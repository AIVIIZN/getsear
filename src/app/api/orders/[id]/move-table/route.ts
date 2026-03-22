import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const moveTableSchema = z.object({
  table_id: z.string().uuid(),
})

/**
 * POST /api/orders/[id]/move-table — move order to a different table
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

  const parsed = moveTableSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'table_id is required', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Get current order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase.from('orders') as any)
    .select('id, table_id, org_id')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const previousTableId = order.table_id

  // Update old table to available/dirty
  if (previousTableId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('tables') as any)
      .update({ status: 'dirty', updated_at: new Date().toISOString() })
      .eq('id', previousTableId)
  }

  // Update new table to seated
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('tables') as any)
    .update({ status: 'seated', updated_at: new Date().toISOString() })
    .eq('id', parsed.data.table_id)

  // Move order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('orders') as any)
    .update({
      table_id: parsed.data.table_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to move order' }, { status: 500 })
  }

  // Audit trail
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('order_modifications') as any).insert({
    org_id: user.org_id,
    order_id: orderId,
    modification_type: 'change_table',
    description: 'Order moved to different table',
    previous_value: { table_id: previousTableId },
    new_value: { table_id: parsed.data.table_id },
    performed_by: user.id,
  })

  return NextResponse.json({ data })
}
