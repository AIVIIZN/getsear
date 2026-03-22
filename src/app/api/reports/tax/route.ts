import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getMockTax } from '@/lib/reports/mock-data'

/**
 * GET /api/reports/tax — tax collected by rate
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
  let countQuery = (supabase.from('orders') as any)
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.org_id)
  if (locationId) countQuery = countQuery.eq('location_id', locationId)
  const { count } = await countQuery

  if (!count || count === 0) {
    return NextResponse.json({ is_mock: true, data: getMockTax() })
  }

  // Real: get tax rates and aggregate from orders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let taxRatesQuery = (supabase.from('tax_rates') as any)
    .select('id, name, rate')
    .eq('org_id', user.org_id)
  if (locationId) taxRatesQuery = taxRatesQuery.eq('location_id', locationId)
  const { data: taxRates } = await taxRatesQuery

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ordersQuery = (supabase.from('orders') as any)
    .select('subtotal, tax')
    .eq('org_id', user.org_id)
    .gte('created_at', `${dateFrom}T00:00:00Z`)
    .lte('created_at', `${dateTo}T23:59:59Z`)
  if (locationId) ordersQuery = ordersQuery.eq('location_id', locationId)
  const { data: orders } = await ordersQuery

  const totalTaxable = (orders ?? []).reduce((s: number, o: { subtotal: number }) => s + (Number(o.subtotal) || 0), 0)
  const totalTax = (orders ?? []).reduce((s: number, o: { tax: number }) => s + (Number(o.tax) || 0), 0)

  if (!taxRates || taxRates.length === 0) {
    return NextResponse.json({
      is_mock: false,
      data: [{
        rate_name: 'Combined Tax',
        rate_pct: totalTaxable > 0 ? Math.round((totalTax / totalTaxable) * 10000) / 100 : 0,
        taxable_sales: Math.round(totalTaxable * 100) / 100,
        tax_collected: Math.round(totalTax * 100) / 100,
      }],
    })
  }

  const result = taxRates.map((tr: { name: string; rate: number }) => ({
    rate_name: tr.name,
    rate_pct: Number(tr.rate),
    taxable_sales: Math.round(totalTaxable * 100) / 100,
    tax_collected: Math.round(totalTaxable * Number(tr.rate) / 100 * 100) / 100,
  }))

  return NextResponse.json({ is_mock: false, data: result })
}
