import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createTableSchema = z.object({
  floor_plan_id: z.string().uuid(),
  name: z.string().min(1).max(50),
  capacity: z.number().int().min(1).max(50).default(4),
  shape: z.enum(['square', 'round', 'rectangle', 'booth', 'bar']).default('square'),
  pos_x: z.number().min(0).default(100),
  pos_y: z.number().min(0).default(100),
  width: z.number().min(40).max(400).default(80),
  height: z.number().min(40).max(400).default(80),
  rotation: z.number().min(0).max(360).default(0),
  section: z.string().max(50).default(''),
  sort_order: z.number().int().min(0).optional(),
})

/**
 * GET /api/tables — list all tables (optionally filter by floor_plan_id, section)
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const floorPlanId = searchParams.get('floor_plan_id')
  const section = searchParams.get('section')
  const locationId = searchParams.get('location_id') ?? user.location_ids[0]

  if (!locationId) {
    return NextResponse.json({ error: 'location_id is required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('tables') as any)
    .select('id, org_id, location_id, floor_plan_id, name, capacity, shape, pos_x, pos_y, width, height, rotation, status, current_order_id, current_server_id, seated_at, is_active, sort_order, section')
    .eq('org_id', user.org_id)
    .eq('location_id', locationId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (floorPlanId) {
    query = query.eq('floor_plan_id', floorPlanId)
  }

  if (section) {
    query = query.eq('section', section)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST /api/tables — create table
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createTableSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify floor plan exists and belongs to this org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: floorPlan } = await (supabase.from('floor_plans') as any)
    .select('id, location_id')
    .eq('id', parsed.data.floor_plan_id)
    .eq('org_id', user.org_id)
    .single()

  if (!floorPlan) {
    return NextResponse.json({ error: 'Floor plan not found' }, { status: 404 })
  }

  // Check table name uniqueness within floor plan
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('tables') as any)
    .select('id')
    .eq('floor_plan_id', parsed.data.floor_plan_id)
    .eq('name', parsed.data.name)
    .eq('is_active', true)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'A table with this name already exists in this floor plan' },
      { status: 409 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('tables') as any)
    .insert({
      org_id: user.org_id,
      location_id: floorPlan.location_id,
      ...parsed.data,
      status: 'available',
      is_active: true,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create table' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
