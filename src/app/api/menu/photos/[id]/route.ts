import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const BUCKET_NAME = 'menu-photos'

const reorderSchema = z.object({
  photo_ids: z.array(z.string().uuid()),
})

type RouteContext = { params: Promise<{ id: string }> }

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await context.params
  const supabase = createAdminClient()

  // Get photo record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photo, error: fetchErr } = await (supabase.from('menu_item_photos') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (fetchErr || !photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  }

  // Delete from storage
  if (photo.storage_path) {
    await supabase.storage.from(BUCKET_NAME).remove([photo.storage_path])
  }

  // Soft delete photo record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('menu_item_photos') as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  // If this was the primary photo, update the item's image_url
  if (photo.is_primary) {
    // Find next photo to be primary
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: nextPhoto } = await (supabase.from('menu_item_photos') as any)
      .select('id, url')
      .eq('item_id', photo.item_id)
      .eq('org_id', user.org_id)
      .is('deleted_at', null)
      .neq('id', id)
      .order('sort_order', { ascending: true })
      .limit(1)
      .single()

    if (nextPhoto) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('menu_item_photos') as any)
        .update({ is_primary: true })
        .eq('id', nextPhoto.id)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('menu_items') as any)
        .update({ image_url: nextPhoto.url })
        .eq('id', photo.item_id)
    } else {
      // No more photos, clear image_url
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('menu_items') as any)
        .update({ image_url: null })
        .eq('id', photo.item_id)
    }
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
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
  const { photo_ids } = parsed.data

  // Update sort_order for each photo and set first as primary
  for (let i = 0; i < photo_ids.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('menu_item_photos') as any)
      .update({
        sort_order: i,
        is_primary: i === 0,
      })
      .eq('id', photo_ids[i])
      .eq('org_id', user.org_id)
  }

  // Update item's image_url to the first photo
  if (photo_ids.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: firstPhoto } = await (supabase.from('menu_item_photos') as any)
      .select('url, item_id')
      .eq('id', photo_ids[0])
      .single()

    if (firstPhoto) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('menu_items') as any)
        .update({ image_url: firstPhoto.url })
        .eq('id', firstPhoto.item_id)
    }
  }

  return NextResponse.json({ success: true })
}
