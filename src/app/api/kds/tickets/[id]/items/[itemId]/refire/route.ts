import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const refireSchema = z.object({
  station_id: z.string().uuid(),
  reason_code: z.enum([
    'dropped',
    'wrong_temp',
    'wrong_item',
    'contamination',
    'customer_complaint',
    'expo_quality',
    'other',
  ]),
})

/**
 * POST /api/kds/tickets/[id]/items/[itemId]/refire
 *
 * Re-fire an individual item with a reason code.
 * - Creates a 'refire' event in kds_ticket_events.
 * - Resets is_ready = false on the order_item.
 * - Item reappears on prep station AND expo with RE-FIRE banner.
 * - Re-fired items automatically get refire priority (above RUSH).
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
    return apiError(400, 'Invalid JSON body')
  }

  const parsed = refireSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { station_id: stationId, reason_code: reasonCode } = parsed.data

  // Parse order_id from composite ticket ID
  const underscoreIdx = ticketId.indexOf('_')
  if (underscoreIdx === -1) {
    return apiError(400, 'Invalid ticket ID format')
  }
  const orderId = ticketId.substring(underscoreIdx + 1)

  const supabase = createAdminClient()

  // Verify station exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station } = await (supabase.from('kds_stations') as any)
    .select('id, station_type')
    .eq('id', stationId)
    .eq('org_id', user.org_id)
    .single()

  if (!station) {
    return apiError(404, 'Station not found')
  }

  // Verify the item exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orderItem } = await (supabase.from('order_items') as any)
    .select('id, order_id, name, prep_station')
    .eq('id', itemId)
    .eq('order_id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!orderItem) {
    return apiError(404, 'Order item not found')
  }

  // Count existing re-fires for this item
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingRefires } = await (supabase.from('kds_ticket_events') as any)
    .select('id')
    .eq('order_item_id', itemId)
    .eq('event_type', 'refire')

  const refireCount = (existingRefires?.length ?? 0) + 1
  const now = new Date().toISOString()

  // Create refire event
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: eventError } = await (supabase.from('kds_ticket_events') as any)
    .insert({
      org_id: user.org_id,
      station_id: stationId,
      order_id: orderId,
      order_item_id: itemId,
      event_type: 'refire',
      performed_by: user.id,
      created_at: now,
    })

  if (eventError) {
    return apiError(500, 'Failed to create refire event')
  }

  // Reset is_ready on the order item
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('order_items') as any)
    .update({ is_ready: false, ready_at: null })
    .eq('id', itemId)
    .eq('org_id', user.org_id)

  // Escalate order priority to 'refire' if not already higher
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('orders') as any)
    .update({ priority: 'refire' })
    .eq('id', orderId)
    .eq('org_id', user.org_id)

  // If order was 'ready', set it back to the active kitchen state.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('orders') as any)
    .update({ status: 'fired' })
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .eq('status', 'ready')

  // Also create a "recalled" event to un-bump the item at this station
  // so it reappears
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('kds_ticket_events') as any)
    .insert({
      org_id: user.org_id,
      station_id: stationId,
      order_id: orderId,
      order_item_id: itemId,
      event_type: 'recalled',
      performed_by: user.id,
      created_at: now,
    })

  return NextResponse.json({
    data: {
      ticket_id: ticketId,
      item_id: itemId,
      station_id: stationId,
      reason_code: reasonCode,
      refire_count: refireCount,
    },
  })
}
