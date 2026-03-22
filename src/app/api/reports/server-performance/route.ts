import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getMockServerPerformance } from '@/lib/reports/mock-data'

/**
 * GET /api/reports/server-performance — per-server metrics
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
  let countQuery = (supabase.from('orders') as any)
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.org_id)
  if (locationId) countQuery = countQuery.eq('location_id', locationId)
  const { count } = await countQuery

  if (!count || count === 0) {
    return NextResponse.json({ is_mock: true, data: getMockServerPerformance() })
  }

  // Real: aggregate orders by server_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('orders') as any)
    .select('server_id, total, guest_count, tip_amount')
    .eq('org_id', user.org_id)
    .gte('created_at', `${dateFrom}T00:00:00Z`)
    .lte('created_at', `${dateTo}T23:59:59Z`)
    .not('server_id', 'is', null)

  if (locationId) query = query.eq('location_id', locationId)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ is_mock: false, data: null, error: error.message }, { status: 500 })
  }

  // Aggregate by server
  const serverMap = new Map<string, { sales: number; orders: number; covers: number; tips: number }>()
  for (const order of (data ?? [])) {
    const sid = order.server_id as string
    const existing = serverMap.get(sid) ?? { sales: 0, orders: 0, covers: 0, tips: 0 }
    existing.sales += Number(order.total) || 0
    existing.orders += 1
    existing.covers += Number(order.guest_count) || 0
    existing.tips += Number(order.tip_amount) || 0
    serverMap.set(sid, existing)
  }

  // Fetch server names
  const serverIds = Array.from(serverMap.keys())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: servers } = await (supabase.from('users') as any)
    .select('id, display_name')
    .in('id', serverIds)

  const nameMap = new Map<string, string>()
  for (const s of (servers ?? [])) {
    nameMap.set(s.id, s.display_name ?? 'Unknown')
  }

  const result = Array.from(serverMap.entries())
    .map(([id, agg]) => ({
      name: nameMap.get(id) ?? 'Unknown',
      total_sales: Math.round(agg.sales * 100) / 100,
      orders: agg.orders,
      avg_check: agg.orders > 0 ? Math.round((agg.sales / agg.orders) * 100) / 100 : 0,
      avg_tip_pct: agg.sales > 0 ? Math.round((agg.tips / agg.sales) * 1000) / 10 : 0,
      covers: agg.covers,
    }))
    .sort((a, b) => b.total_sales - a.total_sales)

  return NextResponse.json({ is_mock: false, data: result })
}
