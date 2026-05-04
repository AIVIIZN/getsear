import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { cacheTags, CACHE_REVALIDATE_PROFILE } from '@/lib/cache/keys'

const updateItemSchema = z.object({
  category_id: z.string().uuid().optional(),
  location_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(200).optional(),
  short_name: z.string().max(30).optional().nullable(),
  description: z.string().max(1000).optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Price must be a valid dollar amount').optional(),
  cost: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
  tax_rate_id: z.string().uuid().optional().nullable(),
  is_taxable: z.boolean().optional(),
  prep_station: z.string().max(50).optional().nullable(),
  prep_time_minutes: z.number().int().min(0).optional().nullable(),
  course: z.string().max(50).optional().nullable(),
  is_active: z.boolean().optional(),
  color: z.string().max(20).optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  allergens: z.array(z.string()).optional().nullable(),
  nutrition: z.record(z.string(), z.unknown()).optional().nullable(),
  plu_code: z.string().max(20).optional().nullable(),
  barcode: z.string().max(50).optional().nullable(),
})

type RouteParams = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('menu_items') as any)
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }

  // Invalidate both the list and per-id cache entries.
  revalidateTag(cacheTags.menu(user.org_id), CACHE_REVALIDATE_PROFILE)
  revalidateTag(cacheTags.menuItem(user.org_id, id), CACHE_REVALIDATE_PROFILE)

  return NextResponse.json({ data })
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('menu_items') as any)
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.org_id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }

  revalidateTag(cacheTags.menu(user.org_id), CACHE_REVALIDATE_PROFILE)
  revalidateTag(cacheTags.menuItem(user.org_id, id), CACHE_REVALIDATE_PROFILE)

  return NextResponse.json({ data: { success: true } })
}
