import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const updateCarSchema = z.object({
  car_id: z.string().uuid(),
  position: z.enum(['ordering', 'payment', 'pickup']).optional(),
  order_id: z.string().uuid().optional(),
  exit: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const body = await request.json()
  const parsed = updateCarSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const db = createAdminClient()
  const now = new Date().toISOString()

  const updates: Record<string, unknown> = {}

  if (parsed.data.position) {
    updates.position = parsed.data.position
    if (parsed.data.position === 'payment') updates.payment_at = now
    if (parsed.data.position === 'pickup') updates.pickup_at = now
  }

  if (parsed.data.order_id) {
    updates.order_id = parsed.data.order_id
    updates.order_placed_at = now
  }

  if (parsed.data.exit) {
    updates.exited_at = now
    // Calculate total time
    const { data: car } = await db
      .from('drive_thru_cars')
      .select('entered_at')
      .eq('id', parsed.data.car_id)
      .single()

    if (car) {
      const enteredAt = new Date(car.entered_at as string)
      const exitedAt = new Date(now)
      updates.total_time_seconds = Math.round((exitedAt.getTime() - enteredAt.getTime()) / 1000)
    }
  }

  const { error } = await db
    .from('drive_thru_cars')
    .update(updates)
    .eq('id', parsed.data.car_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
