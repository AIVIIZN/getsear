import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { getValorClient } from '@/lib/payments/valor-client-loader'

const incrementSchema = z.object({
  additional_amount_cents: z.number().int().min(100).max(50000),
})

/**
 * POST /api/payments/preauth/[id]/increment — incremental auth on existing pre-auth
 *
 * Used when a bar tab's running total approaches the current auth limit.
 * Increases the authorization hold without requiring a new card read.
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

  const parsed = incrementSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { additional_amount_cents } = parsed.data
  const supabase = createAdminClient()

  // Find the payment by processor_transaction_id
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
  const processorResponse = paymentData.processor_response as Record<string, unknown> | null
  const currentAuthCents = (processorResponse?.auth_amount_cents as number) ??
    Math.round(parseFloat(paymentData.total_amount as string) * 100)

  // Call Valor incremental auth
  const valor = getValorClient()
  const result = await valor.incrementalAuth({
    transaction_id: transactionId,
    additional_amount_cents,
  })

  if (!result.success) {
    return apiError(502, 'Incremental authorization failed')
  }

  const newAuthAmount = currentAuthCents + additional_amount_cents

  // Update payment record
  const { data: updated, error: updateErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .update({
      amount: (newAuthAmount / 100).toFixed(2),
      total_amount: (newAuthAmount / 100).toFixed(2),
      processor_response: {
        ...processorResponse,
        auth_amount_cents: newAuthAmount,
        incremental_auths: [
          ...((processorResponse?.incremental_auths as unknown[]) ?? []),
          {
            additional_cents: additional_amount_cents,
            new_total_cents: newAuthAmount,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    })
    .eq('id', paymentData.id)
    .select()
    .single()

  if (updateErr) {
    return apiError(500, 'Failed to update payment record')
  }

  return NextResponse.json({
    data: {
      transaction_id: transactionId,
      previous_auth_cents: currentAuthCents,
      additional_cents: additional_amount_cents,
      new_auth_cents: newAuthAmount,
      payment: updated,
    },
  })
}
