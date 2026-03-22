import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

const updateTableSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  shape: z.enum(['square', 'round', 'rectangle', 'booth', 'bar']).optional(),
  pos_x: z.number().min(0).optional(),
  pos_y: z.number().min(0).optional(),
  width: z.number().min(40).max(400).optional(),
  height: z.number().min(40).max(400).optional(),
  rotation: z.number().min(0).max(360).optional(),
  section: z.string().max(50).optional(),
  sort_order: z.number().int().min(0).optional(),
  status: z.enum([
    'available', 'seated', 'ordered', 'served',
    'check_presented', 'dirty', 'reserved', 'needs_attention',
  ]).optional(),
  current_order_id: z.string().uuid().nullable().optional(),
  current_server_id: z.string().uuid().nullable().optional(),
  guest_count: z.number().int().min(0).optional(),
  seated_at: z.string().nullable().optional(),
})

/**
 * PATCH /api/tables/[id] — update table (position, size, status, etc.)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateTableSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('tables') as any)
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update table' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

/**
 * DELETE /api/tables/[id] — soft delete table
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()

  // Don't allow deleting a table that has an active order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: table } = await (supabase.from('tables') as any)
    .select('id, current_order_id, status')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!table) {
    return NextResponse.json({ error: 'Table not found' }, { status: 404 })
  }

  if (table.current_order_id) {
    return NextResponse.json(
      { error: 'Cannot delete a table with an active order' },
      { status: 400 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('tables') as any)
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', user.org_id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete table' }, { status: 500 })
  }

  return NextResponse.json({ data: { success: true } })
}
