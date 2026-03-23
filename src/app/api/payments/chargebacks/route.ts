import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const submitEvidenceSchema = z.object({
  chargeback_id: z.string().uuid(),
  evidence_type: z.enum(['receipt', 'signed_receipt', 'customer_communication', 'delivery_proof', 'other']),
  evidence_url: z.string().url().optional(),
  evidence_text: z.string().max(5000).optional(),
  notes: z.string().max(1000).optional(),
})

/**
 * GET /api/payments/chargebacks — list chargebacks for location
 *
 * Returns chargeback cases with status, amount, reason, and deadline.
 * Requires manager or owner role.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleCheck = requireRole(user, ['manager', 'admin', 'owner', 'platform_admin'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const status = params.get('status') // 'open', 'evidence_submitted', 'won', 'lost', 'expired'
  const locationId = params.get('location_id')
  const limit = Math.min(parseInt(params.get('limit') ?? '50', 10), 100)
  const offset = parseInt(params.get('offset') ?? '0', 10)

  const supabase = createAdminClient()

  let query = (supabase.from('chargebacks') as ReturnType<typeof supabase.from>)
    .select(`
      id,
      org_id,
      payment_id,
      processor_dispute_id,
      reason_code,
      reason_description,
      amount,
      received_at,
      respond_by,
      status,
      evidence_submitted_at,
      evidence,
      resolved_at,
      resolution,
      created_at,
      updated_at
    `)
    .eq('org_id', user.org_id)
    .order('received_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  // If location filter, we need to join through payments
  // For simplicity, filter after fetch if location_id is specified
  const { data: chargebacks, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch chargebacks' }, { status: 500 })
  }

  const chargebackList = (chargebacks ?? []) as Record<string, unknown>[]

  // If location filter specified, filter by payment's location
  let filteredChargebacks = chargebackList
  if (locationId) {
    const paymentIds = chargebackList
      .map((cb) => cb.payment_id as string)
      .filter(Boolean)

    if (paymentIds.length > 0) {
      const { data: payments } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
        .select('id, location_id')
        .in('id', paymentIds)
        .eq('location_id', locationId)

      const validPaymentIds = new Set(
        ((payments ?? []) as Record<string, unknown>[]).map((p) => p.id as string)
      )

      filteredChargebacks = chargebackList.filter(
        (cb) => !cb.payment_id || validPaymentIds.has(cb.payment_id as string)
      )
    }
  }

  // Add computed fields
  const enriched = filteredChargebacks.map((cb) => {
    const respondBy = new Date(cb.respond_by as string)
    const daysRemaining = Math.max(
      0,
      Math.ceil((respondBy.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    )
    const isUrgent = daysRemaining <= 3
    const cbStatus = cb.status as string

    return {
      ...cb,
      status: cbStatus,
      amount_cents: Math.round(parseFloat(cb.amount as string) * 100),
      days_remaining: daysRemaining,
      is_urgent: isUrgent,
      is_expired: daysRemaining === 0 && cbStatus === 'open',
    }
  })

  // Statistics
  const stats = {
    total: enriched.length,
    open: enriched.filter((cb) => cb.status === 'open').length,
    evidence_submitted: enriched.filter((cb) => cb.status === 'evidence_submitted').length,
    won: enriched.filter((cb) => cb.status === 'won').length,
    lost: enriched.filter((cb) => cb.status === 'lost').length,
    total_amount_cents: enriched.reduce((sum, cb) => sum + cb.amount_cents, 0),
    total_lost_cents: enriched
      .filter((cb) => cb.status === 'lost')
      .reduce((sum, cb) => sum + cb.amount_cents, 0),
  }

  return NextResponse.json({
    data: enriched,
    stats,
    pagination: { limit, offset, total: enriched.length },
  })
}

/**
 * POST /api/payments/chargebacks — submit evidence for a chargeback case
 *
 * Adds evidence to an existing chargeback case and updates its status.
 * Auto-gathers POS data as evidence (receipt, auth code, entry mode).
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

  const parsed = submitEvidenceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { chargeback_id, evidence_type, evidence_url, evidence_text, notes } = parsed.data
  const supabase = createAdminClient()

  // Fetch chargeback
  const { data: chargeback, error: cbErr } = await (supabase.from('chargebacks') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('id', chargeback_id)
    .eq('org_id', user.org_id)
    .single()

  if (cbErr || !chargeback) {
    return NextResponse.json({ error: 'Chargeback case not found' }, { status: 404 })
  }

  const cbData = chargeback as Record<string, unknown>

  // Check if case is still open for evidence
  if (!['open', 'evidence_submitted'].includes(cbData.status as string)) {
    return NextResponse.json(
      { error: 'Chargeback case is no longer accepting evidence' },
      { status: 400 }
    )
  }

  // Check deadline
  const respondBy = new Date(cbData.respond_by as string)
  if (respondBy < new Date()) {
    return NextResponse.json(
      { error: 'Response deadline has passed' },
      { status: 400 }
    )
  }

  // Auto-gather POS evidence from original payment
  let posEvidence: Record<string, unknown> = {}
  if (cbData.payment_id) {
    const { data: payment } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
      .select('*')
      .eq('id', cbData.payment_id)
      .single()

    if (payment) {
      const paymentData = payment as Record<string, unknown>
      posEvidence = {
        auth_code: paymentData.auth_code,
        card_last_four: paymentData.card_last_four,
        card_brand: paymentData.card_brand,
        amount: paymentData.total_amount,
        processed_at: paymentData.processed_at,
        payment_method: paymentData.payment_method,
        processor_transaction_id: paymentData.processor_transaction_id,
      }

      // Get order details
      const { data: order } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
        .select('id, order_number, order_type, subtotal_cents, tax_cents, total_cents, created_at')
        .eq('id', paymentData.order_id)
        .single()

      if (order) {
        posEvidence.order = order
      }
    }
  }

  // Build evidence payload
  const existingEvidence = (cbData.evidence as Record<string, unknown>[]) ?? []
  const newEvidence = {
    type: evidence_type,
    url: evidence_url ?? null,
    text: evidence_text ?? null,
    notes: notes ?? null,
    submitted_by: user.id,
    submitted_at: new Date().toISOString(),
    pos_data: posEvidence,
  }

  const updatedEvidence = [...existingEvidence, newEvidence]

  // Update chargeback
  const { data: updated, error: updateErr } = await (supabase.from('chargebacks') as ReturnType<typeof supabase.from>)
    .update({
      status: 'evidence_submitted',
      evidence: updatedEvidence,
      evidence_submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', chargeback_id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to submit evidence' }, { status: 500 })
  }

  // Audit trail
  await (supabase.from('audit_log') as ReturnType<typeof supabase.from>)
    .insert({
      org_id: user.org_id,
      user_id: user.id,
      action: 'chargeback_evidence_submitted',
      entity_type: 'chargeback',
      entity_id: chargeback_id,
      details: {
        evidence_type,
        amount: cbData.amount,
        reason_code: cbData.reason_code,
      },
    })

  return NextResponse.json({ data: updated })
}
