import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeFoodCostReport, foodCostPercentage } from '@/lib/inventory/food-cost-calc'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager'])
  if (roleCheck) return roleCheck

  const db = createAdminClient()
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') ?? 'week' // day, week, month
  const threshold = parseFloat(searchParams.get('threshold') ?? '3.0')

  // Calculate date range
  const now = new Date()
  const startDate = new Date(now)
  switch (period) {
    case 'day':
      startDate.setDate(startDate.getDate() - 1)
      break
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1)
      break
    default: // week
      startDate.setDate(startDate.getDate() - 7)
  }

  // Fetch recipes with linked menu items and inventory items
  const { data: recipes } = await db
    .from('inventory_recipes')
    .select('*, inventory_items(name, unit_cost, category), menu_items(name, price)')
    .eq('org_id', user.org_id)

  // Fetch order items for the period to get quantities sold
  const { data: orderItems } = await db
    .from('order_items')
    .select('menu_item_id, quantity, subtotal')
    .eq('org_id', user.org_id)
    .gte('created_at', startDate.toISOString())

  // Compute sales by menu item
  const salesByItem = new Map<string, { qty: number; revenue: number }>()
  for (const oi of orderItems ?? []) {
    const existing = salesByItem.get(oi.menu_item_id as string) ?? { qty: 0, revenue: 0 }
    existing.qty += oi.quantity as number
    existing.revenue += Math.round(parseFloat(oi.subtotal as string) * 100)
    salesByItem.set(oi.menu_item_id as string, existing)
  }

  // Compute theoretical cost per category
  const categoryData = new Map<string, { theoretical: number; actual: number; revenue: number }>()

  for (const recipe of recipes ?? []) {
    const invItem = recipe.inventory_items as Record<string, unknown> | null
    const menuItem = recipe.menu_items as Record<string, unknown> | null
    if (!invItem || !menuItem) continue

    const category = (invItem.category as string) || 'General'
    const unitCost = parseFloat(invItem.unit_cost as string) * 100 // Convert to cents
    const recipeQty = recipe.quantity as number
    const menuItemId = recipe.menu_item_id as string

    const sales = salesByItem.get(menuItemId) ?? { qty: 0, revenue: 0 }
    const theoreticalCost = Math.round(unitCost * recipeQty * sales.qty)

    const existing = categoryData.get(category) ?? { theoretical: 0, actual: 0, revenue: 0 }
    existing.theoretical += theoreticalCost
    existing.revenue += sales.revenue
    categoryData.set(category, existing)
  }

  // Fetch purchase totals for actual cost approximation
  const { data: purchases } = await db
    .from('inventory_purchase_orders')
    .select('total')
    .eq('org_id', user.org_id)
    .eq('status', 'received')
    .gte('received_at', startDate.toISOString())

  const totalPurchases = (purchases ?? []).reduce(
    (sum: number, po: Record<string, unknown>) => sum + Math.round(parseFloat(po.total as string) * 100),
    0
  )

  // Distribute actual cost proportionally by category
  const totalTheoretical = Array.from(categoryData.values()).reduce((s, c) => s + c.theoretical, 0)
  for (const [cat, data] of categoryData.entries()) {
    const proportion = totalTheoretical > 0 ? data.theoretical / totalTheoretical : 0
    data.actual = Math.round(totalPurchases * proportion)
    categoryData.set(cat, data)
  }

  // Build result items
  const items = Array.from(categoryData.entries()).map(([category, data]) => ({
    category,
    theoretical_cost: data.theoretical,
    actual_cost: data.actual,
    revenue: data.revenue,
  }))

  const report = computeFoodCostReport(items, threshold)

  // Get current total food cost % from inventory value
  const { data: invItems } = await db
    .from('inventory_items')
    .select('current_stock, unit_cost')
    .eq('org_id', user.org_id)
    .eq('is_active', true)

  const totalInventoryValue = (invItems ?? []).reduce(
    (sum: number, item: Record<string, unknown>) =>
      sum + (item.current_stock as number) * parseFloat(item.unit_cost as string) * 100,
    0
  )

  return NextResponse.json({
    data: {
      ...report,
      total_inventory_value: totalInventoryValue,
      period,
      start_date: startDate.toISOString(),
      end_date: now.toISOString(),
      current_food_cost_pct: report.total_revenue > 0
        ? foodCostPercentage(report.total_actual_cost, report.total_revenue)
        : 0,
    },
  })
}
