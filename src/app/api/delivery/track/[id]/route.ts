import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public endpoint — customer can track their delivery
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = createAdminClient()

  const { data: delivery, error } = await db
    .from('deliveries')
    .select('id, status, driver_lat, driver_lng, estimated_arrival_at, proof_photo_url, created_at')
    .eq('id', id)
    .single()

  if (error || !delivery) {
    return apiError(404, 'Delivery not found')
  }

  // Calculate ETA from current position (simple estimate)
  let estimatedMinutes: number | null = null
  if (delivery.driver_lat && delivery.driver_lng && delivery.status === 'en_route') {
    // Simple estimate — would use a routing API in production
    estimatedMinutes = 10
  }

  return NextResponse.json({
    data: {
      id: delivery.id,
      status: delivery.status,
      driver_location: delivery.driver_lat
        ? { lat: delivery.driver_lat, lng: delivery.driver_lng }
        : null,
      estimated_minutes: estimatedMinutes,
      estimated_arrival: delivery.estimated_arrival_at,
      proof_photo: delivery.proof_photo_url,
      created_at: delivery.created_at,
    },
  })
}
