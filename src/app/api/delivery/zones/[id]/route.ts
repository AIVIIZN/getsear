import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateZoneSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  polygon: z.record(z.string(), z.unknown()).optional().nullable(),
  delivery_fee: z.string().optional(),
  min_order: z.string().optional(),
  estimated_minutes: z.number().min(0).optional(),
  is_active: z.boolean().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/delivery/zones/:id — get zone detail
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await context.params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('delivery_zones') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !data) {
    return apiError(404, 'Zone not found')
  }

  return NextResponse.json({ data })
}

/**
 * PUT /api/delivery/zones/:id — update zone
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = updateZoneSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('delivery_zones') as any)
    .update(parsed.data)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return apiError(500, 'Failed to update zone')
  }

  return NextResponse.json({ data })
}

/**
 * DELETE /api/delivery/zones/:id — deactivate zone
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await context.params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('delivery_zones') as any)
    .update({ is_active: false })
    .eq('id', id)
    .eq('org_id', user.org_id)

  if (error) {
    return apiError(500, 'Failed to deactivate zone')
  }

  return NextResponse.json({ success: true })
}
