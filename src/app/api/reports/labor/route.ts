import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getMockLaborData } from '@/lib/reports/mock-data'

/**
 * GET /api/reports/labor — labor cost, hours, percentage
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager', 'admin'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const dateFrom = params.get('date_from') ?? new Date().toISOString().split('T')[0]
  const dateTo = params.get('date_to') ?? dateFrom
  const locationId = params.get('location_id')

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery = (supabase.from('time_entries') as any)
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.org_id)
  if (locationId) countQuery = countQuery.eq('location_id', locationId)
  const { count } = await countQuery

  if (!count || count === 0) {
    return NextResponse.json({ is_mock: true, data: getMockLaborData() })
  }

  // Real data: join time_entries with users
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('time_entries') as any)
    .select('user_id, clock_in, clock_out, hourly_rate, tips, role, user:users(display_name)')
    .eq('org_id', user.org_id)
    .gte('clock_in', `${dateFrom}T00:00:00Z`)
    .lte('clock_in', `${dateTo}T23:59:59Z`)

  if (locationId) query = query.eq('location_id', locationId)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ is_mock: false, data: null, error: error.message }, { status: 500 })
  }

  // Aggregate by employee
  const empMap = new Map<string, {
    name: string
    role: string
    hours: number
    rate: number
    total_pay: number
    tips: number
    overtime_hours: number
  }>()

  for (const entry of (data ?? [])) {
    const uid = entry.user_id as string
    const clockIn = new Date(entry.clock_in)
    const clockOut = entry.clock_out ? new Date(entry.clock_out) : new Date()
    const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
    const rate = Number(entry.hourly_rate) || 0
    const tips = Number(entry.tips) || 0

    const existing = empMap.get(uid) ?? {
      name: entry.user?.display_name ?? 'Unknown',
      role: entry.role ?? 'Staff',
      hours: 0,
      rate,
      total_pay: 0,
      tips: 0,
      overtime_hours: 0,
    }
    existing.hours += hoursWorked
    existing.total_pay += hoursWorked * rate
    existing.tips += tips
    empMap.set(uid, existing)
  }

  // Calculate overtime (over 40 hours)
  const entries = Array.from(empMap.values()).map((e) => {
    const overtime = Math.max(0, e.hours - 40)
    return {
      ...e,
      hours: Math.round(e.hours * 10) / 10,
      total_pay: Math.round(e.total_pay * 100) / 100,
      tips: Math.round(e.tips * 100) / 100,
      overtime_hours: Math.round(overtime * 10) / 10,
    }
  })

  // Get revenue for labor percentage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let revenueQuery = (supabase.from('daily_metrics') as any)
    .select('net_revenue')
    .eq('org_id', user.org_id)
    .gte('metric_date', dateFrom)
    .lte('metric_date', dateTo)
  if (locationId) revenueQuery = revenueQuery.eq('location_id', locationId)
  const { data: revenueData } = await revenueQuery

  const revenue = (revenueData ?? []).reduce((s: number, r: { net_revenue: number }) => s + (Number(r.net_revenue) || 0), 0)
  const totalLaborCost = entries.reduce((s, e) => s + e.total_pay, 0)
  const totalHours = entries.reduce((s, e) => s + e.hours, 0)

  return NextResponse.json({
    is_mock: false,
    data: {
      entries,
      total_labor_cost: Math.round(totalLaborCost * 100) / 100,
      total_hours: Math.round(totalHours * 10) / 10,
      labor_percentage: revenue > 0 ? Math.round((totalLaborCost / revenue) * 1000) / 10 : 0,
      revenue: Math.round(revenue * 100) / 100,
    },
  })
}
