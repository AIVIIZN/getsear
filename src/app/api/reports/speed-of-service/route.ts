import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getSpeedOfService } from '@/lib/reports/queries'

/**
 * GET /api/reports/speed-of-service — ticket time analytics
 * Query params: date_from, date_to, location_id, station_id
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager', 'admin'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 6)
  const dateFrom = params.get('date_from') ?? weekAgo.toISOString().split('T')[0]
  const dateTo = params.get('date_to') ?? now.toISOString().split('T')[0]
  const locationId = params.get('location_id') ?? undefined
  const stationId = params.get('station_id') ?? undefined

  const result = await getSpeedOfService(user.org_id, dateFrom, dateTo, locationId, stationId)

  if (result.is_mock || !result.data) {
    return NextResponse.json({ is_mock: true, data: null })
  }

  return NextResponse.json({ is_mock: false, data: result.data })
}
