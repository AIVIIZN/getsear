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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
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
    return NextResponse.json({ error: 'Failed to reorder items' }, { status: 500 })
  }

  // Reordering changes sort_order on the cached list payload.
  revalidateTag(cacheTags.menu(user.org_id), CACHE_REVALIDATE_PROFILE)
  for (const item of parsed.data.items) {
    revalidateTag(cacheTags.menuItem(user.org_id, item.id), CACHE_REVALIDATE_PROFILE)
  }

  return NextResponse.json({ data: { success: true } })
}
