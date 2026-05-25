import { createAdminClient } from '@/lib/supabase/admin'

const HEARTBEAT_TIMEOUT_MS = 90000 // 3 missed heartbeats at 30s each

interface StationRecord {
  id: string
  name: string
  location_id: string
  org_id: string
  station_type: string
  last_heartbeat_at: string | null
  display_settings: {
    failover_printer_id?: string | null
    live_metrics?: {
      active_ticket_count: number
      active_item_count: number
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any
  } | null
}

interface FailoverTicket {
  order_number: string
  order_type: string
  server_name: string
  table_name: string | null
  items: Array<{
    name: string
    quantity: number
    modifiers: string[]
    special_instructions: string
  }>
  created_at: string
  is_rush: boolean
}

/**
 * Check all stations at a location for missed heartbeats and trigger failover
 * if any station is offline and has a backup printer configured.
 *
 * This function is designed to be called periodically (e.g., every 30s from
 * a BullMQ job or a cron endpoint).
 */
export async function checkStationHealth(locationId: string): Promise<{
  offlineStations: Array<{ id: string; name: string; failover_active: boolean }>
  onlineStations: Array<{ id: string; name: string }>
}> {
  const supabase = createAdminClient()
  const now = Date.now()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stations, error } = await (supabase.from('kds_stations') as any)
    .select('*')
    .eq('location_id', locationId)
    .eq('is_active', true)

  if (error || !stations) {
    return { offlineStations: [], onlineStations: [] }
  }

  const offlineStations: Array<{ id: string; name: string; failover_active: boolean }> = []
  const onlineStations: Array<{ id: string; name: string }> = []

  for (const station of stations as StationRecord[]) {
    const lastHeartbeat = station.last_heartbeat_at
      ? new Date(station.last_heartbeat_at).getTime()
      : 0
    const elapsed = now - lastHeartbeat
    const isOffline = elapsed > HEARTBEAT_TIMEOUT_MS

    if (isOffline) {
      const failoverPrinterId = station.display_settings?.failover_printer_id
      const failoverActive = !!failoverPrinterId

      offlineStations.push({
        id: station.id,
        name: station.name,
        failover_active: failoverActive,
      })

      // If there is a backup printer, trigger failover
      if (failoverActive) {
        await triggerPrinterFailover(station, failoverPrinterId!)
      }

      // Broadcast offline notification
      const channel = supabase.channel(`kds_stations:${locationId}`)
      await channel.send({
        type: 'broadcast',
        event: 'station_offline',
        payload: {
          station_id: station.id,
          station_name: station.name,
          failover_active: failoverActive,
          backup_printer_id: failoverPrinterId ?? null,
          timestamp: new Date().toISOString(),
        },
      })
    } else {
      onlineStations.push({
        id: station.id,
        name: station.name,
      })
    }
  }

  return { offlineStations, onlineStations }
}

/**
 * Route pending tickets for an offline station to its backup printer.
 * Formats tickets for thermal printing (ESC/POS compatible).
 */
async function triggerPrinterFailover(
  station: StationRecord,
  printerId: string
): Promise<void> {
  const supabase = createAdminClient()

  // Get pending tickets for this station that haven't been printed already
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingOrders } = await (supabase.from('orders') as any)
    .select('id, display_number, order_type, server_id, table_id, is_rush, created_at, notes')
    .eq('location_id', station.location_id)
    .in('status', ['open', 'fired', 'ready'])
    .order('created_at', { ascending: true })

  if (!pendingOrders || pendingOrders.length === 0) return

  const orderIds = pendingOrders.map((o: { id: string }) => o.id)

  // Get items routed to this station
  const prepStations = station.display_settings
    ? (station.display_settings as Record<string, unknown>).prep_stations
    : null
  const prepFilter = Array.isArray(prepStations) ? prepStations : []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let itemsQuery = (supabase.from('order_items') as any)
    .select('*')
    .in('order_id', orderIds)
    .eq('is_sent', true)
    .eq('is_void', false)

  if (station.station_type === 'prep' && prepFilter.length > 0) {
    itemsQuery = itemsQuery.in('prep_station', prepFilter)
  }

  const { data: items } = await itemsQuery
  if (!items || items.length === 0) return

  // Check which tickets have already been printed during this failover period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: printEvents } = await (supabase.from('kds_ticket_events') as any)
    .select('order_id')
    .eq('station_id', station.id)
    .eq('event_type', 'failover_printed')
    .in('order_id', orderIds)

  const alreadyPrintedOrderIds = new Set(
    (printEvents ?? []).map((e: { order_id: string }) => e.order_id)
  )

  // Group items by order for ticket formatting
  const itemsByOrder = new Map<string, typeof items>()
  for (const item of items) {
    if (alreadyPrintedOrderIds.has(item.order_id)) continue
    const existing = itemsByOrder.get(item.order_id) ?? []
    existing.push(item)
    itemsByOrder.set(item.order_id, existing)
  }

  // Format and "print" each ticket
  for (const [orderId, orderItems] of itemsByOrder.entries()) {
    const order = pendingOrders.find((o: { id: string }) => o.id === orderId)
    if (!order) continue

    const ticket: FailoverTicket = {
      order_number: order.display_number,
      order_type: order.order_type,
      server_name: 'Server', // Would need server lookup for full name
      table_name: null,
      items: orderItems.map((item: {
        name: string
        quantity: number
        modifiers: string[] | null
        special_instructions: string | null
      }) => ({
        name: item.name,
        quantity: item.quantity,
        modifiers: item.modifiers ?? [],
        special_instructions: item.special_instructions ?? '',
      })),
      created_at: order.created_at,
      is_rush: order.is_rush ?? false,
    }

    // Queue the print job (in production, this sends to the printer service)
    await queuePrintJob(printerId, station, ticket)

    // Record that this order was printed during failover
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('kds_ticket_events') as any).insert({
      org_id: station.org_id,
      station_id: station.id,
      order_id: orderId,
      event_type: 'failover_printed',
      event_data: {
        printer_id: printerId,
        printed_at: new Date().toISOString(),
        item_count: orderItems.length,
      },
    })
  }
}

/**
 * Format a ticket for thermal printing (ESC/POS) and queue the print job.
 * In production, this sends to a print service or BullMQ queue.
 */
async function queuePrintJob(
  printerId: string,
  station: StationRecord,
  ticket: FailoverTicket
): Promise<void> {
  const supabase = createAdminClient()

  // Build ESC/POS formatted content
  const lines: string[] = []

  // Header
  lines.push('================================')
  if (ticket.is_rush) {
    lines.push('******* RUSH ORDER *******')
  }
  lines.push(`KDS FAILOVER: ${station.name}`)
  lines.push('================================')
  lines.push(`Order #${ticket.order_number}`)
  lines.push(`Type: ${ticket.order_type.toUpperCase()}`)
  if (ticket.table_name) {
    lines.push(`Table: ${ticket.table_name}`)
  }
  lines.push(`Time: ${new Date(ticket.created_at).toLocaleTimeString()}`)
  lines.push('--------------------------------')

  // Items
  for (const item of ticket.items) {
    lines.push(`${item.quantity}x ${item.name}`)
    for (const mod of item.modifiers) {
      lines.push(`   > ${mod}`)
    }
    if (item.special_instructions) {
      lines.push(`   ** ${item.special_instructions} **`)
    }
  }

  lines.push('================================')
  lines.push(`Printed: ${new Date().toLocaleTimeString()}`)
  lines.push('')

  const printContent = lines.join('\n')

  // Queue the print job to the print_jobs table
  // The printer service daemon picks up jobs from this table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('print_jobs') as any).insert({
    org_id: station.org_id,
    location_id: station.location_id,
    printer_id: printerId,
    job_type: 'kds_failover',
    content: printContent,
    metadata: {
      station_id: station.id,
      station_name: station.name,
      order_number: ticket.order_number,
      is_rush: ticket.is_rush,
    },
    status: 'pending',
  })
}

/**
 * Get a status summary of all stations at a location.
 */
export async function getStationHealthSummary(locationId: string): Promise<
  Array<{
    id: string
    name: string
    station_type: string
    is_online: boolean
    is_degraded: boolean
    last_heartbeat_at: string | null
    failover_active: boolean
    active_ticket_count: number
    utilization_pct: number
  }>
> {
  const supabase = createAdminClient()
  const now = Date.now()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stations } = await (supabase.from('kds_stations') as any)
    .select('*')
    .eq('location_id', locationId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (!stations) return []

  return (stations as StationRecord[]).map((station) => {
    const lastHeartbeat = station.last_heartbeat_at
      ? new Date(station.last_heartbeat_at).getTime()
      : 0
    const elapsed = now - lastHeartbeat
    const isOnline = elapsed < HEARTBEAT_TIMEOUT_MS
    const isDegraded = elapsed >= 60000 && elapsed < HEARTBEAT_TIMEOUT_MS
    const metrics = station.display_settings?.live_metrics

    return {
      id: station.id,
      name: station.name,
      station_type: station.station_type,
      is_online: isOnline,
      is_degraded: isDegraded,
      last_heartbeat_at: station.last_heartbeat_at,
      failover_active: !isOnline && !!(station.display_settings?.failover_printer_id),
      active_ticket_count: metrics?.active_ticket_count ?? 0,
      utilization_pct: metrics?.active_item_count
        ? Math.round((metrics.active_item_count / (station.display_settings?.max_capacity ?? 50)) * 100)
        : 0,
    }
  })
}
