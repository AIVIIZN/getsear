import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const statusSchema = z.object({
  external_id: z.string(),
  provider: z.enum(['doordash', 'uberdirect', 'custom']),
  status: z.enum(['assigned', 'picked_up', 'en_route', 'delivered', 'cancelled']),
  driver_name: z.string().optional(),
  driver_phone: z.string().optional(),
  eta_minutes: z.number().optional(),
  api_key: z.string(),
})

// Third-party status update webhook
export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, parsed.error.flatten().fieldErrors)
  }

  const db = createAdminClient()

  // Verify API key
  const { data: config } = await db
    .from('delivery_webhook_configs')
    .select('org_id')
    .eq('api_key', parsed.data.api_key)
    .eq('provider', parsed.data.provider)
    .eq('is_active', true)
    .single()

  if (!config) {
    return apiError(401, 'Invalid API key')
  }

  // Update delivery status
  const updates: Record<string, unknown> = {
    status: parsed.data.status,
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.driver_name) updates.third_party_driver_name = parsed.data.driver_name
  if (parsed.data.driver_phone) updates.third_party_driver_phone = parsed.data.driver_phone
  if (parsed.data.status === 'delivered') updates.delivered_at = new Date().toISOString()

  const { error } = await db
    .from('deliveries')
    .update(updates)
    .eq('external_id', parsed.data.external_id)
    .eq('org_id', config.org_id)

  if (error) {
    return apiError(500, error.message)
  }

  return NextResponse.json({ success: true })
}
