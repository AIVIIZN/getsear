import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/**
 * POST /api/orders/[id]/reopen — reopen a closed order (manager+ only)
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id: orderId } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (supabase.from('orders') as any)
    .select('id, status, total, amount_paid, org_id')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (order.status !== 'closed') {
    return NextResponse.json({ error: 'Only closed orders can be reopened' }, { status: 400 })
  }

  const balanceDue = (parseFloat(order.total) - parseFloat(order.amount_paid)).toFixed(2)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('orders') as any)
    .update({
      status: 'served',
      closed_at: null,
      balance_due: balanceDue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to reopen order' }, { status: 500 })
  }

  // Audit trail
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('order_modifications') as any).insert({
    order_id: orderId,
    modification_type: 'reopen',
    description: 'Order reopened by manager',
    previous_value: { status: 'closed' },
    new_value: { status: 'served', balance_due: balanceDue },
    performed_by: user.id,
  })

  return NextResponse.json({ data })
}
