import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getRoleDefaults } from '@/lib/staff/permission-defaults'

type RouteParams = { params: Promise<{ userId: string }> }

/**
 * GET /api/staff/permissions/[userId] — get overrides + resolved permissions for a user
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { userId } = await params
  const supabase = createAdminClient()

  // Get user profile for role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase.from('users') as any)
    .select('id, role, first_name, last_name')
    .eq('id', userId)
    .eq('org_id', user.org_id)
    .single()

  if (!profile) {
    return apiError(404, 'User not found')
  }

  // Get existing overrides
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: overrides } = await (supabase.from('user_permission_overrides') as any)
    .select('permission_code, override_type')
    .eq('user_id', userId)
    .eq('org_id', user.org_id)

  const overrideMap = new Map<string, string>()
  if (overrides) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const o of overrides as any[]) {
      overrideMap.set(o.permission_code, o.override_type)
    }
  }

  // Get role defaults
  const roleDefaults = getRoleDefaults(profile.role)

  return NextResponse.json({
    data: {
      userId,
      role: profile.role,
      name: `${profile.first_name} ${profile.last_name}`,
      roleDefaults,
      overrides: Object.fromEntries(overrideMap),
    },
  })
}

const updateSchema = z.object({
  permission_code: z.string(),
  override_type: z.enum(['grant', 'deny']).nullable(),
})

/**
 * PUT /api/staff/permissions/[userId] — update a single permission override
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { userId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  if (parsed.data.override_type === null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('user_permission_overrides') as any)
      .delete()
      .eq('user_id', userId)
      .eq('permission_code', parsed.data.permission_code)
      .eq('org_id', user.org_id)
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('user_permission_overrides') as any)
      .upsert(
        {
          org_id: user.org_id,
          user_id: userId,
          permission_code: parsed.data.permission_code,
          override_type: parsed.data.override_type,
          created_by: user.id,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,permission_code' }
      )
  }

  return NextResponse.json({ data: { success: true } })
}
