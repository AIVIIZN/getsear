import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const createDriveThruOrderSchema = z.object({
  location_id: z.string().uuid(),
  order_id: z.string().uuid().optional().nullable(),
  lane: z.number().int().min(1).max(10),
})

/**
 * GET /api/drive-thru/orders — list drive-thru orders with filters
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const params = request.nextUrl.searchParams
  const locationId = params.get('location_id')
  const dateFrom = params.get('date_from')
  const dateTo = params.get('date_to')
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '50', 10)))
  const offset = (page - 1) * limit

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('drive_thru_orders') as any)
    .select('*', { count: 'exact' })
    .eq('org_id', user.org_id)
    .order('ordered_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (locationId) query = query.eq('location_id', locationId)
  if (dateFrom) query = query.gte('ordered_at', dateFrom)
  if (dateTo) query = query.lte('ordered_at', dateTo)

  const { data, error, count } = await query

  if (error) {
    return apiError(500, 'Failed to fetch drive-thru orders')
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: { page, limit, total: count ?? 0 },
  })
}

/**
 * POST /api/drive-thru/orders — create a drive-thru order tracking record
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

  const parsed = createDriveThruOrderSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('drive_thru_orders') as any)
    .insert({
      org_id: user.org_id,
      location_id: parsed.data.location_id,
      order_id: parsed.data.order_id ?? null,
      lane: parsed.data.lane,
      ordered_at: now,
    })
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to create drive-thru order')
  }

  return NextResponse.json({ data }, { status: 201 })
}
