import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getValorClient } from '@/lib/payments/valor-client-loader'
import { compare } from 'bcryptjs'

const REFUND_REASON_CODES = [
  'customer_request',
  'wrong_amount',
  'food_quality',
  'service_issue',
  'other',
] as const

const refundSchema = z.object({
  payment_id: z.string().uuid(),
  amount_cents: z.number().int().min(1),
  reason: z.enum(REFUND_REASON_CODES),
  reason_detail: z.string().max(500).optional(),
  manager_pin: z.string().min(4).max(8),
  is_unlinked: z.boolean().optional().default(false),
})

/** Maximum refund window in days */
const MAX_REFUND_WINDOW_DAYS = 120

/**
 * POST /api/payments/refund — refund a settled transaction
 *
 * Business rules:
 * - Used after batch has settled (funds already moved)
 * - Supports full or partial refund
 * - All refunds require manager role (or manager PIN from non-manager)
 * - Refunds over $50 require manager PIN validation
 * - Unlinked refunds (different card) ALWAYS require manager approval
 * - Cannot refund more than original captured amount minus previous refunds
 * - 120-day refund window
 * - Creates refund record linked to original transaction
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  // All refunds require at least manager role
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

  const { payment_id, amount_cents, reason, reason_detail, manager_pin, is_unlinked } = parsed.data
  const supabase = createAdminClient()

  // Fetch original payment
  const { data: payment, error: paymentErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('id', payment_id)
    .eq('org_id', user.org_id)
    .single()

  if (paymentErr || !payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  const paymentData = payment as Record<string, unknown>

  // Must be captured or settled to refund
  if (!['captured', 'settled'].includes(paymentData.status as string)) {
    return NextResponse.json(
      { error: 'Payment cannot be refunded in current status. Only captured or settled payments can be refunded.' },
      { status: 400 }
    )
  }

  // Check refund window (120 days)
  const paymentDate = new Date(paymentData.processed_at as string)
  const daysSincePayment = (Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSincePayment > MAX_REFUND_WINDOW_DAYS) {
    return NextResponse.json(
      { error: `Transaction exceeds ${MAX_REFUND_WINDOW_DAYS}-day refund window` },
      { status: 400 }
    )
  }

  // Check refund amount against remaining refundable amount
  const totalCents = Math.round(parseFloat(paymentData.total_amount as string) * 100)
  const existingRefundCents = Math.round(parseFloat((paymentData.refund_amount as string) ?? '0') * 100)
  const maxRefundable = totalCents - existingRefundCents

  if (amount_cents > maxRefundable) {
    return NextResponse.json(
      {
        error: 'Refund amount exceeds refundable balance',
        max_refundable_cents: maxRefundable,
        existing_refund_cents: existingRefundCents,
      },
      { status: 400 }
    )
  }

  // Validate manager PIN (always required for refunds)
  const { data: managers } = await (supabase.from('users') as ReturnType<typeof supabase.from>)
    .select('id, pin_hash')
    .eq('org_id', user.org_id)
    .in('role', ['manager', 'admin', 'owner'])

  let pinValid = false
  let approvedByManagerId: string | null = null
  if (managers) {
    for (const mgr of managers as Record<string, unknown>[]) {
      if (mgr.pin_hash && typeof mgr.pin_hash === 'string') {
        const matches = await compare(manager_pin, mgr.pin_hash)
        if (matches) {
          pinValid = true
          approvedByManagerId = mgr.id as string
          break
        }
      }
    }
  }

  if (!pinValid) {
    return NextResponse.json(
      { error: 'Invalid manager PIN' },
      { status: 403 }
    )
  }

  // Process refund via Valor for card payments
  const isCard = ['credit_card', 'debit_card', 'apple_pay', 'google_pay'].includes(
    paymentData.payment_method as string
  )

  if (isCard && paymentData.processor_transaction_id) {
    const valor = getValorClient()
    const refundResult = await valor.refund({
      transaction_id: paymentData.processor_transaction_id as string,
      amount_cents,
    })

    if (!refundResult.success) {
      return NextResponse.json(
        { error: 'Refund failed at processor' },
        { status: 502 }
      )
    }
  }

  // Calculate new refund totals
  const newRefundTotal = existingRefundCents + amount_cents
  const isFullRefund = newRefundTotal >= totalCents
  const newStatus = isFullRefund ? 'refunded' : paymentData.status

  // Update original payment record
  const { data: updated, error: updateErr } = await (supabase.from('payments') as ReturnType<typeof supabase.from>)
    .update({
      status: newStatus,
      refund_amount: (newRefundTotal / 100).toFixed(2),
      refund_reason: `${reason}${reason_detail ? ': ' + reason_detail : ''}`,
      refunded_by: user.id,
      refunded_at: new Date().toISOString(),
      processor_response: {
        ...(paymentData.processor_response as Record<string, unknown>),
        refunds: [
          ...((paymentData.processor_response as Record<string, unknown>)?.refunds as unknown[] ?? []),
          {
            amount_cents,
            reason,
            reason_detail: reason_detail ?? null,
            is_unlinked,
            refunded_by: user.id,
            approved_by: approvedByManagerId,
            refunded_at: new Date().toISOString(),
            is_full_refund: isFullRefund,
          },
        ],
      },
    })
    .eq('id', payment_id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update payment record' }, { status: 500 })
  }

  // Restore order balance
  const { data: order } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
    .select('amount_paid, balance_due, total_cents')
    .eq('id', paymentData.order_id)
    .single()

  if (order) {
    const orderData = order as Record<string, unknown>
    const currentPaid = Math.round(parseFloat((orderData.amount_paid as string) ?? '0') * 100)
    const orderTotal = (orderData.total_cents as number) ?? 0

    const newPaid = Math.max(0, currentPaid - amount_cents)
    const newBalance = Math.max(0, orderTotal - newPaid)

    await (supabase.from('orders') as ReturnType<typeof supabase.from>)
      .update({
        amount_paid: (newPaid / 100).toFixed(2),
        balance_due: (newBalance / 100).toFixed(2),
        status: isFullRefund ? 'refunded' : 'open',
      })
      .eq('id', paymentData.order_id)
  }

  // Create audit trail
  await (supabase.from('audit_log') as ReturnType<typeof supabase.from>)
    .insert({
      org_id: user.org_id,
      location_id: paymentData.location_id,
      user_id: user.id,
      action: isFullRefund ? 'payment_refunded' : 'payment_partially_refunded',
      entity_type: 'payment',
      entity_id: payment_id,
      details: {
        refund_amount_cents: amount_cents,
        total_refunded_cents: newRefundTotal,
        original_amount_cents: totalCents,
        reason,
        reason_detail: reason_detail ?? null,
        is_unlinked,
        is_full_refund: isFullRefund,
        approved_by_manager: approvedByManagerId,
        order_id: paymentData.order_id,
      },
    })

  return NextResponse.json({
    data: {
      ...updated as Record<string, unknown>,
      refund_summary: {
        this_refund_cents: amount_cents,
        total_refunded_cents: newRefundTotal,
        remaining_refundable_cents: totalCents - newRefundTotal,
        is_full_refund: isFullRefund,
      },
    },
  })
}
