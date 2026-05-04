import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { recalculateOrderTotals, StaleVersionError } from '@/lib/tax/recalculate-order'
import { assertVersion, checkUpdateAffectedRow } from '@/lib/orders/concurrency'

const mergeSchema = z.object({
  source_order_id: z.string().uuid(),
})

/**
 * POST /api/orders/[id]/merge -- merge another order into this one
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id: targetOrderId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = mergeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'source_order_id is required', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const { source_order_id } = parsed.data

  // V5.4.1 optimistic-lock guard against the TARGET order. We don't gate the
  // source — by definition we're voiding it, so a stale source-version is
  // not a meaningful conflict (the merge still proceeds with whatever items
  // exist at this moment).
  const check = await assertVersion(supabase, request, targetOrderId, user.org_id, {
    select: 'id, org_id, status, version',
  })
  if (!check.ok) return check.response

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sourceOrder } = await (supabase.from('orders') as any)
    .select('id, org_id, status')
    .eq('id', source_order_id)
    .eq('org_id', user.org_id)
    .single()

  if (!sourceOrder) {
    return NextResponse.json({ error: 'Source order not found' }, { status: 404 })
  }

  const targetStatus = check.currentRow.status as string
  if (targetStatus === 'closed' || targetStatus === 'voided') {
    return NextResponse.json({ error: 'Target order is closed or voided' }, { status: 400 })
  }

  // Move all items from source to target
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('order_items') as any)
    .update({ order_id: targetOrderId })
    .eq('order_id', source_order_id)

  // Move discounts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('order_discounts') as any)
    .update({ order_id: targetOrderId })
    .eq('order_id', source_order_id)

  // Void the source order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('orders') as any)
    .update({
      status: 'voided',
      voided_at: new Date().toISOString(),
      voided_by: user.id,
      void_reason: `Merged into order ${targetOrderId}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', source_order_id)

  // Recalculate target totals using the tax engine (no more hardcoded 8.5%)
  // — this UPDATE bumps the target order's version (V5.4.1). The mutations
  // above touched `order_items`, `order_discounts`, and the *source* order;
  // none bump the target's `orders.version`, so the target is still at
  // `check.expectedVersion` when recalc runs (5.99.2).
  try {
    await recalculateOrderTotals(
      supabase,
      targetOrderId,
      user.org_id,
      check.expectedVersion
    )
  } catch (err) {
    if (err instanceof StaleVersionError) {
      const stale = await checkUpdateAffectedRow(
        supabase,
        targetOrderId,
        user.org_id,
        check.expectedVersion,
        null
      )
      if (stale) return stale
    }
    throw err
  }

  // Fetch the updated order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updatedOrder } = await (supabase.from('orders') as any)
    .select('*, order_items(*, order_item_modifiers(*))')
    .eq('id', targetOrderId)
    .single()

  // Audit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('order_modifications') as any).insert({
    org_id: user.org_id,
    order_id: targetOrderId,
    modification_type: 'merge_order',
    description: `Merged order ${source_order_id} into this order`,
    previous_value: { source_order_id },
    new_value: { merged: true },
    performed_by: user.id,
  })

  const newVersion = (updatedOrder?.version as number | undefined) ?? check.currentVersion + 1
  return NextResponse.json({ data: updatedOrder }, {
    headers: { ETag: `"${newVersion}"` },
  })
}
