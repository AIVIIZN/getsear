import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { getValorClient } from '@/lib/payments/valor-client-loader'
import { recalculateGuestIntelligenceForOrder } from '@/lib/crm/intelligence'

const captureSchema = z.object({
  final_amount_cents: z.number().int().min(1),
  tip_cents: z.number().int().min(0).default(0),
})

/**
 * POST /api/payments/preauth/[id]/capture — final capture with tip (closing the tab)
 *
 * Captures the pre-authorized transaction at the final amount.
 * Any excess authorization above the captured amount is automatically released
 * by the card network.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id: transactionId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = captureSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { final_amount_cents, tip_cents } = parsed.data
  const supabase = createAdminClient()

  // Find the authorized payment
  const { data: payment, error: paymentErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('processor_transaction_id', transactionId)
    .eq('org_id', user.org_id)
    .eq('status', 'authorized')
    .single()

  if (paymentErr || !payment) {
    return apiError(404, 'Active pre-authorization not found')
  }

  const paymentData = payment as Record<string, unknown>
  const totalCapture = final_amount_cents + tip_cents

  // Call Valor capture
  const valor = getValorClient()
  const captureResult = await valor.capture({
    transaction_id: transactionId,
    amount_cents: final_amount_cents,
    tip_cents,
  })

  if (!captureResult.success) {
    return apiError(502, 'Capture failed at processor')
  }

  // Update payment record to captured
  const processorResponse = paymentData.processor_response as Record<string, unknown> | null
  const { data: updated, error: updateErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .update({
      status: 'captured',
      amount: (final_amount_cents / 100).toFixed(2),
      tip_amount: (tip_cents / 100).toFixed(2),
      total_amount: (totalCapture / 100).toFixed(2),
      processor_response: {
        ...processorResponse,
        capture: {
          captured_amount_cents: totalCapture,
          tip_cents,
          captured_at: new Date().toISOString(),
        },
      },
    })
    .eq('id', paymentData.id)
    .select()
    .single()

  if (updateErr) {
    return apiError(500, 'Failed to update payment record')
  }

  // Update order balance
  const orderId = paymentData.order_id as string
  const { data: order } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
    .select('amount_paid, balance_due, total')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (order) {
    const orderData = order as Record<string, unknown>
    const currentPaid = Math.round(parseFloat((orderData.amount_paid as string) ?? '0') * 100)
    const newPaid = currentPaid + totalCapture
    const existingBalance = Math.round(parseFloat(String(orderData.balance_due ?? orderData.total ?? '0')) * 100)
    const newBalance = Math.max(0, existingBalance - totalCapture)

    const orderUpdate: Record<string, unknown> = {
      amount_paid: (newPaid / 100).toFixed(2),
      balance_due: (newBalance / 100).toFixed(2),
      status: newBalance <= 0 ? 'closed' : 'open',
    }
    if (newBalance <= 0) {
      orderUpdate.closed_at = new Date().toISOString()
    }

    await (supabase.from('orders') as ReturnType<typeof supabase.from>)
      .update(orderUpdate)
      .eq('id', orderId)
      .eq('org_id', user.org_id)

    if (newBalance <= 0) {
      await recalculateGuestIntelligenceForOrder({
        db: supabase,
        user,
        orderId,
        request,
      })
    }
  }

  return NextResponse.json({
    data: {
      transaction_id: transactionId,
      captured_amount_cents: totalCapture,
      tip_cents,
      base_amount_cents: final_amount_cents,
      payment: updated,
    },
  })
}
