import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { assertVersion, checkUpdateAffectedRow } from '@/lib/orders/concurrency'
import { CACHE_REVALIDATE_PROFILE, orderCacheTags } from '@/lib/cache/keys'

/**
 * POST /api/orders/[id]/hold — hold order (back to 'open' from 'fired')
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

  const check = await assertVersion(supabase, request, orderId, user.org_id, {
    select: 'id, status, org_id, version',
  })
  if (!check.ok) return check.response

  const status = check.currentRow.status as string
  if (status === 'closed' || status === 'voided') {
    return NextResponse.json({ error: 'Cannot hold a closed or voided order' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateQuery = (supabase.from('orders') as any)
    .update({ status: 'open', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('org_id', user.org_id)
  if (check.expectedVersion !== null) {
    updateQuery = updateQuery.eq('version', check.expectedVersion)
  }
  const { data, error } = await updateQuery.select().maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to hold order' }, { status: 500 })
  }

  const staleResp = await checkUpdateAffectedRow(
    supabase,
    orderId,
    user.org_id,
    check.expectedVersion,
    data
  )
  if (staleResp) return staleResp

  const newVersion = (data as Record<string, unknown>)?.version as number | undefined
    ?? check.currentVersion + 1
  for (const tag of orderCacheTags(user.org_id, orderId)) {
    revalidateTag(tag, CACHE_REVALIDATE_PROFILE)
  }
  return NextResponse.json({ data }, {
    headers: { ETag: `"${newVersion}"` },
  })
}
