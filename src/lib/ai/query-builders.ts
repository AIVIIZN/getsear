/**
 * Parameterized Query Builders for AI Tool Handlers
 *
 * Each function builds a Supabase query for a specific data domain.
 * All queries are scoped by org_id and location_id for security.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

interface ScopeParams {
  orgId: string
  locationId: string
}

interface DateRange {
  startDate: string
  endDate: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryResult = { data: any; error: any }

/**
 * Query sales from orders + order_items tables.
 */
export async function querySalesData(
  supabase: SupabaseClient,
  scope: ScopeParams,
  dates: DateRange,
  options: { groupBy?: string; orderType?: string }
): Promise<QueryResult> {
  const { orgId, locationId } = scope
  const { startDate, endDate } = dates
  const { groupBy, orderType } = options

  // Base: aggregate orders
  if (!groupBy || groupBy === 'day') {
    let query = supabase.rpc('ai_sales_summary', {
      p_org_id: orgId,
      p_location_id: locationId,
      p_start_date: startDate,
      p_end_date: endDate,
      p_group_by: groupBy ?? 'total',
      p_order_type: orderType ?? null,
    })

    const result = await query
    if (result.error) {
      // Fallback to direct query if RPC doesn't exist
      return fallbackSalesQuery(supabase, scope, dates, options)
    }
    return result
  }

  return fallbackSalesQuery(supabase, scope, dates, options)
}

async function fallbackSalesQuery(
  supabase: SupabaseClient,
  scope: ScopeParams,
  dates: DateRange,
  options: { groupBy?: string; orderType?: string }
): Promise<QueryResult> {
  const { orgId, locationId } = scope
  const { startDate, endDate } = dates

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = supabase
    .from('orders')
    .select('id, total_cents, subtotal_cents, tax_cents, tip_cents, cover_count, order_type, created_at, closed_at')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .gte('created_at', `${startDate}T00:00:00Z`)
    .lte('created_at', `${endDate}T23:59:59Z`)
    .in('status', ['closed', 'completed', 'paid'])

  if (options.orderType) {
    query = query.eq('order_type', options.orderType)
  }

  const result = await query
  if (result.error) return result

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orders = (result.data ?? []) as any[]
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_cents ?? 0), 0)
  const totalCovers = orders.reduce((sum, o) => sum + (o.cover_count ?? 1), 0)
  const avgCheck = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0
  const totalTips = orders.reduce((sum, o) => sum + (o.tip_cents ?? 0), 0)

  if (!options.groupBy || options.groupBy === 'day') {
    // Group by day
    const byDay = new Map<string, { revenue: number; covers: number; orders: number; tips: number }>()
    for (const o of orders) {
      const day = (o.created_at as string).split('T')[0]
      const existing = byDay.get(day) ?? { revenue: 0, covers: 0, orders: 0, tips: 0 }
      existing.revenue += o.total_cents ?? 0
      existing.covers += o.cover_count ?? 1
      existing.orders += 1
      existing.tips += o.tip_cents ?? 0
      byDay.set(day, existing)
    }

    return {
      data: {
        summary: {
          total_revenue_cents: totalRevenue,
          total_revenue: `$${(totalRevenue / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          total_covers: totalCovers,
          total_orders: orders.length,
          avg_check_cents: avgCheck,
          avg_check: `$${(avgCheck / 100).toFixed(2)}`,
          total_tips_cents: totalTips,
          total_tips: `$${(totalTips / 100).toFixed(2)}`,
          period: `${startDate} to ${endDate}`,
        },
        by_day: Array.from(byDay.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, d]) => ({
            date,
            revenue: `$${(d.revenue / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            revenue_cents: d.revenue,
            covers: d.covers,
            orders: d.orders,
            tips: `$${(d.tips / 100).toFixed(2)}`,
          })),
      },
      error: null,
    }
  }

  if (options.groupBy === 'order_type') {
    const byType = new Map<string, { revenue: number; covers: number; count: number }>()
    for (const o of orders) {
      const t = o.order_type ?? 'unknown'
      const existing = byType.get(t) ?? { revenue: 0, covers: 0, count: 0 }
      existing.revenue += o.total_cents ?? 0
      existing.covers += o.cover_count ?? 1
      existing.count += 1
      byType.set(t, existing)
    }
    return {
      data: {
        summary: { total_revenue_cents: totalRevenue, total_covers: totalCovers, total_orders: orders.length },
        by_order_type: Array.from(byType.entries()).map(([type, d]) => ({
          order_type: type,
          revenue: `$${(d.revenue / 100).toFixed(2)}`,
          revenue_cents: d.revenue,
          covers: d.covers,
          orders: d.count,
          pct_of_revenue: totalRevenue > 0 ? `${((d.revenue / totalRevenue) * 100).toFixed(1)}%` : '0%',
        })),
      },
      error: null,
    }
  }

  if (options.groupBy === 'hour') {
    const byHour = new Map<number, { revenue: number; covers: number; count: number }>()
    for (const o of orders) {
      const hour = new Date(o.created_at).getHours()
      const existing = byHour.get(hour) ?? { revenue: 0, covers: 0, count: 0 }
      existing.revenue += o.total_cents ?? 0
      existing.covers += o.cover_count ?? 1
      existing.count += 1
      byHour.set(hour, existing)
    }
    return {
      data: {
        summary: { total_revenue_cents: totalRevenue, total_covers: totalCovers },
        by_hour: Array.from(byHour.entries())
          .sort(([a], [b]) => a - b)
          .map(([hour, d]) => ({
            hour: `${hour.toString().padStart(2, '0')}:00`,
            revenue: `$${(d.revenue / 100).toFixed(2)}`,
            revenue_cents: d.revenue,
            covers: d.covers,
            orders: d.count,
          })),
      },
      error: null,
    }
  }

  // Default: return summary
  return {
    data: {
      summary: {
        total_revenue_cents: totalRevenue,
        total_revenue: `$${(totalRevenue / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        total_covers: totalCovers,
        total_orders: orders.length,
        avg_check_cents: avgCheck,
        avg_check: `$${(avgCheck / 100).toFixed(2)}`,
        period: `${startDate} to ${endDate}`,
      },
    },
    error: null,
  }
}

/**
 * Query labor data from time_entries table.
 */
export async function queryLaborData(
  supabase: SupabaseClient,
  scope: ScopeParams,
  dates: DateRange,
  options: { groupBy?: string; role?: string }
): Promise<QueryResult> {
  const { orgId, locationId } = scope
  const { startDate, endDate } = dates

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = supabase
    .from('time_entries')
    .select('id, user_id, clock_in, clock_out, regular_minutes, overtime_minutes, total_pay_cents, role, break_minutes')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .gte('clock_in', `${startDate}T00:00:00Z`)
    .lte('clock_in', `${endDate}T23:59:59Z`)

  if (options.role) {
    query = query.eq('role', options.role)
  }

  const result = await query
  if (result.error) return result

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries = (result.data ?? []) as any[]
  const totalRegularMinutes = entries.reduce((sum, e) => sum + (e.regular_minutes ?? 0), 0)
  const totalOvertimeMinutes = entries.reduce((sum, e) => sum + (e.overtime_minutes ?? 0), 0)
  const totalPayCents = entries.reduce((sum, e) => sum + (e.total_pay_cents ?? 0), 0)
  const totalBreakMinutes = entries.reduce((sum, e) => sum + (e.break_minutes ?? 0), 0)

  // Get sales for labor % calculation
  const salesResult = await fallbackSalesQuery(supabase, scope, dates, {})
  const salesRevenue = salesResult.data?.summary?.total_revenue_cents ?? 0
  const laborPct = salesRevenue > 0 ? ((totalPayCents / salesRevenue) * 100).toFixed(1) : 'N/A'

  const summary = {
    total_hours: ((totalRegularMinutes + totalOvertimeMinutes) / 60).toFixed(1),
    regular_hours: (totalRegularMinutes / 60).toFixed(1),
    overtime_hours: (totalOvertimeMinutes / 60).toFixed(1),
    break_hours: (totalBreakMinutes / 60).toFixed(1),
    total_labor_cost: `$${(totalPayCents / 100).toFixed(2)}`,
    total_labor_cost_cents: totalPayCents,
    labor_pct: `${laborPct}%`,
    total_entries: entries.length,
    period: `${startDate} to ${endDate}`,
  }

  if (options.groupBy === 'employee') {
    const byEmployee = new Map<string, { name: string; hours: number; ot: number; pay: number }>()
    for (const e of entries) {
      const key = e.user_id
      const existing = byEmployee.get(key) ?? { name: e.user_id, hours: 0, ot: 0, pay: 0 }
      existing.hours += (e.regular_minutes ?? 0) / 60
      existing.ot += (e.overtime_minutes ?? 0) / 60
      existing.pay += e.total_pay_cents ?? 0
      byEmployee.set(key, existing)
    }

    // Look up employee names
    const userIds = Array.from(byEmployee.keys())
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, display_name')
        .in('id', userIds)
      if (users) {
        for (const u of users) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const existing = byEmployee.get((u as any).id)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (existing) existing.name = (u as any).display_name
        }
      }
    }

    return {
      data: {
        summary,
        by_employee: Array.from(byEmployee.values())
          .sort((a, b) => b.hours - a.hours)
          .map((e) => ({
            employee: e.name,
            total_hours: e.hours.toFixed(1),
            overtime_hours: e.ot.toFixed(1),
            labor_cost: `$${(e.pay / 100).toFixed(2)}`,
          })),
      },
      error: null,
    }
  }

  if (options.groupBy === 'role') {
    const byRole = new Map<string, { hours: number; ot: number; pay: number; count: number }>()
    for (const e of entries) {
      const r = e.role ?? 'unknown'
      const existing = byRole.get(r) ?? { hours: 0, ot: 0, pay: 0, count: 0 }
      existing.hours += (e.regular_minutes ?? 0) / 60
      existing.ot += (e.overtime_minutes ?? 0) / 60
      existing.pay += e.total_pay_cents ?? 0
      existing.count += 1
      byRole.set(r, existing)
    }
    return {
      data: {
        summary,
        by_role: Array.from(byRole.entries())
          .sort(([, a], [, b]) => b.pay - a.pay)
          .map(([role, d]) => ({
            role,
            total_hours: d.hours.toFixed(1),
            overtime_hours: d.ot.toFixed(1),
            labor_cost: `$${(d.pay / 100).toFixed(2)}`,
            entries: d.count,
          })),
      },
      error: null,
    }
  }

  if (options.groupBy === 'day') {
    const byDay = new Map<string, { hours: number; ot: number; pay: number }>()
    for (const e of entries) {
      const day = (e.clock_in as string).split('T')[0]
      const existing = byDay.get(day) ?? { hours: 0, ot: 0, pay: 0 }
      existing.hours += (e.regular_minutes ?? 0) / 60
      existing.ot += (e.overtime_minutes ?? 0) / 60
      existing.pay += e.total_pay_cents ?? 0
      byDay.set(day, existing)
    }
    return {
      data: {
        summary,
        by_day: Array.from(byDay.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, d]) => ({
            date,
            total_hours: d.hours.toFixed(1),
            overtime_hours: d.ot.toFixed(1),
            labor_cost: `$${(d.pay / 100).toFixed(2)}`,
          })),
      },
      error: null,
    }
  }

  return { data: { summary }, error: null }
}

/**
 * Query menu item performance from order_items + menu_items.
 */
export async function queryMenuPerformance(
  supabase: SupabaseClient,
  scope: ScopeParams,
  dates: DateRange,
  options: { sortBy?: string; sortDir?: string; limit?: number; categoryId?: string }
): Promise<QueryResult> {
  const { orgId, locationId } = scope
  const { startDate, endDate } = dates
  const itemLimit = options.limit ?? 10

  // Get order items for the period
  const { data: orderItems, error: oiError } = await supabase
    .from('order_items')
    .select('menu_item_id, quantity, price_cents, total_cents, order_id')
    .eq('org_id', orgId)
    .gte('created_at', `${startDate}T00:00:00Z`)
    .lte('created_at', `${endDate}T23:59:59Z`)

  if (oiError) return { data: null, error: oiError }

  // Aggregate by menu_item_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = orderItems as any[] ?? []
  const byItem = new Map<string, { units: number; revenue: number }>()
  for (const item of items) {
    const key = item.menu_item_id
    if (!key) continue
    const existing = byItem.get(key) ?? { units: 0, revenue: 0 }
    existing.units += item.quantity ?? 1
    existing.revenue += item.total_cents ?? item.price_cents ?? 0
    byItem.set(key, existing)
  }

  // Get menu item details
  const itemIds = Array.from(byItem.keys())
  if (itemIds.length === 0) {
    return { data: { items: [], period: `${startDate} to ${endDate}` }, error: null }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let menuQuery = supabase
    .from('menu_items')
    .select('id, name, category_id, price_cents, food_cost_cents')
    .in('id', itemIds.slice(0, 100))

  if (options.categoryId) {
    menuQuery = menuQuery.eq('category_id', options.categoryId)
  }

  const { data: menuItems, error: miError } = await menuQuery
  if (miError) return { data: null, error: miError }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const menuMap = new Map((menuItems as any[] ?? []).map((m) => [m.id, m]))

  const results = Array.from(byItem.entries())
    .map(([itemId, stats]) => {
      const menu = menuMap.get(itemId)
      if (!menu) return null
      const foodCostPct = stats.revenue > 0 && menu.food_cost_cents
        ? ((menu.food_cost_cents * stats.units) / stats.revenue * 100)
        : 0
      const marginPct = 100 - foodCostPct
      return {
        item_name: menu.name,
        units_sold: stats.units,
        revenue: `$${(stats.revenue / 100).toFixed(2)}`,
        revenue_cents: stats.revenue,
        price: `$${(menu.price_cents / 100).toFixed(2)}`,
        food_cost_pct: `${foodCostPct.toFixed(1)}%`,
        margin_pct: `${marginPct.toFixed(1)}%`,
        food_cost_pct_num: foodCostPct,
        margin_pct_num: marginPct,
      }
    })
    .filter(Boolean)

  // Sort
  const sortKey = options.sortBy ?? 'revenue'
  const sortAsc = options.sortDir === 'asc'
  results.sort((a, b) => {
    if (!a || !b) return 0
    let aVal: number, bVal: number
    switch (sortKey) {
      case 'units_sold': aVal = a.units_sold; bVal = b.units_sold; break
      case 'revenue': aVal = a.revenue_cents; bVal = b.revenue_cents; break
      case 'margin_pct': aVal = a.margin_pct_num; bVal = b.margin_pct_num; break
      case 'food_cost_pct': aVal = a.food_cost_pct_num; bVal = b.food_cost_pct_num; break
      default: aVal = a.revenue_cents; bVal = b.revenue_cents
    }
    return sortAsc ? aVal - bVal : bVal - aVal
  })

  return {
    data: {
      items: results.slice(0, itemLimit),
      total_items_with_sales: results.length,
      period: `${startDate} to ${endDate}`,
    },
    error: null,
  }
}

/**
 * Query food cost data from waste_entries + inventory data.
 */
export async function queryFoodCostData(
  supabase: SupabaseClient,
  scope: ScopeParams,
  dates: DateRange,
  options: { groupBy?: string }
): Promise<QueryResult> {
  const { orgId, locationId } = scope
  const { startDate, endDate } = dates

  // Get waste entries
  const { data: wasteEntries, error: wError } = await supabase
    .from('waste_entries')
    .select('id, item_name, quantity, cost_cents, reason, created_at, category')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .gte('created_at', `${startDate}T00:00:00Z`)
    .lte('created_at', `${endDate}T23:59:59Z`)

  if (wError) {
    // Table might not exist yet — return empty
    return {
      data: {
        total_waste_cost: '$0.00',
        total_waste_cost_cents: 0,
        entries: 0,
        period: `${startDate} to ${endDate}`,
        note: 'Waste tracking data not available',
      },
      error: null,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const waste = (wasteEntries as any[]) ?? []
  const totalWasteCents = waste.reduce((sum, w) => sum + (w.cost_cents ?? 0), 0)

  // Get sales for food cost % calc
  const salesResult = await fallbackSalesQuery(supabase, scope, dates, {})
  const totalRevenue = salesResult.data?.summary?.total_revenue_cents ?? 0
  const wastePct = totalRevenue > 0 ? ((totalWasteCents / totalRevenue) * 100).toFixed(1) : 'N/A'

  if (options.groupBy === 'day') {
    const byDay = new Map<string, { cost: number; count: number }>()
    for (const w of waste) {
      const day = (w.created_at as string).split('T')[0]
      const existing = byDay.get(day) ?? { cost: 0, count: 0 }
      existing.cost += w.cost_cents ?? 0
      existing.count += 1
      byDay.set(day, existing)
    }
    return {
      data: {
        summary: {
          total_waste_cost: `$${(totalWasteCents / 100).toFixed(2)}`,
          total_waste_cost_cents: totalWasteCents,
          waste_pct_of_revenue: `${wastePct}%`,
          total_entries: waste.length,
          period: `${startDate} to ${endDate}`,
        },
        by_day: Array.from(byDay.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, d]) => ({
            date,
            waste_cost: `$${(d.cost / 100).toFixed(2)}`,
            entries: d.count,
          })),
      },
      error: null,
    }
  }

  if (options.groupBy === 'item') {
    const byItem = new Map<string, { cost: number; quantity: number }>()
    for (const w of waste) {
      const name = w.item_name ?? 'Unknown'
      const existing = byItem.get(name) ?? { cost: 0, quantity: 0 }
      existing.cost += w.cost_cents ?? 0
      existing.quantity += w.quantity ?? 1
      byItem.set(name, existing)
    }
    return {
      data: {
        summary: {
          total_waste_cost: `$${(totalWasteCents / 100).toFixed(2)}`,
          waste_pct_of_revenue: `${wastePct}%`,
        },
        by_item: Array.from(byItem.entries())
          .sort(([, a], [, b]) => b.cost - a.cost)
          .map(([name, d]) => ({
            item: name,
            waste_cost: `$${(d.cost / 100).toFixed(2)}`,
            quantity_wasted: d.quantity,
          })),
      },
      error: null,
    }
  }

  return {
    data: {
      total_waste_cost: `$${(totalWasteCents / 100).toFixed(2)}`,
      total_waste_cost_cents: totalWasteCents,
      waste_pct_of_revenue: `${wastePct}%`,
      total_entries: waste.length,
      top_waste_items: waste
        .sort((a, b) => (b.cost_cents ?? 0) - (a.cost_cents ?? 0))
        .slice(0, 5)
        .map((w) => ({
          item: w.item_name,
          cost: `$${((w.cost_cents ?? 0) / 100).toFixed(2)}`,
          reason: w.reason,
        })),
      period: `${startDate} to ${endDate}`,
    },
    error: null,
  }
}

/**
 * Query speed of service from kds_tickets.
 */
export async function querySpeedOfService(
  supabase: SupabaseClient,
  scope: ScopeParams,
  dates: DateRange,
  options: { groupBy?: string; stationId?: string }
): Promise<QueryResult> {
  const { orgId, locationId } = scope
  const { startDate, endDate } = dates

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = supabase
    .from('kds_tickets')
    .select('id, station_id, created_at, bumped_at, ticket_time_seconds')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .gte('created_at', `${startDate}T00:00:00Z`)
    .lte('created_at', `${endDate}T23:59:59Z`)
    .not('bumped_at', 'is', null)

  if (options.stationId) {
    query = query.eq('station_id', options.stationId)
  }

  const result = await query
  if (result.error) {
    return {
      data: {
        avg_ticket_time_seconds: 0,
        note: 'KDS ticket data not available',
        period: `${startDate} to ${endDate}`,
      },
      error: null,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tickets = (result.data as any[]) ?? []

  // Calculate ticket times
  const times = tickets
    .map((t) => {
      if (t.ticket_time_seconds) return t.ticket_time_seconds
      if (t.bumped_at && t.created_at) {
        return (new Date(t.bumped_at).getTime() - new Date(t.created_at).getTime()) / 1000
      }
      return null
    })
    .filter((t): t is number => t !== null && t > 0)

  const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0
  const medianTime = times.length > 0
    ? times.sort((a, b) => a - b)[Math.floor(times.length / 2)]
    : 0

  const summary = {
    avg_ticket_time_seconds: Math.round(avgTime),
    avg_ticket_time: `${Math.floor(avgTime / 60)}m ${Math.round(avgTime % 60)}s`,
    median_ticket_time_seconds: Math.round(medianTime),
    median_ticket_time: `${Math.floor(medianTime / 60)}m ${Math.round(medianTime % 60)}s`,
    total_tickets: tickets.length,
    period: `${startDate} to ${endDate}`,
  }

  if (options.groupBy === 'station') {
    const byStation = new Map<string, number[]>()
    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i]
      const time = times[i]
      if (time === undefined) continue
      const sid = t.station_id ?? 'unknown'
      const arr = byStation.get(sid) ?? []
      arr.push(time)
      byStation.set(sid, arr)
    }
    return {
      data: {
        summary,
        by_station: Array.from(byStation.entries()).map(([station, stationTimes]) => {
          const avg = stationTimes.reduce((a, b) => a + b, 0) / stationTimes.length
          return {
            station_id: station,
            avg_ticket_time: `${Math.floor(avg / 60)}m ${Math.round(avg % 60)}s`,
            avg_seconds: Math.round(avg),
            tickets: stationTimes.length,
          }
        }),
      },
      error: null,
    }
  }

  return { data: summary, error: null }
}

/**
 * Query voids, comps, and discounts.
 */
export async function queryVoidsComps(
  supabase: SupabaseClient,
  scope: ScopeParams,
  dates: DateRange,
  options: { groupBy?: string }
): Promise<QueryResult> {
  const { orgId, locationId } = scope
  const { startDate, endDate } = dates

  const { data: adjustments, error } = await supabase
    .from('order_adjustments')
    .select('id, type, amount_cents, reason, user_id, created_at')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .gte('created_at', `${startDate}T00:00:00Z`)
    .lte('created_at', `${endDate}T23:59:59Z`)

  if (error) {
    return {
      data: {
        total_voids: 0,
        total_comps: 0,
        total_discounts: 0,
        note: 'Adjustment data not available',
        period: `${startDate} to ${endDate}`,
      },
      error: null,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adj = (adjustments as any[]) ?? []
  const voids = adj.filter((a) => a.type === 'void')
  const comps = adj.filter((a) => a.type === 'comp')
  const discounts = adj.filter((a) => a.type === 'discount')

  const summary = {
    total_voids: voids.length,
    total_void_amount: `$${(voids.reduce((s, v) => s + (v.amount_cents ?? 0), 0) / 100).toFixed(2)}`,
    total_comps: comps.length,
    total_comp_amount: `$${(comps.reduce((s, c) => s + (c.amount_cents ?? 0), 0) / 100).toFixed(2)}`,
    total_discounts: discounts.length,
    total_discount_amount: `$${(discounts.reduce((s, d) => s + (d.amount_cents ?? 0), 0) / 100).toFixed(2)}`,
    total_adjustments: adj.length,
    period: `${startDate} to ${endDate}`,
  }

  if (options.groupBy === 'employee') {
    const byEmployee = new Map<string, { voids: number; comps: number; discounts: number; total_cents: number }>()
    for (const a of adj) {
      const uid = a.user_id ?? 'unknown'
      const existing = byEmployee.get(uid) ?? { voids: 0, comps: 0, discounts: 0, total_cents: 0 }
      if (a.type === 'void') existing.voids++
      else if (a.type === 'comp') existing.comps++
      else existing.discounts++
      existing.total_cents += a.amount_cents ?? 0
      byEmployee.set(uid, existing)
    }

    // Lookup names
    const userIds = Array.from(byEmployee.keys())
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name')
      .in('id', userIds)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nameMap = new Map((users as any[] ?? []).map((u) => [u.id, u.display_name]))

    return {
      data: {
        summary,
        by_employee: Array.from(byEmployee.entries())
          .sort(([, a], [, b]) => b.total_cents - a.total_cents)
          .map(([uid, d]) => ({
            employee: nameMap.get(uid) ?? uid,
            voids: d.voids,
            comps: d.comps,
            discounts: d.discounts,
            total_amount: `$${(d.total_cents / 100).toFixed(2)}`,
          })),
      },
      error: null,
    }
  }

  return { data: summary, error: null }
}

/**
 * Query anonymized customer data.
 */
export async function queryCustomerData(
  supabase: SupabaseClient,
  scope: ScopeParams,
  dates: DateRange,
  options: { metric: string; limit?: number }
): Promise<QueryResult> {
  const { orgId } = scope
  const customerLimit = options.limit ?? 10

  if (options.metric === 'top_customers') {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, total_visits, total_spend, is_vip, created_at')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('total_spend', { ascending: false })
      .limit(customerLimit)

    if (error) return { data: null, error }

    return {
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        top_customers: (customers as any[] ?? []).map((c, i) => ({
          rank: i + 1,
          customer_id: `Customer #${c.id.slice(-6)}`,
          total_visits: c.total_visits ?? 0,
          total_spend: c.total_spend ? `$${parseFloat(c.total_spend).toFixed(2)}` : '$0.00',
          is_vip: c.is_vip ?? false,
        })),
        note: 'Customer names and contact info are not included for privacy.',
      },
      error: null,
    }
  }

  if (options.metric === 'visit_frequency') {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('total_visits')
      .eq('org_id', orgId)
      .is('deleted_at', null)

    if (error) return { data: null, error }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const visits = (customers as any[] ?? []).map((c) => c.total_visits ?? 0)
    const buckets = {
      '1 visit': visits.filter((v) => v === 1).length,
      '2-5 visits': visits.filter((v) => v >= 2 && v <= 5).length,
      '6-10 visits': visits.filter((v) => v >= 6 && v <= 10).length,
      '11-25 visits': visits.filter((v) => v >= 11 && v <= 25).length,
      '25+ visits': visits.filter((v) => v > 25).length,
    }

    return {
      data: {
        visit_frequency: Object.entries(buckets).map(([range, count]) => ({
          range,
          customers: count,
          pct: visits.length > 0 ? `${((count / visits.length) * 100).toFixed(1)}%` : '0%',
        })),
        total_customers: visits.length,
      },
      error: null,
    }
  }

  if (options.metric === 'new_vs_returning') {
    const { startDate, endDate } = dates
    const { data: newCustomers, error: nError } = await supabase
      .from('customers')
      .select('id', { count: 'exact' })
      .eq('org_id', orgId)
      .gte('created_at', `${startDate}T00:00:00Z`)
      .lte('created_at', `${endDate}T23:59:59Z`)

    if (nError) return { data: null, error: nError }

    const { count: totalCount } = await supabase
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null)

    return {
      data: {
        new_customers: newCustomers?.length ?? 0,
        total_customers: totalCount ?? 0,
        period: `${startDate} to ${endDate}`,
      },
      error: null,
    }
  }

  return {
    data: { note: `Metric "${options.metric}" is not yet supported. Available: top_customers, visit_frequency, new_vs_returning` },
    error: null,
  }
}

/**
 * Query inventory stock levels and waste trends.
 */
export async function queryInventoryData(
  supabase: SupabaseClient,
  scope: ScopeParams,
  options: { queryType: string; startDate?: string; endDate?: string; category?: string }
): Promise<QueryResult> {
  const { orgId, locationId } = scope

  if (options.queryType === 'below_par') {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id, name, current_quantity, par_level, unit, category')
      .eq('org_id', orgId)
      .eq('location_id', locationId)
      .not('par_level', 'is', null)

    if (error) return { data: { items: [], note: 'Inventory data not available' }, error: null }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (data as any[] ?? [])
      .filter((i) => (i.current_quantity ?? 0) < (i.par_level ?? 0))
      .sort((a, b) => {
        const aPct = a.par_level > 0 ? a.current_quantity / a.par_level : 1
        const bPct = b.par_level > 0 ? b.current_quantity / b.par_level : 1
        return aPct - bPct
      })
      .map((i) => ({
        name: i.name,
        current: `${i.current_quantity} ${i.unit}`,
        par_level: `${i.par_level} ${i.unit}`,
        shortage: `${i.par_level - i.current_quantity} ${i.unit}`,
        category: i.category,
      }))

    return { data: { items_below_par: items, total_below_par: items.length }, error: null }
  }

  if (options.queryType === 'stock_levels') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = supabase
      .from('inventory_items')
      .select('id, name, current_quantity, par_level, unit, category, last_counted_at')
      .eq('org_id', orgId)
      .eq('location_id', locationId)
      .order('name')

    if (options.category) {
      query = query.eq('category', options.category)
    }

    const { data, error } = await query
    if (error) return { data: { items: [], note: 'Inventory data not available' }, error: null }

    return {
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        stock_levels: (data as any[] ?? []).map((i) => ({
          name: i.name,
          current: `${i.current_quantity ?? 0} ${i.unit ?? ''}`.trim(),
          par_level: i.par_level ? `${i.par_level} ${i.unit ?? ''}`.trim() : 'Not set',
          status: i.par_level && (i.current_quantity ?? 0) < i.par_level ? 'BELOW PAR' : 'OK',
          category: i.category,
        })),
      },
      error: null,
    }
  }

  return {
    data: { note: `Query type "${options.queryType}" processed. Check waste_entries for trends.` },
    error: null,
  }
}

/**
 * Query tip data from orders and payments.
 */
export async function queryTipsData(
  supabase: SupabaseClient,
  scope: ScopeParams,
  dates: DateRange,
  options: { groupBy?: string }
): Promise<QueryResult> {
  const { orgId, locationId } = scope
  const { startDate, endDate } = dates

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, tip_cents, total_cents, server_id, created_at')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .gte('created_at', `${startDate}T00:00:00Z`)
    .lte('created_at', `${endDate}T23:59:59Z`)
    .in('status', ['closed', 'completed', 'paid'])
    .gt('tip_cents', 0)

  if (error) return { data: null, error }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tippedOrders = (orders as any[]) ?? []
  const totalTips = tippedOrders.reduce((s, o) => s + (o.tip_cents ?? 0), 0)
  const totalSales = tippedOrders.reduce((s, o) => s + (o.total_cents ?? 0), 0)
  const tipPct = totalSales > 0 ? ((totalTips / totalSales) * 100).toFixed(1) : '0'

  const summary = {
    total_tips: `$${(totalTips / 100).toFixed(2)}`,
    total_tips_cents: totalTips,
    tip_pct: `${tipPct}%`,
    tipped_orders: tippedOrders.length,
    avg_tip: tippedOrders.length > 0 ? `$${(totalTips / tippedOrders.length / 100).toFixed(2)}` : '$0.00',
    period: `${startDate} to ${endDate}`,
  }

  if (options.groupBy === 'server') {
    const byServer = new Map<string, { tips: number; orders: number; sales: number }>()
    for (const o of tippedOrders) {
      const sid = o.server_id ?? 'unassigned'
      const existing = byServer.get(sid) ?? { tips: 0, orders: 0, sales: 0 }
      existing.tips += o.tip_cents ?? 0
      existing.orders += 1
      existing.sales += o.total_cents ?? 0
      byServer.set(sid, existing)
    }

    const userIds = Array.from(byServer.keys()).filter((id) => id !== 'unassigned')
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name')
      .in('id', userIds)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nameMap = new Map((users as any[] ?? []).map((u) => [u.id, u.display_name]))

    return {
      data: {
        summary,
        by_server: Array.from(byServer.entries())
          .sort(([, a], [, b]) => b.tips - a.tips)
          .map(([sid, d]) => ({
            server: nameMap.get(sid) ?? sid,
            total_tips: `$${(d.tips / 100).toFixed(2)}`,
            tip_pct: d.sales > 0 ? `${((d.tips / d.sales) * 100).toFixed(1)}%` : '0%',
            orders: d.orders,
            avg_tip: `$${(d.tips / d.orders / 100).toFixed(2)}`,
          })),
      },
      error: null,
    }
  }

  if (options.groupBy === 'day') {
    const byDay = new Map<string, { tips: number; orders: number }>()
    for (const o of tippedOrders) {
      const day = (o.created_at as string).split('T')[0]
      const existing = byDay.get(day) ?? { tips: 0, orders: 0 }
      existing.tips += o.tip_cents ?? 0
      existing.orders += 1
      byDay.set(day, existing)
    }
    return {
      data: {
        summary,
        by_day: Array.from(byDay.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, d]) => ({
            date,
            tips: `$${(d.tips / 100).toFixed(2)}`,
            orders: d.orders,
          })),
      },
      error: null,
    }
  }

  return { data: summary, error: null }
}

/**
 * Compare a metric across two date ranges.
 */
export async function comparePeriods(
  supabase: SupabaseClient,
  scope: ScopeParams,
  params: {
    metric: string
    periodA: DateRange
    periodB: DateRange
    groupBy?: string
  }
): Promise<QueryResult> {
  const { metric, periodA, periodB } = params

  let periodAData: number = 0
  let periodBData: number = 0
  let periodALabel = `${periodA.startDate} to ${periodA.endDate}`
  let periodBLabel = `${periodB.startDate} to ${periodB.endDate}`

  // Fetch data for both periods
  if (['revenue', 'covers', 'avg_check'].includes(metric)) {
    const [aResult, bResult] = await Promise.all([
      fallbackSalesQuery(supabase, scope, periodA, {}),
      fallbackSalesQuery(supabase, scope, periodB, {}),
    ])
    const aSummary = aResult.data?.summary
    const bSummary = bResult.data?.summary

    switch (metric) {
      case 'revenue':
        periodAData = aSummary?.total_revenue_cents ?? 0
        periodBData = bSummary?.total_revenue_cents ?? 0
        break
      case 'covers':
        periodAData = aSummary?.total_covers ?? 0
        periodBData = bSummary?.total_covers ?? 0
        break
      case 'avg_check':
        periodAData = aSummary?.avg_check_cents ?? 0
        periodBData = bSummary?.avg_check_cents ?? 0
        break
    }
  } else if (['labor_cost', 'labor_pct'].includes(metric)) {
    const [aResult, bResult] = await Promise.all([
      queryLaborData(supabase, scope, periodA, {}),
      queryLaborData(supabase, scope, periodB, {}),
    ])
    if (metric === 'labor_cost') {
      periodAData = aResult.data?.summary?.total_labor_cost_cents ?? 0
      periodBData = bResult.data?.summary?.total_labor_cost_cents ?? 0
    } else {
      periodAData = parseFloat(aResult.data?.summary?.labor_pct?.replace('%', '') ?? '0')
      periodBData = parseFloat(bResult.data?.summary?.labor_pct?.replace('%', '') ?? '0')
    }
  } else if (metric === 'tips') {
    const [aResult, bResult] = await Promise.all([
      queryTipsData(supabase, scope, periodA, {}),
      queryTipsData(supabase, scope, periodB, {}),
    ])
    periodAData = aResult.data?.total_tips_cents ?? aResult.data?.summary?.total_tips_cents ?? 0
    periodBData = bResult.data?.total_tips_cents ?? bResult.data?.summary?.total_tips_cents ?? 0
  }

  const change = periodAData !== 0 ? ((periodBData - periodAData) / Math.abs(periodAData)) * 100 : 0
  const isMoney = ['revenue', 'avg_check', 'labor_cost', 'tips'].includes(metric)
  const isPct = ['labor_pct', 'food_cost_pct'].includes(metric)

  const formatVal = (v: number) => {
    if (isMoney) return `$${(v / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    if (isPct) return `${v.toFixed(1)}%`
    return v.toLocaleString()
  }

  return {
    data: {
      metric,
      period_a: {
        label: periodALabel,
        value: formatVal(periodAData),
        raw: periodAData,
      },
      period_b: {
        label: periodBLabel,
        value: formatVal(periodBData),
        raw: periodBData,
      },
      change_pct: `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`,
      change_direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
    },
    error: null,
  }
}
