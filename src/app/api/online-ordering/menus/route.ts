import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createMenuSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  location_id: z.string().uuid(),
  is_active: z.boolean().default(false),
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
    .default({}),
})

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const searchParams = request.nextUrl.searchParams
  const locationId = searchParams.get('location_id')

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('online_menus') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch online menus' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
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

  const parsed = createMenuSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Check slug uniqueness within org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('online_menus') as any)
    .select('id')
    .eq('org_id', user.org_id)
    .eq('slug', parsed.data.slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('online_menus') as any)
    .insert({
      org_id: user.org_id,
      location_id: parsed.data.location_id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      is_active: parsed.data.is_active,
      settings: parsed.data.settings,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create online menu' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
