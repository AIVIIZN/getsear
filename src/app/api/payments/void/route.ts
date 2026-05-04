import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getValorClient } from '@/lib/payments/valor-client-loader'
import { validateManagerPin } from '@/lib/auth/manager-pin'
import { audit } from '@/lib/audit/log'
import { checkRateLimit, applyRateLimitHeaders, getClientIp } from '@/lib/api/rate-limit'

const VOID_REASON_CODES = [
  'customer_request',
  'wrong_amount',
  'duplicate_charge',
  'fraud_suspected',
  'other',
] as const

const voidSchema = z.object({
  payment_id: z.string().uuid(),
  reason: z.enum(VOID_REASON_CODES),
  reason_detail: z.string().max(500).optional(),
  // PIN is REQUIRED for every actor — see SECURITY note on the route handler.
  manager_pin: z.string().min(4).max(8),
})

/**
 * POST /api/payments/void — void a transaction before batch settlement
 *
 * SECURITY (V5.99.7 + cycle-2):
 *   - Manager-PIN ALWAYS required for EVERY actor — including managers, admins,
 *     owners, and platform_admins. There is NO self-authorise path. A stolen
 *     manager session must still satisfy the PIN gate. This produces a uniform
 *     audit-log shape: `manager_pin_user_id` is always populated, downstream
 *     dashboards can pivot on it without a NULL branch.
 *   - The PIN can be the manager's own — they pass their own PIN through the
 *     same `validateManagerPin` path. The verified user_id is recorded in
 *     `audit_log.manager_pin_user_id`.
 *   - Replaces legacy `audit_log.details:` insert with audit.record(...) so the
 *     before/after_state and manager_pin_user_id are captured.
 *   - Rate-limited at the payment tier (20/min per actor).
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  // Servers can void small amounts; managers+ can void any amount
  const allowedRoles = ['server', 'bartender', 'cashier', 'manager', 'admin', 'owner', 'platform_admin']
  const roleCheck = requireRole(user, allowedRoles)
  if (roleCheck) return roleCheck

  // Rate-limit payment-mutating endpoints
  const rl = await checkRateLimit('payment', user.id)
  if (!rl.allowed) {
    const res = NextResponse.json(
      { error: 'Too many payment operations. Slow down.' },
      { status: 429 }
    )
    applyRateLimitHeaders(res.headers, rl)
    res.headers.set('Retry-After', String(rl.retryAfterSeconds))
    return res
  }
  // Per-IP secondary limit so a compromised account can't be a single-source DoS
  await checkRateLimit('payment', `ip:${getClientIp(request)}`)

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

  const { payment_id, reason, reason_detail, manager_pin } = parsed.data
  const supabase = createAdminClient()

  // Fetch payment
  const { data: payment, error: paymentErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('id', payment_id)
    .eq('org_id', user.org_id)
    .single()

  if (paymentErr || !payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  const paymentData = payment as Record<string, unknown>

  // Only void authorized or captured (unsettled) transactions
  if (!['authorized', 'captured'].includes(paymentData.status as string)) {
    return NextResponse.json(
      { error: 'Payment cannot be voided in current status. Only authorized or captured (unsettled) payments can be voided.' },
      { status: 400 }
    )
  }

  // Check if already settled
  if (paymentData.status === 'settled') {
    return NextResponse.json(
      { error: 'Payment has been settled. Use refund instead of void.' },
      { status: 400 }
    )
  }

  const totalCents = Math.round(parseFloat(paymentData.total_amount as string) * 100)

  // -------- Manager-PIN ALWAYS required (no self-authorise) ----------------
  // Even managers/owners must enter a PIN — that produces a uniformly
  // populated `manager_pin_user_id` for downstream audit queries and means a
  // stolen manager session can't be used to void without the second factor.
  // The PIN may be the manager's own; verifyManagerPin returns the matching
  // active-manager user id which is recorded as the authoriser.
  // (Zod has already enforced manager_pin presence + 4-8 digit length.)
  const managerPinUserId = await validateManagerPin(supabase, user.org_id, manager_pin)
  if (!managerPinUserId) {
    return NextResponse.json(
      { error: 'Invalid manager PIN' },
      { status: 403 }
    )
  }

  // Call Valor void API for card payments
  const isCard = ['credit_card', 'debit_card', 'apple_pay', 'google_pay'].includes(
    paymentData.payment_method as string
  )

  if (isCard && paymentData.processor_transaction_id) {
    const valor = getValorClient()
    const voidResult = await valor.void({
      transaction_id: paymentData.processor_transaction_id as string,
    })

    if (!voidResult.success) {
      return NextResponse.json(
        { error: 'Void failed at processor. The transaction may have already been settled.' },
        { status: 502 }
      )
    }
  }

  // -------- Capture before-state ----------------------------------------
  const beforeState = {
    id: payment_id,
    status: paymentData.status,
    total_amount: paymentData.total_amount,
    payment_method: paymentData.payment_method,
    order_id: paymentData.order_id,
  }

  // Update payment status
  const voidedAt = new Date().toISOString()
  const { data: updated, error: updateErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .update({
      status: 'voided',
      refund_reason: `${reason}${reason_detail ? ': ' + reason_detail : ''}`,
      refunded_by: user.id,
      refunded_at: voidedAt,
      processor_response: {
        ...(paymentData.processor_response as Record<string, unknown>),
        void: {
          reason,
          reason_detail: reason_detail ?? null,
          voided_by: user.id,
          voided_at: voidedAt,
          authorised_by_manager_id: managerPinUserId,
        },
      },
    })
    .eq('id', payment_id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update payment record' }, { status: 500 })
  }

  // Restore order balance — reopen the check
  const { data: order } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
    .select('amount_paid, balance_due, total_cents')
    .eq('id', paymentData.order_id)
    .eq('org_id', user.org_id)
    .single()

  if (order) {
    const orderData = order as Record<string, unknown>
    const currentPaid = Math.round(parseFloat((orderData.amount_paid as string) ?? '0') * 100)
    const orderTotal = (orderData.total_cents as number) ?? 0

    const newPaid = Math.max(0, currentPaid - totalCents)
    const newBalance = Math.max(0, orderTotal - newPaid)

    await (supabase.from('orders') as ReturnType<typeof supabase.from>)
      .update({
        amount_paid: (newPaid / 100).toFixed(2),
        balance_due: (newBalance / 100).toFixed(2),
        status: 'open',
      })
      .eq('id', paymentData.order_id)
      .eq('org_id', user.org_id)
  }

  // -------- Audit (canonical) -------------------------------------------
  await audit.record({
    actor: user,
    manager_pin_user_id: managerPinUserId,
    action: 'payment_voided',
    entity_type: 'payment',
    entity_id: payment_id,
    description: `Voided $${(totalCents / 100).toFixed(2)} payment (${reason})`,
    before_state: beforeState,
    after_state: {
      status: 'voided',
      refund_reason: `${reason}${reason_detail ? ': ' + reason_detail : ''}`,
      voided_at: voidedAt,
      total_amount: paymentData.total_amount,
    },
    reason: reason_detail ?? reason,
    location_id: (paymentData.location_id as string | null) ?? null,
    request,
  })

  const res = NextResponse.json({ data: updated })
  applyRateLimitHeaders(res.headers, rl)
  return res
}
