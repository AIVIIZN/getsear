import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { USER_ROLES } from '@/lib/constants'

const createRolePermissionsSchema = z.object({
  role: z.enum(USER_ROLES.map(r => r.value) as [string, ...string[]]),
  permission_ids: z.array(z.string().uuid()),
})

interface RolePermissionRow {
  role: string
  permission_id: string
}

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const supabase = createAdminClient()

  // Fetch all permissions
  const { data: permissions, error: permError } = await supabase
    .from('permissions')
    .select('*')
    .order('category', { ascending: true })
    .order('code', { ascending: true })

  if (permError) {
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 })
  }

  // Fetch role_permissions (no org_id - global mapping)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rolePermissions, error: rpError } = await (supabase.from('role_permissions') as any)
    .select('*') as { data: RolePermissionRow[] | null; error: unknown }

  if (rpError) {
    return NextResponse.json({ error: 'Failed to fetch role permissions' }, { status: 500 })
  }

  // Group by role
  const roleMap: Record<string, string[]> = {}
  for (const rp of rolePermissions ?? []) {
    if (!roleMap[rp.role]) {
      roleMap[rp.role] = []
    }
    roleMap[rp.role].push(rp.permission_id)
  }

  const roles = USER_ROLES.map(r => ({
    value: r.value,
    label: r.label,
    permission_ids: roleMap[r.value] ?? [],
    permission_count: (roleMap[r.value] ?? []).length,
  }))

  return NextResponse.json({
    data: {
      roles,
      permissions: permissions ?? [],
    },
  })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createRolePermissionsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Remove existing permissions for this role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('role_permissions') as any)
    .delete()
    .eq('org_id', user.org_id)
    .eq('role', parsed.data.role)

  // Insert new ones
  if (parsed.data.permission_ids.length > 0) {
    const inserts = parsed.data.permission_ids.map(pid => ({
      org_id: user.org_id,
      role: parsed.data.role,
      permission_id: pid,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('role_permissions') as any)
      .insert(inserts)

    if (error) {
      return NextResponse.json({ error: 'Failed to create role permissions' }, { status: 500 })
    }
  }

  return NextResponse.json({ data: { success: true } }, { status: 201 })
}
