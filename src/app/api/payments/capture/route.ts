import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { valorMock } from '@/lib/payments/valor-mock'

const captureSchema = z.object({
  payment_id: z.string().uuid(),
  tip_cents: z.number().int().min(0).optional().default(0),
})

/**
 * POST /api/payments/capture — capture a pre-authorized payment
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

  const parsed = captureSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { payment_id, tip_cents } = parsed.data
  const supabase = createAdminClient()

  const { data: payment, error: paymentErr } = await (supabase.from('payments') as any)
    .select('*')
    .eq('id', payment_id)
    .eq('org_id', user.org_id)
    .single()

  if (paymentErr || !payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  if (payment.status !== 'authorized') {
    return NextResponse.json({ error: 'Payment is not in authorized status' }, { status: 400 })
  }

  const amountCents = Math.round(parseFloat(payment.amount) * 100)
  const captureResult = await valorMock.capture({
    transaction_id: payment.processor_transaction_id ?? '',
    amount_cents: amountCents,
    tip_cents,
  })

  if (!captureResult.success) {
    return NextResponse.json({ error: 'Capture failed' }, { status: 500 })
  }

  const totalCents = amountCents + tip_cents

  const { data: updated, error: updateErr } = await (supabase.from('payments') as any)
    .update({
      status: 'captured',
      tip_amount: (tip_cents / 100).toFixed(2),
      total_amount: (totalCents / 100).toFixed(2),
      processor_response: captureResult,
    })
    .eq('id', payment_id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 })
  }

  // Update order if tip was added
  if (tip_cents > 0) {
    await (supabase.from('orders') as any)
      .update({
        tip_total: (tip_cents / 100).toFixed(2),
      })
      .eq('id', payment.order_id)
  }

  return NextResponse.json({ data: updated })
}
