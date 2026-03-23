import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const gpsSchema = z.object({
  delivery_id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

// Driver submits GPS coordinates
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const body = await request.json()
  const parsed = gpsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const db = createAdminClient()

  // Update delivery with GPS coordinates
  const { error } = await db
    .from('deliveries')
    .update({
      driver_lat: parsed.data.lat,
      driver_lng: parsed.data.lng,
      last_gps_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.delivery_id)
    .eq('driver_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also update driver's current location
  await db
    .from('delivery_drivers')
    .update({
      current_lat: parsed.data.lat,
      current_lng: parsed.data.lng,
      last_seen_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
