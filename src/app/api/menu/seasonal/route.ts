import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const createSeasonalSchema = z.object({
  location_id: z.string().uuid(),
  item_id: z.string().uuid(),
  replaces_item_id: z.string().uuid().nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  is_active: z.boolean().default(true),
}).refine(
  (d) => d.end_date > d.start_date,
  { message: 'end_date must be after start_date', path: ['end_date'] },
)

const updateSeasonalSchema = z.object({
  item_id: z.string().uuid().optional(),
  replaces_item_id: z.string().uuid().nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  is_active: z.boolean().optional(),
})

// ---------------------------------------------------------------------------
// GET /api/menu/seasonal — List seasonal items
// Query params: location_id (required), filter (active|upcoming|expired)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const locationId = request.nextUrl.searchParams.get('location_id')
  if (!locationId) {
    return apiError(400, 'location_id is required')
  }

  const filter = request.nextUrl.searchParams.get('filter') ?? 'all'
  const today = new Date().toISOString().split('T')[0]

  const supabase = createAdminClient()

  let query = supabase
    .from('seasonal_menu_items')
    .select(`
      *,
      menu_item:menu_items!seasonal_menu_items_item_id_fkey(id, name, price, image_url, is_86d),
      replaces_item:menu_items!seasonal_menu_items_replaces_item_id_fkey(id, name, price)
    `)
    .eq('org_id', user.org_id)
    .eq('location_id', locationId)
    .order('start_date', { ascending: true })

  if (filter === 'active') {
    query = query
      .lte('start_date', today)
      .gte('end_date', today)
      .eq('is_active', true)
  } else if (filter === 'upcoming') {
    query = query.gt('start_date', today)
  } else if (filter === 'expired') {
    query = query.lt('end_date', today)
  }

  const { data, error } = await query

  if (error) {
    return apiError(500, 'Failed to fetch seasonal items')
  }

  return NextResponse.json({ data: data ?? [] })
}

// ---------------------------------------------------------------------------
// POST /api/menu/seasonal — Create a seasonal item
// ---------------------------------------------------------------------------

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

  const parsed = createSeasonalSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Verify the menu item exists
  const { data: menuItem } = await supabase
    .from('menu_items')
    .select('id')
    .eq('id', parsed.data.item_id)
    .eq('org_id', user.org_id)
    .single()

  if (!menuItem) {
    return apiError(404, 'Menu item not found')
  }

  const { data, error } = await supabase
    .from('seasonal_menu_items')
    .insert({
      org_id: user.org_id,
      location_id: parsed.data.location_id,
      item_id: parsed.data.item_id,
      replaces_item_id: parsed.data.replaces_item_id ?? null,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      is_active: parsed.data.is_active,
    })
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to create seasonal item')
  }

  return NextResponse.json({ data }, { status: 201 })
}

// ---------------------------------------------------------------------------
// PATCH /api/menu/seasonal — Update a seasonal item (pass id in body)
// ---------------------------------------------------------------------------

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const id = body.id
  if (typeof id !== 'string') {
    return apiError(400, 'id is required')
  }

  const parsed = updateSeasonalSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  if (Object.keys(parsed.data).length === 0) {
    return apiError(400, 'No fields to update')
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('seasonal_menu_items')
    .update(parsed.data)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return apiError(500, 'Failed to update seasonal item')
  }

  return NextResponse.json({ data })
}

// ---------------------------------------------------------------------------
// DELETE /api/menu/seasonal — Delete (pass ?id= query param)
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return apiError(400, 'id query parameter is required')
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('seasonal_menu_items')
    .delete()
    .eq('id', id)
    .eq('org_id', user.org_id)

  if (error) {
    return apiError(500, 'Failed to delete seasonal item')
  }

  return NextResponse.json({ success: true })
}
