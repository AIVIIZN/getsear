import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

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
  const offset = (page - 1) * limit

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('orders') as any)
    .select('*', { count: 'exact' })
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (orderType) query = query.eq('order_type', orderType)
  if (serverId) query = query.eq('server_id', serverId)
  if (locationId) query = query.eq('location_id', locationId)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: { page, limit, total: count ?? 0 },
  })
}

/**
 * POST /api/orders — create new order (draft status)
 */
export async function POST(request: NextRequest) {
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

  return NextResponse.json({ data }, { status: 201 })
}
