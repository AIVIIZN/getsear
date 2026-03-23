import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { getValorClient } from '@/lib/payments/valor-client-loader'

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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = captureSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
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
    return NextResponse.json(
      { error: 'Active pre-authorization not found' },
      { status: 404 }
    )
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
    return NextResponse.json(
      { error: 'Capture failed at processor' },
      { status: 502 }
    )
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
    return NextResponse.json(
      { error: 'Failed to update payment record' },
      { status: 500 }
    )
  }

  // Update order balance
  const orderId = paymentData.order_id as string
  const { data: order } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
    .select('amount_paid, balance_due, total_cents')
    .eq('id', orderId)
    .single()

  if (order) {
    const orderData = order as Record<string, unknown>
    const currentPaid = Math.round(parseFloat((orderData.amount_paid as string) ?? '0') * 100)
    const newPaid = currentPaid + totalCapture
    const totalCents = (orderData.total_cents as number) ?? 0
    const newBalance = Math.max(0, totalCents - newPaid)

    await (supabase.from('orders') as ReturnType<typeof supabase.from>)
      .update({
        amount_paid: (newPaid / 100).toFixed(2),
        balance_due: (newBalance / 100).toFixed(2),
        status: newBalance <= 0 ? 'closed' : 'open',
      })
      .eq('id', orderId)
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
