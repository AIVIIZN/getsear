import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  color: z.string().max(20).optional().default('#F06B18'),
  image_url: z.string().url().optional().nullable(),
  is_active: z.boolean().optional().default(true),
  location_id: z.string().uuid().optional().nullable(),
  available_start_time: z.string().optional().nullable(),
  available_end_time: z.string().optional().nullable(),
  available_days: z.array(z.number().int().min(0).max(6)).optional().nullable(),
})

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const locationId = request.nextUrl.searchParams.get('location_id')

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('menu_categories') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  if (locationId) {
    query = query.or(`location_id.eq.${locationId},location_id.is.null`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
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

  const parsed = createCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Get max sort_order for this org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxRow } = await (supabase.from('menu_categories') as any)
    .select('sort_order')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('menu_categories') as any)
    .insert({
      org_id: user.org_id,
      sort_order: nextSortOrder,
      ...parsed.data,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
