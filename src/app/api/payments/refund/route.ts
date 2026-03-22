import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { valorMock } from '@/lib/payments/valor-mock'

const refundSchema = z.object({
  payment_id: z.string().uuid(),
  amount_cents: z.number().int().min(1),
  reason: z.string().min(1).max(500),
})

/**
 * POST /api/payments/refund — full or partial refund
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleCheck = requireRole(user, ['manager', 'admin', 'owner', 'platform_admin'])
  if (roleCheck) return roleCheck

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = refundSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { payment_id, amount_cents, reason } = parsed.data
  const supabase = createAdminClient()

  const { data: payment, error: paymentErr } = await (supabase.from('payments') as any)
    .select('*')
    .eq('id', payment_id)
    .eq('org_id', user.org_id)
    .single()

  if (paymentErr || !payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  if (!['captured', 'settled'].includes(payment.status)) {
    return NextResponse.json(
      { error: 'Payment cannot be refunded in current status' },
      { status: 400 }
    )
  }

  const totalCents = Math.round(parseFloat(payment.total_amount) * 100)
  const existingRefund = Math.round(parseFloat(payment.refund_amount ?? '0') * 100)

  if (amount_cents + existingRefund > totalCents) {
    return NextResponse.json(
      { error: 'Refund amount exceeds payment total' },
      { status: 400 }
    )
  }

  // Process refund via Valor if card payment
  const isCard = ['credit_card', 'debit_card', 'apple_pay', 'google_pay'].includes(payment.payment_method)
  if (isCard && payment.processor_transaction_id) {
    const refundResult = await valorMock.refund({
      transaction_id: payment.processor_transaction_id,
      amount_cents,
    })

    if (!refundResult.success) {
      return NextResponse.json({ error: 'Refund failed at processor' }, { status: 500 })
    }
  }

  const newRefundTotal = existingRefund + amount_cents
  const isFullRefund = newRefundTotal >= totalCents

  const { data: updated, error: updateErr } = await (supabase.from('payments') as any)
    .update({
      status: isFullRefund ? 'refunded' : payment.status,
      refund_amount: (newRefundTotal / 100).toFixed(2),
      refund_reason: reason,
      refunded_by: user.id,
      refunded_at: new Date().toISOString(),
    })
    .eq('id', payment_id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 })
  }

  // Restore order balance for refund amount
  const { data: order } = await (supabase.from('orders') as any)
    .select('amount_paid, balance_due')
    .eq('id', payment.order_id)
    .single()

  if (order) {
    const currentPaid = Math.round(parseFloat(order.amount_paid ?? '0') * 100)
    const currentBalance = Math.round(parseFloat(order.balance_due ?? '0') * 100)

    await (supabase.from('orders') as any)
      .update({
        amount_paid: (Math.max(0, currentPaid - amount_cents) / 100).toFixed(2),
        balance_due: ((currentBalance + amount_cents) / 100).toFixed(2),
        status: isFullRefund ? 'refunded' : 'open',
      })
      .eq('id', payment.order_id)
  }

  return NextResponse.json({ data: updated })
}
