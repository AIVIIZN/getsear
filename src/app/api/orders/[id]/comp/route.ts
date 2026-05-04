import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { compare } from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { recalculateOrderTotals } from '@/lib/tax/recalculate-order'
import {
  assertTransition,
  IllegalTransitionError,
  isPostClose,
  type OrderState,
} from '@/lib/orders/state-machine'
import { assertVersion, bumpVersion } from '@/lib/orders/concurrency'
import { audit } from '@/lib/audit/log'

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
  manager_pin: z.string().min(4).max(10).optional(),
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

  // ----- 2. Optimistic-lock check (no-op until 5.4.1 lands) -----------------
  const ifMatchHeader = request.headers.get('If-Match')
  const expectedVersion = ifMatchHeader ? Number(ifMatchHeader) : null
  const versionCheck = await assertVersion(supabase, 'orders', orderId, expectedVersion)
  if (!versionCheck.ok) {
    return NextResponse.json(
      {
        error: 'Conflict: order was updated by another terminal',
        current_version: versionCheck.current_version,
        current_state: versionCheck.current_state,
      },
      { status: 409 }
    )
  }

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

    approvedByManagerId = await validateManagerPin(supabase, user.org_id, manager_pin)
    if (!approvedByManagerId) {
      return NextResponse.json({ error: 'Invalid manager PIN' }, { status: 403 })
    }

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('orders') as any)
      .update(
        bumpVersion({
          status: 'served',
          closed_at: null,
          updated_at: new Date().toISOString(),
        })
      )
      .eq('id', orderId)
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
  await recalculateOrderTotals(supabase, orderId, user.org_id)

  // ----- 7. If we re-opened for comp + balance_due is now 0, auto-close -----
  if (isAfterClose) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: refreshed } = await (supabase.from('orders') as any)
      .select('total, amount_paid, balance_due')
      .eq('id', orderId)
      .single()

    const newBalanceCents = Math.round(parseFloat(refreshed?.balance_due ?? '0') * 100)

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
      await (supabase.from('orders') as any)
        .update(
          bumpVersion({
            status: 'closed',
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        )
        .eq('id', orderId)
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

  await audit.record(supabase, {
    org_id: user.org_id,
    location_id: order.location_id,
    user_id: user.id,
    approved_by_user_id: approvedByManagerId,
    action: isAfterClose ? 'order_comp_after_close' : 'order_comp',
    entity_type: 'order',
    entity_id: orderId,
    description: order_item_id
      ? `Item ${order_item_id} comped (${comp_reason})`
      : `Whole order comped (${comp_reason})`,
    before_state: beforeState,
    after_state: finalOrder ?? null,
    reason: comp_reason,
  })

  // ----- 9. Return updated order --------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updatedOrder } = await (supabase.from('orders') as any)
    .select('*, order_items(*, order_item_modifiers(*))')
    .eq('id', orderId)
    .single()

  return NextResponse.json({ data: updatedOrder })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Walk the org's managers, bcrypt-compare PIN, return the matching manager id
 * (or null on no match). Mirrors the pattern used in walkout/refund routes.
 */
async function validateManagerPin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
  pin: string
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: managers } = await (supabase.from('users') as any)
    .select('id, pin_hash')
    .eq('org_id', orgId)
    .in('role', ['owner', 'admin', 'manager'])

  if (!managers || managers.length === 0) return null

  for (const mgr of managers as Array<{ id: string; pin_hash: string | null }>) {
    if (!mgr.pin_hash) continue
    const ok = await compare(pin, mgr.pin_hash)
    if (ok) return mgr.id
  }
  return null
}
