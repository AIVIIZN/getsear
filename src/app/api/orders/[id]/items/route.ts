import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { withIdempotency } from '@/lib/api/idempotency'
import { recalculateOrderTotals, StaleVersionError } from '@/lib/tax/recalculate-order'
import { assertVersion, checkUpdateAffectedRow } from '@/lib/orders/concurrency'
import { getReqLoggerFromRequest } from '@/lib/observability/req-context'
import { CACHE_REVALIDATE_PROFILE, orderCacheTags } from '@/lib/cache/keys'

const modifierSchema = z.object({
  modifier_id: z.string().uuid(),
  modifier_group_id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  price_adjustment: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  quantity: z.number().int().min(1).default(1),
})

const addItemSchema = z.object({
  menu_item_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  unit_price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Price must be a valid dollar amount'),
  quantity: z.number().int().min(1).max(999).default(1),
  seat_number: z.number().int().min(1).max(99).nullable().optional(),
  course: z.number().int().min(1).max(20).optional().default(1),
  prep_station: z.string().max(50).nullable().optional(),
  notes: z.string().max(500).optional().default(''),
  modifiers: z.array(modifierSchema).optional().default([]),
})

/**
 * POST /api/orders/[id]/items -- add item to order
 *
 * Wrapped with `withIdempotency` (V5.3.1) so retries from the offline queue
 * don't double-add items. The dedup key is per-(key, route, org_id), so the
 * same key on different orders is correctly distinct (the body identifies
 * the order — we'd never hit the cache across orders).
 */
export const POST = withIdempotency<{ params: Promise<{ id: string }> }>('orders.add_items', async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const t0 = Date.now()
  const rlog = getReqLoggerFromRequest(request, {
    route: '/api/orders/[id]/items',
    method: 'POST',
  })

  const user = await getAuthUser()
  if (user instanceof NextResponse) {
    rlog.warn('orders.add_items.unauthorized', {
      status: user.status,
      duration_ms: Date.now() - t0,
    })
    return user
  }

  const { id: orderId } = await params
  rlog.info('orders.add_items.start', {
    user_id: user.id,
    org_id: user.org_id,
    order_id: orderId,
  })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    rlog.warn('orders.add_items.invalid_json', {
      user_id: user.id,
      org_id: user.org_id,
      status: 400,
      duration_ms: Date.now() - t0,
    })
    return apiError(400, 'Invalid JSON')
  }

  const parsed = addItemSchema.safeParse(body)
  if (!parsed.success) {
    rlog.warn('orders.add_items.validation_failed', {
      user_id: user.id,
      org_id: user.org_id,
      status: 400,
      duration_ms: Date.now() - t0,
    })
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // V5.4.1 optimistic-lock guard. Adding items mutates the order's totals via
  // `recalculateOrderTotals` below, which performs an UPDATE that fires the
  // version-bump trigger.
  const check = await assertVersion(supabase, request, orderId, user.org_id, {
    select: 'id, org_id, status, location_id, version',
  })
  if (!check.ok) return check.response

  const order = check.currentRow as {
    id: string; org_id: string; status: string; location_id: string
  }

  if (order.status === 'closed' || order.status === 'voided') {
    return apiError(400, 'Cannot add items to a closed or voided order')
  }

  // Check if kitchen is closed — only drink items allowed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: location } = await (supabase.from('locations') as any)
    .select('settings')
    .eq('id', order.location_id)
    .single()

  if (location?.settings?.kitchen_closed) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: menuItem } = await (supabase.from('menu_items') as any)
      .select('course')
      .eq('id', parsed.data.menu_item_id)
      .single()

    if (menuItem && menuItem.course !== 'drink') {
      return apiError(400, 'Kitchen is closed. Only drink items can be added.')
    }
  }

  const { menu_item_id, name, unit_price, quantity, seat_number, course, prep_station, notes, modifiers } = parsed.data

  // Calculate modifier total
  const modifierTotal = modifiers.reduce(
    (sum, m) => sum + parseFloat(m.price_adjustment) * m.quantity,
    0
  )
  const lineTotal = (parseFloat(unit_price) * quantity + modifierTotal * quantity).toFixed(2)

  // Insert order item
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error: itemError } = await (supabase.from('order_items') as any)
    .insert({
      org_id: user.org_id,
      order_id: orderId,
      menu_item_id,
      name,
      unit_price,
      quantity,
      modifier_total: modifierTotal.toFixed(2),
      line_total: lineTotal,
      seat_number: seat_number ?? null,
      course,
      prep_station: prep_station ?? null,
      notes,
      is_sent: false,
      is_fired: false,
      is_ready: false,
      is_served: false,
      is_voided: false,
      is_comped: false,
    })
    .select()
    .single()

  if (itemError || !item) {
    return apiError(500, 'Failed to add item')
  }

  // Insert modifiers if any
  if (modifiers.length > 0) {
    const modRows = modifiers.map((m) => ({
      order_item_id: item.id,
      modifier_id: m.modifier_id,
      modifier_group_id: m.modifier_group_id ?? null,
      name: m.name,
      price_adjustment: m.price_adjustment,
      quantity: m.quantity,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('order_item_modifiers') as any).insert(modRows)
  }

  // Recalculate order totals using the tax engine (no more hardcoded 8.5%).
  // This UPDATE on `orders` triggers the version bump (V5.4.1). The INSERTs
  // above hit only `order_items`/`order_item_modifiers` which do not bump
  // `orders.version`, so we gate the totals UPDATE on `check.expectedVersion`
  // (5.99.2). On a concurrent-writer race the recalc throws and we return
  // the canonical 409 instead of clobbering the other terminal's totals.
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

  // Fetch the complete item with modifiers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: completeItem } = await (supabase.from('order_items') as any)
    .select('*, order_item_modifiers(*)')
    .eq('id', item.id)
    .single()

  // Read the new order version for the response ETag.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: refreshed } = await (supabase.from('orders') as any)
    .select('version')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .maybeSingle()
  const newVersion = (refreshed?.version as number | undefined) ?? check.currentVersion + 1

  rlog.info('orders.add_items.ok', {
    user_id: user.id,
    org_id: user.org_id,
    order_id: orderId,
    item_id: (item as { id?: string })?.id,
    status: 201,
    duration_ms: Date.now() - t0,
  })

  for (const tag of orderCacheTags(user.org_id, orderId)) {
    revalidateTag(tag, CACHE_REVALIDATE_PROFILE)
  }

  return NextResponse.json(
    { data: completeItem },
    { status: 201, headers: { ETag: `"${newVersion}"` } }
  )
})
