import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { cacheTags, CACHE_REVALIDATE_PROFILE } from '@/lib/cache/keys'

const reorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      sort_order: z.number().int().min(0),
    })
  ).min(1),
})

export async function PATCH(request: NextRequest) {
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

  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const updates = parsed.data.items.map((item) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('menu_items') as any)
      .update({ sort_order: item.sort_order, updated_at: now })
      .eq('id', item.id)
      .eq('org_id', user.org_id)
  )

  const results = await Promise.all(updates)
  const failed = results.some((r) => r.error)

  if (failed) {
    return apiError(500, 'Failed to reorder items')
  }

  // Reordering changes sort_order on the cached list payload.
  revalidateTag(cacheTags.menu(user.org_id), CACHE_REVALIDATE_PROFILE)
  for (const item of parsed.data.items) {
    revalidateTag(cacheTags.menuItem(user.org_id, item.id), CACHE_REVALIDATE_PROFILE)
  }

  return NextResponse.json({ data: { success: true } })
}
