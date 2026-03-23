/**
 * Prep list generation logic for Sear POS Inventory module.
 * Generates prep lists based on par levels, current counts, and historical demand.
 */

export interface PrepListItem {
  inventory_item_id: string
  item_name: string
  unit: string
  current_count: number
  par_level: number
  avg_daily_usage: number // Based on historical same-day-of-week
  projected_need: number // par_level - current + avg_daily_usage buffer
  prep_quantity: number // What to prep/order
  priority: 'critical' | 'high' | 'normal'
  category: string
}

export interface PrepListResult {
  generated_at: string
  day_of_week: string
  items: PrepListItem[]
  total_items: number
  critical_count: number
}

/**
 * Calculate prep quantity needed for an item.
 * Formula: max(0, par_level - current_count + buffer)
 * Buffer = avg daily usage * safety factor (1.2x)
 */
export function calculatePrepQuantity(
  currentCount: number,
  parLevel: number,
  avgDailyUsage: number,
  safetyFactor: number = 1.2
): number {
  const buffer = avgDailyUsage * safetyFactor
  const needed = parLevel - currentCount + buffer
  return Math.max(0, Math.ceil(needed * 10) / 10) // Round up to 1 decimal
}

/**
 * Determine prep priority based on current stock vs par level.
 */
export function getPrepPriority(
  currentCount: number,
  parLevel: number,
  reorderPoint: number
): 'critical' | 'high' | 'normal' {
  if (currentCount <= 0) return 'critical'
  if (currentCount <= reorderPoint) return 'critical'
  if (currentCount <= parLevel * 0.5) return 'high'
  return 'normal'
}

/**
 * Generate a complete prep list from inventory data and historical usage.
 */
export function generatePrepList(
  items: Array<{
    id: string
    name: string
    unit: string
    current_stock: number
    par_level: number
    reorder_point: number
    category: string
  }>,
  historicalUsage: Map<string, number>, // item_id -> avg daily usage
  dayOfWeek: string
): PrepListResult {
  const now = new Date().toISOString()

  const prepItems: PrepListItem[] = items
    .map((item) => {
      const avgUsage = historicalUsage.get(item.id) ?? 0
      const prepQty = calculatePrepQuantity(item.current_stock, item.par_level, avgUsage)
      const priority = getPrepPriority(item.current_stock, item.par_level, item.reorder_point)

      return {
        inventory_item_id: item.id,
        item_name: item.name,
        unit: item.unit,
        current_count: item.current_stock,
        par_level: item.par_level,
        avg_daily_usage: avgUsage,
        projected_need: item.par_level - item.current_stock + avgUsage,
        prep_quantity: prepQty,
        priority,
        category: item.category || 'General',
      }
    })
    .filter((item) => item.prep_quantity > 0)
    .sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2 }
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }
      return a.item_name.localeCompare(b.item_name)
    })

  return {
    generated_at: now,
    day_of_week: dayOfWeek,
    items: prepItems,
    total_items: prepItems.length,
    critical_count: prepItems.filter((i) => i.priority === 'critical').length,
  }
}
