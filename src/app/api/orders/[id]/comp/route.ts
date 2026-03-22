import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const compSchema = z.object({
  order_item_id: z.string().uuid().optional(),
  comp_reason: z.enum([
    'manager_comp',
    'quality_issue',
    'service_issue',
    'birthday',
    'vip',
    'employee_meal',
    'promotional',
    'other',
  ]),
  comp_amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
})

/**
 * POST /api/orders/[id]/comp — comp an item or entire order
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id: orderId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = compSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { order_item_id, comp_reason, comp_amount } = parsed.data

  // Verify order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase.from('orders') as any)
    .select('id, org_id')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order_item_id) {
    // Comp specific item
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: item } = await (supabase.from('order_items') as any)
      .select('id, line_total')
      .eq('id', order_item_id)
      .eq('order_id', orderId)
      .single()

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const amount = comp_amount ?? item.line_total

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('order_items') as any)
      .update({
        is_comped: true,
        comp_reason,
        comp_amount: amount,
        comped_by: user.id,
      })
      .eq('id', order_item_id)
  } else {
    // Comp entire order — comp all non-voided items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: items } = await (supabase.from('order_items') as any)
      .select('id, line_total')
      .eq('order_id', orderId)
      .eq('is_voided', false)

    for (const item of items ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('order_items') as any)
        .update({
          is_comped: true,
          comp_reason,
          comp_amount: item.line_total,
          comped_by: user.id,
          comped_at: new Date().toISOString(),
        })
        .eq('id', item.id)
    }
  }

  // Recalculate order totals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allItems } = await (supabase.from('order_items') as any)
    .select('line_total, is_voided, comp_amount')
    .eq('order_id', orderId)

  let subtotal = 0
  for (const item of allItems ?? []) {
    if (item.is_voided) continue
    subtotal += parseFloat(item.line_total || '0') - parseFloat(item.comp_amount || '0')
  }
  const taxTotal = Math.round(subtotal * 0.085 * 100) / 100
  const total = subtotal + taxTotal

  // Fetch current amount_paid to correctly compute balance_due
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentOrder } = await (supabase.from('orders') as any)
    .select('amount_paid')
    .eq('id', orderId)
    .single()
  const amountPaid = parseFloat(currentOrder?.amount_paid ?? '0')
  const balanceDue = Math.max(0, total - amountPaid)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('orders') as any)
    .update({
      subtotal: subtotal.toFixed(2),
      tax_total: taxTotal.toFixed(2),
      total: total.toFixed(2),
      balance_due: balanceDue.toFixed(2),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  // Audit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('order_modifications') as any).insert({
    org_id: user.org_id,
    order_id: orderId,
    modification_type: 'comp_item',
    description: order_item_id ? `Item comped: ${comp_reason}` : `Order comped: ${comp_reason}`,
    new_value: { comp_reason, order_item_id: order_item_id ?? null },
    performed_by: user.id,
  })

  // Return updated order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updatedOrder } = await (supabase.from('orders') as any)
    .select('*, order_items(*, order_item_modifiers(*))')
    .eq('id', orderId)
    .single()

  return NextResponse.json({ data: updatedOrder })
}
