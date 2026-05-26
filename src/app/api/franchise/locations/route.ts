import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/**
 * GET /api/franchise/locations — list all locations with summary metrics
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const params = request.nextUrl.searchParams
  const includeMetrics = params.get('include_metrics') !== 'false'

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: locations, error } = await (supabase.from('locations') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .order('name', { ascending: true })

  if (error) {
    return apiError(500, 'Failed to fetch locations')
  }

  const locationList = (locations ?? []) as Array<Record<string, unknown>>

  if (!includeMetrics) {
    return NextResponse.json({ data: locationList })
  }

  // Fetch summary metrics for each location (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const cutoff = thirtyDaysAgo.toISOString()

  const enriched = await Promise.all(
    locationList.map(async (loc) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: orders } = await (supabase.from('orders') as any)
        .select('total')
        .eq('org_id', user.org_id)
        .eq('location_id', loc.id)
        .in('status', ['closed', 'served'])
        .gte('created_at', cutoff)

      const orderList = (orders ?? []) as Array<{ total: string }>
      const revenue = orderList.reduce((sum, o) => sum + parseFloat(o.total || '0'), 0)

      return {
        ...loc,
        metrics: {
          order_count_30d: orderList.length,
          revenue_30d: revenue.toFixed(2),
        },
      }
    }),
  )

  return NextResponse.json({ data: enriched })
}
