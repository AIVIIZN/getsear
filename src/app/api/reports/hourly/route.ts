import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/**
 * GET /api/reports/hourly — hourly breakdown for a given date
 * Query params: date (YYYY-MM-DD), location_id
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager', 'admin'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const date = params.get('date') ?? new Date().toISOString().split('T')[0]
  const locationId = params.get('location_id')

  const supabase = createAdminClient()

  // Try daily_metrics first
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('daily_metrics') as any)
    .select('hourly_revenue, hourly_covers')
    .eq('org_id', user.org_id)
    .eq('metric_date', date)

  if (locationId) query = query.eq('location_id', locationId)
  const { data, error } = await query.maybeSingle()

  if (!error && data?.hourly_revenue) {
    return NextResponse.json({ is_mock: false, data: data.hourly_revenue })
  }

  // Fallback: query orders directly
  const nextDay = new Date(date)
  nextDay.setDate(nextDay.getDate() + 1)
  const nextDayStr = nextDay.toISOString().split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ordersQuery = (supabase.from('orders') as any)
    .select('created_at, total')
    .eq('org_id', user.org_id)
    .gte('created_at', `${date}T04:00:00Z`)
    .lt('created_at', `${nextDayStr}T04:00:00Z`)
    .not('status', 'eq', 'voided')

  if (locationId) ordersQuery = ordersQuery.eq('location_id', locationId)
  const { data: orders, error: ordersError } = await ordersQuery

  if (ordersError || !orders || orders.length === 0) {
    return NextResponse.json({ is_mock: true, data: [] })
  }

  const hourlyMap = new Map<number, { sales: number; orders: number }>()
  for (const order of orders) {
    const hour = new Date(order.created_at).getUTCHours()
    const existing = hourlyMap.get(hour) ?? { sales: 0, orders: 0 }
    existing.sales += Number(order.total) || 0
    existing.orders += 1
    hourlyMap.set(hour, existing)
  }

  const hourlyData = Array.from(hourlyMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, vals]) => ({
      hour: `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`,
      sales: Math.round(vals.sales * 100) / 100,
      orders: vals.orders,
    }))

  return NextResponse.json({ is_mock: false, data: hourlyData })
}
