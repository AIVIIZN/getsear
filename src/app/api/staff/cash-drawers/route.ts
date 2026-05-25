import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

function serializeDrawer<T extends { is_open?: boolean; opened_by?: string | null }>(drawer: T) {
  return {
    ...drawer,
    status: drawer.is_open ? 'open' : 'closed',
    assigned_to: drawer.opened_by ?? null,
  }
}

/**
 * GET /api/staff/cash-drawers — list drawers for org
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('location_id')

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('cash_drawers') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .order('name', { ascending: true })

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data: drawers, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch cash drawers' }, { status: 500 })
  }

  return NextResponse.json({ data: (drawers ?? []).map(serializeDrawer) })
}

const createDrawerSchema = z.object({
  name: z.string().min(1).max(100),
  location_id: z.string().uuid(),
  terminal_id: z.string().uuid().optional().nullable(),
})

/**
 * POST /api/staff/cash-drawers — create a new cash drawer
 */
export async function POST(request: NextRequest) {
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

  const parsed = createDrawerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('cash_drawers') as any)
    .insert({
      org_id: user.org_id,
      ...parsed.data,
      is_open: false,
      expected_cash: '0.00',
      actual_cash: '0.00',
      over_short: '0.00',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create cash drawer' }, { status: 500 })
  }

  return NextResponse.json({ data: serializeDrawer(data) }, { status: 201 })
}
