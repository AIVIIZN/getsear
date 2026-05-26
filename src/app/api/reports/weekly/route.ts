import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
// Mock data removed — live queries only

/**
 * GET /api/reports/weekly — weekly aggregated sales
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager', 'admin'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const locationId = params.get('location_id')

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery = (supabase.from('orders') as any)
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.org_id)
  if (locationId) countQuery = countQuery.eq('location_id', locationId)
  const { count } = await countQuery

  if (!count || count === 0) {
    return NextResponse.json({ is_mock: true, data: [] })
  }

  // Real: aggregate daily_metrics by week
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('daily_metrics') as any)
    .select('metric_date, total_revenue, net_revenue, order_count, discount_total, tax_total')
    .eq('org_id', user.org_id)
    .gte('metric_date', fourWeeksAgo.toISOString().split('T')[0])
    .order('metric_date', { ascending: true })

  if (locationId) query = query.eq('location_id', locationId)

  const { data, error } = await query

  if (error) {
    return apiError(500, error.message, { extra: { "is_mock": false, "data": null } })
  }

  return NextResponse.json({ is_mock: false, data })
}
