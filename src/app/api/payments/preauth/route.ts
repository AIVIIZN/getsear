import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { getValorClient } from '@/lib/payments/valor-client-loader'

const preauthSchema = z.object({
  order_id: z.string().uuid(),
  terminal_id: z.string().uuid(),
  amount_cents: z.number().int().min(100).max(50000).optional(),
})

/**
 * POST /api/payments/preauth — open a pre-auth on Valor for bar tab
 *
 * Initiates a pre-authorization hold on a card via the Valor terminal.
 * Stores only the token reference (last 4 + brand), NEVER full PAN.
 * Default pre-auth amount comes from location settings, fallback $50.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = preauthSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { order_id, terminal_id, amount_cents } = parsed.data
  const supabase = createAdminClient()

  // Verify order exists and belongs to org
  const { data: order, error: orderErr } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
    .select('id, org_id, location_id, order_type, status')
    .eq('id', order_id)
    .eq('org_id', user.org_id)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const orderData = order as Record<string, unknown>
  const location_id = orderData.location_id as string

  // Determine pre-auth amount
  let preauthAmount = amount_cents ?? 5000 // Default $50

  if (!amount_cents) {
    // Check location settings for default
    const { data: locationSettings } = await (supabase.from('location_settings') as ReturnType<typeof supabase.from>)
      .select('settings')
      .eq('location_id', location_id)
      .single()

    if (locationSettings) {
      const settings = (locationSettings as Record<string, unknown>).settings as Record<string, unknown>
      if (typeof settings?.default_preauth_cents === 'number') {
        preauthAmount = settings.default_preauth_cents as number
      }
    }
  }

  // Check for existing active pre-auth on this order
  const { data: existingAuth } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('id')
    .eq('order_id', order_id)
    .eq('status', 'authorized')
    .limit(1)

  if (existingAuth && (existingAuth as unknown[]).length > 0) {
    return NextResponse.json(
      { error: 'Order already has an active pre-authorization' },
      { status: 409 }
    )
  }

  // Send pre-auth to Valor
  const valor = getValorClient()
  const authResult = await valor.preauth({
    amount_cents: preauthAmount,
    order_id,
    terminal_id,
  })

  // Create payment record — token reference only, NEVER full PAN
  const paymentRecord = {
    org_id: user.org_id,
    location_id,
    order_id,
    payment_method: 'credit_card',
    amount: (preauthAmount / 100).toFixed(2),
    tip_amount: '0.00',
    total_amount: (preauthAmount / 100).toFixed(2),
    status: authResult.success ? 'authorized' : 'declined',
    card_last_four: authResult.card_last_four,
    card_brand: authResult.card_brand,
    auth_code: authResult.auth_code,
    processor_transaction_id: authResult.transaction_id,
    processor_response: {
      type: 'preauth',
      auth_amount_cents: preauthAmount,
      is_bar_tab: true,
      terminal_id,
      card_last_four: authResult.card_last_four,
      card_brand: authResult.card_brand,
    },
    processed_by: user.id,
  }

  const { data: payment, error: paymentInsertErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .insert(paymentRecord)
    .select()
    .single()

  if (paymentInsertErr) {
    return NextResponse.json(
      { error: 'Failed to create pre-auth record' },
      { status: 500 }
    )
  }

  if (!authResult.success) {
    return NextResponse.json(
      {
        error: 'Pre-authorization declined',
        reason: authResult.decline_reason,
        data: payment,
      },
      { status: 402 }
    )
  }

  // Update order status to open if draft
  if (orderData.status === 'draft') {
    await (supabase.from('orders') as ReturnType<typeof supabase.from>)
      .update({ status: 'open' })
      .eq('id', order_id)
  }

  return NextResponse.json(
    {
      data: {
        payment_id: (payment as Record<string, unknown>).id,
        transaction_id: authResult.transaction_id,
        auth_amount_cents: preauthAmount,
        card_last_four: authResult.card_last_four,
        card_brand: authResult.card_brand,
        token_reference: authResult.transaction_id,
      },
    },
    { status: 201 }
  )
}
