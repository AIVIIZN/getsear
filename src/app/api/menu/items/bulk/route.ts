import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { cacheTags, CACHE_REVALIDATE_PROFILE } from '@/lib/cache/keys'

const bulkActionSchema = z.object({
  action: z.enum(['move', '86', 'restore', 'delete', 'price_change']),
  item_ids: z.array(z.string().uuid()).min(1),
  /** Required for 'move' action */
  category_id: z.string().uuid().optional(),
  /** Required for 'price_change' action */
  price_change_type: z.enum(['percentage', 'fixed']).optional(),
  price_change_value: z.number().optional(),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = bulkActionSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { action, item_ids, category_id, price_change_type, price_change_value } = parsed.data
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Invalidate the menu list + every per-id entry that any of these items
  // map to. Any successful bulk operation must propagate to other terminals.
  const invalidateMenuCache = () => {
    revalidateTag(cacheTags.menu(user.org_id), CACHE_REVALIDATE_PROFILE)
    for (const itemId of item_ids) {
      revalidateTag(cacheTags.menuItem(user.org_id, itemId), CACHE_REVALIDATE_PROFILE)
    }
  }

  switch (action) {
    case 'move': {
      if (!category_id) {
        return apiError(400, 'category_id required for move')
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('menu_items') as any)
        .update({ category_id, updated_at: now })
        .in('id', item_ids)
        .eq('org_id', user.org_id)

      if (error) {
        return apiError(500, 'Failed to move items')
      }

      invalidateMenuCache()
      return NextResponse.json({ success: true, affected: item_ids.length })
    }

    case '86': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('menu_items') as any)
        .update({ is_86d: true, updated_at: now })
        .in('id', item_ids)
        .eq('org_id', user.org_id)

      if (error) {
        return apiError(500, 'Failed to 86 items')
      }

      invalidateMenuCache()
      return NextResponse.json({ success: true, affected: item_ids.length })
    }

    case 'restore': {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('menu_items') as any)
        .update({ is_86d: false, updated_at: now })
        .in('id', item_ids)
        .eq('org_id', user.org_id)

      if (error) {
        return apiError(500, 'Failed to restore items')
      }

      invalidateMenuCache()
      return NextResponse.json({ success: true, affected: item_ids.length })
    }

    case 'delete': {
      // Soft delete
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('menu_items') as any)
        .update({ deleted_at: now, updated_at: now })
        .in('id', item_ids)
        .eq('org_id', user.org_id)

      if (error) {
        return apiError(500, 'Failed to delete items')
      }

      invalidateMenuCache()
      return NextResponse.json({ success: true, affected: item_ids.length })
    }

    case 'price_change': {
      if (price_change_type === undefined || price_change_value === undefined) {
        return apiError(400, 'price_change_type and price_change_value required')
      }

      // Fetch current prices
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: items, error: fetchError } = await (supabase.from('menu_items') as any)
        .select('id, price')
        .in('id', item_ids)
        .eq('org_id', user.org_id)

      if (fetchError || !items) {
        return apiError(500, 'Failed to fetch items')
      }

      // Calculate new prices and update each
      let updatedCount = 0
      for (const item of items as { id: string; price: string }[]) {
        const currentPrice = parseFloat(item.price)
        let newPrice: number

        if (price_change_type === 'percentage') {
          newPrice = currentPrice * (1 + price_change_value / 100)
        } else {
          newPrice = currentPrice + price_change_value
        }

        // Ensure price doesn't go below 0
        newPrice = Math.max(0, Math.round(newPrice * 100) / 100)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase.from('menu_items') as any)
          .update({ price: newPrice.toFixed(2), updated_at: now })
          .eq('id', item.id)
          .eq('org_id', user.org_id)

        if (!updateError) updatedCount++
      }

      if (updatedCount > 0) invalidateMenuCache()
      return NextResponse.json({ success: true, affected: updatedCount })
    }

    default:
      return apiError(400, 'Unknown action')
  }
}
