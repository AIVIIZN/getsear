import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const heartbeatSchema = z.object({
  active_ticket_count: z.number().int().min(0).optional().default(0),
  active_item_count: z.number().int().min(0).optional().default(0),
  utilization_pct: z.number().min(0).max(100).optional().default(0),
})

/**
 * POST /api/kds/stations/[id]/heartbeat — KDS station heartbeat
 *
 * Called every 30 seconds by the KDS client to indicate the station is online.
 * Records last_heartbeat_at on the station record.
 * Returns any pending configuration updates.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = heartbeatSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { active_ticket_count, active_item_count, utilization_pct } = parsed.data
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Update station heartbeat and metrics
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station, error: fetchError } = await (supabase.from('kds_stations') as any)
    .select('id, display_settings, last_heartbeat_at')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (fetchError || !station) {
    return NextResponse.json({ error: 'Station not found' }, { status: 404 })
  }

  const previousHeartbeat = station.last_heartbeat_at
  const wasOffline = previousHeartbeat
    ? (Date.now() - new Date(previousHeartbeat).getTime()) > 90000
    : true

  // Update heartbeat timestamp and live metrics
  const updatedSettings = {
    ...(station.display_settings ?? {}),
    live_metrics: {
      active_ticket_count,
      active_item_count,
      utilization_pct,
      last_update: now,
    },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase.from('kds_stations') as any)
    .update({
      last_heartbeat_at: now,
      display_settings: updatedSettings,
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update heartbeat' }, { status: 500 })
  }

  // If station was offline and is now back, broadcast recovery event
  if (wasOffline) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fullStation } = await (supabase.from('kds_stations') as any)
      .select('name, location_id')
      .eq('id', id)
      .single()

    if (fullStation?.location_id) {
      const channel = supabase.channel(`kds_stations:${fullStation.location_id}`)
      await channel.send({
        type: 'broadcast',
        event: 'station_online',
        payload: {
          station_id: id,
          station_name: fullStation.name,
          timestamp: now,
        },
      })
    }
  }

  return NextResponse.json({
    data: {
      station_id: id,
      heartbeat_at: now,
      config: station.display_settings ?? {},
      was_offline: wasOffline,
    },
  })
}
