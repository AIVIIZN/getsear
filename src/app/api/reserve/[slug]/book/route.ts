import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/integrations/twilio-client'

const bookSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  party_size: z.number().int().min(1).max(50),
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().min(7).max(20),
  customer_email: z.string().email().optional().or(z.literal('')),
  special_requests: z.string().max(500).optional(),
})

/**
 * POST /api/reserve/[slug]/book — Public: create a reservation
 * No auth required. Rate-limited.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = bookSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Look up location by slug
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: location, error: locErr } = await (supabase.from('locations') as any)
    .select('id, name, org_id, timezone')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (locErr || !location) {
    return apiError(404, 'Restaurant not found')
  }

  // Check for double-booking at the same time slot
  const turnTimeMinutes = 90
  const [rh, rm] = parsed.data.time.split(':').map(Number)
  const slotMinutes = rh * 60 + rm

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingRes } = await (supabase.from('reservations') as any)
    .select('id, reservation_time, table_id, party_size')
    .eq('location_id', location.id)
    .eq('reservation_date', parsed.data.date)
    .in('status', ['pending', 'confirmed', 'seated'])

  // Count available tables
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tables } = await (supabase.from('tables') as any)
    .select('id, capacity')
    .eq('location_id', location.id)
    .eq('is_active', true)
    .gte('capacity', parsed.data.party_size)

  const totalMatchingTables = tables?.length ?? 0

  // Count overlapping reservations
  let overlapping = 0
  for (const res of existingRes ?? []) {
    if (!res.reservation_time) continue
    const [eh, em] = res.reservation_time.split(':').map(Number)
    const existMin = eh * 60 + em
    if (Math.abs(slotMinutes - existMin) < turnTimeMinutes) {
      overlapping++
    }
  }

  if (overlapping >= totalMatchingTables) {
    return apiError(409, 'No tables available for this time slot. Please choose a different time.')
  }

  // Create the reservation
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: reservation, error: createErr } = await (supabase.from('reservations') as any)
    .insert({
      org_id: location.org_id,
      location_id: location.id,
      customer_name: parsed.data.customer_name,
      customer_phone: parsed.data.customer_phone,
      customer_email: parsed.data.customer_email || null,
      party_size: parsed.data.party_size,
      reservation_date: parsed.data.date,
      reservation_time: parsed.data.time,
      special_requests: parsed.data.special_requests || null,
      status: 'confirmed',
      source: 'widget',
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (createErr || !reservation) {
    console.error('[reserve/book] Create error:', createErr)
    return apiError(500, 'Failed to create reservation')
  }

  // Send confirmation SMS (fire and forget)
  const [th, tm2] = parsed.data.time.split(':').map(Number)
  const h12 = th === 0 ? 12 : th > 12 ? th - 12 : th
  const ampm = th >= 12 ? 'PM' : 'AM'
  const displayTime = `${h12}:${String(tm2).padStart(2, '0')} ${ampm}`

  const dateObj = new Date(parsed.data.date + 'T00:00:00')
  const displayDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  sendSms({
    locationId: location.id,
    to: parsed.data.customer_phone,
    templateType: 'reservation_reminder_24hr',
    variables: {
      customer_name: parsed.data.customer_name,
      location_name: location.name,
      reservation_date: displayDate,
      reservation_time: displayTime,
      party_size: String(parsed.data.party_size),
    },
    idempotencyKey: `reserve-confirm-${reservation.id}`,
    customBody: `Confirmed! Table for ${parsed.data.party_size} at ${location.name}, ${displayDate} at ${displayTime}. See you then, ${parsed.data.customer_name}! Reply STOP to opt out.`,
  }).catch((err) => {
    console.error('[reserve/book] SMS send error:', err)
  })

  return NextResponse.json({
    data: {
      id: reservation.id,
      customer_name: reservation.customer_name,
      party_size: reservation.party_size,
      date: parsed.data.date,
      time: parsed.data.time,
      display_time: displayTime,
      display_date: displayDate,
      location_name: location.name,
      status: 'confirmed',
      special_requests: parsed.data.special_requests || null,
    },
  })
}
