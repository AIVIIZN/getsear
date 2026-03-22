import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const discountSchema = z.object({
  name: z.string().min(1).max(200),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  value: z.number().positive(),
  order_item_id: z.string().uuid().nullable().optional(),
  requires_manager_approval: z.boolean().optional().default(false),
})

/**
 * POST /api/orders/[id]/discount — apply discount to order or item
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id: orderId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = discountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Get the order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase.from('orders') as any)
    .select('id, org_id, subtotal')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const { name, discount_type, value, order_item_id } = parsed.data

  // Calculate applied amount
  let appliedAmount: number

  if (order_item_id) {
    // Item-level discount
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: item } = await (supabase.from('order_items') as any)
      .select('line_total')
      .eq('id', order_item_id)
      .eq('order_id', orderId)
      .single()

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const lineTotal = parseFloat(item.line_total)
    appliedAmount =
      discount_type === 'percentage'
        ? Math.round(lineTotal * (value / 100) * 100) / 100
        : Math.min(value, lineTotal)
  } else {
    // Order-level discount
    const subtotal = parseFloat(order.subtotal)
    appliedAmount =
      discount_type === 'percentage'
        ? Math.round(subtotal * (value / 100) * 100) / 100
        : Math.min(value, subtotal)
  }

  // Insert discount record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: discount, error } = await (supabase.from('order_discounts') as any)
    .insert({
      order_id: orderId,
      order_item_id: order_item_id ?? null,
      name,
      discount_type,
      value: value.toString(),
      applied_amount: appliedAmount.toFixed(2),
      applied_by: user.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to apply discount' }, { status: 500 })
  }

  // Recalculate order totals
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allDiscounts } = await (supabase.from('order_discounts') as any)
    .select('applied_amount')
    .eq('order_id', orderId)

  const totalDiscount = (allDiscounts ?? []).reduce(
    (sum: number, d: { applied_amount: string }) => sum + parseFloat(d.applied_amount),
    0
  )

  const subtotal = parseFloat(order.subtotal)
  const afterDiscount = subtotal - totalDiscount
  const taxTotal = Math.round(afterDiscount * 0.085 * 100) / 100
  const total = afterDiscount + taxTotal

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('orders') as any)
    .update({
      discount_total: totalDiscount.toFixed(2),
      tax_total: taxTotal.toFixed(2),
      total: total.toFixed(2),
      balance_due: total.toFixed(2),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  return NextResponse.json({ data: discount }, { status: 201 })
}
