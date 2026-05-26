import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateChargebackSchema = z.object({
  status: z.enum(['open', 'evidence_submitted', 'won', 'lost', 'expired']).optional(),
  resolution: z.enum(['won', 'lost', 'accepted']).optional(),
  notes: z.string().max(2000).optional(),
})

/**
 * GET /api/payments/chargebacks/[id] — get single chargeback case with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleCheck = requireRole(user, ['manager', 'admin', 'owner', 'platform_admin'])
  if (roleCheck) return roleCheck

  const { id } = await params
  const supabase = createAdminClient()

  // Fetch chargeback
  const { data: chargeback, error: cbErr } = await (supabase.from('chargebacks') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (cbErr || !chargeback) {
    return apiError(404, 'Chargeback case not found')
  }

  const cbData = chargeback as Record<string, unknown>

  // Fetch original payment details
  let paymentDetails: Record<string, unknown> | null = null
  let orderDetails: Record<string, unknown> | null = null

  if (cbData.payment_id) {
    const { data: payment } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
      .select('id, order_id, payment_method, amount, tip_amount, total_amount, card_last_four, card_brand, auth_code, processor_transaction_id, processed_at, processed_by')
      .eq('id', cbData.payment_id)
      .single()

    if (payment) {
      paymentDetails = payment as Record<string, unknown>

      // Fetch order
      const { data: order } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
        .select('id, order_number, order_type, table_name, subtotal_cents, tax_cents, total_cents, created_at')
        .eq('id', paymentDetails.order_id as string)
        .single()

      if (order) {
        orderDetails = order as Record<string, unknown>
      }

      // Fetch server name
      if (paymentDetails.processed_by) {
        const { data: serverUser } = await (supabase.from('users') as ReturnType<typeof supabase.from>)
          .select('id, first_name, last_name')
          .eq('id', paymentDetails.processed_by)
          .single()

        if (serverUser) {
          const userData = serverUser as Record<string, unknown>
          paymentDetails.server_name = `${userData.first_name} ${userData.last_name}`
        }
      }
    }
  }

  // Compute deadline info
  const respondBy = new Date(cbData.respond_by as string)
  const daysRemaining = Math.max(
    0,
    Math.ceil((respondBy.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  )

  return NextResponse.json({
    data: {
      ...cbData,
      amount_cents: Math.round(parseFloat(cbData.amount as string) * 100),
      days_remaining: daysRemaining,
      is_urgent: daysRemaining <= 3,
      is_expired: daysRemaining === 0 && cbData.status === 'open',
      original_payment: paymentDetails,
      original_order: orderDetails,
    },
  })
}

/**
 * PATCH /api/payments/chargebacks/[id] — update chargeback case status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleCheck = requireRole(user, ['manager', 'admin', 'owner', 'platform_admin'])
  if (roleCheck) return roleCheck

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = updateChargebackSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Verify chargeback exists
  const { data: existing } = await (supabase.from('chargebacks') as ReturnType<typeof supabase.from>)
    .select('id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!existing) {
    return apiError(404, 'Chargeback case not found')
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.status) {
    updateData.status = parsed.data.status
  }

  if (parsed.data.resolution) {
    updateData.resolution = parsed.data.resolution
    updateData.resolved_at = new Date().toISOString()
  }

  const { data: updated, error: updateErr } = await (supabase.from('chargebacks') as ReturnType<typeof supabase.from>)
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (updateErr) {
    return apiError(500, 'Failed to update chargeback')
  }

  // Audit trail
  await (supabase.from('audit_log') as ReturnType<typeof supabase.from>)
    .insert({
      org_id: user.org_id,
      user_id: user.id,
      action: 'chargeback_updated',
      entity_type: 'chargeback',
      entity_id: id,
      details: {
        changes: parsed.data,
      },
    })

  return NextResponse.json({ data: updated })
}
