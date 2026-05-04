import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { recalculateOrderTotals, StaleVersionError } from '@/lib/tax/recalculate-order'
import { assertVersion, checkUpdateAffectedRow } from '@/lib/orders/concurrency'

const discountSchema = z.object({
  name: z.string().min(1).max(200),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  value: z.number().positive().max(100),
  order_item_id: z.string().uuid().nullable().optional(),
  requires_manager_approval: z.boolean().optional().default(false),
})

/**
 * POST /api/orders/[id]/discount -- apply discount to order or item
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

  // V5.4.1 optimistic-lock guard. Applying a discount triggers
  // `recalculateOrderTotals` below, which UPDATEs the order row.
  const check = await assertVersion(supabase, request, orderId, user.org_id, {
    select: 'id, org_id, subtotal, amount_paid, version',
  })
  if (!check.ok) return check.response

  const order = check.currentRow as {
    id: string; org_id: string; subtotal: string; amount_paid: string
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

  // Recalculate order totals using the tax engine (no more hardcoded 8.5%)
  // — this UPDATE bumps the order version (V5.4.1). Only an INSERT into
  // `order_discounts` ran above, so `orders.version` is still
  // `check.expectedVersion`; thread it through so 5.99.2 catches a stale
  // snapshot before it clobbers totals.
  try {
    await recalculateOrderTotals(supabase, orderId, user.org_id, check.expectedVersion)
  } catch (err) {
    if (err instanceof StaleVersionError) {
      const stale = await checkUpdateAffectedRow(
        supabase,
        orderId,
        user.org_id,
        check.expectedVersion,
        null
      )
      if (stale) return stale
    }
    throw err
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: refreshed } = await (supabase.from('orders') as any)
    .select('version')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .maybeSingle()
  const newVersion = (refreshed?.version as number | undefined) ?? check.currentVersion + 1

  return NextResponse.json(
    { data: discount },
    { status: 201, headers: { ETag: `"${newVersion}"` } }
  )
}
