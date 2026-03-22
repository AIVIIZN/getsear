import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

/**
 * POST /api/orders/[id]/hold — hold order (back to 'open' from 'fired')
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id: orderId } = await params
  const supabase = createAdminClient()

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
    return NextResponse.json({ error: 'Cannot hold a closed or voided order' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('orders') as any)
    .update({ status: 'open', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to hold order' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
