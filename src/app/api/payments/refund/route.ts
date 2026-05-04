import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getValorClient } from '@/lib/payments/valor-client-loader'
import { compare } from 'bcryptjs'
import {
  assertTransition,
  IllegalTransitionError,
  type OrderState,
} from '@/lib/orders/state-machine'
import { assertVersion, bumpVersion } from '@/lib/orders/concurrency'
import { audit } from '@/lib/audit/log'

const REFUND_REASON_CODES = [
  'customer_request',
  'wrong_amount',
  'food_quality',
  'service_issue',
  'tip_adjustment',
  'partial_item_refund',
  'other',
] as const

/**
 * Refund schemas — accept three modes via discriminated union:
 *
 * 1. `amount` mode (legacy): caller supplies an `amount_cents` to refund
 *    against the payment. Used for ad-hoc partial or full refunds.
 * 2. `tip_only` mode (5.4.2): caller supplies `tip_amount_cents` to refund
 *    JUST the tip portion. The non-tip principal stays with the merchant.
 * 3. `items` mode (5.4.2): caller supplies an array of `order_item_ids`
 *    to refund. The route sums their line_totals (incl. tax + modifiers),
 *    refunds that amount, and marks each item as refunded so reports
 *    reflect "3 of 5 items refunded — remaining still owed".
 */
const baseSchema = z.object({
  payment_id: z.string().uuid(),
  reason: z.enum(REFUND_REASON_CODES),
  reason_detail: z.string().max(500).optional(),
  manager_pin: z.string().min(4).max(8),
  is_unlinked: z.boolean().optional().default(false),
})

const amountRefundSchema = baseSchema.extend({
  mode: z.literal('amount').optional(),
  amount_cents: z.number().int().min(1),
})

const tipOnlyRefundSchema = baseSchema.extend({
  mode: z.literal('tip_only'),
  tip_amount_cents: z.number().int().min(1),
})

const itemsRefundSchema = baseSchema.extend({
  mode: z.literal('items'),
  order_item_ids: z.array(z.string().uuid()).min(1),
})

const refundSchema = z.union([amountRefundSchema, tipOnlyRefundSchema, itemsRefundSchema])

/** Maximum refund window in days */
const MAX_REFUND_WINDOW_DAYS = 120

/**
 * POST /api/payments/refund — refund a settled transaction.
 *
 * Modes (5.4.2 expansion):
 * - `amount` (default): refund N cents against the payment.
 * - `tip_only`: refund just the tip portion. Tip line on payment is reduced;
 *   principal (subtotal+tax) remains captured. Use when a guest disputes
 *   the gratuity but is otherwise satisfied.
 * - `items`: refund a list of items by id. Sums their `line_total` (which
 *   already includes per-item tax + modifiers) and refunds that exact
 *   amount. Each refunded item is flagged so the order shows "3 of 5
 *   refunded; balance owed: $X".
 *
 * State machine: drives the order through REFUND (partial) or REFUND_FULL
 * via `assertTransition`, ensuring illegal refunds (e.g. refund of an
 * already-refunded order) throw a clear 422 instead of corrupting state.
 *
 * Optimistic-locking: respects If-Match against the payment row.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  // All refunds require at least manager role.
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

  const { payment_id, reason, reason_detail, manager_pin, is_unlinked } = parsed.data
  const supabase = createAdminClient()

  // ----- 1. Load payment ----------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payment, error: paymentErr } = await (supabase.from('payments') as any)
    .select('*')
    .eq('id', payment_id)
    .eq('org_id', user.org_id)
    .single()

  if (paymentErr || !payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }

  const paymentData = payment as Record<string, unknown>

  if (!['captured', 'settled'].includes(paymentData.status as string)) {
    return NextResponse.json(
      { error: 'Payment cannot be refunded in current status. Only captured or settled payments can be refunded.' },
      { status: 400 }
    )
  }

  // ----- 2. Refund window check --------------------------------------------
  const paymentDate = new Date(paymentData.processed_at as string)
  const daysSincePayment = (Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSincePayment > MAX_REFUND_WINDOW_DAYS) {
    return NextResponse.json(
      { error: `Transaction exceeds ${MAX_REFUND_WINDOW_DAYS}-day refund window` },
      { status: 400 }
    )
  }

  const totalCents = Math.round(parseFloat(paymentData.total_amount as string) * 100)
  const tipCents = Math.round(parseFloat((paymentData.tip_amount as string) ?? '0') * 100)
  const principalCents = totalCents - tipCents
  const existingRefundCents = Math.round(parseFloat((paymentData.refund_amount as string) ?? '0') * 100)
  const maxRefundable = totalCents - existingRefundCents

  // ----- 3. Resolve refund amount based on mode ----------------------------
  let amountCents: number
  let mode: 'amount' | 'tip_only' | 'items' = 'amount'
  let refundedItemIds: string[] = []

  if ('mode' in parsed.data && parsed.data.mode === 'tip_only') {
    mode = 'tip_only'
    amountCents = parsed.data.tip_amount_cents
    if (amountCents > tipCents) {
      return NextResponse.json(
        {
          error: 'Tip refund exceeds payment tip amount',
          payment_tip_cents: tipCents,
          requested_cents: amountCents,
        },
        { status: 400 }
      )
    }
  } else if ('mode' in parsed.data && parsed.data.mode === 'items') {
    mode = 'items'
    refundedItemIds = parsed.data.order_item_ids

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: items } = await (supabase.from('order_items') as any)
      .select('id, line_total, tax_amount, order_id')
      .in('id', refundedItemIds)
      .eq('order_id', paymentData.order_id)

    if (!items || items.length !== refundedItemIds.length) {
      return NextResponse.json(
        { error: 'One or more order_item_ids not found on this order' },
        { status: 404 }
      )
    }

    // Sum line_total (already incl. modifiers) + tax_amount.
    const itemsTotalCents = (items as Array<{ line_total: string; tax_amount: string }>).reduce(
      (acc, it) =>
        acc +
        Math.round(parseFloat(it.line_total) * 100) +
        Math.round(parseFloat(it.tax_amount ?? '0') * 100),
      0
    )
    amountCents = itemsTotalCents
  } else {
    mode = 'amount'
    amountCents = (parsed.data as { amount_cents: number }).amount_cents
  }

  if (amountCents > maxRefundable) {
    return NextResponse.json(
      {
        error: 'Refund amount exceeds refundable balance',
        max_refundable_cents: maxRefundable,
        existing_refund_cents: existingRefundCents,
      },
      { status: 400 }
    )
  }

  // ----- 4. Manager PIN check (always required for refunds) ----------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: managers } = await (supabase.from('users') as any)
    .select('id, pin_hash')
    .eq('org_id', user.org_id)
    .in('role', ['manager', 'admin', 'owner'])

  let pinValid = false
  let approvedByManagerId: string | null = null
  if (managers) {
    for (const mgr of managers as Array<{ id: string; pin_hash: string | null }>) {
      if (mgr.pin_hash) {
        const ok = await compare(manager_pin, mgr.pin_hash)
        if (ok) {
          pinValid = true
          approvedByManagerId = mgr.id
          break
        }
      }
    }
  }

  if (!pinValid) {
    return NextResponse.json({ error: 'Invalid manager PIN' }, { status: 403 })
  }

  // ----- 5. Optimistic-lock check on payment row ----------------------------
  const ifMatchHeader = request.headers.get('If-Match')
  const expectedVersion = ifMatchHeader ? Number(ifMatchHeader) : null
  const versionCheck = await assertVersion(supabase, 'payments', payment_id, expectedVersion)
  if (!versionCheck.ok) {
    return NextResponse.json(
      {
        error: 'Conflict: payment was updated by another terminal',
        current_version: versionCheck.current_version,
        current_state: versionCheck.current_state,
      },
      { status: 409 }
    )
  }

  // ----- 6. Process refund at processor (cards only) ------------------------
  const isCard = ['credit_card', 'debit_card', 'apple_pay', 'google_pay'].includes(
    paymentData.payment_method as string
  )

  if (isCard && paymentData.processor_transaction_id) {
    const valor = getValorClient()
    const refundResult = await valor.refund({
      transaction_id: paymentData.processor_transaction_id as string,
      amount_cents: amountCents,
    })

    if (!refundResult.success) {
      return NextResponse.json(
        { error: 'Refund failed at processor' },
        { status: 502 }
      )
    }
  }

  // ----- 7. Calculate new totals + state-machine event ---------------------
  const newRefundTotal = existingRefundCents + amountCents
  const isFullRefund = newRefundTotal >= totalCents
  const newPaymentStatus = isFullRefund ? 'refunded' : (paymentData.status as string)

  // For tip-only refunds, reduce the recorded tip on the payment too — keeps
  // tip-out reports honest.
  const newTipCents =
    mode === 'tip_only' ? Math.max(0, tipCents - amountCents) : tipCents

  // ----- 8. Update payment row ---------------------------------------------
  const refundEntry = {
    mode,
    amount_cents: amountCents,
    reason,
    reason_detail: reason_detail ?? null,
    is_unlinked,
    refunded_by: user.id,
    approved_by: approvedByManagerId,
    refunded_at: new Date().toISOString(),
    is_full_refund: isFullRefund,
    refunded_item_ids: refundedItemIds.length > 0 ? refundedItemIds : undefined,
    tip_only: mode === 'tip_only',
  }

  const existingRefundsList = (paymentData.processor_response as Record<string, unknown> | null)
    ?.refunds as unknown[] ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateErr } = await (supabase.from('payments') as any)
    .update(
      bumpVersion({
        status: newPaymentStatus,
        refund_amount: (newRefundTotal / 100).toFixed(2),
        refund_reason: `${reason}${reason_detail ? ': ' + reason_detail : ''}`,
        refunded_by: user.id,
        refunded_at: new Date().toISOString(),
        // For tip-only refunds, lower the tracked tip so reports reflect it.
        ...(mode === 'tip_only' ? { tip_amount: (newTipCents / 100).toFixed(2) } : {}),
        processor_response: {
          ...((paymentData.processor_response as Record<string, unknown>) ?? {}),
          refunds: [...existingRefundsList, refundEntry],
        },
      })
    )
    .eq('id', payment_id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update payment record' }, { status: 500 })
  }

  // ----- 9. Mark refunded items so the order ledger reflects "3 of 5" -----
  if (mode === 'items' && refundedItemIds.length > 0) {
    // Reuse `is_voided` + `void_reason='customer_request'` on the items so
    // existing reports aren't blind to refunded items. (The dedicated
    // `is_refunded` column is added by 5.4.3 / inventory variance work.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('order_items') as any)
      .update({
        is_voided: true,
        void_reason: 'customer_request',
        voided_by: user.id,
        voided_at: new Date().toISOString(),
      })
      .in('id', refundedItemIds)
  }

  // ----- 10. Restore order balance + drive state machine -------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase.from('orders') as any)
    .select('id, status, amount_paid, balance_due, total_cents, total, location_id, org_id')
    .eq('id', paymentData.order_id)
    .single()

  if (order) {
    const orderData = order as Record<string, unknown>
    const orderStatus = orderData.status as OrderState
    const currentPaid = Math.round(parseFloat((orderData.amount_paid as string) ?? '0') * 100)
    const orderTotalCents =
      (orderData.total_cents as number) ??
      Math.round(parseFloat((orderData.total as string) ?? '0') * 100)

    const newPaid = Math.max(0, currentPaid - amountCents)
    const newBalance = Math.max(0, orderTotalCents - newPaid)

    // State-machine guard: REFUND or REFUND_FULL.
    try {
      if (isFullRefund) {
        assertTransition(orderStatus, { type: 'REFUND_FULL' })
      } else {
        assertTransition(orderStatus, { type: 'REFUND', amount_cents: amountCents })
      }
    } catch (err) {
      if (err instanceof IllegalTransitionError) {
        return NextResponse.json({ error: err.message }, { status: 422 })
      }
      throw err
    }

    // For partial refunds: if the order was `closed` and remaining balance > 0
    // (e.g. items refunded but order had a credit somewhere), put it back to
    // `served` so the cashier can re-collect. Otherwise it stays `closed`.
    let nextOrderStatus = orderStatus
    if (isFullRefund) {
      nextOrderStatus = 'refunded'
    } else if (orderStatus === 'closed' && newBalance > 0 && mode === 'items') {
      // Items got refunded after close; the order ledger now owes nothing
      // (we refunded the items' cost), so leave it closed. We only re-open
      // if there's a positive balance the customer needs to settle.
      nextOrderStatus = 'closed'
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('orders') as any)
      .update(
        bumpVersion({
          amount_paid: (newPaid / 100).toFixed(2),
          balance_due: (newBalance / 100).toFixed(2),
          status: nextOrderStatus,
          updated_at: new Date().toISOString(),
        })
      )
      .eq('id', paymentData.order_id)
  }

  // ----- 11. Audit (legacy + new) ------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('audit_log') as any).insert({
    org_id: user.org_id,
    location_id: paymentData.location_id,
    user_id: user.id,
    action: isFullRefund ? 'payment_refunded' : 'payment_partially_refunded',
    entity_type: 'payment',
    entity_id: payment_id,
    description: `${mode === 'tip_only' ? 'Tip-only ' : mode === 'items' ? 'Item ' : ''}refund: $${(amountCents / 100).toFixed(2)} (${reason})`,
    new_state: {
      mode,
      refund_amount_cents: amountCents,
      total_refunded_cents: newRefundTotal,
      original_amount_cents: totalCents,
      principal_cents: principalCents,
      tip_cents_before: tipCents,
      tip_cents_after: newTipCents,
      reason,
      reason_detail: reason_detail ?? null,
      is_unlinked,
      is_full_refund: isFullRefund,
      approved_by_manager: approvedByManagerId,
      refunded_item_ids: refundedItemIds,
      order_id: paymentData.order_id,
    },
  })

  await audit.record(supabase, {
    org_id: user.org_id,
    location_id: paymentData.location_id as string | null,
    user_id: user.id,
    approved_by_user_id: approvedByManagerId,
    action: isFullRefund ? 'payment_refunded' : 'payment_partially_refunded',
    entity_type: 'payment',
    entity_id: payment_id,
    description: `Refund ($${(amountCents / 100).toFixed(2)}) — ${mode}/${reason}`,
    before_state: {
      payment_status: paymentData.status,
      total_amount_cents: totalCents,
      tip_amount_cents: tipCents,
      existing_refund_cents: existingRefundCents,
    },
    after_state: {
      payment_status: newPaymentStatus,
      refunded_cents: newRefundTotal,
      tip_amount_cents: newTipCents,
      refunded_item_ids: refundedItemIds,
      mode,
    },
    reason,
  })

  return NextResponse.json({
    data: {
      ...(updated as Record<string, unknown>),
      refund_summary: {
        mode,
        this_refund_cents: amountCents,
        total_refunded_cents: newRefundTotal,
        remaining_refundable_cents: totalCents - newRefundTotal,
        tip_cents_before: tipCents,
        tip_cents_after: newTipCents,
        refunded_item_ids: refundedItemIds,
        is_full_refund: isFullRefund,
      },
    },
  })
}
