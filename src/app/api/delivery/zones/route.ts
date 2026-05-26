import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createZoneSchema = z.object({
  name: z.string().min(1).max(200),
  location_id: z.string().uuid().optional().nullable(),
  polygon: z.record(z.string(), z.unknown()).optional().nullable(),
  delivery_fee: z.string().default('0.00'),
  min_order: z.string().default('0.00'),
  estimated_minutes: z.number().min(0).default(30),
  is_active: z.boolean().default(true),
})

/**
 * GET /api/delivery/zones — list delivery zones
 */
export async function GET(_request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('delivery_zones') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .order('name', { ascending: true })

  if (error) {
    return apiError(500, 'Failed to fetch delivery zones')
  }

  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST /api/delivery/zones — create delivery zone
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = createZoneSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('delivery_zones') as any)
    .insert({
      org_id: user.org_id,
      ...parsed.data,
    })
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to create delivery zone')
  }

  return NextResponse.json({ data }, { status: 201 })
}
