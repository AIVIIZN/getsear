import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateOrderSchema = z.object({
  order_type: z.enum([
    'dine_in', 'takeout', 'delivery', 'bar', 'catering', 'online', 'kiosk', 'drive_thru', 'qr',
  ]).optional(),
  table_id: z.string().uuid().nullable().optional(),
  guest_count: z.number().int().min(1).max(99).optional(),
  guest_name: z.string().max(200).nullable().optional(),
  guest_phone: z.string().max(30).nullable().optional(),
  notes: z.string().max(2000).optional(),
})

const voidOrderSchema = z.object({
  void_reason: z.string().min(1).max(500),
})

/**
 * GET /api/orders/[id] — get single order with items and modifiers
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('orders') as any)
    .select('*, order_items(*, order_item_modifiers(*)), order_discounts(*)')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({ data })
}

/**
 * PATCH /api/orders/[id] — update order metadata
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('orders') as any)
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

/**
 * DELETE /api/orders/[id] — void order
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = voidOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'void_reason is required', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Check if order has sent items — requires manager
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase.from('orders') as any)
    .select('status')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.status !== 'draft') {
    const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
    if (roleErr) return roleErr
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('orders') as any)
    .update({
      status: 'voided',
      voided_at: new Date().toISOString(),
      voided_by: user.id,
      void_reason: parsed.data.void_reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to void order' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
