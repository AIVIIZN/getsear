import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { assertVersion, checkUpdateAffectedRow } from '@/lib/orders/concurrency'
import { CACHE_REVALIDATE_PROFILE, orderCacheTags } from '@/lib/cache/keys'

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
    return apiError(400, 'Invalid JSON')
  }

  const parsed = moveTableSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'table_id is required', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // V5.4.1 optimistic-lock guard.
  const check = await assertVersion(supabase, request, orderId, user.org_id, {
    select: 'id, table_id, org_id, version',
  })
  if (!check.ok) return check.response

  const previousTableId = check.currentRow.table_id as string | null

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
  let updateQuery = (supabase.from('orders') as any)
    .update({
      table_id: parsed.data.table_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('org_id', user.org_id)
  if (check.expectedVersion !== null) {
    updateQuery = updateQuery.eq('version', check.expectedVersion)
  }
  const { data, error } = await updateQuery.select().maybeSingle()

  if (error) {
    return apiError(500, 'Failed to move order')
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
    modification_type: 'change_table',
    description: 'Order moved to different table',
    previous_value: { table_id: previousTableId },
    new_value: { table_id: parsed.data.table_id },
    performed_by: user.id,
  })

  const newVersion = (data as Record<string, unknown>)?.version as number | undefined
    ?? check.currentVersion + 1
  for (const tag of orderCacheTags(user.org_id, orderId)) {
    revalidateTag(tag, CACHE_REVALIDATE_PROFILE)
  }
  return NextResponse.json({ data }, {
    headers: { ETag: `"${newVersion}"` },
  })
}
