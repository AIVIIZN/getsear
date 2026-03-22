import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

const updateFloorPlanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  canvas_width: z.number().int().min(400).max(4000).optional(),
  canvas_height: z.number().int().min(300).max(3000).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
})

/**
 * GET /api/tables/floor-plans/[id] — get floor plan with all tables
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: floorPlan, error } = await (supabase.from('floor_plans') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !floorPlan) {
    return NextResponse.json({ error: 'Floor plan not found' }, { status: 404 })
  }

  // Fetch all tables for this floor plan
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tables } = await (supabase.from('tables') as any)
    .select('id, org_id, location_id, floor_plan_id, name, capacity, shape, pos_x, pos_y, width, height, rotation, status, current_order_id, current_server_id, seated_at, is_active, sort_order, section, guest_count')
    .eq('floor_plan_id', id)
    .eq('org_id', user.org_id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  // Fetch server names for seated tables
  const serverIds = (tables ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((t: any) => t.current_server_id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((t: any) => t.current_server_id)
  const uniqueServerIds = [...new Set(serverIds)] as string[]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let serverMap: Record<string, string> = {}
  if (uniqueServerIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: servers } = await (supabase.from('users') as any)
      .select('id, first_name, last_name, display_name')
      .in('id', uniqueServerIds)

    if (servers) {
      serverMap = Object.fromEntries(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        servers.map((s: any) => [
          s.id,
          s.display_name || `${s.first_name} ${s.last_name?.[0] ?? ''}`.trim(),
        ])
      )
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrichedTables = (tables ?? []).map((t: any) => ({
    ...t,
    current_server_name: t.current_server_id ? (serverMap[t.current_server_id] ?? null) : null,
  }))

  return NextResponse.json({
    data: {
      ...floorPlan,
      tables: enrichedTables,
    },
  })
}

/**
 * PATCH /api/tables/floor-plans/[id] — update floor plan
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateFloorPlanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('floor_plans') as any)
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update floor plan' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
