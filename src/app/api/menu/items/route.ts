import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createItemSchema = z.object({
  category_id: z.string().uuid(),
  location_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(200),
  short_name: z.string().max(30).optional().nullable(),
  description: z.string().max(1000).optional().default(''),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Price must be a valid dollar amount'),
  cost: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
  tax_rate_id: z.string().uuid().optional().nullable(),
  is_taxable: z.boolean().optional().default(true),
  prep_station: z.string().max(50).optional().nullable(),
  prep_time_minutes: z.number().int().min(0).optional().nullable(),
  course: z.string().max(50).optional().nullable(),
  is_active: z.boolean().optional().default(true),
  color: z.string().max(20).optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  allergens: z.array(z.string()).optional().nullable(),
  nutrition: z.record(z.string(), z.unknown()).optional().nullable(),
  plu_code: z.string().max(20).optional().nullable(),
  barcode: z.string().max(50).optional().nullable(),
})

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const categoryId = request.nextUrl.searchParams.get('category_id')
  const locationId = request.nextUrl.searchParams.get('location_id')
  const search = request.nextUrl.searchParams.get('search')

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('menu_items') as any)
    .select('*, menu_item_modifier_groups(modifier_group_id)')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  if (locationId) {
    query = query.or(`location_id.eq.${locationId},location_id.is.null`)
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,short_name.ilike.%${search}%,plu_code.ilike.%${search}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
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

  const parsed = createItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Get max sort_order for this category
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxRow } = await (supabase.from('menu_items') as any)
    .select('sort_order')
    .eq('org_id', user.org_id)
    .eq('category_id', parsed.data.category_id)
    .is('deleted_at', null)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('menu_items') as any)
    .insert({
      org_id: user.org_id,
      sort_order: nextSortOrder,
      is_86d: false,
      ...parsed.data,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
