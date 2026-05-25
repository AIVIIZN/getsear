import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

/**
 * POST /api/kds/tickets/[id]/recall — recall a bumped ticket
 *
 * The [id] is a composite ticket ID: {station_id}_{order_id}
 *
 * Body:
 *   station_id — optional, can be parsed from ticket ID
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id: ticketId } = await params

  let body: { station_id?: string } = {}
  try {
    body = await request.json()
  } catch {
    // Allow empty body
  }

  // Parse the composite ticket ID
  const underscoreIdx = ticketId.indexOf('_')
  if (underscoreIdx === -1) {
    return NextResponse.json({ error: 'Invalid ticket ID format' }, { status: 400 })
  }

  const stationId = body.station_id ?? ticketId.substring(0, underscoreIdx)
  const orderId = ticketId.substring(underscoreIdx + 1)

  const supabase = createAdminClient()

  // Verify station exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station } = await (supabase.from('kds_stations') as any)
    .select('*')
    .eq('id', stationId)
    .eq('org_id', user.org_id)
    .single()

  if (!station) {
    return NextResponse.json({ error: 'Station not found' }, { status: 404 })
  }

  // Check recall window: only allow recall within 30 minutes
  const recallWindowMs = 30 * 60 * 1000
  const cutoff = new Date(Date.now() - recallWindowMs).toISOString()

  // Get bump events for this order at this station within recall window
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bumpEvents } = await (supabase.from('kds_ticket_events') as any)
    .select('order_item_id')
    .eq('station_id', stationId)
    .eq('order_id', orderId)
    .eq('event_type', 'bumped')
    .gte('created_at', cutoff)

  if (!bumpEvents || bumpEvents.length === 0) {
    return NextResponse.json(
      { error: 'No bumped items found within recall window' },
      { status: 404 }
    )
  }

  const itemIds = [...new Set((bumpEvents as Array<{ order_item_id: string }>).map((e) => e.order_item_id))]
  const now = new Date().toISOString()

  // Create recall events
  const recallEvents = itemIds.map((itemId) => ({
    org_id: user.org_id,
    station_id: stationId,
    order_id: orderId,
    order_item_id: itemId,
    event_type: 'recalled',
    performed_by: user.id,
    created_at: now,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: eventError } = await (supabase.from('kds_ticket_events') as any)
    .insert(recallEvents)

  if (eventError) {
    return NextResponse.json({ error: 'Failed to recall ticket' }, { status: 500 })
  }

  // If this was an expo station, reset is_ready on the items
  if (station.station_type === 'expo') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('order_items') as any)
      .update({ is_ready: false, ready_at: null })
      .in('id', itemIds)
      .eq('org_id', user.org_id)

    // Reset order status from 'ready' back to 'in_progress'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('orders') as any)
      .update({ status: 'in_progress' })
      .eq('id', orderId)
      .eq('org_id', user.org_id)
      .eq('status', 'ready')
  }

  return NextResponse.json({
    data: {
      ticket_id: ticketId,
      recalled_items: itemIds.length,
      station_id: stationId,
      order_id: orderId,
    },
  })
}
