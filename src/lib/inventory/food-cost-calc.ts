/**
 * Food cost calculation utilities for Sear POS Inventory module.
 * Computes theoretical vs actual food cost with variance analysis.
 */

export interface RecipeIngredient {
  inventory_item_id: string
  item_name: string
  quantity: number
  unit: string
  unit_cost: number // cents
}

export interface MenuItem {
  id: string
  name: string
  price: number // cents
  category: string
  quantity_sold: number
}

export interface FoodCostResult {
  category: string
  theoretical_cost: number // cents
  actual_cost: number // cents
  revenue: number // cents
  theoretical_pct: number // 0-100
  actual_pct: number // 0-100
  variance_pct: number // actual_pct - theoretical_pct
  is_flagged: boolean // variance > threshold
}

export interface FoodCostSummary {
  total_theoretical_cost: number
  total_actual_cost: number
  total_revenue: number
  theoretical_pct: number
  actual_pct: number
  variance_pct: number
  by_category: FoodCostResult[]
}

/**
 * Calculate theoretical food cost from recipes.
 * Theoretical = sum of (recipe ingredient quantity * unit cost) * items sold
 */
export function calculateTheoreticalCost(
  recipes: RecipeIngredient[],
  quantitySold: number
): number {
  const recipeCost = recipes.reduce((sum, ing) => sum + ing.quantity * ing.unit_cost, 0)
  return Math.round(recipeCost * quantitySold)
}

/**
 * Calculate actual food cost.
 * Actual = Beginning Inventory + Purchases - Ending Inventory
 */
export function calculateActualCost(
  beginningInventory: number,
  purchases: number,
  endingInventory: number
): number {
  return beginningInventory + purchases - endingInventory
}

/**
 * Calculate food cost percentage.
 */
export function foodCostPercentage(cost: number, revenue: number): number {
  if (revenue === 0) return 0
  return Math.round((cost / revenue) * 10000) / 100
}

/**
 * Compute full food cost analysis by category.
 */
export function computeFoodCostReport(
  items: Array<{
    category: string
    theoretical_cost: number
    actual_cost: number
    revenue: number
  }>,
  varianceThreshold: number = 3.0
): FoodCostSummary {
  // Group by category
  const categoryMap = new Map<string, { theoretical: number; actual: number; revenue: number }>()

  for (const item of items) {
    const cat = item.category || 'Uncategorized'
    const existing = categoryMap.get(cat) ?? { theoretical: 0, actual: 0, revenue: 0 }
    existing.theoretical += item.theoretical_cost
    existing.actual += item.actual_cost
    existing.revenue += item.revenue
    categoryMap.set(cat, existing)
  }

  const byCategory: FoodCostResult[] = Array.from(categoryMap.entries()).map(([category, data]) => {
    const theoreticalPct = foodCostPercentage(data.theoretical, data.revenue)
    const actualPct = foodCostPercentage(data.actual, data.revenue)
    const variancePct = Math.round((actualPct - theoreticalPct) * 100) / 100

    return {
      category,
      theoretical_cost: data.theoretical,
      actual_cost: data.actual,
      revenue: data.revenue,
      theoretical_pct: theoreticalPct,
      actual_pct: actualPct,
      variance_pct: variancePct,
      is_flagged: Math.abs(variancePct) > varianceThreshold,
    }
  })

  const totals = byCategory.reduce(
    (acc, cat) => ({
      theoretical: acc.theoretical + cat.theoretical_cost,
      actual: acc.actual + cat.actual_cost,
      revenue: acc.revenue + cat.revenue,
    }),
    { theoretical: 0, actual: 0, revenue: 0 }
  )

  return {
    total_theoretical_cost: totals.theoretical,
    total_actual_cost: totals.actual,
    total_revenue: totals.revenue,
    theoretical_pct: foodCostPercentage(totals.theoretical, totals.revenue),
    actual_pct: foodCostPercentage(totals.actual, totals.revenue),
    variance_pct:
      Math.round(
        (foodCostPercentage(totals.actual, totals.revenue) -
          foodCostPercentage(totals.theoretical, totals.revenue)) *
          100
      ) / 100,
    by_category: byCategory.sort((a, b) => Math.abs(b.variance_pct) - Math.abs(a.variance_pct)),
  }
}
