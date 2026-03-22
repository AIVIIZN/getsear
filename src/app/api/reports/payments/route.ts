import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getMockPaymentMix, CHART_COLORS } from '@/lib/reports/mock-data'

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
  const locationId = params.get('location_id')

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery = (supabase.from('payments') as any)
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.org_id)
  if (locationId) countQuery = countQuery.eq('location_id', locationId)
  const { count } = await countQuery

  if (!count || count === 0) {
    return NextResponse.json({ is_mock: true, data: getMockPaymentMix() })
  }

  // Real data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('payments') as any)
    .select('payment_method, amount')
    .eq('org_id', user.org_id)
    .eq('status', 'completed')
    .gte('created_at', `${dateFrom}T00:00:00Z`)
    .lte('created_at', `${dateTo}T23:59:59Z`)

  if (locationId) query = query.eq('location_id', locationId)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ is_mock: false, data: null, error: error.message }, { status: 500 })
  }

  const methodMap = new Map<string, number>()
  let total = 0
  for (const p of (data ?? [])) {
    const method = p.payment_method ?? 'other'
    const amount = Number(p.amount) || 0
    methodMap.set(method, (methodMap.get(method) ?? 0) + amount)
    total += amount
  }

  const colorMap: Record<string, string> = {
    card: CHART_COLORS.chart1,
    cash: CHART_COLORS.chart3,
    gift_card: CHART_COLORS.chart4,
    other: CHART_COLORS.chart5,
  }

  const result = Array.from(methodMap.entries())
    .map(([method, amount]) => ({
      method: method.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      amount: Math.round(amount * 100) / 100,
      percentage: total > 0 ? Math.round((amount / total) * 1000) / 10 : 0,
      color: colorMap[method] ?? CHART_COLORS.chart2,
    }))
    .sort((a, b) => b.amount - a.amount)

  return NextResponse.json({ is_mock: false, data: result })
}
