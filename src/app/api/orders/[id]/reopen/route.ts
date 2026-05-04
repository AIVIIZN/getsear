import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { assertVersion, checkUpdateAffectedRow } from '@/lib/orders/concurrency'

/**
 * POST /api/orders/[id]/reopen — reopen a closed order (manager+ only)
 *
 * V5.4.1: gated by `If-Match` optimistic-lock check.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id: orderId } = await params
  const supabase = createAdminClient()

  const check = await assertVersion(supabase, request, orderId, user.org_id, {
    select: 'id, status, total, amount_paid, org_id, version',
  })
  if (!check.ok) return check.response

  const status = check.currentRow.status as string
  if (status !== 'closed') {
    return NextResponse.json({ error: 'Only closed orders can be reopened' }, { status: 400 })
  }

  const total = check.currentRow.total as string
  const amountPaid = check.currentRow.amount_paid as string
  const balanceDue = (parseFloat(total) - parseFloat(amountPaid)).toFixed(2)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateQuery = (supabase.from('orders') as any)
    .update({
      status: 'served',
      closed_at: null,
      balance_due: balanceDue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('org_id', user.org_id)
  if (check.expectedVersion !== null) {
    updateQuery = updateQuery.eq('version', check.expectedVersion)
  }
  const { data, error } = await updateQuery.select().maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to reopen order' }, { status: 500 })
  }

  const staleResp = await checkUpdateAffectedRow(
    supabase,
    orderId,
    user.org_id,
    check.expectedVersion,
    data
  )
  if (staleResp) return staleResp

  // Audit trail
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('order_modifications') as any).insert({
    org_id: user.org_id,
    order_id: orderId,
    modification_type: 'reopen',
    description: 'Order reopened by manager',
    previous_value: { status: 'closed' },
    new_value: { status: 'served', balance_due: balanceDue },
    performed_by: user.id,
  })

  const newVersion = (data as Record<string, unknown>)?.version as number | undefined
    ?? check.currentVersion + 1
  return NextResponse.json({ data }, {
    headers: { ETag: `"${newVersion}"` },
  })
}
