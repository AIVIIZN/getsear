import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/**
 * GET /api/reports/custom — custom date range sales
 * Query params: date_from, date_to, location_id
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager', 'admin'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const dateFrom = params.get('date_from')
  const dateTo = params.get('date_to')
  const locationId = params.get('location_id')

  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: 'date_from and date_to are required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Try daily_metrics first
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('daily_metrics') as any)
    .select('metric_date, total_revenue, net_revenue, order_count, average_check, discount_total, tax_total, labor_cost, labor_percentage, tip_total')
    .eq('org_id', user.org_id)
    .gte('metric_date', dateFrom)
    .lte('metric_date', dateTo)
    .order('metric_date', { ascending: true })

  if (locationId) query = query.eq('location_id', locationId)
  const { data } = await query

  if (data && data.length > 0) {
    const totals = {
      total_revenue: 0, net_revenue: 0, order_count: 0, discount_total: 0, tax_total: 0, labor_cost: 0, tip_total: 0,
    }
    for (const row of data) {
      totals.total_revenue += Number(row.total_revenue) || 0
      totals.net_revenue += Number(row.net_revenue) || 0
      totals.order_count += Number(row.order_count) || 0
      totals.discount_total += Number(row.discount_total) || 0
      totals.tax_total += Number(row.tax_total) || 0
      totals.labor_cost += Number(row.labor_cost) || 0
      totals.tip_total += Number(row.tip_total) || 0
    }

    return NextResponse.json({
      is_mock: false,
      data: {
        daily: data,
        totals: {
          ...totals,
          avg_check: totals.order_count > 0 ? Math.round((totals.total_revenue / totals.order_count) * 100) / 100 : 0,
          labor_pct: totals.net_revenue > 0 ? Math.round((totals.labor_cost / totals.net_revenue) * 1000) / 10 : 0,
        },
      },
    })
  }

  // Fallback: query orders directly
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ordersQuery = (supabase.from('orders') as any)
    .select('created_at, total, discount_total, tax_total, tip_total')
    .eq('org_id', user.org_id)
    .gte('created_at', `${dateFrom}T04:00:00Z`)
    .lte('created_at', `${dateTo}T23:59:59Z`)
    .not('status', 'eq', 'voided')

  if (locationId) ordersQuery = ordersQuery.eq('location_id', locationId)
  const { data: orders } = await ordersQuery

  if (!orders || orders.length === 0) {
    return NextResponse.json({ is_mock: true, data: { daily: [], totals: {} } })
  }

  // Group by date
  const dayMap = new Map<string, { total: number; discount: number; tax: number; orders: number }>()
  for (const order of orders) {
    const day = order.created_at.split('T')[0]
    const existing = dayMap.get(day) ?? { total: 0, discount: 0, tax: 0, orders: 0 }
    existing.total += Number(order.total) || 0
    existing.discount += Number(order.discount_total) || 0
    existing.tax += Number(order.tax_total) || 0
    existing.orders += 1
    dayMap.set(day, existing)
  }

  const daily = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      metric_date: date,
      total_revenue: v.total,
      net_revenue: v.total - v.discount,
      order_count: v.orders,
      discount_total: v.discount,
      tax_total: v.tax,
    }))

  return NextResponse.json({ is_mock: false, data: { daily } })
}
