import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager'])
  if (roleCheck) return roleCheck

  const db = createAdminClient()
  const { searchParams } = new URL(request.url)
  const weekStart = searchParams.get('week_start')
  const targetPct = parseFloat(searchParams.get('target_pct') ?? '30')

  if (!weekStart) {
    return apiError(400, 'week_start is required')
  }

  // Get shifts for the week
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const { data: shifts } = await db
    .from('shifts')
    .select('id, staff_id, date, start_time, end_time, users(first_name, last_name, hourly_rate)')
    .eq('org_id', user.org_id)
    .gte('date', weekStart)
    .lt('date', weekEnd.toISOString().split('T')[0])
    .order('date')

  // Calculate hours and cost per shift
  let totalHours = 0
  let totalCost = 0
  const byDay = new Map<string, { hours: number; cost: number }>()

  for (const shift of shifts ?? []) {
    const staff = shift.users as unknown as Record<string, unknown> | null
    const hourlyRate = staff ? parseFloat(staff.hourly_rate as string) * 100 : 1500 // Default $15/hr

    const start = new Date(`2000-01-01T${shift.start_time}`)
    const end = new Date(`2000-01-01T${shift.end_time}`)
    let hours = (end.getTime() - start.getTime()) / 3600000
    if (hours < 0) hours += 24 // Overnight shift

    const cost = Math.round(hours * hourlyRate)
    totalHours += hours
    totalCost += cost

    const date = shift.date as string
    const existing = byDay.get(date) ?? { hours: 0, cost: 0 }
    existing.hours += hours
    existing.cost += cost
    byDay.set(date, existing)
  }

  // Get historical sales for this day-of-week pattern (last 4 weeks average)
  const projectedSales = new Map<string, number>()
  const startDate = new Date(weekStart)

  for (let d = 0; d < 7; d++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + d)
    const dateStr = date.toISOString().split('T')[0]

    // Average sales for this day-of-week over last 4 weeks
    let totalSalesForDay = 0
    let weekCount = 0

    for (let w = 1; w <= 4; w++) {
      const histDate = new Date(date)
      histDate.setDate(histDate.getDate() - 7 * w)
      const histDateStr = histDate.toISOString().split('T')[0]

      const { data: daySales } = await db
        .from('orders')
        .select('total')
        .eq('org_id', user.org_id)
        .gte('created_at', `${histDateStr}T00:00:00Z`)
        .lte('created_at', `${histDateStr}T23:59:59Z`)
        .in('status', ['closed', 'served'])

      if (daySales && daySales.length > 0) {
        const dayTotal = daySales.reduce(
          (sum: number, o: Record<string, unknown>) => sum + Math.round(parseFloat(o.total as string) * 100),
          0
        )
        totalSalesForDay += dayTotal
        weekCount++
      }
    }

    projectedSales.set(dateStr, weekCount > 0 ? Math.round(totalSalesForDay / weekCount) : 0)
  }

  const totalProjectedSales = Array.from(projectedSales.values()).reduce((sum, s) => sum + s, 0)
  const laborPct = totalProjectedSales > 0 ? Math.round((totalCost / totalProjectedSales) * 10000) / 100 : 0

  const byDayResult = Array.from(byDay.entries()).map(([date, data]) => {
    const daySales = projectedSales.get(date) ?? 0
    return {
      date,
      hours: Math.round(data.hours * 10) / 10,
      cost: data.cost,
      projected_sales: daySales,
      labor_pct: daySales > 0 ? Math.round((data.cost / daySales) * 10000) / 100 : 0,
    }
  })

  return NextResponse.json({
    data: {
      total_hours: Math.round(totalHours * 10) / 10,
      total_cost: totalCost,
      projected_sales: totalProjectedSales,
      labor_pct: laborPct,
      target_pct: targetPct,
      is_over_target: laborPct > targetPct,
      by_day: byDayResult,
    },
  })
}
