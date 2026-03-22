import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/inventory/purchase-orders/:id/reconcile — mark PO as reconciled
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await context.params
  const supabase = createAdminClient()

  // Verify PO exists and is received
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: po } = await (supabase.from('purchase_orders') as any)
    .select('id, status')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!po) {
    return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
  }

  if (po.status !== 'received') {
    return NextResponse.json({ error: 'PO must be in received state to reconcile' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('purchase_orders') as any)
    .update({ status: 'reconciled' })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to reconcile PO' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
