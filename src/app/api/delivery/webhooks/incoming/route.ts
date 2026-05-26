import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'

const webhookSchema = z.object({
  external_id: z.string(),
  provider: z.enum(['doordash', 'uberdirect', 'custom']),
  customer_name: z.string(),
  customer_phone: z.string(),
  delivery_address: z.string(),
  items: z.array(z.object({
    name: z.string(),
    quantity: z.number(),
    price: z.number(),
  })),
  total: z.number(),
  pickup_time: z.string().optional(),
  notes: z.string().optional(),
  api_key: z.string(), // Simple auth for webhook
})

// Third-party delivery service webhook — creates delivery in Sear
export async function POST(request: NextRequest) {
  const body = await request.json()
  const parsed = webhookSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, parsed.error.flatten().fieldErrors)
  }

  const db = createAdminClient()

  // Verify API key against webhook config
  const { data: config } = await db
    .from('delivery_webhook_configs')
    .select('org_id, location_id, is_active')
    .eq('api_key', parsed.data.api_key)
    .eq('provider', parsed.data.provider)
    .eq('is_active', true)
    .single()

  if (!config) {
    return apiError(401, 'Invalid API key or inactive webhook')
  }

  // Create delivery record
  const { data: delivery, error } = await db
    .from('deliveries')
    .insert({
      org_id: config.org_id,
      location_id: config.location_id,
      external_id: parsed.data.external_id,
      provider: parsed.data.provider,
      customer_name: parsed.data.customer_name,
      customer_phone: parsed.data.customer_phone,
      delivery_address: parsed.data.delivery_address,
      status: 'pending',
      order_total: parsed.data.total,
      notes: parsed.data.notes ?? null,
      source: 'third_party',
    })
    .select()
    .single()

  if (error) {
    return apiError(500, error.message)
  }

  return NextResponse.json({
    data: { delivery_id: delivery.id, status: 'pending' },
  }, { status: 201 })
}
