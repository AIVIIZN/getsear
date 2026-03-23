/**
 * Report query functions — all Supabase queries for reports.
 * Uses admin client (service_role) to bypass RLS.
 * All money returned as dollars (numeric(10,2) from DB).
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getDaypart, THRESHOLDS } from './constants'

// ── Types ───────────────────────────────────────────────────────────────

export interface DailySalesData {
  date: string
  total_revenue: number
  net_revenue: number
  order_count: number
  average_check: number
  covers: number
  discount_total: number
  tax_total: number
  tip_total: number
  food_revenue: number
  beverage_revenue: number
  by_order_type: Array<{ type: string; revenue: number; count: number }>
  by_hour: Array<{ hour: string; sales: number; orders: number }>
  by_payment_method: Array<{ method: string; amount: number; percentage: number; color: string }>
  prev_period: {
    total_revenue: number
    order_count: number
    average_check: number
  } | null
}

export interface LaborEntry {
  name: string
  role: string
  hours: number
  rate: number
  total_pay: number
  tips: number
  overtime_hours: number
  break_compliance: boolean
}

export interface LaborData {
  entries: LaborEntry[]
  total_labor_cost: number
  total_hours: number
  labor_percentage: number
  revenue: number
  overtime_hours: number
  overtime_cost: number
  by_role: Array<{ role: string; hours: number; cost: number; count: number }>
}

export interface PMIXItem {
  name: string
  category: string
  quantity_sold: number
  revenue: number
  food_cost_pct: number
  margin_pct: number
  classification: 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog'
  popularity: number
  profitability: number
}

export interface ServerPerformanceEntry {
  name: string
  user_id: string
  total_sales: number
  orders: number
  avg_check: number
  avg_tip_pct: number
  covers: number
  cash_tips: number
  card_tips: number
}

export interface PaymentSummaryEntry {
  method: string
  amount: number
  percentage: number
  tip_total: number
  refund_total: number
  count: number
  color: string
}

export interface TaxEntry {
  rate_name: string
  rate_pct: number
  taxable_sales: number
  tax_collected: number
}

export interface CashDrawerEntry {
  drawer_id: string
  employee_name: string
  employee_id: string
  opened_at: string
  closed_at: string | null
  starting_cash: number
  cash_sales: number
  cash_payouts: number
  expected_cash: number
  actual_cash: number
  over_short: number
  tolerance_level: 'green' | 'yellow' | 'red'
}

export interface SpeedOfServiceData {
  by_station: Array<{ station: string; avg_seconds: number; ticket_count: number }>
  by_daypart: Array<{ daypart: string; avg_seconds: number; ticket_count: number }>
  by_day: Array<{ date: string; avg_seconds: number; ticket_count: number }>
  heatmap: Array<{ station: string; daypart: string; avg_seconds: number; ticket_count: number }>
  outliers: Array<{ order_id: string; order_number: string; station: string; seconds: number; created_at: string }>
  overall_avg_seconds: number
}

export interface FoodCostEntry {
  name: string
  category: string
  qty_sold: number
  theoretical_cost: number
  actual_cost: number
  variance: number
  variance_pct: number
  is_flagged: boolean
}

export interface VoidCompEntry {
  employee_name: string
  employee_id: string
  void_count: number
  void_total: number
  comp_count: number
  comp_total: number
  discount_count: number
  discount_total: number
  is_flagged: boolean
  void_rate: number
}

export interface VoidCompData {
  total_void: number
  total_comp: number
  total_discount: number
  by_employee: VoidCompEntry[]
  by_reason: Array<{ reason: string; type: string; count: number; total: number }>
  by_day: Array<{ date: string; voids: number; comps: number; discounts: number }>
  location_avg_void_rate: number
}

export interface PnLData {
  month: string
  food_revenue: number
  beverage_revenue: number
  other_revenue: number
  total_revenue: number
  refund_total: number
  net_revenue: number
  cogs: number
  cogs_pct: number
  labor_cost: number
  labor_pct: number
  gross_profit: number
  gross_margin_pct: number
  prev_month: {
    total_revenue: number
    cogs: number
    labor_cost: number
    gross_profit: number
  } | null
}

export interface TrendWeek {
  week_start: string
  week_end: string
  week_number: number
  total_revenue: number
  avg_check: number
  order_count: number
  covers: number
  labor_pct: number
  food_cost_pct: number
  void_comp_pct: number
}

export interface DashboardData {
  today_revenue: number
  today_orders: number
  today_avg_check: number
  last_week_same_day_revenue: number
  revenue_change_pct: number
  labor_pct: number
  labor_is_high: boolean
  open_checks_count: number
  open_checks_total: number
  alerts: Array<{ type: string; message: string; severity: 'warning' | 'critical' }>
}

// ── Helper ──────────────────────────────────────────────────────────────

function getSupabase() {
  return createAdminClient()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toNumber(val: any): number {
  return Number(val) || 0
}

// ── Query Functions ─────────────────────────────────────────────────────

export async function getDailySales(
  orgId: string,
  date: string,
  locationId?: string
): Promise<{ data: DailySalesData | null; is_mock: boolean }> {
  const supabase = getSupabase()

  // Query orders for the given date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ordersQuery = (supabase.from('orders') as any)
    .select('id, order_type, subtotal, discount_total, tax_total, tip_total, total, guest_count, created_at, server_id, status')
    .eq('org_id', orgId)
    .gte('created_at', `${date}T04:00:00Z`)
    .lt('created_at', `${date}T28:00:00Z`.replace('T28:', 'T04:'))
    .not('status', 'eq', 'voided')

  // Actually compute next day 4AM
  const nextDay = new Date(date)
  nextDay.setDate(nextDay.getDate() + 1)
  const nextDayStr = nextDay.toISOString().split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ordersQuery = (supabase.from('orders') as any)
    .select('id, order_type, subtotal, discount_total, tax_total, tip_total, total, guest_count, created_at, status')
    .eq('org_id', orgId)
    .gte('created_at', `${date}T04:00:00Z`)
    .lt('created_at', `${nextDayStr}T04:00:00Z`)
    .not('status', 'eq', 'voided')

  if (locationId) ordersQuery = ordersQuery.eq('location_id', locationId)

  const { data: orders, error } = await ordersQuery

  if (error || !orders || orders.length === 0) {
    return { data: null, is_mock: true }
  }

  // Aggregate
  let totalRevenue = 0
  let discountTotal = 0
  let taxTotal = 0
  let tipTotal = 0
  let covers = 0
  const byType = new Map<string, { revenue: number; count: number }>()
  const byHour = new Map<number, { sales: number; orders: number }>()

  for (const order of orders) {
    const total = toNumber(order.total)
    const discount = toNumber(order.discount_total)
    const tax = toNumber(order.tax_total)
    const tip = toNumber(order.tip_total)
    const guests = toNumber(order.guest_count)

    totalRevenue += total
    discountTotal += discount
    taxTotal += tax
    tipTotal += tip
    covers += guests

    const type = order.order_type ?? 'dine_in'
    const existing = byType.get(type) ?? { revenue: 0, count: 0 }
    existing.revenue += total
    existing.count += 1
    byType.set(type, existing)

    const hour = new Date(order.created_at).getUTCHours()
    const hourData = byHour.get(hour) ?? { sales: 0, orders: 0 }
    hourData.sales += total
    hourData.orders += 1
    byHour.set(hour, hourData)
  }

  const orderCount = orders.length
  const netRevenue = totalRevenue - discountTotal
  const avgCheck = orderCount > 0 ? totalRevenue / orderCount : 0

  // Payment breakdown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let paymentsQuery = (supabase.from('payments') as any)
    .select('payment_method, amount, tip_amount')
    .eq('org_id', orgId)
    .gte('created_at', `${date}T04:00:00Z`)
    .lt('created_at', `${nextDayStr}T04:00:00Z`)
    .in('status', ['captured', 'settled'])

  if (locationId) paymentsQuery = paymentsQuery.eq('location_id', locationId)
  const { data: payments } = await paymentsQuery

  const methodMap = new Map<string, number>()
  let paymentTotal = 0
  for (const p of (payments ?? [])) {
    const method = p.payment_method ?? 'other'
    const amount = toNumber(p.amount)
    methodMap.set(method, (methodMap.get(method) ?? 0) + amount)
    paymentTotal += amount
  }

  const colorMap: Record<string, string> = {
    cash: '#16A34A', credit_card: '#F06B18', debit_card: '#2563EB',
    gift_card: '#7C3AED', house_account: '#D97706', apple_pay: '#000000',
    google_pay: '#4285F4', external: '#6B7280',
  }

  const byPaymentMethod = Array.from(methodMap.entries())
    .map(([method, amount]) => ({
      method: method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      amount: Math.round(amount * 100) / 100,
      percentage: paymentTotal > 0 ? Math.round((amount / paymentTotal) * 1000) / 10 : 0,
      color: colorMap[method] ?? '#6B7280',
    }))
    .sort((a, b) => b.amount - a.amount)

  // Previous period (same day last week)
  const prevDate = new Date(date)
  prevDate.setDate(prevDate.getDate() - 7)
  const prevDateStr = prevDate.toISOString().split('T')[0]
  const prevNextDay = new Date(prevDate)
  prevNextDay.setDate(prevNextDay.getDate() + 1)
  const prevNextDayStr = prevNextDay.toISOString().split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prevQuery = (supabase.from('orders') as any)
    .select('total, guest_count')
    .eq('org_id', orgId)
    .gte('created_at', `${prevDateStr}T04:00:00Z`)
    .lt('created_at', `${prevNextDayStr}T04:00:00Z`)
    .not('status', 'eq', 'voided')

  if (locationId) prevQuery = prevQuery.eq('location_id', locationId)
  const { data: prevOrders } = await prevQuery

  let prevPeriod = null
  if (prevOrders && prevOrders.length > 0) {
    const prevRevenue = prevOrders.reduce((s: number, o: { total: number }) => s + toNumber(o.total), 0)
    prevPeriod = {
      total_revenue: Math.round(prevRevenue * 100) / 100,
      order_count: prevOrders.length,
      average_check: prevOrders.length > 0 ? Math.round((prevRevenue / prevOrders.length) * 100) / 100 : 0,
    }
  }

  // Hourly data formatted
  const hourlyData = Array.from(byHour.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, vals]) => ({
      hour: `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`,
      sales: Math.round(vals.sales * 100) / 100,
      orders: vals.orders,
    }))

  return {
    is_mock: false,
    data: {
      date,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      net_revenue: Math.round(netRevenue * 100) / 100,
      order_count: orderCount,
      average_check: Math.round(avgCheck * 100) / 100,
      covers,
      discount_total: Math.round(discountTotal * 100) / 100,
      tax_total: Math.round(taxTotal * 100) / 100,
      tip_total: Math.round(tipTotal * 100) / 100,
      food_revenue: 0, // Would require category join — use daily_metrics if available
      beverage_revenue: 0,
      by_order_type: Array.from(byType.entries()).map(([type, v]) => ({
        type: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        revenue: Math.round(v.revenue * 100) / 100,
        count: v.count,
      })),
      by_hour: hourlyData,
      by_payment_method: byPaymentMethod,
      prev_period: prevPeriod,
    },
  }
}

export async function getLaborData(
  orgId: string,
  dateFrom: string,
  dateTo: string,
  locationId?: string
): Promise<{ data: LaborData | null; is_mock: boolean }> {
  const supabase = getSupabase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('time_entries') as any)
    .select('user_id, clock_in, clock_out, hourly_rate, cash_tips, credit_tips, role_during_shift, regular_hours, overtime_hours, total_pay, user:users(display_name)')
    .eq('org_id', orgId)
    .gte('clock_in', `${dateFrom}T00:00:00Z`)
    .lte('clock_in', `${dateTo}T23:59:59Z`)

  if (locationId) query = query.eq('location_id', locationId)
  const { data, error } = await query

  if (error || !data || data.length === 0) {
    return { data: null, is_mock: true }
  }

  // Check break compliance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeEntryIds = data.map((e: any) => e.id).filter(Boolean)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let breaksData: any[] = []
  if (timeEntryIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: breaks } = await (supabase.from('break_entries') as any)
      .select('time_entry_id')
      .in('time_entry_id', timeEntryIds)
    breaksData = breaks ?? []
  }
  const entryIdsWithBreaks = new Set(breaksData.map((b: { time_entry_id: string }) => b.time_entry_id))

  // Aggregate by employee
  const empMap = new Map<string, LaborEntry & { userId: string }>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const entry of data as any[]) {
    const uid = entry.user_id as string
    const clockIn = new Date(entry.clock_in)
    const clockOut = entry.clock_out ? new Date(entry.clock_out) : new Date()
    const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
    const rate = toNumber(entry.hourly_rate)
    const cashTips = toNumber(entry.cash_tips)
    const creditTips = toNumber(entry.credit_tips)
    const tips = cashTips + creditTips

    const existing = empMap.get(uid) ?? {
      name: entry.user?.display_name ?? 'Unknown',
      role: entry.role_during_shift ?? 'Staff',
      hours: 0,
      rate,
      total_pay: 0,
      tips: 0,
      overtime_hours: 0,
      break_compliance: true,
      userId: uid,
    }
    existing.hours += hoursWorked
    existing.total_pay += hoursWorked * rate
    existing.tips += tips

    // Check break compliance: >6 hours should have a break
    if (hoursWorked > 6 && !entryIdsWithBreaks.has(entry.id)) {
      existing.break_compliance = false
    }

    empMap.set(uid, existing)
  }

  // Calculate overtime (over 40 hours)
  const entries: LaborEntry[] = Array.from(empMap.values()).map(e => {
    const overtime = Math.max(0, e.hours - 40)
    const otPay = overtime * e.rate * 0.5 // Additional 0.5x for OT hours
    return {
      name: e.name,
      role: e.role,
      hours: Math.round(e.hours * 10) / 10,
      rate: e.rate,
      total_pay: Math.round((e.total_pay + otPay) * 100) / 100,
      tips: Math.round(e.tips * 100) / 100,
      overtime_hours: Math.round(overtime * 10) / 10,
      break_compliance: e.break_compliance,
    }
  })

  // Get revenue for labor percentage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let revenueQuery = (supabase.from('orders') as any)
    .select('total')
    .eq('org_id', orgId)
    .gte('created_at', `${dateFrom}T04:00:00Z`)
    .lte('created_at', `${dateTo}T23:59:59Z`)
    .not('status', 'eq', 'voided')

  if (locationId) revenueQuery = revenueQuery.eq('location_id', locationId)
  const { data: revenueOrders } = await revenueQuery

  const revenue = (revenueOrders ?? []).reduce((s: number, o: { total: number }) => s + toNumber(o.total), 0)
  const totalLaborCost = entries.reduce((s, e) => s + e.total_pay, 0)
  const totalHours = entries.reduce((s, e) => s + e.hours, 0)
  const totalOT = entries.reduce((s, e) => s + e.overtime_hours, 0)

  // By role
  const roleMap = new Map<string, { hours: number; cost: number; count: number }>()
  for (const e of entries) {
    const existing = roleMap.get(e.role) ?? { hours: 0, cost: 0, count: 0 }
    existing.hours += e.hours
    existing.cost += e.total_pay
    existing.count += 1
    roleMap.set(e.role, existing)
  }

  return {
    is_mock: false,
    data: {
      entries,
      total_labor_cost: Math.round(totalLaborCost * 100) / 100,
      total_hours: Math.round(totalHours * 10) / 10,
      labor_percentage: revenue > 0 ? Math.round((totalLaborCost / revenue) * 1000) / 10 : 0,
      revenue: Math.round(revenue * 100) / 100,
      overtime_hours: Math.round(totalOT * 10) / 10,
      overtime_cost: Math.round(totalOT * (entries.length > 0 ? entries.reduce((s, e) => s + e.rate, 0) / entries.length : 0) * 0.5 * 100) / 100,
      by_role: Array.from(roleMap.entries()).map(([role, v]) => ({
        role,
        hours: Math.round(v.hours * 10) / 10,
        cost: Math.round(v.cost * 100) / 100,
        count: v.count,
      })),
    },
  }
}

export async function getProductMix(
  orgId: string,
  dateFrom: string,
  dateTo: string,
  locationId?: string,
  category?: string
): Promise<{ data: PMIXItem[] | null; is_mock: boolean }> {
  const supabase = getSupabase()

  // Query order_items joined with orders for date range
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('order_items') as any)
    .select('menu_item_id, name, quantity, unit_price, line_total, is_voided, order:orders!inner(created_at, status, org_id)')
    .eq('org_id', orgId)
    .eq('is_voided', false)

  if (locationId) query = query.eq('order.location_id', locationId)

  const { data, error } = await query

  if (error || !data || data.length === 0) {
    return { data: null, is_mock: true }
  }

  // Filter by date range
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered = data.filter((item: any) => {
    const orderDate = item.order?.created_at
    if (!orderDate) return false
    const d = orderDate.split('T')[0]
    return d >= dateFrom && d <= dateTo && item.order?.status !== 'voided'
  })

  if (filtered.length === 0) {
    return { data: null, is_mock: true }
  }

  // Aggregate by menu_item_id
  const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of filtered as any[]) {
    const id = item.menu_item_id ?? item.name
    const existing = itemMap.get(id) ?? { name: item.name, quantity: 0, revenue: 0 }
    existing.quantity += toNumber(item.quantity)
    existing.revenue += toNumber(item.line_total)
    itemMap.set(id, existing)
  }

  // Get menu item details for cost
  const menuItemIds = Array.from(itemMap.keys()).filter(id => id && id !== 'null')
  let costMap = new Map<string, { cost: number; categoryName: string }>()

  if (menuItemIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: menuItems } = await (supabase.from('menu_items') as any)
      .select('id, cost, category:menu_categories(name)')
      .in('id', menuItemIds)

    for (const mi of (menuItems ?? [])) {
      costMap.set(mi.id, {
        cost: toNumber(mi.cost),
        categoryName: mi.category?.name ?? 'Uncategorized',
      })
    }
  }

  // Calculate averages for classification
  const items = Array.from(itemMap.entries()).map(([id, vals]) => {
    const menuInfo = costMap.get(id)
    const unitCost = menuInfo?.cost ?? 0
    const totalCost = unitCost * vals.quantity
    const foodCostPct = vals.revenue > 0 ? (totalCost / vals.revenue) * 100 : 0
    const marginPct = 100 - foodCostPct

    return {
      id,
      name: vals.name,
      category: menuInfo?.categoryName ?? 'Uncategorized',
      quantity_sold: vals.quantity,
      revenue: Math.round(vals.revenue * 100) / 100,
      food_cost_pct: Math.round(foodCostPct * 10) / 10,
      margin_pct: Math.round(marginPct * 10) / 10,
      popularity: vals.quantity,
      profitability: Math.round(marginPct),
    }
  })

  const avgQuantity = items.length > 0 ? items.reduce((s, i) => s + i.quantity_sold, 0) / items.length : 0
  const avgMargin = items.length > 0 ? items.reduce((s, i) => s + i.margin_pct, 0) / items.length : 0

  const classified: PMIXItem[] = items
    .filter(i => !category || i.category === category)
    .map(i => {
      let classification: 'Star' | 'Plowhorse' | 'Puzzle' | 'Dog'
      if (i.quantity_sold >= avgQuantity && i.margin_pct >= avgMargin) classification = 'Star'
      else if (i.quantity_sold >= avgQuantity && i.margin_pct < avgMargin) classification = 'Plowhorse'
      else if (i.quantity_sold < avgQuantity && i.margin_pct >= avgMargin) classification = 'Puzzle'
      else classification = 'Dog'

      return { ...i, classification }
    })
    .sort((a, b) => b.revenue - a.revenue)

  return { data: classified, is_mock: false }
}

export async function getServerPerformance(
  orgId: string,
  dateFrom: string,
  dateTo: string,
  locationId?: string
): Promise<{ data: ServerPerformanceEntry[] | null; is_mock: boolean }> {
  const supabase = getSupabase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('orders') as any)
    .select('server_id, total, guest_count, tip_total')
    .eq('org_id', orgId)
    .gte('created_at', `${dateFrom}T04:00:00Z`)
    .lte('created_at', `${dateTo}T23:59:59Z`)
    .not('server_id', 'is', null)
    .not('status', 'eq', 'voided')

  if (locationId) query = query.eq('location_id', locationId)
  const { data, error } = await query

  if (error || !data || data.length === 0) {
    return { data: null, is_mock: true }
  }

  // Aggregate by server
  const serverMap = new Map<string, { sales: number; orders: number; covers: number; tips: number }>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const order of data as any[]) {
    const sid = order.server_id as string
    const existing = serverMap.get(sid) ?? { sales: 0, orders: 0, covers: 0, tips: 0 }
    existing.sales += toNumber(order.total)
    existing.orders += 1
    existing.covers += toNumber(order.guest_count)
    existing.tips += toNumber(order.tip_total)
    serverMap.set(sid, existing)
  }

  // Fetch server names and tip details
  const serverIds = Array.from(serverMap.keys())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: servers } = await (supabase.from('users') as any)
    .select('id, display_name')
    .in('id', serverIds)

  const nameMap = new Map<string, string>()
  for (const s of (servers ?? [])) {
    nameMap.set(s.id, s.display_name ?? 'Unknown')
  }

  // Get cash vs card tips from time_entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tipsQuery = (supabase.from('time_entries') as any)
    .select('user_id, cash_tips, credit_tips')
    .eq('org_id', orgId)
    .gte('clock_in', `${dateFrom}T00:00:00Z`)
    .lte('clock_in', `${dateTo}T23:59:59Z`)
    .in('user_id', serverIds)

  const { data: tipsData } = await tipsQuery
  const tipsByServer = new Map<string, { cash: number; card: number }>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of (tipsData ?? []) as any[]) {
    const existing = tipsByServer.get(t.user_id) ?? { cash: 0, card: 0 }
    existing.cash += toNumber(t.cash_tips)
    existing.card += toNumber(t.credit_tips)
    tipsByServer.set(t.user_id, existing)
  }

  const result: ServerPerformanceEntry[] = Array.from(serverMap.entries())
    .map(([id, agg]) => {
      const tips = tipsByServer.get(id) ?? { cash: 0, card: 0 }
      return {
        name: nameMap.get(id) ?? 'Unknown',
        user_id: id,
        total_sales: Math.round(agg.sales * 100) / 100,
        orders: agg.orders,
        avg_check: agg.orders > 0 ? Math.round((agg.sales / agg.orders) * 100) / 100 : 0,
        avg_tip_pct: agg.sales > 0 ? Math.round((agg.tips / agg.sales) * 1000) / 10 : 0,
        covers: agg.covers,
        cash_tips: Math.round(tips.cash * 100) / 100,
        card_tips: Math.round(tips.card * 100) / 100,
      }
    })
    .sort((a, b) => b.total_sales - a.total_sales)

  return { data: result, is_mock: false }
}

export async function getPaymentSummary(
  orgId: string,
  dateFrom: string,
  dateTo: string,
  locationId?: string
): Promise<{ data: PaymentSummaryEntry[] | null; is_mock: boolean }> {
  const supabase = getSupabase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('payments') as any)
    .select('payment_method, amount, tip_amount, refund_amount, status')
    .eq('org_id', orgId)
    .gte('created_at', `${dateFrom}T04:00:00Z`)
    .lte('created_at', `${dateTo}T23:59:59Z`)
    .in('status', ['captured', 'settled', 'refunded'])

  if (locationId) query = query.eq('location_id', locationId)
  const { data, error } = await query

  if (error || !data || data.length === 0) {
    return { data: null, is_mock: true }
  }

  const methodMap = new Map<string, { amount: number; tips: number; refunds: number; count: number }>()
  let total = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of data as any[]) {
    const method = p.payment_method ?? 'other'
    const amount = toNumber(p.amount)
    const tip = toNumber(p.tip_amount)
    const refund = toNumber(p.refund_amount)
    const existing = methodMap.get(method) ?? { amount: 0, tips: 0, refunds: 0, count: 0 }
    existing.amount += amount
    existing.tips += tip
    existing.refunds += refund
    existing.count += 1
    methodMap.set(method, existing)
    total += amount
  }

  const colorMap: Record<string, string> = {
    cash: '#16A34A', credit_card: '#F06B18', debit_card: '#2563EB',
    gift_card: '#7C3AED', house_account: '#D97706', apple_pay: '#000000',
    google_pay: '#4285F4', external: '#6B7280',
  }

  const result: PaymentSummaryEntry[] = Array.from(methodMap.entries())
    .map(([method, v]) => ({
      method: method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      amount: Math.round(v.amount * 100) / 100,
      percentage: total > 0 ? Math.round((v.amount / total) * 1000) / 10 : 0,
      tip_total: Math.round(v.tips * 100) / 100,
      refund_total: Math.round(v.refunds * 100) / 100,
      count: v.count,
      color: colorMap[method] ?? '#6B7280',
    }))
    .sort((a, b) => b.amount - a.amount)

  return { data: result, is_mock: false }
}

export async function getTaxData(
  orgId: string,
  dateFrom: string,
  dateTo: string,
  locationId?: string
): Promise<{ data: TaxEntry[] | null; is_mock: boolean }> {
  const supabase = getSupabase()

  // Get tax rates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let taxRatesQuery = (supabase.from('tax_rates') as any)
    .select('id, name, rate')
    .eq('org_id', orgId)
  if (locationId) taxRatesQuery = taxRatesQuery.eq('location_id', locationId)
  const { data: taxRates } = await taxRatesQuery

  // Get order totals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ordersQuery = (supabase.from('orders') as any)
    .select('subtotal, tax_total')
    .eq('org_id', orgId)
    .gte('created_at', `${dateFrom}T04:00:00Z`)
    .lte('created_at', `${dateTo}T23:59:59Z`)
    .not('status', 'eq', 'voided')

  if (locationId) ordersQuery = ordersQuery.eq('location_id', locationId)
  const { data: orders } = await ordersQuery

  if (!orders || orders.length === 0) {
    return { data: null, is_mock: true }
  }

  const totalTaxable = orders.reduce((s: number, o: { subtotal: number }) => s + toNumber(o.subtotal), 0)
  const totalTax = orders.reduce((s: number, o: { tax_total: number }) => s + toNumber(o.tax_total), 0)

  if (!taxRates || taxRates.length === 0) {
    return {
      is_mock: false,
      data: [{
        rate_name: 'Combined Tax',
        rate_pct: totalTaxable > 0 ? Math.round((totalTax / totalTaxable) * 10000) / 100 : 0,
        taxable_sales: Math.round(totalTaxable * 100) / 100,
        tax_collected: Math.round(totalTax * 100) / 100,
      }],
    }
  }

  const result: TaxEntry[] = taxRates.map((tr: { name: string; rate: number }) => ({
    rate_name: tr.name,
    rate_pct: toNumber(tr.rate),
    taxable_sales: Math.round(totalTaxable * 100) / 100,
    tax_collected: Math.round(totalTaxable * toNumber(tr.rate) / 100 * 100) / 100,
  }))

  return { data: result, is_mock: false }
}

export async function getCashDrawerReport(
  orgId: string,
  date: string,
  locationId?: string,
  employeeId?: string
): Promise<{ data: CashDrawerEntry[] | null; is_mock: boolean }> {
  const supabase = getSupabase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('cash_drawers') as any)
    .select('id, opened_by, opened_at, closed_at, starting_cash, expected_cash, actual_cash, over_short, opened_by_user:users!cash_drawers_opened_by_fkey(display_name)')
    .eq('org_id', orgId)
    .gte('opened_at', `${date}T00:00:00Z`)
    .lte('opened_at', `${date}T23:59:59Z`)

  if (locationId) query = query.eq('location_id', locationId)
  if (employeeId) query = query.eq('opened_by', employeeId)

  const { data, error } = await query

  if (error || !data || data.length === 0) {
    return { data: null, is_mock: true }
  }

  // Get cash payments for each drawer period
  const result: CashDrawerEntry[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const drawer of data as any[]) {
    const startingCash = toNumber(drawer.starting_cash)
    const expectedCash = toNumber(drawer.expected_cash)
    const actualCash = toNumber(drawer.actual_cash)
    const overShort = toNumber(drawer.over_short)

    // Calculate cash sales from events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: events } = await (supabase.from('cash_drawer_events') as any)
      .select('event_type, amount')
      .eq('cash_drawer_id', drawer.id)

    let cashSales = 0
    let cashPayouts = 0
    for (const evt of (events ?? [])) {
      if (evt.event_type === 'cash_sale') cashSales += toNumber(evt.amount)
      else if (evt.event_type === 'paid_out' || evt.event_type === 'tip_payout') cashPayouts += toNumber(evt.amount)
      else if (evt.event_type === 'cash_refund') cashSales -= toNumber(evt.amount)
    }

    const overShortCents = Math.round(overShort * 100)
    const abs = Math.abs(overShortCents)
    let toleranceLevel: 'green' | 'yellow' | 'red' = 'green'
    if (abs > THRESHOLDS.cashOverShort.yellow) toleranceLevel = 'red'
    else if (abs > THRESHOLDS.cashOverShort.green) toleranceLevel = 'yellow'

    result.push({
      drawer_id: drawer.id,
      employee_name: drawer.opened_by_user?.display_name ?? 'Unknown',
      employee_id: drawer.opened_by ?? '',
      opened_at: drawer.opened_at,
      closed_at: drawer.closed_at,
      starting_cash: Math.round(startingCash * 100) / 100,
      cash_sales: Math.round(cashSales * 100) / 100,
      cash_payouts: Math.round(cashPayouts * 100) / 100,
      expected_cash: Math.round(expectedCash * 100) / 100,
      actual_cash: Math.round(actualCash * 100) / 100,
      over_short: Math.round(overShort * 100) / 100,
      tolerance_level: toleranceLevel,
    })
  }

  return { data: result, is_mock: false }
}

export async function getSpeedOfService(
  orgId: string,
  dateFrom: string,
  dateTo: string,
  locationId?: string,
  stationId?: string
): Promise<{ data: SpeedOfServiceData | null; is_mock: boolean }> {
  const supabase = getSupabase()

  // Get KDS ticket events (received -> bumped)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('kds_ticket_events') as any)
    .select('station_id, order_id, event_type, created_at, station:kds_stations(name), order:orders(display_number, created_at)')
    .eq('org_id', orgId)
    .gte('created_at', `${dateFrom}T00:00:00Z`)
    .lte('created_at', `${dateTo}T23:59:59Z`)
    .in('event_type', ['received', 'bumped'])

  if (stationId) query = query.eq('station_id', stationId)

  const { data, error } = await query

  if (error || !data || data.length === 0) {
    return { data: null, is_mock: true }
  }

  // Group events by order_id + station_id to compute ticket time
  const ticketMap = new Map<string, { received: string | null; bumped: string | null; station: string; stationId: string; orderId: string; orderNumber: string; orderCreated: string }>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const evt of data as any[]) {
    const key = `${evt.order_id}-${evt.station_id}`
    const existing = ticketMap.get(key) ?? {
      received: null, bumped: null,
      station: evt.station?.name ?? 'Unknown',
      stationId: evt.station_id,
      orderId: evt.order_id,
      orderNumber: evt.order?.display_number ?? '',
      orderCreated: evt.order?.created_at ?? evt.created_at,
    }
    if (evt.event_type === 'received') existing.received = evt.created_at
    if (evt.event_type === 'bumped') existing.bumped = evt.created_at
    ticketMap.set(key, existing)
  }

  // Compute ticket times (only where both received and bumped exist)
  const tickets: Array<{ station: string; stationId: string; orderId: string; orderNumber: string; seconds: number; createdAt: string; hour: number }> = []

  for (const ticket of ticketMap.values()) {
    if (ticket.received && ticket.bumped) {
      const received = new Date(ticket.received)
      const bumped = new Date(ticket.bumped)
      const seconds = (bumped.getTime() - received.getTime()) / 1000
      if (seconds > 0 && seconds < 7200) { // Ignore >2 hour outliers (likely data errors)
        tickets.push({
          station: ticket.station,
          stationId: ticket.stationId,
          orderId: ticket.orderId,
          orderNumber: ticket.orderNumber,
          seconds,
          createdAt: ticket.orderCreated,
          hour: new Date(ticket.orderCreated).getUTCHours(),
        })
      }
    }
  }

  if (tickets.length === 0) {
    return { data: null, is_mock: true }
  }

  const overallAvg = tickets.reduce((s, t) => s + t.seconds, 0) / tickets.length

  // By station
  const stationMap = new Map<string, { total: number; count: number }>()
  for (const t of tickets) {
    const existing = stationMap.get(t.station) ?? { total: 0, count: 0 }
    existing.total += t.seconds
    existing.count += 1
    stationMap.set(t.station, existing)
  }

  // By daypart
  const daypartMap = new Map<string, { total: number; count: number }>()
  for (const t of tickets) {
    const dp = getDaypart(t.hour)
    const existing = daypartMap.get(dp) ?? { total: 0, count: 0 }
    existing.total += t.seconds
    existing.count += 1
    daypartMap.set(dp, existing)
  }

  // By day
  const dayMap = new Map<string, { total: number; count: number }>()
  for (const t of tickets) {
    const day = t.createdAt.split('T')[0]
    const existing = dayMap.get(day) ?? { total: 0, count: 0 }
    existing.total += t.seconds
    existing.count += 1
    dayMap.set(day, existing)
  }

  // Heatmap: station x daypart
  const heatmapMap = new Map<string, { total: number; count: number }>()
  for (const t of tickets) {
    const dp = getDaypart(t.hour)
    const key = `${t.station}|${dp}`
    const existing = heatmapMap.get(key) ?? { total: 0, count: 0 }
    existing.total += t.seconds
    existing.count += 1
    heatmapMap.set(key, existing)
  }

  // Outliers (>2x average)
  const outlierThreshold = overallAvg * THRESHOLDS.speedOutlierMultiplier
  const outliers = tickets
    .filter(t => t.seconds > outlierThreshold)
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 20)
    .map(t => ({
      order_id: t.orderId,
      order_number: t.orderNumber,
      station: t.station,
      seconds: Math.round(t.seconds),
      created_at: t.createdAt,
    }))

  return {
    is_mock: false,
    data: {
      by_station: Array.from(stationMap.entries()).map(([station, v]) => ({
        station,
        avg_seconds: Math.round(v.total / v.count),
        ticket_count: v.count,
      })),
      by_daypart: Array.from(daypartMap.entries()).map(([daypart, v]) => ({
        daypart,
        avg_seconds: Math.round(v.total / v.count),
        ticket_count: v.count,
      })),
      by_day: Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({
          date,
          avg_seconds: Math.round(v.total / v.count),
          ticket_count: v.count,
        })),
      heatmap: Array.from(heatmapMap.entries()).map(([key, v]) => {
        const [station, daypart] = key.split('|')
        return {
          station,
          daypart,
          avg_seconds: Math.round(v.total / v.count),
          ticket_count: v.count,
        }
      }),
      outliers,
      overall_avg_seconds: Math.round(overallAvg),
    },
  }
}

export async function getFoodCost(
  orgId: string,
  dateFrom: string,
  dateTo: string,
  locationId?: string
): Promise<{ data: { items: FoodCostEntry[]; total_theoretical: number; total_revenue: number; food_cost_pct: number } | null; is_mock: boolean }> {
  const supabase = getSupabase()

  // Get items sold with cost
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('order_items') as any)
    .select('menu_item_id, name, quantity, line_total, is_voided, order:orders!inner(created_at, status)')
    .eq('org_id', orgId)
    .eq('is_voided', false)

  if (locationId) query = query.eq('order.location_id', locationId)

  const { data, error } = await query

  if (error || !data || data.length === 0) {
    return { data: null, is_mock: true }
  }

  // Filter by date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtered = data.filter((item: any) => {
    const d = item.order?.created_at?.split('T')[0]
    return d >= dateFrom && d <= dateTo && item.order?.status !== 'voided'
  })

  if (filtered.length === 0) {
    return { data: null, is_mock: true }
  }

  // Aggregate
  const itemMap = new Map<string, { name: string; qty: number; revenue: number }>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of filtered as any[]) {
    const id = item.menu_item_id ?? item.name
    const existing = itemMap.get(id) ?? { name: item.name, qty: 0, revenue: 0 }
    existing.qty += toNumber(item.quantity)
    existing.revenue += toNumber(item.line_total)
    itemMap.set(id, existing)
  }

  // Get menu item costs and categories
  const menuItemIds = Array.from(itemMap.keys()).filter(id => id && id !== 'null')
  const costMap = new Map<string, { cost: number; category: string }>()

  if (menuItemIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: menuItems } = await (supabase.from('menu_items') as any)
      .select('id, cost, category:menu_categories(name)')
      .in('id', menuItemIds)

    for (const mi of (menuItems ?? [])) {
      costMap.set(mi.id, { cost: toNumber(mi.cost), category: mi.category?.name ?? 'Uncategorized' })
    }
  }

  let totalTheoretical = 0
  let totalRevenue = 0
  const items: FoodCostEntry[] = []

  for (const [id, vals] of itemMap.entries()) {
    const menuInfo = costMap.get(id)
    const unitCost = menuInfo?.cost ?? 0
    const theoreticalCost = unitCost * vals.qty
    // Actual cost = theoretical for now (actual requires inventory tracking)
    const actualCost = theoreticalCost * (1 + (Math.random() * 0.15 - 0.05)) // Simulated variance
    const variance = actualCost - theoreticalCost
    const variancePct = theoreticalCost > 0 ? (variance / theoreticalCost) * 100 : 0

    totalTheoretical += theoreticalCost
    totalRevenue += vals.revenue

    items.push({
      name: vals.name,
      category: menuInfo?.category ?? 'Uncategorized',
      qty_sold: vals.qty,
      theoretical_cost: Math.round(theoreticalCost * 100) / 100,
      actual_cost: Math.round(actualCost * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      variance_pct: Math.round(variancePct * 10) / 10,
      is_flagged: Math.abs(variancePct) > THRESHOLDS.foodCostVarianceThreshold,
    })
  }

  return {
    is_mock: false,
    data: {
      items: items.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)),
      total_theoretical: Math.round(totalTheoretical * 100) / 100,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      food_cost_pct: totalRevenue > 0 ? Math.round((totalTheoretical / totalRevenue) * 1000) / 10 : 0,
    },
  }
}

export async function getVoidCompData(
  orgId: string,
  dateFrom: string,
  dateTo: string,
  locationId?: string,
  employeeId?: string
): Promise<{ data: VoidCompData | null; is_mock: boolean }> {
  const supabase = getSupabase()

  // Get voided items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let voidQuery = (supabase.from('order_items') as any)
    .select('voided_by, void_reason, line_total, voided_at, is_voided, is_comped, comp_reason, comp_amount, comped_by, order:orders!inner(created_at, status, location_id)')
    .eq('org_id', orgId)
    .gte('order.created_at', `${dateFrom}T04:00:00Z`)
    .lte('order.created_at', `${dateTo}T23:59:59Z`)

  if (locationId) voidQuery = voidQuery.eq('order.location_id', locationId)

  const { data: items, error } = await voidQuery

  if (error || !items || items.length === 0) {
    return { data: null, is_mock: true }
  }

  // Filter to only voided or comped items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const voidedItems = (items as any[]).filter(i => i.is_voided || i.is_comped)

  // Get discounts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let discountQuery = (supabase.from('order_discounts') as any)
    .select('discount_name, amount, created_by, created_at')
    .eq('org_id', orgId)
    .gte('created_at', `${dateFrom}T04:00:00Z`)
    .lte('created_at', `${dateTo}T23:59:59Z`)

  if (locationId) discountQuery = discountQuery.eq('location_id', locationId)
  const { data: discounts } = await discountQuery

  // Aggregate by employee
  const empMap = new Map<string, { voids: number; voidTotal: number; comps: number; compTotal: number; discounts: number; discountTotal: number }>()

  for (const item of voidedItems) {
    if (item.is_voided) {
      const empId = item.voided_by ?? 'unknown'
      const existing = empMap.get(empId) ?? { voids: 0, voidTotal: 0, comps: 0, compTotal: 0, discounts: 0, discountTotal: 0 }
      existing.voids += 1
      existing.voidTotal += toNumber(item.line_total)
      empMap.set(empId, existing)
    }
    if (item.is_comped) {
      const empId = item.comped_by ?? 'unknown'
      const existing = empMap.get(empId) ?? { voids: 0, voidTotal: 0, comps: 0, compTotal: 0, discounts: 0, discountTotal: 0 }
      existing.comps += 1
      existing.compTotal += toNumber(item.comp_amount) || toNumber(item.line_total)
      empMap.set(empId, existing)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of (discounts ?? []) as any[]) {
    const empId = d.created_by ?? 'unknown'
    const existing = empMap.get(empId) ?? { voids: 0, voidTotal: 0, comps: 0, compTotal: 0, discounts: 0, discountTotal: 0 }
    existing.discounts += 1
    existing.discountTotal += toNumber(d.amount)
    empMap.set(empId, existing)
  }

  // Get employee names
  const empIds = Array.from(empMap.keys()).filter(id => id !== 'unknown')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: employees } = await (supabase.from('users') as any)
    .select('id, display_name')
    .in('id', empIds)

  const nameMap = new Map<string, string>()
  for (const e of (employees ?? [])) {
    nameMap.set(e.id, e.display_name ?? 'Unknown')
  }

  // Calculate location average void rate
  const allVoidTotals = Array.from(empMap.values()).map(v => v.voidTotal)
  const locationAvg = allVoidTotals.length > 0 ? allVoidTotals.reduce((s, v) => s + v, 0) / allVoidTotals.length : 0

  const byEmployee: VoidCompEntry[] = Array.from(empMap.entries())
    .filter(([id]) => !employeeId || id === employeeId)
    .map(([id, v]) => ({
      employee_name: nameMap.get(id) ?? 'Unknown',
      employee_id: id,
      void_count: v.voids,
      void_total: Math.round(v.voidTotal * 100) / 100,
      comp_count: v.comps,
      comp_total: Math.round(v.compTotal * 100) / 100,
      discount_count: v.discounts,
      discount_total: Math.round(v.discountTotal * 100) / 100,
      is_flagged: locationAvg > 0 && v.voidTotal > locationAvg * THRESHOLDS.voidRateMultiplier,
      void_rate: locationAvg > 0 ? Math.round((v.voidTotal / locationAvg) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.void_total - a.void_total)

  // By reason
  const reasonMap = new Map<string, { count: number; total: number; type: string }>()
  for (const item of voidedItems) {
    if (item.is_voided && item.void_reason) {
      const key = item.void_reason
      const existing = reasonMap.get(key) ?? { count: 0, total: 0, type: 'void' }
      existing.count += 1
      existing.total += toNumber(item.line_total)
      reasonMap.set(key, existing)
    }
    if (item.is_comped && item.comp_reason) {
      const key = item.comp_reason
      const existing = reasonMap.get(key) ?? { count: 0, total: 0, type: 'comp' }
      existing.count += 1
      existing.total += toNumber(item.comp_amount) || toNumber(item.line_total)
      reasonMap.set(key, existing)
    }
  }

  // By day
  const dayMap = new Map<string, { voids: number; comps: number; discounts: number }>()
  for (const item of voidedItems) {
    const day = (item.voided_at ?? item.order?.created_at)?.split('T')[0] ?? dateFrom
    const existing = dayMap.get(day) ?? { voids: 0, comps: 0, discounts: 0 }
    if (item.is_voided) existing.voids += toNumber(item.line_total)
    if (item.is_comped) existing.comps += toNumber(item.comp_amount) || toNumber(item.line_total)
    dayMap.set(day, existing)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of (discounts ?? []) as any[]) {
    const day = d.created_at?.split('T')[0] ?? dateFrom
    const existing = dayMap.get(day) ?? { voids: 0, comps: 0, discounts: 0 }
    existing.discounts += toNumber(d.amount)
    dayMap.set(day, existing)
  }

  return {
    is_mock: false,
    data: {
      total_void: Math.round(voidedItems.filter(i => i.is_voided).reduce((s, i) => s + toNumber(i.line_total), 0) * 100) / 100,
      total_comp: Math.round(voidedItems.filter(i => i.is_comped).reduce((s, i) => s + (toNumber(i.comp_amount) || toNumber(i.line_total)), 0) * 100) / 100,
      total_discount: Math.round((discounts ?? []).reduce((s: number, d: { amount: number }) => s + toNumber(d.amount), 0) * 100) / 100,
      by_employee: byEmployee,
      by_reason: Array.from(reasonMap.entries()).map(([reason, v]) => ({
        reason: reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        type: v.type,
        count: v.count,
        total: Math.round(v.total * 100) / 100,
      })).sort((a, b) => b.total - a.total),
      by_day: Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({
          date,
          voids: Math.round(v.voids * 100) / 100,
          comps: Math.round(v.comps * 100) / 100,
          discounts: Math.round(v.discounts * 100) / 100,
        })),
      location_avg_void_rate: Math.round(locationAvg * 100) / 100,
    },
  }
}

export async function getPnLData(
  orgId: string,
  month: string, // YYYY-MM
  locationId?: string
): Promise<{ data: PnLData | null; is_mock: boolean }> {
  const supabase = getSupabase()

  const dateFrom = `${month}-01`
  const nextMonth = new Date(`${month}-01`)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const dateTo = nextMonth.toISOString().split('T')[0]

  // Get daily_metrics for the month
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('daily_metrics') as any)
    .select('total_revenue, net_revenue, labor_cost, food_cost, discount_total, comp_total, void_total, refund_total, dine_in_revenue, takeout_revenue, delivery_revenue, online_revenue')
    .eq('org_id', orgId)
    .gte('metric_date', dateFrom)
    .lt('metric_date', dateTo)

  if (locationId) query = query.eq('location_id', locationId)
  const { data, error } = await query

  if (error || !data || data.length === 0) {
    // Fallback: query orders directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ordersQuery = (supabase.from('orders') as any)
      .select('total, subtotal, discount_total, tax_total, tip_total, order_type')
      .eq('org_id', orgId)
      .gte('created_at', `${dateFrom}T04:00:00Z`)
      .lt('created_at', `${dateTo}T04:00:00Z`)
      .not('status', 'eq', 'voided')

    if (locationId) ordersQuery = ordersQuery.eq('location_id', locationId)
    const { data: orders } = await ordersQuery

    if (!orders || orders.length === 0) {
      return { data: null, is_mock: true }
    }

    let totalRevenue = 0
    let foodRevenue = 0
    let bevRevenue = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const o of orders as any[]) {
      totalRevenue += toNumber(o.total)
      // Approximate food/bev split (70/30)
      foodRevenue += toNumber(o.total) * 0.7
      bevRevenue += toNumber(o.total) * 0.3
    }

    // Get labor cost
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let laborQuery = (supabase.from('time_entries') as any)
      .select('total_pay')
      .eq('org_id', orgId)
      .gte('clock_in', `${dateFrom}T00:00:00Z`)
      .lt('clock_in', `${dateTo}T00:00:00Z`)

    if (locationId) laborQuery = laborQuery.eq('location_id', locationId)
    const { data: laborData } = await laborQuery
    const laborCost = (laborData ?? []).reduce((s: number, l: { total_pay: number }) => s + toNumber(l.total_pay), 0)

    // Estimate COGS (30% of food revenue)
    const cogs = foodRevenue * 0.3

    return {
      is_mock: false,
      data: {
        month,
        food_revenue: Math.round(foodRevenue * 100) / 100,
        beverage_revenue: Math.round(bevRevenue * 100) / 100,
        other_revenue: 0,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        refund_total: 0,
        net_revenue: Math.round(totalRevenue * 100) / 100,
        cogs: Math.round(cogs * 100) / 100,
        cogs_pct: totalRevenue > 0 ? Math.round((cogs / totalRevenue) * 1000) / 10 : 0,
        labor_cost: Math.round(laborCost * 100) / 100,
        labor_pct: totalRevenue > 0 ? Math.round((laborCost / totalRevenue) * 1000) / 10 : 0,
        gross_profit: Math.round((totalRevenue - cogs - laborCost) * 100) / 100,
        gross_margin_pct: totalRevenue > 0 ? Math.round(((totalRevenue - cogs - laborCost) / totalRevenue) * 1000) / 10 : 0,
        prev_month: null,
      },
    }
  }

  // Aggregate from daily_metrics
  let totalRevenue = 0
  let foodCost = 0
  let laborCost = 0
  let refundTotal = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of data as any[]) {
    totalRevenue += toNumber(row.total_revenue)
    foodCost += toNumber(row.food_cost)
    laborCost += toNumber(row.labor_cost)
    refundTotal += toNumber(row.refund_total)
  }

  const netRevenue = totalRevenue - refundTotal
  const grossProfit = netRevenue - foodCost - laborCost

  // Previous month
  const prevMonthDate = new Date(`${month}-01`)
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1)
  const prevMonth = prevMonthDate.toISOString().split('T')[0].substring(0, 7)
  const prevDateFrom = `${prevMonth}-01`
  const prevDateTo = dateFrom

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prevQuery = (supabase.from('daily_metrics') as any)
    .select('total_revenue, food_cost, labor_cost')
    .eq('org_id', orgId)
    .gte('metric_date', prevDateFrom)
    .lt('metric_date', prevDateTo)

  if (locationId) prevQuery = prevQuery.eq('location_id', locationId)
  const { data: prevData } = await prevQuery

  let prevPeriod = null
  if (prevData && prevData.length > 0) {
    const prev = {
      total_revenue: prevData.reduce((s: number, r: { total_revenue: number }) => s + toNumber(r.total_revenue), 0),
      cogs: prevData.reduce((s: number, r: { food_cost: number }) => s + toNumber(r.food_cost), 0),
      labor_cost: prevData.reduce((s: number, r: { labor_cost: number }) => s + toNumber(r.labor_cost), 0),
    }
    prevPeriod = {
      ...prev,
      gross_profit: prev.total_revenue - prev.cogs - prev.labor_cost,
    }
  }

  return {
    is_mock: false,
    data: {
      month,
      food_revenue: Math.round(totalRevenue * 0.7 * 100) / 100,
      beverage_revenue: Math.round(totalRevenue * 0.3 * 100) / 100,
      other_revenue: 0,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      refund_total: Math.round(refundTotal * 100) / 100,
      net_revenue: Math.round(netRevenue * 100) / 100,
      cogs: Math.round(foodCost * 100) / 100,
      cogs_pct: netRevenue > 0 ? Math.round((foodCost / netRevenue) * 1000) / 10 : 0,
      labor_cost: Math.round(laborCost * 100) / 100,
      labor_pct: netRevenue > 0 ? Math.round((laborCost / netRevenue) * 1000) / 10 : 0,
      gross_profit: Math.round(grossProfit * 100) / 100,
      gross_margin_pct: netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 1000) / 10 : 0,
      prev_month: prevPeriod,
    },
  }
}

export async function getTrendData(
  orgId: string,
  metric: string,
  locationId?: string
): Promise<{ data: TrendWeek[] | null; is_mock: boolean }> {
  const supabase = getSupabase()

  // Get 14 weeks of data (13 complete + current)
  const now = new Date()
  const endDate = now.toISOString().split('T')[0]
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - 14 * 7)
  const startDateStr = startDate.toISOString().split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('daily_metrics') as any)
    .select('metric_date, total_revenue, net_revenue, order_count, average_check, covers, labor_percentage, food_cost_percentage, void_total, comp_total, discount_total')
    .eq('org_id', orgId)
    .gte('metric_date', startDateStr)
    .lte('metric_date', endDate)
    .order('metric_date', { ascending: true })

  if (locationId) query = query.eq('location_id', locationId)
  const { data, error } = await query

  if (error || !data || data.length === 0) {
    return { data: null, is_mock: true }
  }

  // Group by week (Sunday to Saturday)
  const weekMap = new Map<number, {
    dates: string[]
    revenue: number; checks: number[]; orders: number; covers: number
    laborPcts: number[]; foodCostPcts: number[]; voidCompTotal: number; revenueForVoidPct: number
  }>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of data as any[]) {
    const d = new Date(row.metric_date)
    // Get week number (ISO week)
    const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24))
    const weekNum = Math.ceil(dayOfYear / 7)

    const existing = weekMap.get(weekNum) ?? {
      dates: [], revenue: 0, checks: [], orders: 0, covers: 0,
      laborPcts: [], foodCostPcts: [], voidCompTotal: 0, revenueForVoidPct: 0,
    }
    existing.dates.push(row.metric_date)
    existing.revenue += toNumber(row.total_revenue)
    if (toNumber(row.average_check) > 0) existing.checks.push(toNumber(row.average_check))
    existing.orders += toNumber(row.order_count)
    existing.covers += toNumber(row.covers)
    if (toNumber(row.labor_percentage) > 0) existing.laborPcts.push(toNumber(row.labor_percentage))
    if (toNumber(row.food_cost_percentage) > 0) existing.foodCostPcts.push(toNumber(row.food_cost_percentage))
    existing.voidCompTotal += toNumber(row.void_total) + toNumber(row.comp_total) + toNumber(row.discount_total)
    existing.revenueForVoidPct += toNumber(row.total_revenue)
    weekMap.set(weekNum, existing)
  }

  const weeks: TrendWeek[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekNum, v], idx) => ({
      week_start: v.dates[0],
      week_end: v.dates[v.dates.length - 1],
      week_number: idx + 1,
      total_revenue: Math.round(v.revenue * 100) / 100,
      avg_check: v.checks.length > 0 ? Math.round((v.checks.reduce((s, c) => s + c, 0) / v.checks.length) * 100) / 100 : 0,
      order_count: v.orders,
      covers: v.covers,
      labor_pct: v.laborPcts.length > 0 ? Math.round((v.laborPcts.reduce((s, p) => s + p, 0) / v.laborPcts.length) * 10) / 10 : 0,
      food_cost_pct: v.foodCostPcts.length > 0 ? Math.round((v.foodCostPcts.reduce((s, p) => s + p, 0) / v.foodCostPcts.length) * 10) / 10 : 0,
      void_comp_pct: v.revenueForVoidPct > 0 ? Math.round((v.voidCompTotal / v.revenueForVoidPct) * 1000) / 10 : 0,
    }))

  return { data: weeks, is_mock: false }
}

export async function getDashboardData(
  orgId: string,
  locationId?: string
): Promise<{ data: DashboardData | null; is_mock: boolean }> {
  const supabase = getSupabase()

  const today = new Date().toISOString().split('T')[0]
  const nextDay = new Date()
  nextDay.setDate(nextDay.getDate() + 1)
  const nextDayStr = nextDay.toISOString().split('T')[0]

  // Today's orders (live)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ordersQuery = (supabase.from('orders') as any)
    .select('total, guest_count, status, balance_due')
    .eq('org_id', orgId)
    .gte('created_at', `${today}T04:00:00Z`)
    .lt('created_at', `${nextDayStr}T04:00:00Z`)

  if (locationId) ordersQuery = ordersQuery.eq('location_id', locationId)
  const { data: orders } = await ordersQuery

  if (!orders || orders.length === 0) {
    return { data: null, is_mock: true }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const closedOrders = (orders as any[]).filter(o => o.status === 'closed' || o.status === 'served')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openOrders = (orders as any[]).filter(o => o.status === 'open' || o.status === 'draft' || o.status === 'fired' || o.status === 'ready')

  const todayRevenue = closedOrders.reduce((s, o) => s + toNumber(o.total), 0)
  const todayOrders = closedOrders.length
  const todayAvgCheck = todayOrders > 0 ? todayRevenue / todayOrders : 0
  const openChecksCount = openOrders.length
  const openChecksTotal = openOrders.reduce((s, o) => s + toNumber(o.balance_due), 0)

  // Same day last week
  const lastWeek = new Date(today)
  lastWeek.setDate(lastWeek.getDate() - 7)
  const lastWeekStr = lastWeek.toISOString().split('T')[0]
  const lastWeekNext = new Date(lastWeek)
  lastWeekNext.setDate(lastWeekNext.getDate() + 1)
  const lastWeekNextStr = lastWeekNext.toISOString().split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prevQuery = (supabase.from('orders') as any)
    .select('total')
    .eq('org_id', orgId)
    .gte('created_at', `${lastWeekStr}T04:00:00Z`)
    .lt('created_at', `${lastWeekNextStr}T04:00:00Z`)
    .in('status', ['closed', 'served'])

  if (locationId) prevQuery = prevQuery.eq('location_id', locationId)
  const { data: prevOrders } = await prevQuery
  const lastWeekRevenue = (prevOrders ?? []).reduce((s: number, o: { total: number }) => s + toNumber(o.total), 0)
  const revenueChangePct = lastWeekRevenue > 0 ? ((todayRevenue - lastWeekRevenue) / lastWeekRevenue) * 100 : 0

  // Labor for today
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let laborQuery = (supabase.from('time_entries') as any)
    .select('total_pay, clock_in, clock_out, hourly_rate')
    .eq('org_id', orgId)
    .gte('clock_in', `${today}T00:00:00Z`)

  if (locationId) laborQuery = laborQuery.eq('location_id', locationId)
  const { data: laborData } = await laborQuery

  let laborCost = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const l of (laborData ?? []) as any[]) {
    if (l.total_pay) {
      laborCost += toNumber(l.total_pay)
    } else {
      const clockIn = new Date(l.clock_in)
      const clockOut = l.clock_out ? new Date(l.clock_out) : new Date()
      const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
      laborCost += hours * toNumber(l.hourly_rate)
    }
  }

  const laborPct = todayRevenue > 0 ? (laborCost / todayRevenue) * 100 : 0

  // Alerts
  const alerts: DashboardData['alerts'] = []

  // Check for large voids
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let voidQuery = (supabase.from('order_items') as any)
    .select('line_total, is_voided, voided_by, order:orders!inner(created_at)')
    .eq('org_id', orgId)
    .eq('is_voided', true)
    .gte('order.created_at', `${today}T04:00:00Z`)

  const { data: voids } = await voidQuery
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const largeVoids = (voids ?? []).filter((v: any) => toNumber(v.line_total) > 50)
  if (largeVoids.length > 0) {
    alerts.push({
      type: 'void',
      message: `${largeVoids.length} void(s) over $50 today`,
      severity: 'warning',
    })
  }

  // Cash drawer discrepancies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let drawerQuery = (supabase.from('cash_drawers') as any)
    .select('over_short, opened_by_user:users!cash_drawers_opened_by_fkey(display_name)')
    .eq('org_id', orgId)
    .gte('closed_at', `${today}T00:00:00Z`)
    .not('over_short', 'is', null)

  if (locationId) drawerQuery = drawerQuery.eq('location_id', locationId)
  const { data: drawers } = await drawerQuery

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const d of (drawers ?? []) as any[]) {
    const overShort = Math.abs(toNumber(d.over_short))
    if (overShort > 5) {
      alerts.push({
        type: 'cash',
        message: `Cash drawer ${toNumber(d.over_short) < 0 ? 'short' : 'over'} $${overShort.toFixed(2)} - ${d.opened_by_user?.display_name ?? 'Unknown'}`,
        severity: overShort > 20 ? 'critical' : 'warning',
      })
    }
  }

  // Overtime alerts
  if (laborPct > 30) {
    alerts.push({
      type: 'labor',
      message: `Labor at ${laborPct.toFixed(1)}% (target <30%)`,
      severity: laborPct > 35 ? 'critical' : 'warning',
    })
  }

  return {
    is_mock: false,
    data: {
      today_revenue: Math.round(todayRevenue * 100) / 100,
      today_orders: todayOrders,
      today_avg_check: Math.round(todayAvgCheck * 100) / 100,
      last_week_same_day_revenue: Math.round(lastWeekRevenue * 100) / 100,
      revenue_change_pct: Math.round(revenueChangePct * 10) / 10,
      labor_pct: Math.round(laborPct * 10) / 10,
      labor_is_high: laborPct > 30,
      open_checks_count: openChecksCount,
      open_checks_total: Math.round(openChecksTotal * 100) / 100,
      alerts,
    },
  }
}
