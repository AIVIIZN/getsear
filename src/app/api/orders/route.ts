import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { withIdempotency } from '@/lib/api/idempotency'
import { CACHE_REVALIDATE_PROFILE, cacheTags, orderCacheTags } from '@/lib/cache/keys'

const createOrderSchema = z.object({
  order_type: z.enum([
    'dine_in', 'takeout', 'delivery', 'bar', 'catering', 'online', 'kiosk', 'drive_thru', 'qr',
  ]),
  location_id: z.string().uuid(),
  table_id: z.string().uuid().optional().nullable(),
  guest_count: z.number().int().min(1).max(99).optional().default(1),
  guest_name: z.string().max(200).optional().nullable(),
  guest_phone: z.string().max(30).optional().nullable(),
  notes: z.string().max(2000).optional().default(''),
  source: z.enum(['pos', 'online', 'kiosk', 'phone', 'catering']).optional().default('pos'),
  /** Explicit for-here / to-go flag. Stored in metadata jsonb. */
  for_here: z.boolean().optional(),
})

/**
 * GET /api/orders — list orders with filters
 */
function fetchOrdersList(
  orgId: string,
  filters: {
    status: string | null
    orderType: string | null
    serverId: string | null
    locationId: string | null
    dateFrom: string | null
    dateTo: string | null
    page: number
    limit: number
  }
) {
  return unstable_cache(
    async () => {
      const offset = (filters.page - 1) * filters.limit
      const supabase = createAdminClient()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from('orders') as any)
        .select('*', { count: 'exact' })
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .range(offset, offset + filters.limit - 1)

      if (filters.status) query = query.eq('status', filters.status)
      if (filters.orderType) query = query.eq('order_type', filters.orderType)
      if (filters.serverId) query = query.eq('server_id', filters.serverId)
      if (filters.locationId) query = query.eq('location_id', filters.locationId)
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo)

      const { data, error, count } = await query
      if (error) return { error: 'Failed to fetch orders' as const, data: null, count: 0 }
      return { error: null, data: data ?? [], count: count ?? 0 }
    },
    [
      'orders-list',
      orgId,
      filters.status ?? '',
      filters.orderType ?? '',
      filters.serverId ?? '',
      filters.locationId ?? '',
      filters.dateFrom ?? '',
      filters.dateTo ?? '',
      String(filters.page),
      String(filters.limit),
    ],
    { tags: [cacheTags.orders(orgId)], revalidate: 15 }
  )()
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const params = request.nextUrl.searchParams
  const status = params.get('status')
  const orderType = params.get('order_type')
  const serverId = params.get('server_id')
  const locationId = params.get('location_id')
  const dateFrom = params.get('date_from')
  const dateTo = params.get('date_to')
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '50', 10)))

  const result = await fetchOrdersList(user.org_id, {
    status,
    orderType,
    serverId,
    locationId,
    dateFrom,
    dateTo,
    page,
    limit,
  })

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    data: result.data ?? [],
    pagination: { page, limit, total: result.count },
  })
}

/**
 * POST /api/orders — create new order (draft status)
 *
 * Wrapped with `withIdempotency` (V5.3.1) so the offline mutation queue can
 * safely retry: a replay with the same `Idempotency-Key` returns the
 * original response instead of creating a duplicate order.
 */
export const POST = withIdempotency('orders.create', async (request: NextRequest) => {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { order_type, location_id, table_id, guest_count, guest_name, guest_phone, notes, source, for_here } = parsed.data

  // Generate next order number using DB function with advisory lock to prevent race conditions
  const { data: numberResult } = await supabase.rpc('next_order_number', {
    p_location_id: location_id,
  })

  const nextNumber = (numberResult as number) ?? 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('orders') as any)
    .insert({
      org_id: user.org_id,
      location_id,
      order_number: nextNumber,
      display_number: `A-${String(nextNumber).padStart(3, '0')}`,
      order_type,
      status: 'draft',
      table_id: table_id ?? null,
      server_id: user.id,
      guest_count,
      guest_name: guest_name ?? null,
      guest_phone: guest_phone ?? null,
      subtotal: '0.00',
      discount_total: '0.00',
      tax_total: '0.00',
      tip_total: '0.00',
      total: '0.00',
      amount_paid: '0.00',
      balance_due: '0.00',
      notes,
      source,
      metadata: for_here !== undefined ? { for_here } : {},
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }

  for (const tag of orderCacheTags(user.org_id, data.id)) {
    revalidateTag(tag, CACHE_REVALIDATE_PROFILE)
  }

  return NextResponse.json({ data }, { status: 201 })
})
