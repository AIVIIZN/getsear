import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getPnLData } from '@/lib/reports/queries'

/**
 * GET /api/reports/pnl — P&L summary
 * Query params: month (YYYY-MM), location_id
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const month = params.get('month') ?? defaultMonth
  const locationId = params.get('location_id') ?? undefined

  const result = await getPnLData(user.org_id, month, locationId)

  if (result.is_mock || !result.data) {
    return NextResponse.json({ is_mock: true, data: null })
  }

  return NextResponse.json({ is_mock: false, data: result.data })
}
