import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getMockDailySales } from '@/lib/reports/mock-data'

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery = (supabase.from('orders') as any)
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.org_id)
  if (locationId) countQuery = countQuery.eq('location_id', locationId)
  const { count } = await countQuery

  if (!count || count === 0) {
    const daysDiff = Math.ceil(
      (new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1
    return NextResponse.json({ is_mock: true, data: getMockDailySales(daysDiff) })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('daily_metrics') as any)
    .select('metric_date, total_revenue, net_revenue, order_count, average_check, discount_total, tax_total, labor_cost, labor_percentage, tip_total')
    .eq('org_id', user.org_id)
    .gte('metric_date', dateFrom)
    .lte('metric_date', dateTo)
    .order('metric_date', { ascending: true })

  if (locationId) query = query.eq('location_id', locationId)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ is_mock: false, data: null, error: error.message }, { status: 500 })
  }

  // Aggregate totals
  const totals = {
    total_revenue: 0,
    net_revenue: 0,
    order_count: 0,
    discount_total: 0,
    tax_total: 0,
    labor_cost: 0,
    tip_total: 0,
  }
  for (const row of (data ?? [])) {
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
