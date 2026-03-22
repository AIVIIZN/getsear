import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateItemsSchema = z.object({
  items: z.array(
    z.object({
      menu_item_id: z.string().uuid(),
      is_available: z.boolean(),
      online_price: z.number().min(0).nullable().optional(),
      sort_order: z.number().int().min(0).optional(),
    })
  ),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const supabase = createAdminClient()

  // Verify menu ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: menu } = await (supabase.from('online_menus') as any)
    .select('id, org_id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .maybeSingle()

  if (!menu) {
    return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('online_menu_items') as any)
    .select('*')
    .eq('online_menu_id', id)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateItemsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify menu ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: menu } = await (supabase.from('online_menus') as any)
    .select('id, org_id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .maybeSingle()

  if (!menu) {
    return NextResponse.json({ error: 'Menu not found' }, { status: 404 })
  }

  // Upsert items
  const upsertRows = parsed.data.items.map((item, idx) => ({
    online_menu_id: id,
    menu_item_id: item.menu_item_id,
    is_available: item.is_available,
    online_price: item.online_price ?? null,
    sort_order: item.sort_order ?? idx,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('online_menu_items') as any)
    .upsert(upsertRows, { onConflict: 'online_menu_id,menu_item_id' })
    .select()

  if (error) {
    return NextResponse.json({ error: 'Failed to update menu items' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}
