import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createFloorPlanSchema = z.object({
  name: z.string().min(1).max(100),
  canvas_width: z.number().int().min(400).max(4000).default(1200),
  canvas_height: z.number().int().min(300).max(3000).default(800),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().default(true),
})

/**
 * GET /api/tables/floor-plans — list floor plans for location
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('location_id') ?? user.location_ids[0]

  if (!locationId) {
    return NextResponse.json({ error: 'location_id is required' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('floor_plans') as any)
    .select('id, org_id, location_id, name, sort_order, is_active, canvas_width, canvas_height, created_at, updated_at')
    .eq('org_id', user.org_id)
    .eq('location_id', locationId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch floor plans' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST /api/tables/floor-plans — create floor plan
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

  const parsed = createFloorPlanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const locationId = (body as Record<string, unknown>).location_id as string | undefined ?? user.location_ids[0]
  if (!locationId) {
    return NextResponse.json({ error: 'location_id is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('floor_plans') as any)
    .insert({
      org_id: user.org_id,
      location_id: locationId,
      ...parsed.data,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create floor plan' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
