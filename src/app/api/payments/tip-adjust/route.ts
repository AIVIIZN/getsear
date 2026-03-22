import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const tipAdjustSchema = z.object({
  payment_id: z.string().uuid(),
  new_tip_cents: z.number().int().min(0),
})

/**
 * POST /api/payments/tip-adjust — adjust tip after signing
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

  const parsed = tipAdjustSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { payment_id, new_tip_cents } = parsed.data
  const supabase = createAdminClient()

  const { data: payment, error: paymentErr } = await (supabase.from('payments') as any)
    .select('*')
    .eq('id', payment_id)
    .eq('org_id', user.org_id)
    .single()

  if (paymentErr || !payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  if (payment.status === 'settled') {
    return NextResponse.json(
      { error: 'Cannot adjust tip on settled payment' },
      { status: 400 }
    )
  }

  const originalTipCents = Math.round(parseFloat(payment.tip_amount ?? '0') * 100)
  const amountCents = Math.round(parseFloat(payment.amount) * 100)
  const newTotalCents = amountCents + new_tip_cents

  // Create tip adjustment record
  await (supabase.from('tip_adjustments') as any)
    .insert({
      payment_id,
      original_tip: (originalTipCents / 100).toFixed(2),
      new_tip: (new_tip_cents / 100).toFixed(2),
      adjusted_by: user.id,
    })

  // Update payment
  const { data: updated, error: updateErr } = await (supabase.from('payments') as any)
    .update({
      tip_amount: (new_tip_cents / 100).toFixed(2),
      total_amount: (newTotalCents / 100).toFixed(2),
    })
    .eq('id', payment_id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to adjust tip' }, { status: 500 })
  }

  // Update order tip total
  const tipDiff = new_tip_cents - originalTipCents
  if (tipDiff !== 0) {
    const { data: order } = await (supabase.from('orders') as any)
      .select('tip_total, amount_paid, balance_due')
      .eq('id', payment.order_id)
      .single()

    if (order) {
      const currentTip = Math.round(parseFloat(order.tip_total ?? '0') * 100)
      const currentPaid = Math.round(parseFloat(order.amount_paid ?? '0') * 100)

      await (supabase.from('orders') as any)
        .update({
          tip_total: ((currentTip + tipDiff) / 100).toFixed(2),
          amount_paid: ((currentPaid + tipDiff) / 100).toFixed(2),
        })
        .eq('id', payment.order_id)
    }
  }

  return NextResponse.json({ data: updated })
}
