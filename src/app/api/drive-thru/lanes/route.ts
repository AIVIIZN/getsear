import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const createCarSchema = z.object({
  lane_id: z.string().uuid(),
})

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const db = createAdminClient()

  const { data: lanes, error } = await db
    .from('drive_thru_lanes')
    .select('*, drive_thru_cars(id, order_id, position, entered_at, order_placed_at, payment_at, pickup_at)')
    .eq('org_id', user.org_id)
    .eq('is_active', true)
    .order('number')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Calculate metrics per lane
  const lanesWithMetrics = (lanes ?? []).map((lane: Record<string, unknown>) => {
    const cars = (lane.drive_thru_cars as Array<Record<string, unknown>>) ?? []
    const activeCars = cars.filter((c) => !c.exited_at)

    return {
      id: lane.id,
      number: lane.number,
      name: lane.name,
      is_active: lane.is_active,
      cars: activeCars.map((car) => ({
        id: car.id,
        order_id: car.order_id,
        position: car.position,
        entered_at: car.entered_at,
        order_placed_at: car.order_placed_at,
        payment_at: car.payment_at,
        pickup_at: car.pickup_at,
      })),
      car_count: activeCars.length,
    }
  })

  return NextResponse.json({ data: lanesWithMetrics })
}

// Add a new car to a lane
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const body = await request.json()
  const parsed = createCarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const db = createAdminClient()

  const { data, error } = await db
    .from('drive_thru_cars')
    .insert({
      org_id: user.org_id,
      lane_id: parsed.data.lane_id,
      position: 'ordering',
      entered_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
