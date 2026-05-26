import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { assertVersion } from '@/lib/orders/concurrency'

const splitSchema = z.object({
  mode: z.enum(['by_seat', 'equal', 'custom']),
  split_count: z.number().int().min(2).max(20).optional(),
  item_assignments: z
    .array(
      z.object({
        item_id: z.string().uuid(),
        target_check: z.number().int().min(0),
      })
    )
    .optional(),
})

/**
 * POST /api/orders/[id]/split — split order into multiple checks
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
    return apiError(400, 'Invalid JSON')
  }

  const parsed = splitSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // V5.4.1 optimistic-lock guard. Splitting an order is a multi-step write
  // (creates new orders, moves items, updates the original); we want to
  // 409 early if a concurrent edit is in flight rather than risk an
  // inconsistent split.
  const versionCheck = await assertVersion(supabase, request, orderId, user.org_id, {
    select: 'id, version',
  })
  if (!versionCheck.ok) return versionCheck.response

  // Get the order with items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase.from('orders') as any)
    .select('*, order_items(*, order_item_modifiers(*))')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!order) {
    return apiError(404, 'Order not found')
  }

  const items = order.order_items ?? []
  const activeItems = items.filter((i: { is_voided: boolean }) => !i.is_voided)

  if (activeItems.length === 0) {
    return apiError(400, 'No items to split')
  }

  const { mode } = parsed.data
  const newOrders: string[] = []

  if (mode === 'by_seat') {
    // Group items by seat number
    const seats = new Map<number, typeof activeItems>()
    for (const item of activeItems) {
      const seat = item.seat_number ?? 1
      if (!seats.has(seat)) seats.set(seat, [])
      seats.get(seat)!.push(item)
    }

    if (seats.size < 2) {
      return apiError(400, 'Need items on at least 2 seats to split by seat')
    }

    // Create a new order for each seat (first seat keeps original order)
    let isFirst = true
    for (const [, seatItems] of seats) {
      if (isFirst) {
        isFirst = false
        continue
      }

      // Create new order
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newOrder } = await (supabase.from('orders') as any)
        .insert({
          org_id: order.org_id,
          location_id: order.location_id,
          order_number: 0,
          display_number: `${order.display_number}-S`,
          order_type: order.order_type,
          status: order.status,
          table_id: order.table_id,
          server_id: order.server_id,
          guest_count: 1,
          subtotal: '0.00',
          discount_total: '0.00',
          tax_total: '0.00',
          tip_total: '0.00',
          total: '0.00',
          amount_paid: '0.00',
          balance_due: '0.00',
          source: order.source,
          split_from_order_id: orderId,
        })
        .select()
        .single()

      if (newOrder) {
        newOrders.push(newOrder.id)
        // Move items to new order
        for (const item of seatItems) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('order_items') as any)
            .update({ order_id: newOrder.id })
            .eq('id', item.id)
        }
      }
    }
  } else if (mode === 'equal') {
    const count = parsed.data.split_count ?? 2
    // For equal split, we keep original order but create N-1 new orders
    // Each new order gets an equal portion of the total
    for (let i = 1; i < count; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: newOrder } = await (supabase.from('orders') as any)
        .insert({
          org_id: order.org_id,
          location_id: order.location_id,
          order_number: 0,
          display_number: `${order.display_number}-${i + 1}`,
          order_type: order.order_type,
          status: order.status,
          table_id: order.table_id,
          server_id: order.server_id,
          guest_count: 1,
          subtotal: (parseFloat(order.subtotal) / count).toFixed(2),
          discount_total: (parseFloat(order.discount_total) / count).toFixed(2),
          tax_total: (parseFloat(order.tax_total) / count).toFixed(2),
          tip_total: '0.00',
          total: (parseFloat(order.total) / count).toFixed(2),
          amount_paid: '0.00',
          balance_due: (parseFloat(order.total) / count).toFixed(2),
          source: order.source,
          split_from_order_id: orderId,
        })
        .select()
        .single()

      if (newOrder) newOrders.push(newOrder.id)
    }

    // Update original order with its share (all financial fields)
    const splitCount = parsed.data.split_count ?? 2
    const shareSubtotal = (parseFloat(order.subtotal) / splitCount).toFixed(2)
    const shareDiscount = (parseFloat(order.discount_total) / splitCount).toFixed(2)
    const shareTax = (parseFloat(order.tax_total) / splitCount).toFixed(2)
    const shareTotal = (parseFloat(order.total) / splitCount).toFixed(2)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('orders') as any)
      .update({
        subtotal: shareSubtotal,
        discount_total: shareDiscount,
        tax_total: shareTax,
        total: shareTotal,
        balance_due: shareTotal,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
  }

  // Audit trail
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('order_modifications') as any).insert({
    org_id: user.org_id,
    order_id: orderId,
    modification_type: 'split_order',
    description: `Order split (${mode})`,
    new_value: { new_order_ids: newOrders, mode },
    performed_by: user.id,
  })

  // Read fresh version for ETag (the original order was UPDATEd in the equal
  // branch above; in the by_seat branch only the items moved, so the trigger
  // may not have fired — either way this is the canonical post-split version).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: refreshed } = await (supabase.from('orders') as any)
    .select('version')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .maybeSingle()
  const newVersion = (refreshed?.version as number | undefined) ?? versionCheck.currentVersion

  return NextResponse.json(
    {
      data: {
        original_order_id: orderId,
        new_order_ids: newOrders,
        mode,
      },
    },
    { headers: { ETag: `"${newVersion}"` } }
  )
}
