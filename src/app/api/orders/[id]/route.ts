import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { withIdempotency } from '@/lib/api/idempotency'
import { recalculateOrderTotals, StaleVersionError } from '@/lib/tax/recalculate-order'
import { CACHE_REVALIDATE_PROFILE, cacheTags, orderCacheTags } from '@/lib/cache/keys'
import {
  assertVersion,
  checkUpdateAffectedRow,
} from '@/lib/orders/concurrency'

const updateOrderSchema = z.object({
  order_type: z.enum([
    'dine_in', 'takeout', 'delivery', 'bar', 'catering', 'online', 'kiosk', 'drive_thru', 'qr',
  ]).optional(),
  table_id: z.string().uuid().nullable().optional(),
  guest_count: z.number().int().min(1).max(99).optional(),
  guest_name: z.string().max(200).nullable().optional(),
  guest_phone: z.string().max(30).nullable().optional(),
  notes: z.string().max(2000).optional(),
  /** Explicit for-here / to-go toggle. Affects tax calculation. */
  for_here: z.boolean().optional(),
})

/**
 * GET /api/orders/[id] -- get single order with items and modifiers
 */
function fetchOrderDetail(orgId: string, id: string) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('orders') as any)
        .select('*, order_items(*, order_item_modifiers(*)), order_discounts(*)')
        .eq('id', id)
        .eq('org_id', orgId)
        .single()

      if (error || !data) return { error: 'Order not found' as const, data: null }
      return { error: null, data }
    },
    ['order-detail', orgId, id],
    { tags: [cacheTags.orders(orgId), cacheTags.activeOrders(orgId), cacheTags.order(orgId, id)], revalidate: 10 }
  )()
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const result = await fetchOrderDetail(user.org_id, id)

  if (result.error || !result.data) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Surface the optimistic-lock version as ETag so clients can pass it back
  // via If-Match on the next mutating request (V5.4.1).
  const version = (result.data as Record<string, unknown>).version
  const headers: Record<string, string> = {}
  if (typeof version === 'number') headers.ETag = `"${version}"`

  return NextResponse.json({ data: result.data }, { headers })
}

/**
 * PATCH /api/orders/[id] -- update order metadata
 * Supports toggling for_here which triggers tax recalculation.
 *
 * Wrapped with `withIdempotency` (V5.3.1) so the offline queue's
 * `update_order` replays don't double-apply state changes when the network
 * blips between the server commit and the ack.
 */
export const PATCH = withIdempotency<{ params: Promise<{ id: string }> }>('orders.update', async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // V5.4.1: optimistic-lock guard. If the client passed `If-Match`, we
  // compare against the live row; mismatch returns 409 with the current
  // state so the StaleOrderModal can render a diff. No header → legacy
  // unconditional path (offline-replay queue, pre-V5.4.1 callers).
  const check = await assertVersion(supabase, request, id, user.org_id, {
    select: 'metadata, version',
  })
  if (!check.ok) return check.response

  // Build update payload
  // for_here is stored in the metadata jsonb field since the orders table
  // doesn't have a dedicated column for it
  const { for_here, ...directFields } = parsed.data

  // If for_here is being toggled, merge it into the metadata field
  if (for_here !== undefined) {
    const currentMetadata = (check.currentRow.metadata ?? {}) as Record<string, unknown>
    const metadata = { ...currentMetadata, for_here }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let updateQuery = (supabase.from('orders') as any)
      .update({
        ...directFields,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('org_id', user.org_id)
    if (check.expectedVersion !== null) {
      updateQuery = updateQuery.eq('version', check.expectedVersion)
    }
    const { data, error } = await updateQuery.select().maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }

    const staleResp = await checkUpdateAffectedRow(
      supabase,
      id,
      user.org_id,
      check.expectedVersion,
      data
    )
    if (staleResp) return staleResp

    // Recalculate tax when for_here or order_type changes.
    // 5.99.2 — the primary `orders` UPDATE above already fired the
    // version-bump trigger, so the row is at `expectedVersion + 1` now;
    // gate the totals UPDATE on that to detect a concurrent writer that
    // squeezed in between our checkUpdateAffectedRow above and this recalc.
    const recalcExpected =
      check.expectedVersion === null ? null : check.expectedVersion + 1
    try {
      await recalculateOrderTotals(supabase, id, user.org_id, recalcExpected)
    } catch (err) {
      if (err instanceof StaleVersionError) {
        const stale = await checkUpdateAffectedRow(
          supabase,
          id,
          user.org_id,
          recalcExpected,
          null
        )
        if (stale) return stale
      }
      throw err
    }

    // Fetch updated order with recalculated totals
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedOrder } = await (supabase.from('orders') as any)
      .select('*')
      .eq('id', id)
      .single()

    for (const tag of orderCacheTags(user.org_id, id)) {
      revalidateTag(tag, CACHE_REVALIDATE_PROFILE)
    }

    const newVersion = updatedOrder?.version ?? check.currentVersion + 1
    return NextResponse.json({ data: updatedOrder }, {
      headers: { ETag: `"${newVersion}"` },
    })
  }

  // Standard update without for_here
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateQuery = (supabase.from('orders') as any)
    .update({ ...directFields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.org_id)
  if (check.expectedVersion !== null) {
    updateQuery = updateQuery.eq('version', check.expectedVersion)
  }
  const { data, error } = await updateQuery.select().maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }

  const staleResp = await checkUpdateAffectedRow(
    supabase,
    id,
    user.org_id,
    check.expectedVersion,
    data
  )
  if (staleResp) return staleResp

  // If order_type changed, recalculate tax (affects for-here/to-go logic).
  // 5.99.2 — same reasoning as the for_here branch above: the primary UPDATE
  // already bumped the version by 1, so we gate recalc on expectedVersion+1.
  if (directFields.order_type) {
    const recalcExpected =
      check.expectedVersion === null ? null : check.expectedVersion + 1
    try {
      await recalculateOrderTotals(supabase, id, user.org_id, recalcExpected)
    } catch (err) {
      if (err instanceof StaleVersionError) {
        const stale = await checkUpdateAffectedRow(
          supabase,
          id,
          user.org_id,
          recalcExpected,
          null
        )
        if (stale) return stale
      }
      throw err
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedOrder } = await (supabase.from('orders') as any)
      .select('*')
      .eq('id', id)
      .single()

    for (const tag of orderCacheTags(user.org_id, id)) {
      revalidateTag(tag, CACHE_REVALIDATE_PROFILE)
    }

    const newVersion = updatedOrder?.version ?? check.currentVersion + 1
    return NextResponse.json({ data: updatedOrder }, {
      headers: { ETag: `"${newVersion}"` },
    })
  }

  for (const tag of orderCacheTags(user.org_id, id)) {
    revalidateTag(tag, CACHE_REVALIDATE_PROFILE)
  }

  const newVersion = (data as Record<string, unknown>)?.version as number | undefined
    ?? check.currentVersion + 1
  return NextResponse.json({ data }, {
    headers: { ETag: `"${newVersion}"` },
  })
})

// DELETE /api/orders/[id] was removed in 5.99.3 — it was a side-door void
// that bypassed assertVersion / assertTransition / withIdempotency / audit.
// All voids now go through POST /api/orders/[id]/void (the canonical path
// with state-machine guards, optimistic-locking, and full audit trail).
