import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { PERMISSION_CATEGORIES, ALL_PERMISSION_CODES, getRoleDefaults } from '@/lib/staff/permission-defaults'

/**
 * GET /api/staff/permissions — list all permission categories and codes
 */
export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  return NextResponse.json({
    data: {
      categories: PERMISSION_CATEGORIES,
      allCodes: ALL_PERMISSION_CODES,
    },
  })
}

const bulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      user_id: z.string().uuid(),
      permission_code: z.string(),
      override_type: z.enum(['grant', 'deny']).nullable(),
    })
  ),
})

/**
 * PUT /api/staff/permissions — bulk update permission overrides
 */
export async function PUT(request: NextRequest) {
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

  const parsed = bulkUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  for (const update of parsed.data.updates) {
    if (update.override_type === null) {
      // Remove override (revert to role default)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('user_permission_overrides') as any)
        .delete()
        .eq('user_id', update.user_id)
        .eq('permission_code', update.permission_code)
        .eq('org_id', user.org_id)
    } else {
      // Upsert override
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('user_permission_overrides') as any)
        .upsert(
          {
            org_id: user.org_id,
            user_id: update.user_id,
            permission_code: update.permission_code,
            override_type: update.override_type,
            created_by: user.id,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,permission_code' }
        )
    }
  }

  return NextResponse.json({ data: { success: true, count: parsed.data.updates.length } })
}
