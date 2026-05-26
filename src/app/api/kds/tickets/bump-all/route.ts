import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const bumpAllSchema = z.object({
  station_id: z.string().uuid(),
  location_id: z.string().uuid(),
})

/**
 * POST /api/kds/tickets/bump-all — bump all active tickets for a station
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = bumpAllSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { station_id: stationId, location_id: locationId } = parsed.data
  const supabase = createAdminClient()

  // Get station
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station } = await (supabase.from('kds_stations') as any)
    .select('*')
    .eq('id', stationId)
    .eq('org_id', user.org_id)
    .single()

  if (!station) {
    return apiError(404, 'Station not found')
  }

  const prepStationsFilter: string[] = station.prep_stations ?? []
  const isExpo = station.station_type === 'expo'

  // Get active orders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders } = await (supabase.from('orders') as any)
    .select('id')
    .eq('org_id', user.org_id)
    .eq('location_id', locationId)
    .in('status', ['open', 'fired', 'ready'])

  if (!orders || orders.length === 0) {
    return NextResponse.json({ data: { bumped_count: 0 } })
  }

  const orderIds = (orders as Array<{ id: string }>).map((o) => o.id)

  // Get items for those orders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let itemsQuery = (supabase.from('order_items') as any)
    .select('id, order_id')
    .in('order_id', orderIds)
    .eq('org_id', user.org_id)
    .eq('is_sent', true)
    .eq('is_voided', false)

  if (!isExpo && prepStationsFilter.length > 0) {
    itemsQuery = itemsQuery.in('prep_station', prepStationsFilter)
  }

  const { data: items } = await itemsQuery

  if (!items || items.length === 0) {
    return NextResponse.json({ data: { bumped_count: 0 } })
  }

  const now = new Date().toISOString()

  // Create bump events for all items
  const bumpEvents = (items as Array<{ id: string; order_id: string }>).map((item) => ({
    org_id: user.org_id,
    station_id: stationId,
    order_id: item.order_id,
    order_item_id: item.id,
    event_type: 'bumped',
    performed_by: user.id,
    created_at: now,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('kds_ticket_events') as any)
    .insert(bumpEvents)

  if (error) {
    return apiError(500, 'Failed to bump all tickets')
  }

  // For expo, mark all items as ready
  if (isExpo) {
    const itemIds = (items as Array<{ id: string }>).map((i) => i.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('order_items') as any)
      .update({ is_ready: true, ready_at: now })
      .in('id', itemIds)
      .eq('org_id', user.org_id)

    // Mark all those orders as ready
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('orders') as any)
      .update({ status: 'ready' })
      .in('id', orderIds)
      .eq('org_id', user.org_id)
  }

  return NextResponse.json({
    data: { bumped_count: items.length, station_id: stationId },
  })
}
