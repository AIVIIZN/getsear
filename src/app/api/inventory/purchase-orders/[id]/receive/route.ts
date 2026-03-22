import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const receiveItemSchema = z.object({
  purchase_order_item_id: z.string().uuid(),
  quantity_received: z.number().min(0),
})

const receiveSchema = z.object({
  items: z.array(receiveItemSchema).min(1),
})

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/inventory/purchase-orders/:id/receive — receive PO items
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = receiveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Verify PO exists and is in submitted state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: po } = await (supabase.from('purchase_orders') as any)
    .select('id, status, org_id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!po) {
    return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
  }

  if (po.status !== 'submitted' && po.status !== 'draft') {
    return NextResponse.json({ error: 'PO is not in a receivable state' }, { status: 400 })
  }

  // Process each received item
  for (const receivedItem of parsed.data.items) {
    // Get the PO item
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: poItem } = await (supabase.from('purchase_order_items') as any)
      .select('id, inventory_item_id, quantity_received, unit_cost')
      .eq('id', receivedItem.purchase_order_item_id)
      .eq('purchase_order_id', id)
      .single()

    if (!poItem) continue

    const newReceived = (poItem.quantity_received ?? 0) + receivedItem.quantity_received

    // Update PO item received quantity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('purchase_order_items') as any)
      .update({ quantity_received: newReceived })
      .eq('id', receivedItem.purchase_order_item_id)

    // Update inventory item stock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: invItem } = await (supabase.from('inventory_items') as any)
      .select('id, current_stock')
      .eq('id', poItem.inventory_item_id)
      .single()

    if (invItem) {
      const newStock = (invItem.current_stock ?? 0) + receivedItem.quantity_received

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('inventory_items') as any)
        .update({ current_stock: newStock })
        .eq('id', poItem.inventory_item_id)

      // Create inventory transaction
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('inventory_transactions') as any)
        .insert({
          org_id: user.org_id,
          inventory_item_id: poItem.inventory_item_id,
          type: 'receive',
          quantity: receivedItem.quantity_received,
          unit_cost: poItem.unit_cost,
          reference_id: id,
          notes: `Received from PO ${id}`,
          created_by: user.id,
        })
    }
  }

  // Check if all items are fully received to update PO status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allItems } = await (supabase.from('purchase_order_items') as any)
    .select('quantity_ordered, quantity_received')
    .eq('purchase_order_id', id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allReceived = allItems?.every((item: any) =>
    (item.quantity_received ?? 0) >= item.quantity_ordered
  )

  if (allReceived) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('purchase_orders') as any)
      .update({ status: 'received', received_at: new Date().toISOString() })
      .eq('id', id)
  }

  return NextResponse.json({ success: true, fully_received: allReceived ?? false })
}
