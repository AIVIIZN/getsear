import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { calculateOvertime, getDefaultConfig, type TimeEntry, type OvertimeRule } from '@/lib/staff/overtime-engine'

/**
 * GET /api/staff/overtime — overtime status for all on-duty employees
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('location_id')

  const supabase = createAdminClient()

  // Get location OT config
  let otRule: OvertimeRule = 'federal'
  if (locationId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: location } = await (supabase.from('locations') as any)
      .select('settings')
      .eq('id', locationId)
      .single()

    if (location?.settings?.overtime_rule) {
      otRule = location.settings.overtime_rule as OvertimeRule
    }
  }

  const config = getDefaultConfig(otRule)

  // Get all active time entries (clocked in, no clock out)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeEntries } = await (supabase.from('time_entries') as any)
    .select('id, user_id, location_id, clock_in, clock_out, regular_hours, overtime_hours')
    .eq('org_id', user.org_id)
    .is('clock_out', null)

  if (!activeEntries || activeEntries.length === 0) {
    return NextResponse.json({ data: [] })
  }

  // Get unique user IDs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userIds = [...new Set(activeEntries.map((e: any) => e.user_id))]

  // Get all time entries for these users this week (for weekly OT calculation)
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() + mondayOffset)
  weekStart.setHours(0, 0, 0, 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: weekEntries } = await (supabase.from('time_entries') as any)
    .select('id, user_id, location_id, clock_in, clock_out')
    .eq('org_id', user.org_id)
    .in('user_id', userIds)
    .gte('clock_in', weekStart.toISOString())

  // Get break data for all week entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weekEntryIds = (weekEntries ?? []).map((e: any) => e.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: breaks } = await (supabase.from('break_entries') as any)
    .select('time_entry_id, duration_minutes, break_type')
    .in('time_entry_id', weekEntryIds.length > 0 ? weekEntryIds : ['none'])
    .not('end_time', 'is', null)

  const breakMinutesMap = new Map<string, number>()
  if (breaks) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const b of breaks as any[]) {
      if (b.break_type === 'unpaid') {
        const current = breakMinutesMap.get(b.time_entry_id) ?? 0
        breakMinutesMap.set(b.time_entry_id, current + (b.duration_minutes ?? 0))
      }
    }
  }

  // Calculate OT for each user
  const results = userIds.map((userId) => {
     
    const userWeekEntries: TimeEntry[] = (weekEntries ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((e: any) => e.user_id === userId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any) => ({
        id: e.id,
        userId: e.user_id,
        locationId: e.location_id,
        clockIn: new Date(e.clock_in),
        clockOut: e.clock_out ? new Date(e.clock_out) : null,
        unpaidBreakMinutes: breakMinutesMap.get(e.id) ?? 0,
      }))

    const otResult = calculateOvertime(userWeekEntries, config, now)

    return {
      userId,
      ...otResult,
    }
  })

  return NextResponse.json({ data: results })
}
