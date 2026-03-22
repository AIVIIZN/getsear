import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/staff/[id]/time-entries — list time entries for a staff member (date range filter)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('time_entries') as any)
    .select('*')
    .eq('user_id', id)
    .eq('org_id', user.org_id)
    .order('clock_in', { ascending: false })

  if (startDate) {
    query = query.gte('clock_in', `${startDate}T00:00:00Z`)
  }
  if (endDate) {
    query = query.lte('clock_in', `${endDate}T23:59:59Z`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}
