import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { valorMock } from '@/lib/payments/valor-mock'

const preauthSchema = z.object({
  order_id: z.string().uuid(),
  location_id: z.string().uuid(),
  amount_cents: z.number().int().min(1).optional().default(5000), // Default $50 pre-auth
})

/**
 * POST /api/payments/preauth — pre-authorize a card (bar tabs)
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

  const { order_id, location_id, amount_cents } = parsed.data
  const supabase = createAdminClient()

  // Verify order exists
  const { data: order, error: orderErr } = await (supabase.from('orders') as any)
    .select('id, org_id')
    .eq('id', order_id)
    .eq('org_id', user.org_id)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Pre-auth via Valor mock
  const authResult = await valorMock.preauth({
    amount_cents,
    order_id,
  })

  const paymentRecord: Record<string, unknown> = {
    org_id: user.org_id,
    location_id,
    order_id,
    payment_method: 'credit_card',
    amount: (amount_cents / 100).toFixed(2),
    tip_amount: '0.00',
    total_amount: (amount_cents / 100).toFixed(2),
    status: authResult.success ? 'authorized' : 'declined',
    card_last_four: authResult.card_last_four,
    card_brand: authResult.card_brand,
    reference_number: authResult.auth_code,
    processor_transaction_id: authResult.transaction_id,
    processor_response: authResult,
    processed_by: user.id,
  }

  const { data: payment, error: paymentErr } = await (supabase.from('payments') as any)
    .insert(paymentRecord)
    .select()
    .single()

  if (paymentErr) {
    return NextResponse.json({ error: 'Failed to create pre-auth record' }, { status: 500 })
  }

  if (!authResult.success) {
    return NextResponse.json(
      { error: 'Pre-authorization declined', reason: authResult.decline_reason, data: payment },
      { status: 402 }
    )
  }

  return NextResponse.json({ data: payment }, { status: 201 })
}
