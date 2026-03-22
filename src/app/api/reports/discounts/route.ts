import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getMockDiscounts } from '@/lib/reports/mock-data'

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
  const locationId = params.get('location_id')

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery = (supabase.from('order_discounts') as any)
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.org_id)
  if (locationId) countQuery = countQuery.eq('location_id', locationId)
  const { count } = await countQuery

  if (!count || count === 0) {
    return NextResponse.json({ is_mock: true, data: getMockDiscounts() })
  }

  // Real data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('order_discounts') as any)
    .select('discount_name, discount_type, amount')
    .eq('org_id', user.org_id)
    .gte('created_at', `${dateFrom}T00:00:00Z`)
    .lte('created_at', `${dateTo}T23:59:59Z`)

  if (locationId) query = query.eq('location_id', locationId)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ is_mock: false, data: null, error: error.message }, { status: 500 })
  }

  const discountMap = new Map<string, { count: number; amount: number }>()
  let totalDiscount = 0
  let totalComp = 0
  let totalVoid = 0

  for (const d of (data ?? [])) {
    const name = d.discount_name ?? 'Unknown'
    const amount = Number(d.amount) || 0
    const existing = discountMap.get(name) ?? { count: 0, amount: 0 }
    existing.count += 1
    existing.amount += amount
    discountMap.set(name, existing)

    if (d.discount_type === 'comp') totalComp += amount
    else if (d.discount_type === 'void') totalVoid += amount
    else totalDiscount += amount
  }

  return NextResponse.json({
    is_mock: false,
    data: {
      discounts: Array.from(discountMap.entries())
        .map(([name, v]) => ({ name, count: v.count, amount: Math.round(v.amount * 100) / 100 }))
        .sort((a, b) => b.amount - a.amount),
      total_discount: Math.round(totalDiscount * 100) / 100,
      total_comp: Math.round(totalComp * 100) / 100,
      total_void: Math.round(totalVoid * 100) / 100,
    },
  })
}
