import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { diffTicketItems, type DiffableOrderItem } from '@/lib/kds/diff'

interface RawOrderItem {
  id: string
  order_id: string
  menu_item_id: string
  name: string
  quantity: number
  order_item_modifiers?: Array<{ name: string; price_adjustment: string | number; quantity: number }>
  notes: string | null
  seat_number: number | null
  course: number | null
  prep_station: string | null
  is_voided: boolean
  is_sent: boolean
  is_fired: boolean
  is_ready: boolean
  sent_at: string | null
  fired_at: string | null
  ready_at: string | null
  menu_category_id?: string | null
}

interface RawOrder {
  id: string
  org_id: string
  location_id: string
  order_number: number
  display_number: string
  order_type: string
  status: string
  table_id: string | null
  server_id: string | null
  customer_id: string | null
  is_rush: boolean
  priority?: string
  created_at: string
  notes: string | null
}

type ItemStatus = 'pending' | 'in_progress' | 'completed' | 'voided' | 'held'
type TicketPriority = 'refire' | 'rush' | 'vip' | 'normal'

interface TicketItem {
  id: string
  name: string
  quantity: number
  modifiers: string[]
  special_instructions: string
  seat_number: number | null
  course: number
  status: ItemStatus
  is_void: boolean
  is_fired: boolean
  is_bumped: boolean
  is_refire: boolean
  is_add: boolean
  refire_count: number
  refire_reason: string | null
  prep_station: string | null
  station_label: string | null
  category_id: string | null
}

interface Ticket {
  id: string
  order_id: string
  order_number: string
  order_type: string
  server_name: string
  table_name: string | null
  items: TicketItem[]
  created_at: string
  age_seconds: number
  age_category: 'fresh' | 'aging' | 'late' | 'critical'
  is_rush: boolean
  is_vip: boolean
  is_refire: boolean
  is_add: boolean
  station_id: string
  priority: TicketPriority
  station_statuses: Record<string, 'pending' | 'complete'>
}

function getAgeCategory(seconds: number): 'fresh' | 'aging' | 'late' | 'critical' {
  if (seconds >= 900) return 'critical'
  if (seconds >= 600) return 'late'
  if (seconds >= 300) return 'aging'
  return 'fresh'
}

/**
 * GET /api/kds/tickets -- get active tickets for a station
 *
 * Query params:
 *   station_id -- required, the KDS station to get tickets for
 *   location_id -- required, the location
 *   _bumped -- if "true", return recently bumped tickets (for recall)
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const params = request.nextUrl.searchParams
  const stationId = params.get('station_id')
  const locationId = params.get('location_id')

  if (!stationId) {
    return NextResponse.json({ error: 'station_id is required' }, { status: 400 })
  }
  // Fall back to user's first location if not specified
  const effectiveLocationId = locationId ?? user.location_ids?.[0]
  if (!effectiveLocationId) {
    return NextResponse.json({ error: 'location_id is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 1. Get the station to know what prep_stations it routes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station, error: stationError } = await (supabase.from('kds_stations') as any)
    .select('*')
    .eq('id', stationId)
    .eq('org_id', user.org_id)
    .single()

  if (stationError || !station) {
    return NextResponse.json({ error: 'Station not found' }, { status: 404 })
  }

  const stationType = station.station_type as string
  const prepStationsFilter: string[] = station.prep_stations ?? []
  const isExpo = stationType === 'expo'

  // 2. Get active orders for this location
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders, error: ordersError } = await (supabase.from('orders') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .eq('location_id', effectiveLocationId)
    .in('status', ['open', 'fired', 'sent', 'in_progress', 'ready'])
    .order('created_at', { ascending: true })

  if (ordersError) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json({ data: [] })
  }

  const orderIds = (orders as RawOrder[]).map((o) => o.id)

  // 3. Get order items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let itemsQuery = (supabase.from('order_items') as any)
    .select('*, order_item_modifiers(name, price_adjustment, quantity)')
    .in('order_id', orderIds)
    .eq('org_id', user.org_id)
    .eq('is_sent', true)

  if (!isExpo && prepStationsFilter.length > 0) {
    itemsQuery = itemsQuery.in('prep_station', prepStationsFilter)
  }

  const { data: items, error: itemsError } = await itemsQuery

  if (itemsError) {
    return NextResponse.json({ error: 'Failed to fetch order items' }, { status: 500 })
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ data: [] })
  }

  // 3b. Compute per-order ADD-item diffs.
  // Anchor must be the order's earliest sent_at across ALL items, not just
  // items routed to this station -- otherwise a station that only sees a
  // late-added item would treat it as the "original" batch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allOrderItemsForDiff } = await (supabase.from('order_items') as any)
    .select('id, order_id, sent_at, is_voided')
    .in('order_id', orderIds)
    .eq('org_id', user.org_id)
    .eq('is_sent', true)

  const addItemIds = new Set<string>()
  if (allOrderItemsForDiff) {
    const itemsByOrder = new Map<string, DiffableOrderItem[]>()
    for (const row of allOrderItemsForDiff as Array<{
      id: string
      order_id: string
      sent_at: string | null
      is_voided: boolean | null
    }>) {
      const list = itemsByOrder.get(row.order_id) ?? []
      list.push({ id: row.id, sent_at: row.sent_at, is_void: row.is_voided })
      itemsByOrder.set(row.order_id, list)
    }
    for (const orderItems of itemsByOrder.values()) {
      const diff = diffTicketItems(orderItems)
      for (const change of diff.changes) {
        if (change.is_add) addItemIds.add(change.id)
      }
    }
  }

  // 4. Get ALL bump/recall/refire events for these items
  const allItemIds = (items as RawOrderItem[]).map((i) => i.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allEvents } = await (supabase.from('kds_ticket_events') as any)
    .select('order_item_id, event_type, station_id')
    .in('order_item_id', allItemIds)
    .in('event_type', ['bumped', 'recalled', 'refire'])
    .order('created_at', { ascending: true })

  // Build per-item state: bumped status per station, refire info
  type ItemEventState = {
    bumpedAtStation: Set<string>
    refireCount: number
    lastRefireReason: string | null
    isRefire: boolean
  }
  const itemEventStates = new Map<string, ItemEventState>()

  if (allEvents) {
    for (const evt of allEvents as Array<{
      order_item_id: string
      event_type: string
      station_id: string
    }>) {
      const itemId = evt.order_item_id
      if (!itemEventStates.has(itemId)) {
        itemEventStates.set(itemId, {
          bumpedAtStation: new Set(),
          refireCount: 0,
          lastRefireReason: null,
          isRefire: false,
        })
      }
      const state = itemEventStates.get(itemId)!

      if (evt.event_type === 'bumped') {
        state.bumpedAtStation.add(evt.station_id)
      } else if (evt.event_type === 'recalled') {
        state.bumpedAtStation.delete(evt.station_id)
      } else if (evt.event_type === 'refire') {
        state.refireCount++
        state.isRefire = true
      }
    }
  }

  // Determine effectively bumped items at THIS station
  const bumpedItemIds = new Set<string>()
  for (const [itemId, state] of itemEventStates) {
    if (state.bumpedAtStation.has(stationId)) {
      bumpedItemIds.add(itemId)
    }
  }

  // 5. Get all KDS stations for expo station labels
  let stationNameMap: Record<string, string> = {}
  if (isExpo) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allStations } = await (supabase.from('kds_stations') as any)
      .select('id, name, prep_stations')
      .eq('org_id', user.org_id)
      .eq('location_id', effectiveLocationId)

    if (allStations) {
      // Build prep_station -> station_name mapping
      const prepToStationName: Record<string, string> = {}
      for (const s of allStations as Array<{ id: string; name: string; prep_stations: string[] }>) {
        stationNameMap[s.id] = s.name
        for (const ps of s.prep_stations ?? []) {
          prepToStationName[ps] = s.name
        }
      }
      // We'll use prepToStationName below for station_label
      stationNameMap = { ...stationNameMap, ...prepToStationName }
    }
  }

  // 6. Get server names and table names
  const serverIds = [...new Set((orders as RawOrder[]).map((o) => o.server_id).filter(Boolean))]
  const tableIds = [...new Set((orders as RawOrder[]).map((o) => o.table_id).filter(Boolean))]

  let serverMap: Record<string, string> = {}
  let tableMap: Record<string, string> = {}

  if (serverIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: servers } = await (supabase.from('users') as any)
      .select('id, display_name, first_name, last_name')
      .in('id', serverIds)

    if (servers) {
      serverMap = Object.fromEntries(
        (servers as Array<{ id: string; display_name?: string; first_name?: string; last_name?: string }>).map((s) => [
          s.id,
          s.display_name || `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Unknown',
        ])
      )
    }
  }

  if (tableIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tables } = await (supabase.from('tables') as any)
      .select('id, name')
      .in('id', tableIds)

    if (tables) {
      tableMap = Object.fromEntries(
        (tables as Array<{ id: string; name: string }>).map((t) => [t.id, t.name])
      )
    }
  }

  // 7. Get customer info for VIP and allergens (for expo)
  const customerIds = [...new Set((orders as RawOrder[]).map((o) => o.customer_id).filter(Boolean))]
  let customerMap: Record<string, { is_vip?: boolean; allergens?: string[] }> = {}

  if (customerIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: customers } = await (supabase.from('customers') as any)
      .select('id, is_vip, allergens')
      .in('id', customerIds)

    if (customers) {
      customerMap = Object.fromEntries(
        (customers as Array<{ id: string; is_vip?: boolean; allergens?: string[] }>).map((c) => [
          c.id,
          { is_vip: c.is_vip, allergens: c.allergens },
        ])
      )
    }
  }

  // 8. Group items by order to build tickets
  const orderMap = new Map<string, RawOrder>()
  for (const order of orders as RawOrder[]) {
    orderMap.set(order.id, order)
  }

  const ticketsByOrder = new Map<string, TicketItem[]>()
  for (const item of items as RawOrderItem[]) {
    const itemEvents = itemEventStates.get(item.id)
    const isBumpedHere = bumpedItemIds.has(item.id)

    // For non-expo stations: skip fully bumped items
    if (!isExpo && isBumpedHere) continue

    // For expo: include all items but mark their bumped status
    const isBumpedAnywhere = itemEvents
      ? itemEvents.bumpedAtStation.size > 0
      : false

    const ticketItem: TicketItem = {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      modifiers: (item.order_item_modifiers ?? []).map((mod) => {
        const quantity = mod.quantity > 1 ? ` x${mod.quantity}` : ''
        return `${mod.name}${quantity}`
      }),
      special_instructions: item.notes ?? '',
      seat_number: item.seat_number,
      course: item.course ?? 1,
      status: item.is_voided
        ? 'voided'
        : isExpo
          ? (isBumpedAnywhere || item.is_ready ? 'completed' : item.is_fired ? 'in_progress' : 'pending')
          : (item.is_ready ? 'completed' : item.is_fired ? 'in_progress' : 'pending'),
      is_void: item.is_voided ?? false,
      is_fired: item.is_fired ?? false,
      is_bumped: isExpo ? (isBumpedAnywhere || item.is_ready) : isBumpedHere,
      is_refire: itemEvents?.isRefire ?? false,
      is_add: addItemIds.has(item.id),
      refire_count: itemEvents?.refireCount ?? 0,
      refire_reason: itemEvents?.lastRefireReason ?? null,
      prep_station: item.prep_station,
      station_label: item.prep_station
        ? (stationNameMap[item.prep_station] ?? item.prep_station)
        : null,
      category_id: (item as RawOrderItem).menu_category_id ?? null,
    }

    const existing = ticketsByOrder.get(item.order_id) ?? []
    existing.push(ticketItem)
    ticketsByOrder.set(item.order_id, existing)
  }

  // 9. Build tickets
  const now = Date.now()
  const tickets: Ticket[] = []

  for (const [orderId, ticketItems] of ticketsByOrder.entries()) {
    if (ticketItems.length === 0) continue

    const order = orderMap.get(orderId)
    if (!order) continue

    // For non-expo: skip if all visible items are void
    const nonVoidItems = ticketItems.filter((i) => !i.is_void)
    if (!isExpo && nonVoidItems.length === 0) continue

    const createdAt = order.created_at
    const ageSeconds = Math.floor((now - new Date(createdAt).getTime()) / 1000)

    // Determine order-level flags
    const customerInfo = order.customer_id ? customerMap[order.customer_id] : undefined
    const isVip = customerInfo?.is_vip ?? false
    const isRefire = ticketItems.some((i) => i.is_refire)
    const isAdd = ticketItems.some((i) => i.is_add)
    const isRush = order.is_rush ?? false

    // Resolve priority
    let priority: TicketPriority = 'normal'
    if (isRefire || order.priority === 'refire') priority = 'refire'
    else if (isRush || order.priority === 'rush') priority = 'rush'
    else if (isVip || order.priority === 'vip') priority = 'vip'

    // Expo: build station completion statuses
    const stationStatuses: Record<string, 'pending' | 'complete'> = {}
    if (isExpo) {
      const stationItems = new Map<string, boolean[]>()
      for (const item of ticketItems) {
        if (item.is_void) continue
        const label = item.station_label ?? item.prep_station ?? 'Unknown'
        const items = stationItems.get(label) ?? []
        items.push(item.is_bumped || item.status === 'completed')
        stationItems.set(label, items)
      }
      for (const [label, completions] of stationItems) {
        stationStatuses[label] = completions.every(Boolean) ? 'complete' : 'pending'
      }
    }

    tickets.push({
      id: `${stationId}_${orderId}`,
      order_id: orderId,
      order_number: order.display_number,
      order_type: order.order_type,
      server_name: order.server_id ? (serverMap[order.server_id] ?? 'Unknown') : 'Unknown',
      table_name: order.table_id ? (tableMap[order.table_id] ?? null) : null,
      items: ticketItems.sort((a, b) => a.course - b.course),
      created_at: createdAt,
      age_seconds: ageSeconds,
      age_category: getAgeCategory(ageSeconds),
      is_rush: isRush,
      is_vip: isVip,
      is_refire: isRefire,
      is_add: isAdd,
      station_id: stationId,
      priority,
      station_statuses: stationStatuses,
    })
  }

  // Sort by priority then age
  const priorityRank: Record<TicketPriority, number> = {
    refire: 1,
    rush: 2,
    vip: 3,
    normal: 4,
  }

  tickets.sort((a, b) => {
    const rankDiff = (priorityRank[a.priority] ?? 4) - (priorityRank[b.priority] ?? 4)
    if (rankDiff !== 0) return rankDiff
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return NextResponse.json({ data: tickets })
}
