import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { valorClient } from '@/lib/payments/valor-client'

const captureSchema = z.object({
  payment_id: z.string().uuid(),
  tip_cents: z.number().int().min(0).optional().default(0),
})

/**
 * POST /api/payments/capture
 *
 * Captures a previously authorized card payment (tip-on-receipt flow).
 * Accepts the tip amount from the signed receipt and captures at
 * final_amount = auth_amount + tip.
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

  // Fetch the payment
  const { data: payment, error: paymentErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('id', payment_id)
    .eq('org_id', user.org_id)
    .single()

  if (paymentErr || !payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  const paymentData = payment as Record<string, unknown>

  if (paymentData.status !== 'authorized') {
    return NextResponse.json(
      { error: 'Payment is not in authorized status. Only pre-authorized payments can be captured.' },
      { status: 400 }
    )
  }

  const processorTxnId = (paymentData.processor_transaction_id as string) ?? ''
  const amountCents = Math.round(parseFloat(paymentData.amount as string) * 100)

  // Validate tip: warn if > 50% of payment amount (fraud prevention)
  if (tip_cents > amountCents * 0.5) {
    // Still allow it, but log for manager review
    console.warn(
      `[Payments] High tip alert: payment ${payment_id}, tip ${tip_cents} cents exceeds 50% of ${amountCents} cents`
    )
  }

  // Call Valor to capture with tip
  let captureResult
  try {
    captureResult = await valorClient.capture({
      transaction_id: processorTxnId,
      amount_cents: amountCents,
      tip_cents,
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Capture request failed'
    return NextResponse.json(
      { error: 'Capture failed', reason: errorMessage },
      { status: 500 }
    )
  }

  if (!captureResult.success) {
    return NextResponse.json(
      { error: 'Capture failed at processor' },
      { status: 500 }
    )
  }

  const totalCents = amountCents + tip_cents

  // Update payment record
  const { data: updated, error: updateErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .update({
      status: 'captured',
      tip_amount: (tip_cents / 100).toFixed(2),
      total_amount: (totalCents / 100).toFixed(2),
      processor_response: captureResult,
      captured_at: new Date().toISOString(),
    })
    .eq('id', payment_id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json(
      { error: 'Failed to update payment record' },
      { status: 500 }
    )
  }

  // Update order totals
  const orderId = paymentData.order_id as string

  // Fetch current order state
  const { data: orderData } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
    .select('tip_total, amount_paid, balance_due, total')
    .eq('id', orderId)
    .single()

  if (orderData) {
    const orderRecord = orderData as Record<string, unknown>
    const currentTip = Math.round(parseFloat((orderRecord.tip_total as string) ?? '0') * 100)
    const currentPaid = Math.round(parseFloat((orderRecord.amount_paid as string) ?? '0') * 100)
    const currentBalance = Math.round(
      parseFloat((orderRecord.balance_due as string) ?? (orderRecord.total as string) ?? '0') * 100
    )

    // The auth amount was already "reserved" but not counted as paid.
    // Now that we've captured, add the full amount (including tip) to paid.
    const newPaid = currentPaid + totalCents
    const newBalance = Math.max(0, currentBalance - totalCents)

    const orderUpdate: Record<string, unknown> = {
      tip_total: ((currentTip + tip_cents) / 100).toFixed(2),
      amount_paid: (newPaid / 100).toFixed(2),
      balance_due: (newBalance / 100).toFixed(2),
    }

    // Close order if fully paid
    if (newBalance === 0) {
      orderUpdate.status = 'closed'
    }

    await (supabase.from('orders') as ReturnType<typeof supabase.from>)
      .update(orderUpdate)
      .eq('id', orderId)
  }

  return NextResponse.json({ data: updated })
}
