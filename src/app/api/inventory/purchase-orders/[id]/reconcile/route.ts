import { apiError } from '@/lib/api/error-response'
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
    return apiError(404, 'Purchase order not found')
  }

  if (po.status !== 'received') {
    return apiError(400, 'PO must be in received state to reconcile')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('purchase_orders') as any)
    .update({ status: 'reconciled' })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error || !data) {
    return apiError(500, 'Failed to reconcile PO')
  }

  return NextResponse.json({ data })
}
