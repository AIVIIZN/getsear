import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const updateDriveThruOrderSchema = z.object({
  order_id: z.string().uuid().optional().nullable(),
  ready_at: z.string().datetime().optional().nullable(),
  delivered_at: z.string().datetime().optional().nullable(),
  total_seconds: z.number().int().min(0).optional().nullable(),
})

/**
 * GET /api/drive-thru/orders/:id — get single drive-thru order
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('drive_thru_orders') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !data) {
    return apiError(404, 'Drive-thru order not found')
  }

  return NextResponse.json({ data })
}

/**
 * PUT /api/drive-thru/orders/:id — update drive-thru order timestamps
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = updateDriveThruOrderSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // If delivered_at is set, auto-calculate total_seconds from order_taken_at
  const updates: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.delivered_at && !parsed.data.total_seconds) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('drive_thru_orders') as any)
      .select('order_taken_at')
      .eq('id', id)
      .eq('org_id', user.org_id)
      .single()

    if (existing?.order_taken_at) {
      const takenAt = new Date(existing.order_taken_at).getTime()
      const deliveredAt = new Date(parsed.data.delivered_at).getTime()
      updates.total_seconds = Math.round((deliveredAt - takenAt) / 1000)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('drive_thru_orders') as any)
    .update(updates)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return apiError(500, 'Failed to update drive-thru order')
  }

  return NextResponse.json({ data })
}
