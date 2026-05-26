import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * POST /api/staff/time-entries/[id]/approve — approve time entry
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()

  // Verify entry belongs to this org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('time_entries') as any)
    .select('id, org_id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!existing) {
    return apiError(404, 'Time entry not found')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('time_entries') as any)
    .update({
      is_approved: true,
      approved_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to approve time entry')
  }

  return NextResponse.json({ data })
}
