import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getVoidCompData } from '@/lib/reports/queries'

/**
 * GET /api/reports/discounts — discounts and comps summary
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

  const result = await getVoidCompData(user.org_id, dateFrom, dateTo, locationId)

  if (result.is_mock || !result.data) {
    return NextResponse.json({
      is_mock: true,
      data: { discounts: [], total_discount: 0, total_comp: 0, total_void: 0 },
    })
  }

  // Map to backward-compatible format
  return NextResponse.json({
    is_mock: false,
    data: {
      discounts: result.data.by_reason.filter(r => r.type !== 'void').map(r => ({
        name: r.reason,
        count: r.count,
        amount: r.total,
      })),
      total_discount: result.data.total_discount,
      total_comp: result.data.total_comp,
      total_void: result.data.total_void,
    },
  })
}
