import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const proofSchema = z.object({
  delivery_id: z.string().uuid(),
  photo_url: z.string().url(),
  notes: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const body = await request.json()
  const parsed = proofSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, parsed.error.flatten().fieldErrors)
  }

  const db = createAdminClient()

  const { error } = await db
    .from('deliveries')
    .update({
      proof_photo_url: parsed.data.photo_url,
      proof_notes: parsed.data.notes ?? null,
      status: 'delivered',
      delivered_at: new Date().toISOString(),
    })
    .eq('id', parsed.data.delivery_id)
    .eq('driver_id', user.id)

  if (error) {
    return apiError(500, error.message)
  }

  // Update driver status back to available
  await db
    .from('delivery_drivers')
    .update({ status: 'available' })
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
