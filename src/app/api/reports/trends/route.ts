import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getTrendData } from '@/lib/reports/queries'

/**
 * GET /api/reports/trends — 13-week trend data
 * Query params: metric (revenue|avg_check|orders|covers|labor_pct|food_cost_pct|void_comp_pct), location_id
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager', 'admin'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const metric = params.get('metric') ?? 'total_revenue'
  const locationId = params.get('location_id') ?? undefined

  const result = await getTrendData(user.org_id, metric, locationId)

  if (result.is_mock || !result.data) {
    return NextResponse.json({ is_mock: true, data: null })
  }

  // Calculate 13-week average (exclude current incomplete week)
  const completeWeeks = result.data.slice(0, -1)
  const avgMap: Record<string, number> = {}
  const metricKeys = ['total_revenue', 'avg_check', 'order_count', 'covers', 'labor_pct', 'food_cost_pct', 'void_comp_pct']

  for (const key of metricKeys) {
    const values = completeWeeks.map(w => (w as unknown as Record<string, number>)[key] ?? 0)
    avgMap[key] = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0
  }

  // Flag deviation >10%
  const flagged = result.data.map(week => {
    const val = (week as unknown as Record<string, number>)[metric] ?? 0
    const avg = avgMap[metric] ?? 0
    const deviation = avg > 0 ? ((val - avg) / avg) * 100 : 0
    return {
      ...week,
      is_deviation: Math.abs(deviation) > 10,
      deviation_pct: Math.round(deviation * 10) / 10,
    }
  })

  return NextResponse.json({
    is_mock: false,
    data: {
      weeks: flagged,
      averages: avgMap,
      selected_metric: metric,
    },
  })
}
