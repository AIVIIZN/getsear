import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/**
 * GET /api/drive-thru/orders/metrics — speed-of-service metrics
 * Query params: location_id, date_from, date_to
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const params = request.nextUrl.searchParams
  const locationId = params.get('location_id')
  const dateFrom = params.get('date_from')
  const dateTo = params.get('date_to')

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('drive_thru_orders') as any)
    .select('id, lane, ordered_at, paid_at, served_at, total_seconds')
    .eq('org_id', user.org_id)
    .not('total_seconds', 'is', null)
    .order('ordered_at', { ascending: false })

  if (locationId) query = query.eq('location_id', locationId)
  if (dateFrom) query = query.gte('ordered_at', dateFrom)
  if (dateTo) query = query.lte('ordered_at', dateTo)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
  }

  const orders = (data ?? []) as Array<{
    id: string
    lane: number
    ordered_at: string
    paid_at: string | null
    served_at: string | null
    total_seconds: number
  }>

  const totalOrders = orders.length
  const totalSeconds = orders.reduce((sum, o) => sum + o.total_seconds, 0)
  const avgSeconds = totalOrders > 0 ? Math.round(totalSeconds / totalOrders) : 0

  // Group by lane
  const laneMap = new Map<number, number[]>()
  for (const o of orders) {
    const existing = laneMap.get(o.lane) ?? []
    existing.push(o.total_seconds)
    laneMap.set(o.lane, existing)
  }

  const laneMetrics = Array.from(laneMap.entries()).map(([lane, times]) => ({
    lane,
    order_count: times.length,
    avg_seconds: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    min_seconds: Math.min(...times),
    max_seconds: Math.max(...times),
  }))

  // Group by hour
  const hourMap = new Map<number, number[]>()
  for (const o of orders) {
    const hour = new Date(o.ordered_at).getHours()
    const existing = hourMap.get(hour) ?? []
    existing.push(o.total_seconds)
    hourMap.set(hour, existing)
  }

  const hourlyMetrics = Array.from(hourMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, times]) => ({
      hour,
      order_count: times.length,
      avg_seconds: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    }))

  return NextResponse.json({
    data: {
      total_orders: totalOrders,
      avg_total_seconds: avgSeconds,
      lanes: laneMetrics,
      hourly: hourlyMetrics,
    },
  })
}
