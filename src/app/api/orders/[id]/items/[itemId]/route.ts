import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { recalculateOrderTotals, StaleVersionError } from '@/lib/tax/recalculate-order'
import { assertVersion, checkUpdateAffectedRow } from '@/lib/orders/concurrency'
import { CACHE_REVALIDATE_PROFILE, orderCacheTags } from '@/lib/cache/keys'

const updateItemSchema = z.object({
  quantity: z.number().int().min(1).max(999).optional(),
  seat_number: z.number().int().min(1).max(99).nullable().optional(),
  course: z.number().int().min(1).max(20).optional(),
  notes: z.string().max(500).optional(),
})

const voidItemSchema = z.object({
  void_reason: z.enum([
    'customer_request', 'kitchen_error', 'server_error', 'wrong_item',
    'quality_issue', '86d', 'duplicate', 'other',
  ]),
})

type RouteParams = { params: Promise<{ id: string; itemId: string }> }

/**
 * PATCH /api/orders/[id]/items/[itemId] -- update item
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id: orderId, itemId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // V5.4.1 optimistic-lock guard. PATCHing an item will trigger a totals
  // recalculation that bumps the order's version.
  const check = await assertVersion(supabase, request, orderId, user.org_id, {
    select: 'id, version',
  })
  if (!check.ok) return check.response

  const updates: Record<string, unknown> = {}
  if (parsed.data.quantity !== undefined) updates.quantity = parsed.data.quantity
  if (parsed.data.seat_number !== undefined) updates.seat_number = parsed.data.seat_number
  if (parsed.data.course !== undefined) updates.course = parsed.data.course
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes

  // If quantity changed, recalculate line_total
  if (parsed.data.quantity !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: currentItem } = await (supabase.from('order_items') as any)
      .select('unit_price, modifier_total')
      .eq('id', itemId)
      .single()

    if (currentItem) {
      const unitPrice = parseFloat(currentItem.unit_price || '0')
      const modTotal = parseFloat(currentItem.modifier_total || '0')
      updates.line_total = ((unitPrice + modTotal) * parsed.data.quantity).toFixed(2)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('order_items') as any)
    .update(updates)
    .eq('id', itemId)
    .eq('order_id', orderId)
    .select('*, order_item_modifiers(*)')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }

  // Recalculate order totals using the tax engine (no more hardcoded 8.5%)
  // — this UPDATE bumps the order version (V5.4.1). The PATCH above mutated
  // only `order_items`, so `orders.version` is still `check.expectedVersion`
  // here; pass it through so 5.99.2 catches a concurrent racer.
  try {
    await recalculateOrderTotals(supabase, orderId, user.org_id, check.expectedVersion)
  } catch (err) {
    if (err instanceof StaleVersionError) {
      const stale = await checkUpdateAffectedRow(
        supabase,
        orderId,
        user.org_id,
        check.expectedVersion,
        null
      )
      if (stale) return stale
    }
    throw err
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: refreshed } = await (supabase.from('orders') as any)
    .select('version')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .maybeSingle()
  const newVersion = (refreshed?.version as number | undefined) ?? check.currentVersion + 1

  for (const tag of orderCacheTags(user.org_id, orderId)) {
    revalidateTag(tag, CACHE_REVALIDATE_PROFILE)
  }

  return NextResponse.json(
    { data },
    { headers: { ETag: `"${newVersion}"` } }
  )
}

/**
 * DELETE /api/orders/[id]/items/[itemId] -- void item
 *
 * NOTE: V5.4.1 deliberately does NOT add an If-Match guard here. Item-void
 * is a privileged action (manager PIN) and is being moved to the new
 * `/api/orders/[id]/void/route.ts` handler in sister task 5.4.2 along with
 * comp/refund. We leave this endpoint unguarded for now to avoid a merge
 * conflict with that branch.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id: orderId, itemId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = voidItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'void_reason is required', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Check if item has been sent -- requires manager
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item } = await (supabase.from('order_items') as any)
    .select('is_sent, order_id')
    .eq('id', itemId)
    .single()

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  if (item.is_sent) {
    const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
    if (roleErr) return roleErr
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('order_items') as any)
    .update({
      is_voided: true,
      void_reason: parsed.data.void_reason,
      voided_at: new Date().toISOString(),
      voided_by: user.id,
    })
    .eq('id', itemId)
    .eq('order_id', orderId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to void item' }, { status: 500 })
  }

  // Recalculate order totals using the tax engine (no more hardcoded 8.5%).
  // DELETE has no If-Match guard yet (deferred to sister 5.4.2 — see notes
  // above), so we recalc unconditionally with expectedVersion=null. The
  // version-bump trigger still fires on the orders UPDATE.
  await recalculateOrderTotals(supabase, orderId, user.org_id, null)

  for (const tag of orderCacheTags(user.org_id, orderId)) {
    revalidateTag(tag, CACHE_REVALIDATE_PROFILE)
  }

  return NextResponse.json({ data })
}
