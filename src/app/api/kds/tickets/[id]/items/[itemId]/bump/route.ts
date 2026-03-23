import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const bumpItemSchema = z.object({
  station_id: z.string().uuid(),
})

/**
 * POST /api/kds/tickets/[id]/items/[itemId]/bump
 *
 * Bump an individual item within a ticket.
 * - Idempotent: if already bumped, returns success without creating duplicate events.
 * - If all items on the ticket are bumped, creates a station_complete event.
 *
 * The [id] is a composite ticket ID: {station_id}_{order_id}
 * The [itemId] is the order_item_id
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id: ticketId, itemId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = bumpItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { station_id: stationId } = parsed.data

  // Parse order_id from composite ticket ID
  const underscoreIdx = ticketId.indexOf('_')
  if (underscoreIdx === -1) {
    return NextResponse.json({ error: 'Invalid ticket ID format' }, { status: 400 })
  }
  const orderId = ticketId.substring(underscoreIdx + 1)

  const supabase = createAdminClient()

  // Verify station exists and belongs to user's org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station } = await (supabase.from('kds_stations') as any)
    .select('id, station_type, prep_stations')
    .eq('id', stationId)
    .eq('org_id', user.org_id)
    .single()

  if (!station) {
    return NextResponse.json({ error: 'Station not found' }, { status: 404 })
  }

  // Verify the item exists on this order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderItem } = await (supabase.from('order_items') as any)
    .select('id, order_id, is_sent, is_void')
    .eq('id', itemId)
    .eq('order_id', orderId)
    .single()

  if (!orderItem) {
    return NextResponse.json({ error: 'Order item not found' }, { status: 404 })
  }

  // Idempotency check: see if this item is already bumped at this station
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingBumps } = await (supabase.from('kds_ticket_events') as any)
    .select('id, event_type')
    .eq('station_id', stationId)
    .eq('order_item_id', itemId)
    .in('event_type', ['bumped', 'recalled'])
    .order('created_at', { ascending: true })

  // Check net state: bumped but not subsequently recalled
  let isAlreadyBumped = false
  if (existingBumps) {
    for (const evt of existingBumps as Array<{ id: string; event_type: string }>) {
      if (evt.event_type === 'bumped') isAlreadyBumped = true
      if (evt.event_type === 'recalled') isAlreadyBumped = false
    }
  }

  if (isAlreadyBumped) {
    // Already bumped - idempotent success
    return NextResponse.json({
      data: {
        ticket_id: ticketId,
        item_id: itemId,
        station_id: stationId,
        already_bumped: true,
      },
    })
  }

  const now = new Date().toISOString()

  // Create bump event for this specific item
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: eventError } = await (supabase.from('kds_ticket_events') as any)
    .insert({
      org_id: user.org_id,
      station_id: stationId,
      order_id: orderId,
      order_item_id: itemId,
      event_type: 'bumped',
      data: { performed_by: user.id },
      metadata: { item_bump: true },
      created_at: now,
    })

  if (eventError) {
    return NextResponse.json({ error: 'Failed to create bump event' }, { status: 500 })
  }

  // Check if ALL items for this order at this station are now bumped
  const prepStationsFilter: string[] = station.prep_stations ?? []
  const isExpo = station.station_type === 'expo'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allItemsQuery = (supabase.from('order_items') as any)
    .select('id')
    .eq('order_id', orderId)
    .eq('is_sent', true)
    .eq('is_void', false)

  if (!isExpo && prepStationsFilter.length > 0) {
    allItemsQuery = allItemsQuery.in('prep_station', prepStationsFilter)
  }

  const { data: allItems } = await allItemsQuery

  let allBumped = false
  if (allItems && allItems.length > 0) {
    const allItemIds = (allItems as Array<{ id: string }>).map((i) => i.id)

    // Get all bump/recall events for these items at this station
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: allEvents } = await (supabase.from('kds_ticket_events') as any)
      .select('order_item_id, event_type')
      .eq('station_id', stationId)
      .in('order_item_id', allItemIds)
      .in('event_type', ['bumped', 'recalled'])
      .order('created_at', { ascending: true })

    const bumpedSet = new Set<string>()
    if (allEvents) {
      for (const evt of allEvents as Array<{ order_item_id: string; event_type: string }>) {
        if (evt.event_type === 'bumped') bumpedSet.add(evt.order_item_id)
        if (evt.event_type === 'recalled') bumpedSet.delete(evt.order_item_id)
      }
    }

    allBumped = allItemIds.every((id) => bumpedSet.has(id))
  }

  if (allBumped) {
    // Create station_complete event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('kds_ticket_events') as any)
      .insert({
        org_id: user.org_id,
        station_id: stationId,
        order_id: orderId,
        event_type: 'station_complete',
        data: { performed_by: user.id },
        metadata: { auto_complete: true },
        created_at: now,
      })

    // If expo, mark items as ready and potentially update order status
    if (isExpo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('order_items') as any)
        .update({ is_ready: true, ready_at: now })
        .eq('order_id', orderId)
        .eq('is_sent', true)
        .eq('is_void', false)

      // Check if all items on the order are ready
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pendingItems } = await (supabase.from('order_items') as any)
        .select('id')
        .eq('order_id', orderId)
        .eq('is_sent', true)
        .eq('is_void', false)
        .eq('is_ready', false)

      if (!pendingItems || pendingItems.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('orders') as any)
          .update({ status: 'ready' })
          .eq('id', orderId)
      }
    }
  }

  return NextResponse.json({
    data: {
      ticket_id: ticketId,
      item_id: itemId,
      station_id: stationId,
      all_bumped: allBumped,
    },
  })
}
