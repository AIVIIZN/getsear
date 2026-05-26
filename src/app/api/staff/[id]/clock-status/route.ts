import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

/**
 * GET /api/staff/:id/clock-status — check if staff member is clocked in
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const supabase = createAdminClient()

  // Check for an active time entry (clocked in, not clocked out)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error } = await (supabase.from('time_entries') as any)
    .select('id, clock_in, role_during_shift')
    .eq('user_id', id)
    .eq('org_id', user.org_id)
    .is('clock_out', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return apiError(500, 'Failed to check clock status')
  }

  return NextResponse.json({
    is_clocked_in: !!entry,
    clock_in: entry?.clock_in ?? null,
    time_entry_id: entry?.id ?? null,
    role: entry?.role_during_shift ?? null,
  })
}
