import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * POST /api/staff/[id]/break-end — end break, calculate duration
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const supabase = createAdminClient()

  // Find active time entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeEntry, error: findError } = await (supabase.from('time_entries') as any)
    .select('id')
    .eq('user_id', id)
    .eq('org_id', user.org_id)
    .is('clock_out', null)
    .limit(1)
    .maybeSingle()

  if (findError || !activeEntry) {
    return NextResponse.json({ error: 'Staff member is not clocked in' }, { status: 404 })
  }

  // Find active break
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeBreak, error: breakError } = await (supabase.from('break_entries') as any)
    .select('id, start_time')
    .eq('time_entry_id', activeEntry.id)
    .is('end_time', null)
    .limit(1)
    .maybeSingle()

  if (breakError || !activeBreak) {
    return NextResponse.json({ error: 'No active break found' }, { status: 404 })
  }

  const now = new Date()
  const startTime = new Date(activeBreak.start_time)
  const durationMinutes = Math.round((now.getTime() - startTime.getTime()) / 60000)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: breakEntry, error } = await (supabase.from('break_entries') as any)
    .update({
      end_time: now.toISOString(),
      duration_minutes: durationMinutes,
    })
    .eq('id', activeBreak.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to end break' }, { status: 500 })
  }

  return NextResponse.json({ data: breakEntry })
}
