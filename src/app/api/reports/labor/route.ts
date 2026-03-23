import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getLaborData } from '@/lib/reports/queries'

/**
 * GET /api/reports/labor — labor cost, hours, percentage
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager', 'admin'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const dateFrom = params.get('date_from') ?? new Date().toISOString().split('T')[0]
  const dateTo = params.get('date_to') ?? dateFrom
  const locationId = params.get('location_id') ?? undefined

  const result = await getLaborData(user.org_id, dateFrom, dateTo, locationId)

  if (result.is_mock || !result.data) {
    return NextResponse.json({
      is_mock: true,
      data: {
        entries: [],
        total_labor_cost: 0,
        total_hours: 0,
        labor_percentage: 0,
        revenue: 0,
        overtime_hours: 0,
        overtime_cost: 0,
        by_role: [],
      },
    })
  }

  return NextResponse.json({ is_mock: false, data: result.data })
}
