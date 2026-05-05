import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const BUCKET_NAME = 'menu-photos'
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const itemId = request.nextUrl.searchParams.get('item_id')
  if (!itemId) {
    return NextResponse.json({ error: 'item_id is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('menu_item_photos') as any)
    .select('*')
    .eq('item_id', itemId)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const itemId = formData.get('item_id') as string | null

  if (!file || !itemId) {
    return NextResponse.json({ error: 'file and item_id are required' }, { status: 400 })
  }

  // Validate file
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify item belongs to org
   
  const { data: item, error: itemErr } = await supabase.from('menu_items')
    .select('id')
    .eq('id', itemId)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (itemErr || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  // Upload to storage
  const ext = file.name.split('.').pop() || 'webp'
  const filePath = `${user.org_id}/${itemId}/${Date.now()}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath)

  const publicUrl = urlData.publicUrl

  // Get max sort_order for this item's photos.
  // TODO(supabase-type-gen): menu_item_photos table is referenced here but not yet
  // present in the public schema; remove the cast once the table is added.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: maxRow } = await (supabase as any).from('menu_item_photos')
    .select('sort_order')
    .eq('item_id', itemId)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1
  const isPrimary = nextSortOrder === 0

  // Insert photo record.
  // TODO(supabase-type-gen): menu_item_photos table is referenced here but not yet
  // present in the public schema; remove the cast once the table is added.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photo, error: insertError } = await (supabase as any).from('menu_item_photos')
    .insert({
      org_id: user.org_id,
      item_id: itemId,
      url: publicUrl,
      storage_path: filePath,
      sort_order: nextSortOrder,
      is_primary: isPrimary,
    })
    .select()
    .single()

  if (insertError) {
    // Clean up uploaded file on DB insert failure
    await supabase.storage.from(BUCKET_NAME).remove([filePath])
    return NextResponse.json({ error: 'Failed to save photo record' }, { status: 500 })
  }

  // If primary, update the menu item's image_url
  if (isPrimary) {
    await supabase.from('menu_items')
      .update({ image_url: publicUrl })
      .eq('id', itemId)
  }

  return NextResponse.json({ data: photo }, { status: 201 })
}
