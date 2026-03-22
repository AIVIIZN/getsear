import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/**
 * GET /api/franchise/reports — consolidated reports across all locations
 * Query params: date_from, date_to, location_ids (comma separated)
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const params = request.nextUrl.searchParams
  const dateFrom = params.get('date_from')
  const dateTo = params.get('date_to')
  const locationIdsParam = params.get('location_ids')

  if (!dateFrom || !dateTo) {
    return NextResponse.json(
      { error: 'date_from and date_to are required' },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()

  // Get all locations for org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let locQuery = (supabase.from('locations') as any)
    .select('id, name')
    .eq('org_id', user.org_id)

  if (locationIdsParam) {
    const ids = locationIdsParam.split(',').map((s) => s.trim())
    locQuery = locQuery.in('id', ids)
  }

  const { data: locations, error: locError } = await locQuery

  if (locError) {
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 })
  }

  const locationList = (locations ?? []) as Array<{ id: string; name: string }>

  let totalRevenue = 0
  let totalOrders = 0
  const locationReports: Array<{
    location_id: string
    location_name: string
    revenue: string
    order_count: number
    avg_check: string
  }> = []

  for (const loc of locationList) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: orders } = await (supabase.from('orders') as any)
      .select('total')
      .eq('org_id', user.org_id)
      .eq('location_id', loc.id)
      .in('status', ['closed', 'served'])
      .gte('created_at', dateFrom)
      .lte('created_at', dateTo)

    const orderList = (orders ?? []) as Array<{ total: string }>
    const revenue = orderList.reduce((sum, o) => sum + parseFloat(o.total || '0'), 0)
    const avgCheck = orderList.length > 0 ? revenue / orderList.length : 0

    totalRevenue += revenue
    totalOrders += orderList.length

    locationReports.push({
      location_id: loc.id,
      location_name: loc.name,
      revenue: revenue.toFixed(2),
      order_count: orderList.length,
      avg_check: avgCheck.toFixed(2),
    })
  }

  return NextResponse.json({
    data: {
      period: { date_from: dateFrom, date_to: dateTo },
      totals: {
        revenue: totalRevenue.toFixed(2),
        order_count: totalOrders,
        avg_check: totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : '0.00',
        location_count: locationList.length,
      },
      locations: locationReports,
    },
  })
}
