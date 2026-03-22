import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

/** GET /api/reservations/availability — check available time slots for a date and party size */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const params = request.nextUrl.searchParams
  const date = params.get('date')
  const partySize = parseInt(params.get('party_size') ?? '2', 10)
  const locationId = params.get('location_id') ?? user.location_ids[0]

  if (!date) {
    return NextResponse.json({ error: 'date parameter is required' }, { status: 400 })
  }

  if (!locationId) {
    return NextResponse.json({ error: 'No location specified' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Get all tables that can accommodate the party size
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tables } = await (supabase.from('tables') as any)
    .select('id, name, capacity')
    .eq('location_id', locationId)
    .gte('capacity', partySize)
    .order('capacity', { ascending: true })

  if (!tables || tables.length === 0) {
    return NextResponse.json({
      data: {
        date,
        party_size: partySize,
        available_slots: [],
        message: 'No tables available for this party size',
      },
    })
  }

  // Get existing reservations for this date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingReservations } = await (supabase.from('reservations') as any)
    .select('id, reservation_time, table_id, party_size, status')
    .eq('org_id', user.org_id)
    .eq('location_id', locationId)
    .eq('reservation_date', date)
    .in('status', ['pending', 'confirmed', 'seated'])

  const reservations = existingReservations ?? []

  // Default duration is 90 minutes, buffer is 15 minutes
  const durationMinutes = 90
  const bufferMinutes = 15
  const totalBlockMinutes = durationMinutes + bufferMinutes

  // Generate time slots from 11:00 to 21:00 in 30-minute increments
  const slots: Array<{
    time: string
    available_tables: number
    total_tables: number
  }> = []

  for (let hour = 11; hour <= 21; hour++) {
    for (const minute of [0, 30]) {
      if (hour === 21 && minute === 30) continue // Don't offer 21:30

      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      const slotStart = hour * 60 + minute
      const slotEnd = slotStart + totalBlockMinutes

      // Count how many tables are free during this slot
      let availableTables = 0
      for (const table of tables) {
        const isOccupied = reservations.some((r: Record<string, unknown>) => {
          if (r.table_id !== table.id) return false
          const [rh, rm] = (r.reservation_time as string).split(':').map(Number)
          const rStart = rh * 60 + rm
          const rEnd = rStart + totalBlockMinutes
          // Overlap check
          return slotStart < rEnd && slotEnd > rStart
        })
        if (!isOccupied) {
          availableTables++
        }
      }

      slots.push({
        time: timeStr,
        available_tables: availableTables,
        total_tables: tables.length,
      })
    }
  }

  return NextResponse.json({
    data: {
      date,
      party_size: partySize,
      available_slots: slots.filter((s) => s.available_tables > 0),
    },
  })
}
