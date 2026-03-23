import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

const updateDaypartSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  start_time: z.string().regex(timeRegex, 'Must be HH:MM (24h)').optional(),
  end_time: z.string().regex(timeRegex, 'Must be HH:MM (24h)').optional(),
  days: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  sections: z.array(z.string().max(50)).optional(),
  is_active: z.boolean().optional(),
})

// ---------------------------------------------------------------------------
// GET /api/menu/dayparts/[id]
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('menu_dayparts')
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Daypart not found' }, { status: 404 })
  }

  return NextResponse.json({ data })
}

// ---------------------------------------------------------------------------
// PATCH /api/menu/dayparts/[id]
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

  const parsed = updateDaypartSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    )
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('menu_dayparts')
    .update(parsed.data)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update daypart' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// ---------------------------------------------------------------------------
// DELETE /api/menu/dayparts/[id]
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params

  const supabase = createAdminClient()

  // Check for items with this daypart in their availability
  const { data: linkedItems } = await supabase
    .from('menu_items')
    .select('id')
    .contains('available_dayparts', [id])
    .eq('org_id', user.org_id)
    .limit(1)

  if (linkedItems && linkedItems.length > 0) {
    return NextResponse.json(
      { error: 'Cannot delete daypart: menu items reference it. Remove daypart from item availability first.' },
      { status: 409 },
    )
  }

  // Also check price_level_prices with this daypart
  const { data: linkedPrices } = await supabase
    .from('price_level_prices')
    .select('id')
    .eq('daypart_id', id)
    .eq('org_id', user.org_id)
    .limit(1)

  if (linkedPrices && linkedPrices.length > 0) {
    return NextResponse.json(
      { error: 'Cannot delete daypart: price levels reference it. Remove daypart pricing first.' },
      { status: 409 },
    )
  }

  const { error } = await supabase
    .from('menu_dayparts')
    .delete()
    .eq('id', id)
    .eq('org_id', user.org_id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete daypart' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
