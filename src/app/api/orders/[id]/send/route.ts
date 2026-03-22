import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

/**
 * POST /api/orders/[id]/send — send order to kitchen
 * Marks all unsent items as sent, transitions order from draft→open
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id: orderId } = await params
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Verify order
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase.from('orders') as any)
    .select('id, status, org_id')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.status === 'closed' || order.status === 'voided') {
    return NextResponse.json({ error: 'Cannot send a closed or voided order' }, { status: 400 })
  }

  // Mark all unsent, non-voided items as sent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sentItems, error: itemError } = await (supabase.from('order_items') as any)
    .update({ is_sent: true, sent_at: now })
    .eq('order_id', orderId)
    .eq('is_sent', false)
    .eq('is_voided', false)
    .select()

  if (itemError) {
    return NextResponse.json({ error: 'Failed to send items' }, { status: 500 })
  }

  // Transition order status: draft→open on first send, or keep current if already open/fired
  const newStatus = order.status === 'draft' ? 'open' : order.status

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updatedOrder, error: orderError } = await (supabase.from('orders') as any)
    .update({
      status: newStatus,
      sent_at: now,
      updated_at: now,
    })
    .eq('id', orderId)
    .select()
    .single()

  if (orderError) {
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 })
  }

  return NextResponse.json({
    data: updatedOrder,
    sent_items_count: sentItems?.length ?? 0,
  })
}
