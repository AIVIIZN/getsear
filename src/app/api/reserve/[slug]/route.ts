import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  party_size: z.coerce.number().int().min(1).max(50).default(2),
})

/**
 * GET /api/reserve/[slug] — Public: get availability for a location
 * No auth required. Rate-limited by slug.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = querySchema.safeParse(searchParams)
  if (!parsed.success) {
    return apiError(400, 'Invalid parameters. Required: date (YYYY-MM-DD), party_size (number)')
  }

  const { date, party_size } = parsed.data
  const supabase = createAdminClient()

  // Look up location by slug
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: location, error: locErr } = await (supabase.from('locations') as any)
    .select('id, name, org_id, timezone, settings')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (locErr || !location) {
    return apiError(404, 'Restaurant not found')
  }

  // Get all tables that can accommodate the party
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tables } = await (supabase.from('tables') as any)
    .select('id, capacity')
    .eq('location_id', location.id)
    .eq('is_active', true)
    .gte('capacity', party_size)

  const totalMatchingTables = tables?.length ?? 0

  if (totalMatchingTables === 0) {
    return NextResponse.json({
      data: {
        location_name: location.name,
        date,
        party_size,
        available_slots: [],
        message: `No tables available for a party of ${party_size}`,
      },
    })
  }

  // Get existing reservations for the date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingRes } = await (supabase.from('reservations') as any)
    .select('id, reservation_time, party_size, table_id, status')
    .eq('location_id', location.id)
    .eq('reservation_date', date)
    .in('status', ['pending', 'confirmed', 'seated'])

  const reservations = existingRes ?? []

  // Generate 30-minute slots from 11:00 to 21:30 (configurable)
  const slotStart = 11 // 11:00 AM
  const slotEnd = 21.5 // 9:30 PM
  const slotDurationMinutes = 30
  const turnTimeMinutes = 90 // Assumed turn time for reservations

  const slots: Array<{
    time: string
    display_time: string
    available_tables: number
    total_tables: number
    status: 'available' | 'limited' | 'unavailable'
  }> = []

  for (let hour = slotStart; hour <= slotEnd; hour += slotDurationMinutes / 60) {
    const h = Math.floor(hour)
    const m = Math.round((hour - h) * 60)
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    const ampm = h >= 12 ? 'PM' : 'AM'
    const displayTime = `${h12}:${String(m).padStart(2, '0')} ${ampm}`

    // Count tables occupied at this time (reservation overlaps)
    const occupiedTableIds = new Set<string>()
    for (const res of reservations) {
      if (!res.reservation_time) continue
      const [rh, rm] = res.reservation_time.split(':').map(Number)
      const resStartMin = rh * 60 + rm
      const slotMin = h * 60 + m
      // Reservation occupies table for turnTimeMinutes
      if (slotMin >= resStartMin && slotMin < resStartMin + turnTimeMinutes) {
        if (res.table_id) {
          occupiedTableIds.add(res.table_id)
        } else {
          // Reservation without specific table still uses one
          occupiedTableIds.add(`unassigned-${res.id}`)
        }
      }
    }

    const availableTables = Math.max(0, totalMatchingTables - occupiedTableIds.size)

    let status: 'available' | 'limited' | 'unavailable' = 'available'
    if (availableTables === 0) status = 'unavailable'
    else if (availableTables <= 2) status = 'limited'

    slots.push({
      time: timeStr,
      display_time: displayTime,
      available_tables: availableTables,
      total_tables: totalMatchingTables,
      status,
    })
  }

  return NextResponse.json({
    data: {
      location_name: location.name,
      location_id: location.id,
      date,
      party_size,
      available_slots: slots.filter((s) => s.status !== 'unavailable'),
      all_slots: slots,
    },
  })
}
