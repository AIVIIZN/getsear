import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getMockDailySales, getMockKPIs } from '@/lib/reports/mock-data'

/**
 * GET /api/reports/daily — daily sales summary
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

  // Check if real data exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery = (supabase.from('orders') as any)
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.org_id)

  if (locationId) countQuery = countQuery.eq('location_id', locationId)

  const { count } = await countQuery

  if (!count || count === 0) {
    const kpis = getMockKPIs()
    return NextResponse.json({
      is_mock: true,
      data: {
        date,
        total_sales: kpis.total_sales,
        orders: kpis.orders,
        avg_check: kpis.avg_check,
        covers: 412,
        net_sales: kpis.total_sales - 884,
        discounts: 884,
        tax: 1662.88,
        tips: 2840,
        labor_cost: 5486,
        labor_pct: kpis.labor_pct,
        hourly_revenue: getMockDailySales(1),
        prev_period: {
          total_sales: kpis.prev_total_sales,
          orders: kpis.prev_orders,
          avg_check: kpis.prev_avg_check,
          labor_pct: kpis.prev_labor_pct,
        },
      },
    })
  }

  // Real data query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('daily_metrics') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .eq('metric_date', date)

  if (locationId) query = query.eq('location_id', locationId)

  const { data, error } = await query.single()

  if (error) {
    return NextResponse.json({ is_mock: false, data: null, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ is_mock: false, data })
}
