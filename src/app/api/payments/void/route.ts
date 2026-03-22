import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { valorMock } from '@/lib/payments/valor-mock'

const voidSchema = z.object({
  payment_id: z.string().uuid(),
  reason: z.string().min(1).max(500),
})

/**
 * POST /api/payments/void — void a payment (before settlement)
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

  const parsed = voidSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { payment_id, reason } = parsed.data
  const supabase = createAdminClient()

  const { data: payment, error: paymentErr } = await (supabase.from('payments') as any)
    .select('*')
    .eq('id', payment_id)
    .eq('org_id', user.org_id)
    .single()

  if (paymentErr || !payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  if (!['authorized', 'captured'].includes(payment.status)) {
    return NextResponse.json(
      { error: 'Payment cannot be voided in current status' },
      { status: 400 }
    )
  }

  // Void via Valor if card payment
  const isCard = ['credit_card', 'debit_card', 'apple_pay', 'google_pay'].includes(payment.payment_method)
  if (isCard && payment.processor_transaction_id) {
    const voidResult = await valorMock.void({
      transaction_id: payment.processor_transaction_id,
    })

    if (!voidResult.success) {
      return NextResponse.json({ error: 'Void failed at processor' }, { status: 500 })
    }
  }

  const totalCents = Math.round(parseFloat(payment.total_amount) * 100)

  const { data: updated, error: updateErr } = await (supabase.from('payments') as any)
    .update({
      status: 'voided',
      refund_reason: reason,
      refunded_by: user.id,
      refunded_at: new Date().toISOString(),
      processor_response: { ...payment.processor_response, void_reason: reason },
    })
    .eq('id', payment_id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to void payment' }, { status: 500 })
  }

  // Restore order balance
  const { data: order } = await (supabase.from('orders') as any)
    .select('amount_paid, balance_due')
    .eq('id', payment.order_id)
    .single()

  if (order) {
    const currentPaid = Math.round(parseFloat(order.amount_paid ?? '0') * 100)
    const currentBalance = Math.round(parseFloat(order.balance_due ?? '0') * 100)

    await (supabase.from('orders') as any)
      .update({
        amount_paid: (Math.max(0, currentPaid - totalCents) / 100).toFixed(2),
        balance_due: ((currentBalance + totalCents) / 100).toFixed(2),
        status: 'open',
      })
      .eq('id', payment.order_id)
  }

  return NextResponse.json({ data: updated })
}
