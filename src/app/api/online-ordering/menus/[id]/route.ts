import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateMenuSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  is_active: z.boolean().optional(),
  settings: z
    .object({
      theme_color: z.string().optional(),
      logo_url: z.string().url().optional().nullable(),
      min_order_amount: z.number().min(0).optional(),
      delivery_fee: z.number().min(0).optional(),
      pickup_lead_time: z.number().int().min(0).optional(),
      delivery_lead_time: z.number().int().min(0).optional(),
      max_orders_per_hour: z.number().int().min(1).optional(),
      auto_accept: z.boolean().optional(),
    })
    .optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = updateMenuSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('online_menus') as any)
    .select('id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .maybeSingle()

  if (!existing) {
    return apiError(404, 'Menu not found')
  }

  // If slug is changing, check uniqueness
  if (parsed.data.slug) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: slugExists } = await (supabase.from('online_menus') as any)
      .select('id')
      .eq('org_id', user.org_id)
      .eq('slug', parsed.data.slug)
      .neq('id', id)
      .maybeSingle()

    if (slugExists) {
      return apiError(409, 'Slug already in use')
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('online_menus') as any)
    .update(parsed.data)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to update menu')
  }

  return NextResponse.json({ data })
}
