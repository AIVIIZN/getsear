import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateRoleSchema = z.object({
  permission_ids: z.array(z.string().uuid()),
})

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner'])
  if (roleErr) return roleErr

  const { id: role } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = updateRoleSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Remove existing permissions for this role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('role_permissions') as any)
    .delete()
    .eq('org_id', user.org_id)
    .eq('role', role)

  // Insert new permissions
  if (parsed.data.permission_ids.length > 0) {
    const inserts = parsed.data.permission_ids.map(pid => ({
      org_id: user.org_id,
      role,
      permission_id: pid,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('role_permissions') as any)
      .insert(inserts)

    if (error) {
      return apiError(500, 'Failed to update role permissions')
    }
  }

  return NextResponse.json({ data: { success: true } })
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner'])
  if (roleErr) return roleErr

  const { id: role } = await params
  const supabase = createAdminClient()

  // Prevent deleting built-in roles
  const builtInRoles = ['owner', 'admin', 'manager', 'server', 'bartender', 'host', 'kitchen', 'cashier']
  if (builtInRoles.includes(role)) {
    return apiError(400, 'Cannot delete built-in roles')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('role_permissions') as any)
    .delete()
    .eq('org_id', user.org_id)
    .eq('role', role)

  if (error) {
    return apiError(500, 'Failed to delete role')
  }

  return NextResponse.json({ data: { success: true } })
}
