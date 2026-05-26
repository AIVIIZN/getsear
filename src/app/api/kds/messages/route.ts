import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const sendMessageSchema = z.object({
  from_station_id: z.string().uuid(),
  to_station_id: z.string().uuid().nullable(),
  message: z.string().min(1).max(500),
  message_type: z.enum(['quick', 'custom']),
  location_id: z.string().uuid(),
})

/**
 * GET /api/kds/messages — list messages for a station
 *
 * Query params:
 *   station_id — required, the station to get messages for
 *   location_id — required, the location
 *   limit — optional, max messages to return (default 100)
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const params = request.nextUrl.searchParams
  const stationId = params.get('station_id')
  const locationId = params.get('location_id')
  const limit = Math.min(parseInt(params.get('limit') ?? '100', 10), 200)

  if (!stationId) {
    return apiError(400, 'station_id is required')
  }
  if (!locationId) {
    return apiError(400, 'location_id is required')
  }

  const supabase = createAdminClient()

  // Get messages where this station is sender, receiver, or it was a broadcast (to_station_id is null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('kds_messages') as any)
    .select('*')
    .eq('location_id', locationId)
    .or(`from_station_id.eq.${stationId},to_station_id.eq.${stationId},to_station_id.is.null`)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    return apiError(500, 'Failed to fetch messages')
  }

  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST /api/kds/messages — send a message from one station to another
 *
 * Body:
 *   from_station_id — sender station
 *   to_station_id — receiver station (null = broadcast to all)
 *   message — message text
 *   message_type — 'quick' or 'custom'
 *   location_id — the location
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

  const parsed = sendMessageSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { from_station_id, to_station_id, message, message_type, location_id } = parsed.data
  const supabase = createAdminClient()

  // Look up station names for display
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fromStation } = await (supabase.from('kds_stations') as any)
    .select('name, station_type')
    .eq('id', from_station_id)
    .single()

  const fromStationName = fromStation?.name ?? 'Unknown Station'

  let toStationName: string | null = null
  if (to_station_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: toStation } = await (supabase.from('kds_stations') as any)
      .select('name')
      .eq('id', to_station_id)
      .single()
    toStationName = toStation?.name ?? null
  }

  // Insert the message
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newMessage, error } = await (supabase.from('kds_messages') as any)
    .insert({
      org_id: user.org_id,
      location_id,
      from_station_id,
      from_station_name: fromStationName,
      to_station_id,
      to_station_name: toStationName,
      message,
      message_type,
      is_read: false,
      sent_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to send message')
  }

  // Broadcast via Supabase Realtime so all KDS screens at this location pick it up
  const channel = supabase.channel(`kds_messages:${location_id}`)
  await channel.send({
    type: 'broadcast',
    event: 'message_received',
    payload: {
      ...newMessage,
    },
  })

  return NextResponse.json({ data: newMessage }, { status: 201 })
}
