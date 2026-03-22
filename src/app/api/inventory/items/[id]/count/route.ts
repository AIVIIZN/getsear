import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const countSchema = z.object({
  counted_quantity: z.number().min(0),
  notes: z.string().max(500).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/inventory/items/:id/count — quick count for an item
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

  const parsed = countSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Get current item
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: item, error: itemErr } = await (supabase.from('inventory_items') as any)
    .select('id, current_stock, unit_cost')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (itemErr || !item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  }

  const variance = parsed.data.counted_quantity - (item.current_stock ?? 0)

  // Create transaction record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('inventory_transactions') as any)
    .insert({
      org_id: user.org_id,
      inventory_item_id: id,
      type: 'count',
      quantity: variance,
      unit_cost: item.unit_cost,
      notes: parsed.data.notes ?? `Count adjustment: ${item.current_stock} -> ${parsed.data.counted_quantity}`,
      created_by: user.id,
    })

  // Update current stock
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateErr } = await (supabase.from('inventory_items') as any)
    .update({ current_stock: parsed.data.counted_quantity })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update count' }, { status: 500 })
  }

  return NextResponse.json({ data: updated, variance })
}
