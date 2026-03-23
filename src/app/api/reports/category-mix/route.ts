import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
// Mock data removed — live queries only

/**
 * GET /api/reports/category-mix — sales by category
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
  let countQuery = (supabase.from('order_items') as any)
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.org_id)
  if (locationId) countQuery = countQuery.eq('location_id', locationId)
  const { count } = await countQuery

  if (!count || count === 0) {
    return NextResponse.json({ is_mock: true, data: [] })
  }

  // Real: join order_items → menu_items → menu_categories
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('order_items') as any)
    .select('quantity, price, menu_item:menu_items(category_id, category:menu_categories(name))')
    .eq('org_id', user.org_id)
    .gte('created_at', `${dateFrom}T00:00:00Z`)
    .lte('created_at', `${dateTo}T23:59:59Z`)

  if (locationId) query = query.eq('location_id', locationId)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ is_mock: false, data: null, error: error.message }, { status: 500 })
  }

  // Aggregate by category
  const catMap = new Map<string, number>()
  let totalSales = 0
  for (const item of (data ?? [])) {
    const catName = item.menu_item?.category?.name ?? 'Uncategorized'
    const sales = (Number(item.quantity) || 0) * (Number(item.price) || 0)
    catMap.set(catName, (catMap.get(catName) ?? 0) + sales)
    totalSales += sales
  }

  const result = Array.from(catMap.entries())
    .map(([category, sales]) => ({
      category,
      sales: Math.round(sales * 100) / 100,
      percentage: totalSales > 0 ? Math.round((sales / totalSales) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sales - a.sales)

  return NextResponse.json({ is_mock: false, data: result })
}
