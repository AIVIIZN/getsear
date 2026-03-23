import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getPaymentSummary } from '@/lib/reports/queries'

/**
 * GET /api/reports/payments — payment method breakdown
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

  const result = await getPaymentSummary(user.org_id, dateFrom, dateTo, locationId)

  if (result.is_mock || !result.data) {
    return NextResponse.json({ is_mock: true, data: [] })
  }

  return NextResponse.json({ is_mock: false, data: result.data })
}
