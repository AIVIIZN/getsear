import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { calculateLaborForecast, type ScheduledShift } from '@/lib/staff/labor-forecast'

/**
 * GET /api/staff/labor-forecast — projected labor cost/percentage for a date range
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('location_id')
  const weekStart = searchParams.get('week_start')

  if (!locationId || !weekStart) {
    return NextResponse.json({ error: 'location_id and week_start are required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Calculate week end (7 days from start)
  const startDate = new Date(weekStart + 'T00:00:00Z')
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)
  const weekEnd = endDate.toISOString().split('T')[0]

  // Generate date array for the week
  const dates: string[] = []
  const d = new Date(startDate)
  for (let i = 0; i < 7; i++) {
    dates.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }

  // Get scheduled shifts for the week
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shifts } = await (supabase.from('scheduled_shifts') as any)
    .select('id, user_id, role, start_time, end_time')
    .eq('org_id', user.org_id)
    .eq('location_id', locationId)
    .gte('start_time', `${weekStart}T00:00:00Z`)
    .lte('start_time', `${weekEnd}T23:59:59Z`)

  // Get hourly rates for assigned staff
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userIds = [...new Set((shifts ?? []).map((s: any) => s.user_id).filter(Boolean))]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users } = await (supabase.from('users') as any)
    .select('id, hourly_rate')
    .in('id', userIds.length > 0 ? userIds : ['none'])

  const rateMap = new Map<string, number>()
  if (users) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const u of users as any[]) {
      rateMap.set(u.id, Math.round(parseFloat(u.hourly_rate ?? '15') * 100))
    }
  }

  // Build shift data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scheduledShifts: ScheduledShift[] = (shifts ?? []).map((s: any) => ({
    userId: s.user_id ?? '',
    role: s.role ?? '',
    startTime: new Date(s.start_time),
    endTime: new Date(s.end_time),
    hourlyRateCents: rateMap.get(s.user_id) ?? 1500, // default $15/hr
  }))

  // Get projected revenue: same week last year
  const lastYearStart = new Date(startDate)
  lastYearStart.setFullYear(lastYearStart.getFullYear() - 1)
  const lastYearEnd = new Date(endDate)
  lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lastYearRevenue } = await (supabase.from('daily_metrics') as any)
    .select('date, total_revenue')
    .eq('location_id', locationId)
    .gte('date', lastYearStart.toISOString().split('T')[0])
    .lte('date', lastYearEnd.toISOString().split('T')[0])

  // Trailing 4 weeks revenue
  const fourWeeksAgo = new Date(startDate)
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentRevenue } = await (supabase.from('daily_metrics') as any)
    .select('date, total_revenue')
    .eq('location_id', locationId)
    .gte('date', fourWeeksAgo.toISOString().split('T')[0])
    .lt('date', weekStart)

  // Simple projected revenue: use recent 4-week average * 7 days, or fallback to last year
  let projectedRevenueCents = 0

  if (recentRevenue && recentRevenue.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalRecent = recentRevenue.reduce((s: number, r: any) => s + Math.round(parseFloat(r.total_revenue ?? '0') * 100), 0)
    const avgWeekly = (totalRecent / Math.max(1, recentRevenue.length)) * 7
    projectedRevenueCents = Math.round(avgWeekly)
  } else if (lastYearRevenue && lastYearRevenue.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    projectedRevenueCents = lastYearRevenue.reduce((s: number, r: any) => s + Math.round(parseFloat(r.total_revenue ?? '0') * 100), 0)
  } else {
    // No historical data — estimate based on scheduled hours * average revenue per labor hour ($50/hr typical)
    const totalHours = scheduledShifts.reduce((s, sh) => s + (sh.endTime.getTime() - sh.startTime.getTime()) / 3600000, 0)
    projectedRevenueCents = Math.round(totalHours * 5000)
  }

  const forecast = calculateLaborForecast(scheduledShifts, projectedRevenueCents, dates)

  return NextResponse.json({ data: forecast })
}
