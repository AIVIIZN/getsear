import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const createDeliverySchema = z.object({
  order_id: z.string().uuid(),
  delivery_address: z.record(z.string(), z.unknown()),
  notes: z.string().max(2000).optional().nullable(),
  estimated_delivery_at: z.string().optional().nullable(),
})

/**
 * GET /api/delivery/deliveries — list deliveries (filterable)
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const driverId = searchParams.get('driver_id')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('deliveries') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  if (driverId) {
    query = query.eq('driver_id', driverId)
  }

  const { data, error } = await query

  if (error) {
    return apiError(500, 'Failed to fetch deliveries')
  }

  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST /api/delivery/deliveries — create a delivery
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = createDeliverySchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('deliveries') as any)
    .insert({
      org_id: user.org_id,
      ...parsed.data,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to create delivery')
  }

  return NextResponse.json({ data }, { status: 201 })
}
