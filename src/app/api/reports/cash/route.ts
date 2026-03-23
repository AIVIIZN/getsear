import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getCashDrawerReport } from '@/lib/reports/queries'

/**
 * GET /api/reports/cash — cash drawer reconciliation
 * Query params: date, location_id, employee_id
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager', 'admin'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const date = params.get('date') ?? new Date().toISOString().split('T')[0]
  const locationId = params.get('location_id') ?? undefined
  const employeeId = params.get('employee_id') ?? undefined

  const result = await getCashDrawerReport(user.org_id, date, locationId, employeeId)

  if (result.is_mock || !result.data) {
    return NextResponse.json({ is_mock: true, data: null })
  }

  // Calculate summary
  const summary = {
    total_starting: result.data.reduce((s, d) => s + d.starting_cash, 0),
    total_cash_sales: result.data.reduce((s, d) => s + d.cash_sales, 0),
    total_payouts: result.data.reduce((s, d) => s + d.cash_payouts, 0),
    total_expected: result.data.reduce((s, d) => s + d.expected_cash, 0),
    total_actual: result.data.reduce((s, d) => s + d.actual_cash, 0),
    total_over_short: result.data.reduce((s, d) => s + d.over_short, 0),
    drawer_count: result.data.length,
  }

  return NextResponse.json({ is_mock: false, data: { drawers: result.data, summary } })
}
