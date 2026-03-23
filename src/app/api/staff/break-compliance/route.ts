import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { checkBreakCompliance, getDefaultBreakConfig, type BreakRuleState, type EmployeeShiftInfo, type BreakEntry } from '@/lib/staff/break-compliance'

/**
 * GET /api/staff/break-compliance — break compliance status for on-duty employees
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('location_id')

  const supabase = createAdminClient()

  // Get location break config
  let breakState: BreakRuleState = 'federal'
  if (locationId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: location } = await (supabase.from('locations') as any)
      .select('settings')
      .eq('id', locationId)
      .single()

    if (location?.settings?.break_rules_state) {
      breakState = location.settings.break_rules_state as BreakRuleState
    }
  }

  const config = getDefaultBreakConfig(breakState)

  // Get all active time entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('time_entries') as any)
    .select('id, user_id, clock_in')
    .eq('org_id', user.org_id)
    .is('clock_out', null)

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data: activeEntries } = await query

  if (!activeEntries || activeEntries.length === 0) {
    return NextResponse.json({ data: { alerts: [], employees: [] } })
  }

  // Get user names
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userIds = activeEntries.map((e: any) => e.user_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users } = await (supabase.from('users') as any)
    .select('id, first_name, last_name')
    .in('id', userIds)

  const userNameMap = new Map<string, string>()
  if (users) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const u of users as any[]) {
      userNameMap.set(u.id, `${u.first_name} ${u.last_name}`)
    }
  }

  // Get breaks for active entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entryIds = activeEntries.map((e: any) => e.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: breakData } = await (supabase.from('break_entries') as any)
    .select('id, time_entry_id, start_time, end_time, break_type, duration_minutes')
    .in('time_entry_id', entryIds)

  const breaksByEntry = new Map<string, BreakEntry[]>()
  if (breakData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const b of breakData as any[]) {
      const list = breaksByEntry.get(b.time_entry_id) ?? []
      list.push({
        id: b.id,
        timeEntryId: b.time_entry_id,
        startTime: new Date(b.start_time),
        endTime: b.end_time ? new Date(b.end_time) : null,
        breakType: b.break_type ?? 'meal',
        durationMinutes: b.duration_minutes,
      })
      breaksByEntry.set(b.time_entry_id, list)
    }
  }

  // Build employee shift info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const employees: EmployeeShiftInfo[] = activeEntries.map((e: any) => {
    const breaks = breaksByEntry.get(e.id) ?? []
    const activeBreak = breaks.find((b) => b.endTime === null)

    return {
      userId: e.user_id,
      userName: userNameMap.get(e.user_id) ?? 'Unknown',
      clockIn: new Date(e.clock_in),
      breaks,
      isOnBreak: !!activeBreak,
    }
  })

  const alerts = checkBreakCompliance(employees, config)

  return NextResponse.json({
    data: {
      alerts,
      config: {
        state: config.state,
        mealThresholdHours: config.mealThresholdHours,
        restThresholdHours: config.restThresholdHours,
      },
    },
  })
}
