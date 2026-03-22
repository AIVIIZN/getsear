import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getMockPMIX } from '@/lib/reports/mock-data'

/**
 * GET /api/reports/pmix — product mix report
 * Query params: date_from, date_to, category, location_id
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager', 'admin'])
  if (roleCheck) return roleCheck

  const params = request.nextUrl.searchParams
  const dateFrom = params.get('date_from') ?? new Date().toISOString().split('T')[0]
  const dateTo = params.get('date_to') ?? dateFrom
  const category = params.get('category')
  const locationId = params.get('location_id')

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery = (supabase.from('order_items') as any)
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.org_id)
  if (locationId) countQuery = countQuery.eq('location_id', locationId)
  const { count } = await countQuery

  if (!count || count === 0) {
    let items = getMockPMIX()
    if (category) {
      items = items.filter((item) => item.category === category)
    }
    return NextResponse.json({ is_mock: true, data: items })
  }

  // Real data: query daily_item_metrics
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('daily_item_metrics') as any)
    .select('menu_item_id, quantity_sold, gross_revenue, food_cost, margin_percentage')
    .eq('org_id', user.org_id)
    .gte('metric_date', dateFrom)
    .lte('metric_date', dateTo)

  if (locationId) query = query.eq('location_id', locationId)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ is_mock: false, data: null, error: error.message }, { status: 500 })
  }

  // Aggregate by item
  const itemMap = new Map<string, { quantity: number; revenue: number; food_cost: number }>()
  for (const row of (data ?? [])) {
    const existing = itemMap.get(row.menu_item_id) ?? { quantity: 0, revenue: 0, food_cost: 0 }
    existing.quantity += Number(row.quantity_sold) || 0
    existing.revenue += Number(row.gross_revenue) || 0
    existing.food_cost += Number(row.food_cost) || 0
    itemMap.set(row.menu_item_id, existing)
  }

  // Fetch item names
  const itemIds = Array.from(itemMap.keys())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let itemsQuery = (supabase.from('menu_items') as any)
    .select('id, name, category_id')
    .in('id', itemIds)

  const { data: items } = await itemsQuery

  const avgQuantity = itemMap.size > 0
    ? Array.from(itemMap.values()).reduce((s, v) => s + v.quantity, 0) / itemMap.size
    : 0
  const avgMargin = itemMap.size > 0
    ? Array.from(itemMap.values()).reduce((s, v) => s + (v.revenue > 0 ? (1 - v.food_cost / v.revenue) * 100 : 0), 0) / itemMap.size
    : 0

  const result = (items ?? []).map((item: { id: string; name: string; category_id: string }) => {
    const agg = itemMap.get(item.id) ?? { quantity: 0, revenue: 0, food_cost: 0 }
    const margin = agg.revenue > 0 ? (1 - agg.food_cost / agg.revenue) * 100 : 0
    const foodCostPct = agg.revenue > 0 ? (agg.food_cost / agg.revenue) * 100 : 0
    let classification: string
    if (agg.quantity >= avgQuantity && margin >= avgMargin) classification = 'Star'
    else if (agg.quantity >= avgQuantity && margin < avgMargin) classification = 'Plowhorse'
    else if (agg.quantity < avgQuantity && margin >= avgMargin) classification = 'Puzzle'
    else classification = 'Dog'

    return {
      name: item.name,
      category: item.category_id,
      quantity_sold: agg.quantity,
      revenue: Math.round(agg.revenue * 100) / 100,
      food_cost_pct: Math.round(foodCostPct * 10) / 10,
      margin_pct: Math.round(margin * 10) / 10,
      classification,
      popularity: agg.quantity,
      profitability: Math.round(margin),
    }
  })

  return NextResponse.json({ is_mock: false, data: result })
}
