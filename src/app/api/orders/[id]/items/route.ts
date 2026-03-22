import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const modifierSchema = z.object({
  modifier_id: z.string().uuid(),
  modifier_group_id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  price_adjustment: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  quantity: z.number().int().min(1).default(1),
})

const addItemSchema = z.object({
  menu_item_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  unit_price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Price must be a valid dollar amount'),
  quantity: z.number().int().min(1).max(999).default(1),
  seat_number: z.number().int().min(1).max(99).nullable().optional(),
  course: z.number().int().min(1).max(20).optional().default(1),
  prep_station: z.string().max(50).nullable().optional(),
  notes: z.string().max(500).optional().default(''),
  modifiers: z.array(modifierSchema).optional().default([]),
})

/**
 * POST /api/orders/[id]/items — add item to order
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

  const parsed = addItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify order exists and belongs to org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase.from('orders') as any)
    .select('id, org_id, status')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.status === 'closed' || order.status === 'voided') {
    return NextResponse.json({ error: 'Cannot add items to a closed or voided order' }, { status: 400 })
  }

  const { menu_item_id, name, unit_price, quantity, seat_number, course, prep_station, notes, modifiers } = parsed.data

  // Calculate modifier total
  const modifierTotal = modifiers.reduce(
    (sum, m) => sum + parseFloat(m.price_adjustment) * m.quantity,
    0
  )
  const lineTotal = (parseFloat(unit_price) * quantity + modifierTotal * quantity).toFixed(2)

  // Insert order item
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error: itemError } = await (supabase.from('order_items') as any)
    .insert({
      order_id: orderId,
      menu_item_id,
      name,
      unit_price,
      quantity,
      modifier_total: modifierTotal.toFixed(2),
      line_total: lineTotal,
      seat_number: seat_number ?? null,
      course,
      prep_station: prep_station ?? null,
      notes,
      is_sent: false,
      is_fired: false,
      is_ready: false,
      is_served: false,
      is_voided: false,
      is_comped: false,
    })
    .select()
    .single()

  if (itemError || !item) {
    return NextResponse.json({ error: 'Failed to add item' }, { status: 500 })
  }

  // Insert modifiers if any
  if (modifiers.length > 0) {
    const modRows = modifiers.map((m) => ({
      order_item_id: item.id,
      modifier_id: m.modifier_id,
      modifier_group_id: m.modifier_group_id ?? null,
      name: m.name,
      price_adjustment: m.price_adjustment,
      quantity: m.quantity,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('order_item_modifiers') as any).insert(modRows)
  }

  // Recalculate order totals
  await recalculateOrderTotals(supabase, orderId)

  // Fetch the complete item with modifiers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: completeItem } = await (supabase.from('order_items') as any)
    .select('*, order_item_modifiers(*)')
    .eq('id', item.id)
    .single()

  return NextResponse.json({ data: completeItem }, { status: 201 })
}

/**
 * Recalculate order financial totals from line items
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recalculateOrderTotals(supabase: any, orderId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items } = await (supabase.from('order_items') as any)
    .select('line_total, is_voided, is_comped, comp_amount, tax_amount')
    .eq('order_id', orderId)

  if (!items) return

  let subtotal = 0
  let taxTotal = 0

  for (const item of items) {
    if (item.is_voided) continue
    const lineAmount = parseFloat(item.line_total || '0')
    const compAmount = parseFloat(item.comp_amount || '0')
    subtotal += lineAmount - compAmount
    taxTotal += parseFloat(item.tax_amount || '0')
  }

  // Get order-level discounts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: discounts } = await (supabase.from('order_discounts') as any)
    .select('applied_amount')
    .eq('order_id', orderId)
    .is('order_item_id', null)

  const discountTotal = (discounts ?? []).reduce(
    (sum: number, d: { applied_amount: string }) => sum + parseFloat(d.applied_amount || '0'),
    0
  )

  // Default tax calculation if no per-item tax (8.5%)
  if (taxTotal === 0) {
    taxTotal = Math.round((subtotal - discountTotal) * 0.085 * 100) / 100
  }

  const total = subtotal - discountTotal + taxTotal

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('orders') as any)
    .update({
      subtotal: subtotal.toFixed(2),
      discount_total: discountTotal.toFixed(2),
      tax_total: taxTotal.toFixed(2),
      total: total.toFixed(2),
      balance_due: total.toFixed(2),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
}
