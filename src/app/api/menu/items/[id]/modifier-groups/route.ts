import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const linkModifierGroupsSchema = z.object({
  modifier_group_ids: z.array(z.string().uuid()),
})

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id: menuItemId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = linkModifierGroupsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify the item belongs to this org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error: itemErr } = await (supabase.from('menu_items') as any)
    .select('id')
    .eq('id', menuItemId)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (itemErr || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  // Delete existing links
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('menu_item_modifier_groups') as any)
    .delete()
    .eq('menu_item_id', menuItemId)

  // Insert new links
  if (parsed.data.modifier_group_ids.length > 0) {
    const rows = parsed.data.modifier_group_ids.map((groupId, idx) => ({
      menu_item_id: menuItemId,
      modifier_group_id: groupId,
      sort_order: idx,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertErr } = await (supabase.from('menu_item_modifier_groups') as any)
      .insert(rows)

    if (insertErr) {
      return NextResponse.json({ error: 'Failed to link modifier groups' }, { status: 500 })
    }
  }

  return NextResponse.json({ data: { success: true } })
}
