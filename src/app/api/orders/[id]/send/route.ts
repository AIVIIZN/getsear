import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { assertVersion, checkUpdateAffectedRow } from '@/lib/orders/concurrency'

/**
 * POST /api/orders/[id]/send — send order to kitchen
 * Marks all unsent items as sent, transitions order from draft→open
 *
 * V5.4.1: gated by `If-Match` optimistic-lock check. Mismatch → 409 with
 * current state for the StaleOrderModal.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id: orderId } = await params
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const check = await assertVersion(supabase, request, orderId, user.org_id, {
    select: 'id, status, org_id, version',
  })
  if (!check.ok) return check.response

  const status = check.currentRow.status as string
  if (status === 'closed' || status === 'voided') {
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
  const newStatus = status === 'draft' ? 'open' : status

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateQuery = (supabase.from('orders') as any)
    .update({
      status: newStatus,
      sent_at: now,
      updated_at: now,
    })
    .eq('id', orderId)
    .eq('org_id', user.org_id)
  if (check.expectedVersion !== null) {
    updateQuery = updateQuery.eq('version', check.expectedVersion)
  }
  const { data: updatedOrder, error: orderError } = await updateQuery
    .select()
    .maybeSingle()

  if (orderError) {
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 })
  }

  const staleResp = await checkUpdateAffectedRow(
    supabase,
    orderId,
    user.org_id,
    check.expectedVersion,
    updatedOrder
  )
  if (staleResp) return staleResp

  const newVersion =
    (updatedOrder as Record<string, unknown>)?.version as number | undefined
    ?? check.currentVersion + 1

  return NextResponse.json(
    {
      data: updatedOrder,
      sent_items_count: sentItems?.length ?? 0,
    },
    { headers: { ETag: `"${newVersion}"` } }
  )
}
