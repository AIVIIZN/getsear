import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateLocationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address_line1: z.string().max(500).optional(),
  address_line2: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zip: z.string().max(20).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  timezone: z.string().optional(),
  currency: z.string().max(3).optional(),
  business_hours: z.array(z.object({
    day: z.number().min(0).max(6),
    open: z.string(),
    close: z.string(),
  })).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
})

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (error || !data) {
    return apiError(404, 'Location not found')
  }

  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = updateLocationSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('locations') as any)
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to update location')
  }

  return NextResponse.json({ data })
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()

  // Soft delete
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('locations') as any)
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .eq('org_id', user.org_id)

  if (error) {
    return apiError(500, 'Failed to delete location')
  }

  return NextResponse.json({ data: { success: true } })
}
