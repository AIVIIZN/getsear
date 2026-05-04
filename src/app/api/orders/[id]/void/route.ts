import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { compare } from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import {
  assertTransition,
  IllegalTransitionError,
  isPostClose,
  isTerminal,
  type OrderState,
} from '@/lib/orders/state-machine'
import { assertVersion, bumpVersion } from '@/lib/orders/concurrency'
import { audit } from '@/lib/audit/log'

const VOID_REASONS = [
  'customer_request',
  'kitchen_error',
  'server_error',
  'wrong_item',
  'quality_issue',
  '86d',
  'duplicate',
  'other',
] as const

const voidSchema = z.object({
  reason: z.enum(VOID_REASONS),
  notes: z.string().max(2000).optional(),
  /** Required when voiding a closed/refunded order. */
  manager_pin: z.string().min(4).max(10).optional(),
})

/**
 * POST /api/orders/[id]/void -- void an order with state-machine guards.
 *
 * Lifecycle handling (5.4.2):
 *   - Pre-close (draft/open/fired/ready/served): standard void; manager role
 *     check is sufficient.
 *   - Post-close (closed): requires manager_pin via bcrypt validation.
 *     This is the "void after close" rule from the spec — voiding a paid
 *     order is destructive and needs a second-factor approval.
 *   - Terminal (already voided / refunded): rejected with 422.
 *
 * Optimistic-locking: respects If-Match via `assertVersion` (sister 5.4.1).
 * Audit: writes to both `order_modifications` (legacy) and via `audit.record`
 * (sister 5.4.3) with full before/after state.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  // Manager+ to void anything beyond a draft.
  // (Draft voids by anyone are handled by DELETE /api/orders/[id]; this route
  // is the explicit "void with reason + audit" flow.)
  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id: orderId } = await params

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

  const { reason, notes, manager_pin } = parsed.data
  const supabase = createAdminClient()

  // ----- 1. Load order ------------------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase.from('orders') as any)
    .select('id, org_id, status, total, amount_paid, balance_due, location_id, table_id, metadata')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const currentStatus = order.status as OrderState

  // Reject terminal states — no double-void / void-of-refunded.
  if (isTerminal(currentStatus)) {
    return NextResponse.json(
      { error: `Cannot void order in terminal state "${currentStatus}"` },
      { status: 422 }
    )
  }

  // ----- 2. Optimistic-lock check ------------------------------------------
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

  // ----- 3. Manager-PIN validation (post-close only) ------------------------
  let approvedByManagerId: string | null = null
  const isAfterClose = isPostClose(currentStatus)

  if (isAfterClose) {
    if (!manager_pin) {
      return NextResponse.json(
        { error: 'Manager PIN required to void a closed order' },
        { status: 403 }
      )
    }

    approvedByManagerId = await validateManagerPin(supabase, user.org_id, manager_pin)
    if (!approvedByManagerId) {
      return NextResponse.json({ error: 'Invalid manager PIN' }, { status: 403 })
    }
  }

  // ----- 4. State-machine validation ---------------------------------------
  try {
    if (isAfterClose) {
      assertTransition(currentStatus, {
        type: 'VOID_AFTER_CLOSE',
        reason,
        manager_pin_verified: true,
      })
    } else {
      assertTransition(currentStatus, { type: 'VOID', reason })
    }
  } catch (err) {
    if (err instanceof IllegalTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    throw err
  }

  // ----- 5. Capture before-state for audit ----------------------------------
  const beforeState = {
    status: order.status,
    total: order.total,
    amount_paid: order.amount_paid,
    balance_due: order.balance_due,
  }

  // ----- 6. Write the void --------------------------------------------------
  const voidedAt = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateErr } = await (supabase.from('orders') as any)
    .update(
      bumpVersion({
        status: 'voided',
        voided_at: voidedAt,
        voided_by: user.id,
        void_reason: reason,
        metadata: {
          ...(order.metadata ?? {}),
          void: {
            reason,
            notes: notes ?? null,
            after_close: isAfterClose,
            manager_id: approvedByManagerId,
            voided_by_user_id: user.id,
            voided_at: voidedAt,
          },
        },
        updated_at: voidedAt,
      })
    )
    .eq('id', orderId)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to void order' }, { status: 500 })
  }

  // ----- 7. Release the table if dine-in ------------------------------------
  if (order.table_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('tables') as any)
      .update({
        status: 'available',
        current_order_id: null,
        updated_at: voidedAt,
      })
      .eq('id', order.table_id)
  }

  // ----- 8. Audit (legacy + new) --------------------------------------------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('order_modifications') as any).insert({
    org_id: user.org_id,
    order_id: orderId,
    modification_type: isAfterClose ? 'void_after_close' : 'void',
    description: `Order voided: ${reason}${notes ? ` — ${notes}` : ''}${isAfterClose ? ' (after close)' : ''}`,
    previous_value: beforeState,
    new_value: {
      status: 'voided',
      reason,
      notes: notes ?? null,
      after_close: isAfterClose,
      manager_id: approvedByManagerId,
    },
    performed_by: user.id,
    approved_by: approvedByManagerId,
  })

  await audit.record(supabase, {
    org_id: user.org_id,
    location_id: order.location_id,
    user_id: user.id,
    approved_by_user_id: approvedByManagerId,
    action: isAfterClose ? 'order_void_after_close' : 'order_void',
    entity_type: 'order',
    entity_id: orderId,
    description: `Order voided (${reason})`,
    before_state: beforeState,
    after_state: {
      status: 'voided',
      voided_at: voidedAt,
      void_reason: reason,
    },
    reason,
  })

  return NextResponse.json({
    data: {
      ...(updated as Record<string, unknown>),
      void_summary: {
        reason,
        notes: notes ?? null,
        after_close: isAfterClose,
        approved_by_manager_id: approvedByManagerId,
        voided_at: voidedAt,
      },
    },
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
