import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getFoodCost } from '@/lib/reports/queries'

/**
 * GET /api/reports/food-cost — theoretical vs actual food cost
 * Query params: date_from, date_to, location_id
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager', 'admin'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const dateFrom = params.get('date_from') ?? monthStart.toISOString().split('T')[0]
  const dateTo = params.get('date_to') ?? now.toISOString().split('T')[0]
  const locationId = params.get('location_id') ?? undefined

  const result = await getFoodCost(user.org_id, dateFrom, dateTo, locationId)

  if (result.is_mock || !result.data) {
    return NextResponse.json({ is_mock: true, data: null })
  }

  return NextResponse.json({ is_mock: false, data: result.data })
}
