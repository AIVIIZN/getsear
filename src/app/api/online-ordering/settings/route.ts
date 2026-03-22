import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateSettingsSchema = z.object({
  max_orders_per_15_min: z.number().int().min(1).max(999).optional(),
  max_orders_per_hour: z.number().int().min(1).max(9999).optional(),
  is_paused: z.boolean().optional(),
  pause_reason: z.string().max(500).optional().nullable(),
  auto_accept: z.boolean().optional(),
  operating_hours: z
    .object({
      monday: z.object({ open: z.string(), close: z.string(), enabled: z.boolean() }).optional(),
      tuesday: z.object({ open: z.string(), close: z.string(), enabled: z.boolean() }).optional(),
      wednesday: z.object({ open: z.string(), close: z.string(), enabled: z.boolean() }).optional(),
      thursday: z.object({ open: z.string(), close: z.string(), enabled: z.boolean() }).optional(),
      friday: z.object({ open: z.string(), close: z.string(), enabled: z.boolean() }).optional(),
      saturday: z.object({ open: z.string(), close: z.string(), enabled: z.boolean() }).optional(),
      sunday: z.object({ open: z.string(), close: z.string(), enabled: z.boolean() }).optional(),
    })
    .optional(),
})

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const searchParams = request.nextUrl.searchParams
  const locationId = searchParams.get('location_id')

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('order_throttle_config') as any)
    .select('*')
    .eq('org_id', user.org_id)

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }

  // Return defaults if no config exists yet
  if (!data) {
    return NextResponse.json({
      data: {
        max_orders_per_15_min: 10,
        max_orders_per_hour: 30,
        is_paused: false,
        pause_reason: null,
        current_count_15min: 0,
        current_count_hour: 0,
      },
    })
  }

  return NextResponse.json({ data })
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const updateData: Record<string, unknown> = {}
  if (parsed.data.max_orders_per_15_min !== undefined)
    updateData.max_orders_per_15_min = parsed.data.max_orders_per_15_min
  if (parsed.data.max_orders_per_hour !== undefined)
    updateData.max_orders_per_hour = parsed.data.max_orders_per_hour
  if (parsed.data.is_paused !== undefined) {
    updateData.is_paused = parsed.data.is_paused
    if (parsed.data.is_paused) {
      updateData.pause_reason = parsed.data.pause_reason ?? 'Manually paused'
      updateData.paused_by = user.id
      updateData.paused_at = new Date().toISOString()
    } else {
      updateData.pause_reason = null
      updateData.paused_by = null
      updateData.paused_at = null
    }
  }

  // Upsert: create if not exists, update if exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('order_throttle_config') as any)
    .upsert(
      {
        org_id: user.org_id,
        ...updateData,
      },
      { onConflict: 'org_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
