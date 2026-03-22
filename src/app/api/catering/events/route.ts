import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createEventSchema = z.object({
  location_id: z.string().uuid(),
  customer_id: z.string().uuid().optional().nullable(),
  event_name: z.string().min(1).max(300),
  event_date: z.string().min(1),
  event_time: z.string().min(1),
  guest_count: z.number().int().min(1).max(10000),
  status: z.enum(['inquiry', 'quoted', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional().default('inquiry'),
  total: z.string().optional().nullable(),
  deposit: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  contact_name: z.string().min(1).max(200),
  contact_phone: z.string().max(30).optional().nullable(),
  contact_email: z.string().email().optional().nullable(),
  delivery_address: z.record(z.string(), z.unknown()).optional().nullable(),
})

/**
 * GET /api/catering/events — list catering events with filters
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const params = request.nextUrl.searchParams
  const status = params.get('status')
  const locationId = params.get('location_id')
  const dateFrom = params.get('date_from')
  const dateTo = params.get('date_to')
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '50', 10)))
  const offset = (page - 1) * limit

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('catering_events') as any)
    .select('*', { count: 'exact' })
    .eq('org_id', user.org_id)
    .order('event_date', { ascending: true })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (locationId) query = query.eq('location_id', locationId)
  if (dateFrom) query = query.gte('event_date', dateFrom)
  if (dateTo) query = query.lte('event_date', dateTo)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: { page, limit, total: count ?? 0 },
  })
}

/**
 * POST /api/catering/events — create a new catering event
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

  const parsed = createEventSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('catering_events') as any)
    .insert({
      org_id: user.org_id,
      ...parsed.data,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
