import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getDashboardData } from '@/lib/reports/queries'

/**
 * GET /api/reports/dashboard — owner mobile dashboard (live data)
 * Query params: location_id
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'admin'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const locationId = params.get('location_id') ?? undefined

  const result = await getDashboardData(user.org_id, locationId)

  if (result.is_mock || !result.data) {
    return NextResponse.json({ is_mock: true, data: null })
  }

  return NextResponse.json({ is_mock: false, data: result.data })
}
