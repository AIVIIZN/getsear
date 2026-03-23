/**
 * Daily metrics aggregation logic for BullMQ job.
 * Runs at 4 AM to compute the previous business day's metrics.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { THRESHOLDS } from './constants'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toNumber(val: any): number {
  return Number(val) || 0
}

interface AggregationResult {
  location_id: string
  metric_date: string
  metrics: Record<string, number | string | object>
}

/**
 * Aggregate metrics for a single location for a single business day.
 */
export async function aggregateLocationDay(
  orgId: string,
  locationId: string,
  businessDate: string
): Promise<AggregationResult> {
  const supabase = createAdminClient()

  // Business day: businessDate 4AM -> next day 4AM
  const nextDay = new Date(businessDate)
  nextDay.setDate(nextDay.getDate() + 1)
  const nextDayStr = nextDay.toISOString().split('T')[0]

  const from = `${businessDate}T${String(THRESHOLDS.businessDayCutoffHour).padStart(2, '0')}:00:00Z`
  const to = `${nextDayStr}T${String(THRESHOLDS.businessDayCutoffHour).padStart(2, '0')}:00:00Z`

  // ── Orders ────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders } = await (supabase.from('orders') as any)
    .select('id, order_type, subtotal, discount_total, tax_total, tip_total, total, guest_count, created_at, status')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .gte('created_at', from)
    .lt('created_at', to)
    .not('status', 'eq', 'voided')

  const validOrders = orders ?? []
  let totalRevenue = 0
  let netRevenue = 0
  let discountTotal = 0
  let compTotal = 0
  let voidTotal = 0
  let tipTotal = 0
  let covers = 0
  let dineInRevenue = 0
  let takeoutRevenue = 0
  let deliveryRevenue = 0
  let onlineRevenue = 0
  const hourlyRevenue: Record<string, number> = {}
  const hourlyCovers: Record<string, number> = {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const order of validOrders as any[]) {
    const total = toNumber(order.total)
    const discount = toNumber(order.discount_total)
    const tip = toNumber(order.tip_total)
    const guests = toNumber(order.guest_count)

    totalRevenue += total
    discountTotal += discount
    tipTotal += tip
    covers += guests

    const type = order.order_type
    if (type === 'dine_in' || type === 'bar') dineInRevenue += total
    else if (type === 'takeout') takeoutRevenue += total
    else if (type === 'delivery') deliveryRevenue += total
    else if (type === 'online') onlineRevenue += total

    const hour = new Date(order.created_at).getUTCHours().toString()
    hourlyRevenue[hour] = (hourlyRevenue[hour] ?? 0) + total
    hourlyCovers[hour] = (hourlyCovers[hour] ?? 0) + guests
  }

  netRevenue = totalRevenue - discountTotal
  const orderCount = validOrders.length
  const averageCheck = orderCount > 0 ? totalRevenue / orderCount : 0
  const revenuePerCover = covers > 0 ? totalRevenue / covers : 0

  // ── Voided items ──────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: voidedItems } = await (supabase.from('order_items') as any)
    .select('line_total, is_voided, is_comped, comp_amount')
    .eq('org_id', orgId)
    .gte('created_at', from)
    .lt('created_at', to)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of (voidedItems ?? []) as any[]) {
    if (item.is_voided) voidTotal += toNumber(item.line_total)
    if (item.is_comped) compTotal += toNumber(item.comp_amount) || toNumber(item.line_total)
  }

  // ── Payments ──────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payments } = await (supabase.from('payments') as any)
    .select('payment_method, amount, refund_amount')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .gte('created_at', from)
    .lt('created_at', to)
    .in('status', ['captured', 'settled', 'refunded'])

  let cashTotal = 0
  let cardTotal = 0
  let giftCardTotal = 0
  let refundTotal = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of (payments ?? []) as any[]) {
    const amount = toNumber(p.amount)
    const refund = toNumber(p.refund_amount)
    refundTotal += refund

    if (p.payment_method === 'cash') cashTotal += amount
    else if (p.payment_method === 'gift_card') giftCardTotal += amount
    else cardTotal += amount
  }

  // ── Labor ─────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: timeEntries } = await (supabase.from('time_entries') as any)
    .select('clock_in, clock_out, hourly_rate, total_pay')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .gte('clock_in', `${businessDate}T00:00:00Z`)
    .lt('clock_in', `${nextDayStr}T23:59:59Z`)

  let laborCost = 0
  let laborHours = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const te of (timeEntries ?? []) as any[]) {
    if (te.total_pay) {
      laborCost += toNumber(te.total_pay)
    } else {
      const clockIn = new Date(te.clock_in)
      const clockOut = te.clock_out ? new Date(te.clock_out) : new Date()
      const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
      laborCost += hours * toNumber(te.hourly_rate)
      laborHours += hours
    }
  }

  const laborPercentage = netRevenue > 0 ? (laborCost / netRevenue) * 100 : 0

  // ── Food Cost ─────────────────────────────────────────────────────
  // Theoretical food cost from items sold
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: itemsSold } = await (supabase.from('order_items') as any)
    .select('menu_item_id, quantity')
    .eq('org_id', orgId)
    .eq('is_voided', false)
    .gte('created_at', from)
    .lt('created_at', to)

  const menuItemIds = [...new Set((itemsSold ?? []).map((i: { menu_item_id: string }) => i.menu_item_id).filter(Boolean))]
  let foodCost = 0

  if (menuItemIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: menuItems } = await (supabase.from('menu_items') as any)
      .select('id, cost')
      .in('id', menuItemIds)

    const costMap = new Map<string, number>()
    for (const mi of (menuItems ?? [])) {
      costMap.set(mi.id, toNumber(mi.cost))
    }

    for (const item of (itemsSold ?? [])) {
      const unitCost = costMap.get(item.menu_item_id) ?? 0
      foodCost += unitCost * toNumber(item.quantity)
    }
  }

  const foodCostPercentage = netRevenue > 0 ? (foodCost / netRevenue) * 100 : 0

  // ── Speed of Service ──────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: kdsEvents } = await (supabase.from('kds_ticket_events') as any)
    .select('order_id, station_id, event_type, created_at')
    .eq('org_id', orgId)
    .gte('created_at', from)
    .lt('created_at', to)
    .in('event_type', ['received', 'bumped'])

  const ticketTimes: number[] = []
  const ticketMap = new Map<string, { received: string | null; bumped: string | null }>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const evt of (kdsEvents ?? []) as any[]) {
    const key = `${evt.order_id}-${evt.station_id}`
    const existing = ticketMap.get(key) ?? { received: null, bumped: null }
    if (evt.event_type === 'received') existing.received = evt.created_at
    if (evt.event_type === 'bumped') existing.bumped = evt.created_at
    ticketMap.set(key, existing)
  }

  for (const ticket of ticketMap.values()) {
    if (ticket.received && ticket.bumped) {
      const seconds = (new Date(ticket.bumped).getTime() - new Date(ticket.received).getTime()) / 1000
      if (seconds > 0 && seconds < 7200) ticketTimes.push(seconds)
    }
  }

  const avgTicketTime = ticketTimes.length > 0
    ? Math.round(ticketTimes.reduce((s, t) => s + t, 0) / ticketTimes.length)
    : 0

  // ── Upsert to daily_metrics ───────────────────────────────────────
  const metricsRow = {
    org_id: orgId,
    location_id: locationId,
    metric_date: businessDate,
    total_revenue: Math.round(totalRevenue * 100) / 100,
    net_revenue: Math.round(netRevenue * 100) / 100,
    order_count: orderCount,
    average_check: Math.round(averageCheck * 100) / 100,
    covers,
    revenue_per_cover: Math.round(revenuePerCover * 100) / 100,
    dine_in_revenue: Math.round(dineInRevenue * 100) / 100,
    takeout_revenue: Math.round(takeoutRevenue * 100) / 100,
    delivery_revenue: Math.round(deliveryRevenue * 100) / 100,
    online_revenue: Math.round(onlineRevenue * 100) / 100,
    cash_total: Math.round(cashTotal * 100) / 100,
    card_total: Math.round(cardTotal * 100) / 100,
    gift_card_total: Math.round(giftCardTotal * 100) / 100,
    labor_cost: Math.round(laborCost * 100) / 100,
    labor_hours: Math.round(laborHours * 100) / 100,
    labor_percentage: Math.round(laborPercentage * 100) / 100,
    food_cost: Math.round(foodCost * 100) / 100,
    food_cost_percentage: Math.round(foodCostPercentage * 100) / 100,
    discount_total: Math.round(discountTotal * 100) / 100,
    comp_total: Math.round(compTotal * 100) / 100,
    void_total: Math.round(voidTotal * 100) / 100,
    refund_total: Math.round(refundTotal * 100) / 100,
    tip_total: Math.round(tipTotal * 100) / 100,
    avg_ticket_time_seconds: avgTicketTime,
    avg_table_turn_minutes: 0, // Would require table tracking
    hourly_revenue: hourlyRevenue,
    hourly_covers: hourlyCovers,
    calculated_at: new Date().toISOString(),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertError } = await (supabase.from('daily_metrics') as any)
    .upsert(metricsRow, { onConflict: 'location_id,metric_date' })

  if (upsertError) {
    console.error(`Failed to upsert daily_metrics for ${locationId} on ${businessDate}:`, upsertError)
  }

  return {
    location_id: locationId,
    metric_date: businessDate,
    metrics: metricsRow,
  }
}

/**
 * Aggregate metrics for all locations in an org for a given business date.
 */
export async function aggregateAllLocations(orgId: string, businessDate: string): Promise<AggregationResult[]> {
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: locations } = await (supabase.from('locations') as any)
    .select('id')
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (!locations || locations.length === 0) return []

  const results: AggregationResult[] = []
  for (const loc of locations) {
    const result = await aggregateLocationDay(orgId, loc.id, businessDate)
    results.push(result)
  }

  return results
}

/**
 * Run aggregation for all active orgs for yesterday's business date.
 * This is the entry point for the BullMQ cron job.
 */
export async function runDailyAggregation(): Promise<{ orgs: number; locations: number; errors: string[] }> {
  const supabase = createAdminClient()

  // Yesterday's business date
  const now = new Date()
  now.setDate(now.getDate() - 1)
  const businessDate = now.toISOString().split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgs } = await (supabase.from('organizations') as any)
    .select('id')
    .eq('subscription_status', 'active')
    .is('deleted_at', null)

  const errors: string[] = []
  let totalLocations = 0

  for (const org of (orgs ?? [])) {
    try {
      const results = await aggregateAllLocations(org.id, businessDate)
      totalLocations += results.length
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`Org ${org.id}: ${message}`)
    }
  }

  return {
    orgs: (orgs ?? []).length,
    locations: totalLocations,
    errors,
  }
}
