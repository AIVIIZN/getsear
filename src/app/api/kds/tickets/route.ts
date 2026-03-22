import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

interface RawOrderItem {
  id: string
  order_id: string
  menu_item_id: string
  name: string
  quantity: number
  modifiers: string[] | null
  special_instructions: string | null
  seat_number: number | null
  course: number | null
  prep_station: string | null
  is_void: boolean
  is_sent: boolean
  is_fired: boolean
  is_ready: boolean
  sent_at: string | null
  fired_at: string | null
  ready_at: string | null
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
  is_rush: boolean
  created_at: string
  notes: string | null
}

interface TicketItem {
  id: string
  name: string
  quantity: number
  modifiers: string[]
  special_instructions: string
  seat_number: number | null
  course: number
  status: 'pending' | 'in_progress' | 'completed'
  is_void: boolean
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
  station_id: string
}

function getAgeCategory(seconds: number): 'fresh' | 'aging' | 'late' | 'critical' {
  if (seconds >= 900) return 'critical'
  if (seconds >= 600) return 'late'
  if (seconds >= 300) return 'aging'
  return 'fresh'
}

/**
 * GET /api/kds/tickets — get active tickets for a station
 *
 * Query params:
 *   station_id — required, the KDS station to get tickets for
 *   location_id — required, the location
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
  if (!locationId) {
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

  const stationType = station.type as string
  const prepStationsFilter: string[] = station.settings?.prep_stations ?? []

  // 2. Get active orders (status = 'fired' or 'ready') for this location
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders, error: ordersError } = await (supabase.from('orders') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .eq('location_id', locationId)
    .in('status', ['fired', 'sent', 'in_progress', 'ready'])
    .order('created_at', { ascending: true })

  if (ordersError) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json({ data: [] })
  }

  const orderIds = (orders as RawOrder[]).map((o) => o.id)

  // 3. Get order items for those orders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let itemsQuery = (supabase.from('order_items') as any)
    .select('*')
    .in('order_id', orderIds)
    .eq('is_sent', true)

  // For prep stations, filter to items matching this station's prep_stations
  // For expo stations, show all items
  if (stationType === 'prep' && prepStationsFilter.length > 0) {
    itemsQuery = itemsQuery.in('prep_station', prepStationsFilter)
  }

  const { data: items, error: itemsError } = await itemsQuery

  if (itemsError) {
    return NextResponse.json({ error: 'Failed to fetch order items' }, { status: 500 })
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ data: [] })
  }

  // 4. Check which items have been bumped at this station (via kds_ticket_events)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bumpEvents } = await (supabase.from('kds_ticket_events') as any)
    .select('order_item_id, event_type')
    .eq('station_id', stationId)
    .in('event_type', ['bumped', 'recalled'])
    .in('order_item_id', (items as RawOrderItem[]).map((i) => i.id))
    .order('created_at', { ascending: true })

  // Build a set of effectively bumped item IDs (bumped but not subsequently recalled)
  const bumpedItemIds = new Set<string>()
  if (bumpEvents) {
    for (const evt of bumpEvents) {
      const itemId = evt.order_item_id as string
      if (evt.event_type === 'bumped') {
        bumpedItemIds.add(itemId)
      } else if (evt.event_type === 'recalled') {
        bumpedItemIds.delete(itemId)
      }
    }
  }

  // 5. Get server names and table names
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

  // 6. Group items by order to build tickets
  const orderMap = new Map<string, RawOrder>()
  for (const order of orders as RawOrder[]) {
    orderMap.set(order.id, order)
  }

  const ticketsByOrder = new Map<string, TicketItem[]>()
  for (const item of items as RawOrderItem[]) {
    // Skip items that have been bumped at this station
    if (bumpedItemIds.has(item.id)) continue

    const ticketItem: TicketItem = {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      modifiers: item.modifiers ?? [],
      special_instructions: item.special_instructions ?? '',
      seat_number: item.seat_number,
      course: item.course ?? 1,
      status: item.is_ready ? 'completed' : item.is_fired ? 'in_progress' : 'pending',
      is_void: item.is_void ?? false,
    }

    const existing = ticketsByOrder.get(item.order_id) ?? []
    existing.push(ticketItem)
    ticketsByOrder.set(item.order_id, existing)
  }

  // 7. Build tickets
  const now = Date.now()
  const tickets: Ticket[] = []

  for (const [orderId, ticketItems] of ticketsByOrder.entries()) {
    // Skip orders where all items are completed (for prep stations)
    if (ticketItems.length === 0) continue

    const order = orderMap.get(orderId)
    if (!order) continue

    const createdAt = order.created_at
    const ageSeconds = Math.floor((now - new Date(createdAt).getTime()) / 1000)

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
      is_rush: order.is_rush ?? false,
      station_id: stationId,
    })
  }

  // Sort by created_at ascending (oldest first) with rush orders first
  tickets.sort((a, b) => {
    if (a.is_rush !== b.is_rush) return a.is_rush ? -1 : 1
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return NextResponse.json({ data: tickets })
}
