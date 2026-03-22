import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateItemSchema = z.object({
  quantity: z.number().int().min(1).max(999).optional(),
  seat_number: z.number().int().min(1).max(99).nullable().optional(),
  course: z.number().int().min(1).max(20).optional(),
  notes: z.string().max(500).optional(),
})

const voidItemSchema = z.object({
  void_reason: z.string().min(1).max(500),
})

type RouteParams = { params: Promise<{ id: string; itemId: string }> }

/**
 * PATCH /api/orders/[id]/items/[itemId] — update item
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id: orderId, itemId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify order belongs to org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase.from('orders') as any)
    .select('id')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (parsed.data.quantity !== undefined) updates.quantity = parsed.data.quantity
  if (parsed.data.seat_number !== undefined) updates.seat_number = parsed.data.seat_number
  if (parsed.data.course !== undefined) updates.course = parsed.data.course
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes

  // If quantity changed, recalculate line_total
  if (parsed.data.quantity !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: currentItem } = await (supabase.from('order_items') as any)
      .select('unit_price, modifier_total')
      .eq('id', itemId)
      .single()

    if (currentItem) {
      const unitPrice = parseFloat(currentItem.unit_price || '0')
      const modTotal = parseFloat(currentItem.modifier_total || '0')
      updates.line_total = ((unitPrice + modTotal) * parsed.data.quantity).toFixed(2)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('order_items') as any)
    .update(updates)
    .eq('id', itemId)
    .eq('order_id', orderId)
    .select('*, order_item_modifiers(*)')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }

  // Recalculate order totals
  await recalcOrderTotals(supabase, orderId)

  return NextResponse.json({ data })
}

/**
 * DELETE /api/orders/[id]/items/[itemId] — void item
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id: orderId, itemId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = voidItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'void_reason is required', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Check if item has been sent — requires manager
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item } = await (supabase.from('order_items') as any)
    .select('is_sent, order_id')
    .eq('id', itemId)
    .single()

  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  if (item.is_sent) {
    const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
    if (roleErr) return roleErr
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('order_items') as any)
    .update({
      is_voided: true,
      void_reason: parsed.data.void_reason,
      voided_at: new Date().toISOString(),
      voided_by: user.id,
    })
    .eq('id', itemId)
    .eq('order_id', orderId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to void item' }, { status: 500 })
  }

  await recalcOrderTotals(supabase, orderId)

  return NextResponse.json({ data })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recalcOrderTotals(supabase: any, orderId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items } = await (supabase.from('order_items') as any)
    .select('line_total, is_voided, comp_amount')
    .eq('order_id', orderId)

  if (!items) return

  let subtotal = 0
  for (const item of items) {
    if (item.is_voided) continue
    subtotal += parseFloat(item.line_total || '0') - parseFloat(item.comp_amount || '0')
  }

  const taxTotal = Math.round(subtotal * 0.085 * 100) / 100
  const total = subtotal + taxTotal

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('orders') as any)
    .update({
      subtotal: subtotal.toFixed(2),
      tax_total: taxTotal.toFixed(2),
      total: total.toFixed(2),
      balance_due: total.toFixed(2),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
}
