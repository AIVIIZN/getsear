import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { valorClient } from '@/lib/payments/valor-client'

const tipAdjustSchema = z.object({
  payment_id: z.string().uuid(),
  new_tip_cents: z.number().int().min(0),
})

/**
 * POST /api/payments/tip-adjust
 *
 * Adjust a tip on a captured payment (within the 24-hour adjustment window).
 * Used when a server enters a corrected tip from a signed receipt.
 *
 * For Valor: performs a capture adjustment (if the batch hasn't settled)
 * or logs the adjustment for the next batch.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = tipAdjustSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { payment_id, new_tip_cents } = parsed.data
  const supabase = createAdminClient()

  // Fetch payment
  const { data: payment, error: paymentErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('id', payment_id)
    .eq('org_id', user.org_id)
    .single()

  if (paymentErr || !payment) {
    return apiError(404, 'Payment not found')
  }

  const paymentData = payment as Record<string, unknown>

  // Cannot adjust tips on settled or voided payments
  if (paymentData.status === 'settled') {
    return apiError(400, 'Cannot adjust tip on settled payment. The batch has already been settled.')
  }

  if (paymentData.status === 'voided') {
    return apiError(400, 'Cannot adjust tip on voided payment')
  }

  // Enforce 24-hour adjustment window
  const capturedAt = paymentData.captured_at as string | undefined
  const createdAt = paymentData.created_at as string | undefined
  const paymentTime = capturedAt ?? createdAt
  if (paymentTime) {
    const paymentDate = new Date(paymentTime)
    const now = new Date()
    const hoursSincePayment = (now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60)
    if (hoursSincePayment > 24) {
      return apiError(400, 'Tip adjustment window has expired. Tips can only be adjusted within 24 hours.')
    }
  }

  const originalTipCents = Math.round(parseFloat((paymentData.tip_amount as string) ?? '0') * 100)
  const amountCents = Math.round(parseFloat(paymentData.amount as string) * 100)
  const newTotalCents = amountCents + new_tip_cents

  // Validate tip: warn if > 50% of payment amount
  if (new_tip_cents > amountCents * 0.5) {
    console.warn(
      `[Payments] High tip adjustment alert: payment ${payment_id}, new tip ${new_tip_cents} cents exceeds 50% of ${amountCents} cents`
    )
  }

  // If payment has a processor transaction, attempt capture adjustment via Valor
  const processorTxnId = paymentData.processor_transaction_id as string | undefined
  if (processorTxnId) {
    try {
      const captureResult = await valorClient.capture({
        transaction_id: processorTxnId,
        amount_cents: amountCents,
        tip_cents: new_tip_cents,
      })

      if (!captureResult.success) {
        console.warn(
          `[Payments] Valor tip adjustment capture failed for ${payment_id}. Recording adjustment locally.`
        )
      }
    } catch (err) {
      // Log but don't block the adjustment — the batch settle will pick up the final amount
      console.warn(
        `[Payments] Valor tip adjustment error for ${payment_id}:`,
        err instanceof Error ? err.message : err
      )
    }
  }

  // Create tip adjustment audit record
  await (supabase.from('tip_adjustments') as ReturnType<typeof supabase.from>)
    .insert({
      org_id: user.org_id,
      payment_id,
      order_id: paymentData.order_id,
      server_id: paymentData.processed_by,
      original_tip: (originalTipCents / 100).toFixed(2),
      adjusted_tip: (new_tip_cents / 100).toFixed(2),
      adjusted_by: user.id,
    })

  // Update payment
  const { data: updated, error: updateErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .update({
      tip_amount: (new_tip_cents / 100).toFixed(2),
      total_amount: (newTotalCents / 100).toFixed(2),
    })
    .eq('id', payment_id)
    .select()
    .single()

  if (updateErr) {
    return apiError(500, 'Failed to adjust tip')
  }

  // Update order tip total and amount_paid
  const tipDiff = new_tip_cents - originalTipCents
  if (tipDiff !== 0) {
    const orderId = paymentData.order_id as string
    const { data: order } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
      .select('tip_total, amount_paid, balance_due')
      .eq('id', orderId)
      .single()

    if (order) {
      const orderRecord = order as Record<string, unknown>
      const currentTip = Math.round(parseFloat((orderRecord.tip_total as string) ?? '0') * 100)
      const currentPaid = Math.round(parseFloat((orderRecord.amount_paid as string) ?? '0') * 100)

      await (supabase.from('orders') as ReturnType<typeof supabase.from>)
        .update({
          tip_total: ((currentTip + tipDiff) / 100).toFixed(2),
          amount_paid: ((currentPaid + tipDiff) / 100).toFixed(2),
        })
        .eq('id', orderId)
    }
  }

  return NextResponse.json({ data: updated })
}
