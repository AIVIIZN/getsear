import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { cacheTags, CACHE_REVALIDATE_PROFILE } from '@/lib/cache/keys'

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
    return apiError(400, 'Invalid JSON')
  }

  const parsed = linkModifierGroupsSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
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
    return apiError(404, 'Item not found')
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
      return apiError(500, 'Failed to link modifier groups')
    }
  }

  // The list endpoint embeds menu_item_modifier_groups, so the menu list
  // payload is now stale. Invalidate both list + per-id tags.
  revalidateTag(cacheTags.menu(user.org_id), CACHE_REVALIDATE_PROFILE)
  revalidateTag(cacheTags.menuItem(user.org_id, menuItemId), CACHE_REVALIDATE_PROFILE)

  return NextResponse.json({ data: { success: true } })
}
