import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateTerminalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
})

type RouteParams = { params: Promise<{ id: string }> }

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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateTerminalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('terminals')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update terminal' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('terminals')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.org_id)

  if (error) {
    return NextResponse.json({ error: 'Failed to deactivate terminal' }, { status: 500 })
  }

  return NextResponse.json({ data: { success: true } })
}
