import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

/**
 * POST /api/kds/tickets/[id]/bump — bump a ticket (mark all items complete at this station)
 *
 * The [id] is a composite ticket ID in the form: {station_id}_{order_id}
 *
 * Body:
 *   station_id — the KDS station ID
 *   item_ids — array of order_item IDs to mark as bumped
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id: ticketId } = await params

  let body: { station_id?: string; item_ids?: string[] } = {}
  try {
    body = await request.json()
  } catch {
    // Allow empty body — we'll parse station_id from ticket ID
  }

  // Parse the composite ticket ID: station_id_order_id
  const underscoreIdx = ticketId.indexOf('_')
  if (underscoreIdx === -1) {
    return NextResponse.json({ error: 'Invalid ticket ID format' }, { status: 400 })
  }

  const stationId = body.station_id ?? ticketId.substring(0, underscoreIdx)
  const orderId = ticketId.substring(underscoreIdx + 1)

  const supabase = createAdminClient()

  // Get the station's prep_stations filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station } = await (supabase.from('kds_stations') as any)
    .select('*')
    .eq('id', stationId)
    .eq('org_id', user.org_id)
    .single()

  if (!station) {
    return NextResponse.json({ error: 'Station not found' }, { status: 404 })
  }

  const prepStationsFilter: string[] = station.prep_stations ?? []
  const isExpo = station.station_type === 'expo'

  // Get order items for this order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let itemsQuery = (supabase.from('order_items') as any)
    .select('id, prep_station')
    .eq('order_id', orderId)
    .eq('is_sent', true)
    .eq('is_void', false)

  if (!isExpo && prepStationsFilter.length > 0) {
    itemsQuery = itemsQuery.in('prep_station', prepStationsFilter)
  }

  // If specific item_ids provided, further filter
  if (body.item_ids && body.item_ids.length > 0) {
    itemsQuery = itemsQuery.in('id', body.item_ids)
  }

  const { data: items, error: itemsError } = await itemsQuery

  if (itemsError || !items || items.length === 0) {
    return NextResponse.json({ error: 'No items to bump' }, { status: 404 })
  }

  const itemIds = (items as Array<{ id: string }>).map((i) => i.id)
  const now = new Date().toISOString()

  // Create bump events for each item
  const bumpEvents = itemIds.map((itemId) => ({
    org_id: user.org_id,
    station_id: stationId,
    order_id: orderId,
    order_item_id: itemId,
    event_type: 'bumped',
    data: { performed_by: user.id },
    created_at: now,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: eventError } = await (supabase.from('kds_ticket_events') as any)
    .insert(bumpEvents)

  if (eventError) {
    return NextResponse.json({ error: 'Failed to create bump events' }, { status: 500 })
  }

  // For expo station, mark items as ready on order_items
  if (isExpo) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('order_items') as any)
      .update({ is_ready: true, ready_at: now })
      .in('id', itemIds)

    // Check if all items on the order are now ready
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pendingItems } = await (supabase.from('order_items') as any)
      .select('id')
      .eq('order_id', orderId)
      .eq('is_sent', true)
      .eq('is_void', false)
      .eq('is_ready', false)

    if (!pendingItems || pendingItems.length === 0) {
      // All items ready — update order status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('orders') as any)
        .update({ status: 'ready' })
        .eq('id', orderId)
    }
  }

  return NextResponse.json({
    data: {
      ticket_id: ticketId,
      bumped_items: itemIds.length,
      station_id: stationId,
      order_id: orderId,
    },
  })
}
