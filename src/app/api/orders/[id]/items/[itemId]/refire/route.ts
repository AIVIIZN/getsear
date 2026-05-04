import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { assertVersion } from '@/lib/orders/concurrency'

const refireSchema = z.object({
  reason: z.enum([
    'wrong_temp',
    'wrong_item',
    'quality',
    'dropped',
    'customer_changed',
    'other',
  ]),
})

/**
 * POST /api/orders/[id]/items/[itemId]/refire
 *
 * Re-fires a specific item to the kitchen.
 * Creates a new KDS ticket event with priority 'refire' for that item.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id: orderId, itemId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = refireSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // V5.4.1 optimistic-lock guard. Refire mutates kitchen state; if a parallel
  // edit is already in flight we'd rather 409 than create a refire ticket
  // for an item that just got voided.
  const check = await assertVersion(supabase, request, orderId, user.org_id, {
    select: 'id, org_id, location_id, status, version',
  })
  if (!check.ok) return check.response

  const order = check.currentRow as {
    id: string; org_id: string; location_id: string; status: string
  }

  if (order.status === 'closed' || order.status === 'voided') {
    return NextResponse.json(
      { error: 'Cannot refire items on a closed or voided order' },
      { status: 400 }
    )
  }

  // Verify item exists on this order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item } = await (supabase.from('order_items') as any)
    .select('id, name, prep_station, is_voided')
    .eq('id', itemId)
    .eq('order_id', orderId)
    .single()

  if (!item) {
    return NextResponse.json({ error: 'Item not found on this order' }, { status: 404 })
  }

  if (item.is_voided) {
    return NextResponse.json({ error: 'Cannot refire a voided item' }, { status: 400 })
  }

  // Reset item status to pending/sent so kitchen sees it again
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('order_items') as any)
    .update({
      is_fired: false,
      is_ready: false,
      is_served: false,
      fired_at: null,
      ready_at: null,
      served_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)

  // Find the KDS station that handles this item's prep_station
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let stationQuery = (supabase.from('kds_stations') as any)
    .select('id')
    .eq('org_id', user.org_id)
    .eq('location_id', order.location_id)
    .eq('is_active', true)

  if (item.prep_station) {
    stationQuery = stationQuery.contains('prep_stations', [item.prep_station])
  }

  const { data: stations } = await stationQuery.limit(1)
  const stationId = stations?.[0]?.id ?? null

  // Create KDS ticket event for the refire
  if (stationId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('kds_ticket_events') as any).insert({
      org_id: user.org_id,
      station_id: stationId,
      order_id: orderId,
      order_item_id: itemId,
      event_type: 'received',
      performed_by: user.id,
    })
  }

  // Create audit log entry for the refire
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('order_modifications') as any).insert({
    org_id: user.org_id,
    order_id: orderId,
    modification_type: 'refire',
    description: `Refire: ${item.name} - ${parsed.data.reason}`,
    new_value: {
      item_id: itemId,
      item_name: item.name,
      reason: parsed.data.reason,
      priority: 'refire',
      station_id: stationId,
    },
    performed_by: user.id,
  })

  return NextResponse.json({
    data: {
      item_id: itemId,
      order_id: orderId,
      reason: parsed.data.reason,
      refired_at: new Date().toISOString(),
      station_id: stationId,
    },
  })
}
