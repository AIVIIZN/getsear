import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { validateManagerPinForAction } from '@/lib/auth/manager-pin'
import { recalculateOrderTotals, StaleVersionError } from '@/lib/tax/recalculate-order'
import {
  assertTransition,
  IllegalTransitionError,
  isPostClose,
  type OrderState,
} from '@/lib/orders/state-machine'
import { assertVersion, checkUpdateAffectedRow } from '@/lib/orders/concurrency'
import { audit } from '@/lib/audit/log'
import { applyRateLimitHeaders } from '@/lib/api/rate-limit'

const compSchema = z.object({
  order_item_id: z.string().uuid().optional(),
  comp_reason: z.enum([
    'manager_comp',
    'quality_issue',
    'service_issue',
    'birthday',
    'vip',
    'employee_meal',
    'promotional',
    'other',
  ]),
  comp_amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  /**
   * Required when comping a closed/refunded order. The route re-opens the
   * order, applies the comp, then closes it again with the new totals.
   * Manager-PIN is mandatory for post-close comps.
   */
  manager_pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be digits only').optional(),
})

/**
 * POST /api/orders/[id]/comp -- comp an item or entire order.
 *
 * Lifecycle handling (5.4.2):
 *   - Pre-close (draft/open/fired/ready/served): standard comp + recalc.
 *   - Post-close (closed/refunded): requires manager_pin. The order is
 *     re-opened to `served`, the comp is applied, totals recalculated,
 *     and if the new balance_due is <= 0 the order is auto-closed again.
 *     A full audit row is written including before/after totals.
 *
 * Optimistic-locking: respects If-Match header via `assertVersion()`
 * (sister 5.4.1). When the helper is the stub it always passes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id: orderId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = compSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { order_item_id, comp_reason, comp_amount, manager_pin } = parsed.data

  // ----- 1. Load order with status + tenant scope ---------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase.from('orders') as any)
    .select('id, org_id, status, total, amount_paid, balance_due, location_id, closed_at')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const currentStatus = order.status as OrderState

  // ----- 2. Optimistic-lock check (5.4.1 — assertVersion 409s on stale) ----
  // Real impl loads the row, parses If-Match, and returns a NextResponse 409
  // with the current state on mismatch. We pass through that response so
  // the StaleOrderModal on the client renders the diff.
  //
  // 5.99.4: previously this was decorative — the helper was called but the
  // subsequent UPDATEs in this handler weren't gated on the version, so a
  // refund + comp race could both "win". We now thread `expectedVersion`
  // through every UPDATE and verify the affected-row count, returning a 409
  // (via checkUpdateAffectedRow) when another writer slipped in.
  const versionCheck = await assertVersion(supabase, request, orderId, user.org_id, {
    select: 'id, version',
  })
  if (!versionCheck.ok) return versionCheck.response

  // Tracks the version we expect for the *next* UPDATE in this handler. Each
  // successful UPDATE bumps `orders.version` via the BEFORE-UPDATE trigger,
  // so we increment locally as we go (or re-read from the row when we have
  // an interleaved write through `recalculateOrderTotals`).
  // `null` = legacy unconditional path (no If-Match header sent); skip gating.
  let nextExpectedVersion: number | null = versionCheck.expectedVersion

  // ----- 3. Post-close path: validate manager PIN + re-open -----------------
  let approvedByManagerId: string | null = null
  const isAfterClose = isPostClose(currentStatus)

  if (isAfterClose) {
    if (!manager_pin) {
      return NextResponse.json(
        { error: 'Manager PIN required to comp a closed/refunded order' },
        { status: 403 }
      )
    }

    const pinResult = await validateManagerPinForAction({
      actor: user,
      pin: manager_pin,
      request,
      supabase,
    })
    if (pinResult.kind === 'rate_limited') {
      const res = NextResponse.json(
        { error: 'Too many PIN attempts. Please wait 15 minutes before trying again.' },
        { status: 429 }
      )
      applyRateLimitHeaders(res.headers, pinResult.rateLimit)
      res.headers.set('Retry-After', String(pinResult.rateLimit.retryAfterSeconds))
      return res
    }
    if (pinResult.kind === 'invalid') {
      return NextResponse.json({ error: 'Invalid manager PIN' }, { status: 403 })
    }
    approvedByManagerId = pinResult.manager_user_id

    // State machine: closed -COMP_AFTER_CLOSE-> served (re-open to apply comp)
    try {
      assertTransition(currentStatus, {
        type: 'COMP_AFTER_CLOSE',
        reason: comp_reason,
        manager_pin_verified: true,
      })
    } catch (err) {
      if (err instanceof IllegalTransitionError) {
        return NextResponse.json({ error: err.message }, { status: 422 })
      }
      throw err
    }

    // Re-open the order. Clears closed_at; balance_due is recomputed below.
    // The BEFORE-UPDATE trigger from migration 20260504063720 auto-bumps
    // orders.version, so we just do the domain update.
    //
    // 5.99.4: gate on version (when caller asserted one) and verify the
    // affected-row count via checkUpdateAffectedRow. A 0-row UPDATE means
    // another writer (e.g. a refund route) raced us.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let reopenQuery = (supabase.from('orders') as any)
      .update({
        status: 'served',
        closed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('org_id', user.org_id)
    if (nextExpectedVersion !== null) {
      reopenQuery = reopenQuery.eq('version', nextExpectedVersion)
    }
    const { data: reopenedRow } = await reopenQuery.select('version').maybeSingle()

    const reopenStaleResp = await checkUpdateAffectedRow(
      supabase,
      orderId,
      user.org_id,
      nextExpectedVersion,
      reopenedRow
    )
    if (reopenStaleResp) return reopenStaleResp

    // Trigger bumped version. Track for the next gated UPDATE.
    if (nextExpectedVersion !== null) {
      const v = (reopenedRow as { version?: number } | null)?.version
      nextExpectedVersion = typeof v === 'number' ? v : nextExpectedVersion + 1
    }
  }

  // ----- 4. Capture before-state for audit ----------------------------------
  const beforeState = {
    status: order.status,
    total: order.total,
    amount_paid: order.amount_paid,
    balance_due: order.balance_due,
  }

  // ----- 5. Apply the comp --------------------------------------------------
  if (order_item_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: item } = await (supabase.from('order_items') as any)
      .select('id, line_total')
      .eq('id', order_item_id)
      .eq('order_id', orderId)
      .single()

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const amount = comp_amount ?? item.line_total

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('order_items') as any)
      .update({
        is_comped: true,
        comp_reason,
        comp_amount: amount,
        comped_by: user.id,
      })
      .eq('id', order_item_id)
  } else {
    // Comp every non-voided, non-already-comped item.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: items } = await (supabase.from('order_items') as any)
      .select('id, line_total')
      .eq('order_id', orderId)
      .eq('is_voided', false)
      .eq('is_comped', false)

    for (const item of items ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('order_items') as any)
        .update({
          is_comped: true,
          comp_reason,
          comp_amount: item.line_total,
          comped_by: user.id,
        })
        .eq('id', item.id)
    }
  }

  // ----- 6. Recalculate totals ----------------------------------------------
  // 5.99.2 — gate the totals UPDATE on `orders.version` so a concurrent
  // writer can't clobber. Tricky case: when `isAfterClose` is true, step 3
  // re-opened the order with an UPDATE on `orders` that fired the trigger,
  // bumping `orders.version` to `expectedVersion + 1`. The pre-close path
  // touched only `order_items`, so `orders.version` is still
  // `expectedVersion`. If `versionCheck.expectedVersion` is null (legacy
  // unconditional caller, e.g. offline replay), pass null straight through.
  const recalcExpected =
    versionCheck.expectedVersion === null
      ? null
      : isAfterClose
        ? versionCheck.expectedVersion + 1
        : versionCheck.expectedVersion
  try {
    await recalculateOrderTotals(supabase, orderId, user.org_id, recalcExpected)
  } catch (err) {
    if (err instanceof StaleVersionError) {
      const stale = await checkUpdateAffectedRow(
        supabase,
        orderId,
        user.org_id,
        recalcExpected,
        null
      )
      if (stale) return stale
    }
    throw err
  }

  // ----- 7. If we re-opened for comp + balance_due is now 0, auto-close -----
  if (isAfterClose) {
    // recalculateOrderTotals UPDATEd `orders` (bumping version via trigger),
    // so re-read the live version here. We use it to gate the auto-close
    // UPDATE below — without this, a concurrent refund could land between
    // recalc and close and we'd silently overwrite their state.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: refreshed } = await (supabase.from('orders') as any)
      .select('total, amount_paid, balance_due, version')
      .eq('id', orderId)
      .single()

    const newBalanceCents = Math.round(parseFloat(refreshed?.balance_due ?? '0') * 100)

    if (nextExpectedVersion !== null) {
      const v = (refreshed as { version?: number } | null)?.version
      // If the re-read returned a version, that's our new gate. If it didn't
      // (shouldn't happen — `single()` would have thrown), fall back to the
      // tracked counter. We bias toward gating; a missing version surfaces
      // as a 409 via the affected-row check rather than a silent bypass.
      nextExpectedVersion = typeof v === 'number' ? v : nextExpectedVersion
    }

    if (newBalanceCents <= 0) {
      // Drive it back through CLOSE.
      try {
        assertTransition('served', { type: 'CLOSE', balance_due_cents: newBalanceCents })
      } catch (err) {
        if (err instanceof IllegalTransitionError) {
          return NextResponse.json({ error: err.message }, { status: 422 })
        }
        throw err
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let closeQuery = (supabase.from('orders') as any)
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .eq('org_id', user.org_id)
      if (nextExpectedVersion !== null) {
        closeQuery = closeQuery.eq('version', nextExpectedVersion)
      }
      const { data: closedRow } = await closeQuery.select('version').maybeSingle()

      const closeStaleResp = await checkUpdateAffectedRow(
        supabase,
        orderId,
        user.org_id,
        nextExpectedVersion,
        closedRow
      )
      if (closeStaleResp) return closeStaleResp

      // nextExpectedVersion would be advanced here for any subsequent gated
      // UPDATEs, but the auto-close is the final write in the comp flow —
      // downstream are non-orders writes (audit, order_modifications) and
      // a final SELECT. Intentionally not reassigning to keep the linter
      // happy without losing the invariant for future additions.
    }
    // If newBalanceCents > 0 the order legitimately still owes money
    // (e.g. comp was less than the refund the customer expected) — leave it
    // in `served` so the cashier can refund / re-collect.
  }

  // ----- 8. Audit (legacy + new) --------------------------------------------
  // Legacy path — order_modifications, kept until 5.4.3 fully replaces it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('order_modifications') as any).insert({
    org_id: user.org_id,
    order_id: orderId,
    modification_type: isAfterClose ? 'comp_after_close' : 'comp_item',
    description: order_item_id
      ? `Item comped: ${comp_reason}${isAfterClose ? ' (after close)' : ''}`
      : `Order comped: ${comp_reason}${isAfterClose ? ' (after close)' : ''}`,
    previous_value: beforeState,
    new_value: {
      comp_reason,
      order_item_id: order_item_id ?? null,
      after_close: isAfterClose,
      manager_id: approvedByManagerId,
    },
    performed_by: user.id,
    approved_by: approvedByManagerId,
  })

  // New audit path — populated by 5.4.3.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: finalOrder } = await (supabase.from('orders') as any)
    .select('status, total, amount_paid, balance_due')
    .eq('id', orderId)
    .single()

  // 5.4.3 audit enum has only `order_comped` (no `order_comped_after_close`),
  // so we encode the post-close differentiation in `reason` and the
  // before/after state snapshots — both queryable from audit_log.
  await audit.record({
    actor: user,
    manager_pin_user_id: approvedByManagerId,
    action: 'order_comped',
    entity_type: 'order',
    entity_id: orderId,
    description: order_item_id
      ? `Item ${order_item_id} comped (${comp_reason})${isAfterClose ? ' [after close]' : ''}`
      : `Whole order comped (${comp_reason})${isAfterClose ? ' [after close]' : ''}`,
    before_state: { ...beforeState, after_close: isAfterClose },
    after_state: finalOrder ?? null,
    reason: isAfterClose ? `${comp_reason} (after close)` : comp_reason,
    location_id: order.location_id,
    request,
  })

  // ----- 9. Return updated order --------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updatedOrder } = await (supabase.from('orders') as any)
    .select('*, order_items(*, order_item_modifiers(*))')
    .eq('id', orderId)
    .single()

  return NextResponse.json({ data: updatedOrder })
}
