import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createReservationSchema = z.object({
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().max(20).optional().nullable(),
  customer_email: z.string().email().optional().nullable(),
  party_size: z.number().int().min(1).max(100),
  reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reservation_time: z.string().regex(/^\d{2}:\d{2}$/),
  table_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  special_requests: z.string().max(2000).optional().nullable(),
  location_id: z.string().uuid().optional(),
})

/** GET /api/reservations — list reservations with date range and status filter */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const params = request.nextUrl.searchParams
  const dateFrom = params.get('date_from')
  const dateTo = params.get('date_to')
  const status = params.get('status')
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '50', 10)))
  const offset = (page - 1) * limit

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('reservations') as any)
    .select('*', { count: 'exact' })
    .eq('org_id', user.org_id)

  if (dateFrom) {
    query = query.gte('reservation_date', dateFrom)
  }
  if (dateTo) {
    query = query.lte('reservation_date', dateTo)
  }
  if (status) {
    query = query.eq('status', status)
  }

  query = query
    .order('reservation_date', { ascending: true })
    .order('reservation_time', { ascending: true })
    .range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch reservations' }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      total_pages: Math.ceil((count ?? 0) / limit),
    },
  })
}

/** POST /api/reservations — create a new reservation */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'host', 'server'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createReservationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const locationId = parsed.data.location_id ?? user.location_ids[0]

  if (!locationId) {
    return NextResponse.json({ error: 'No location specified' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('reservations') as any)
    .insert({
      org_id: user.org_id,
      location_id: locationId,
      customer_name: parsed.data.customer_name,
      customer_phone: parsed.data.customer_phone ?? null,
      customer_email: parsed.data.customer_email ?? null,
      party_size: parsed.data.party_size,
      reservation_date: parsed.data.reservation_date,
      reservation_time: parsed.data.reservation_time,
      table_id: parsed.data.table_id ?? null,
      status: 'pending',
      notes: parsed.data.notes ?? null,
      special_requests: parsed.data.special_requests ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
