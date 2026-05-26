import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { assertVersion, checkUpdateAffectedRow } from '@/lib/orders/concurrency'
import { CACHE_REVALIDATE_PROFILE, orderCacheTags } from '@/lib/cache/keys'

const transferSchema = z.object({
  server_id: z.string().uuid(),
})

/**
 * POST /api/orders/[id]/transfer — transfer order to a different server
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

  const parsed = transferSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'server_id is required', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // V5.4.1 optimistic-lock guard.
  const check = await assertVersion(supabase, request, orderId, user.org_id, {
    select: 'id, server_id, org_id, version',
  })
  if (!check.ok) return check.response

  const previousServerId = check.currentRow.server_id as string | null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let updateQuery = (supabase.from('orders') as any)
    .update({
      server_id: parsed.data.server_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)
    .eq('org_id', user.org_id)
  if (check.expectedVersion !== null) {
    updateQuery = updateQuery.eq('version', check.expectedVersion)
  }
  const { data, error } = await updateQuery.select().maybeSingle()

  if (error) {
    return apiError(500, 'Failed to transfer order')
  }

  const staleResp = await checkUpdateAffectedRow(
    supabase,
    orderId,
    user.org_id,
    check.expectedVersion,
    data
  )
  if (staleResp) return staleResp

  // Create modification record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('order_modifications') as any).insert({
    org_id: user.org_id,
    order_id: orderId,
    modification_type: 'change_server',
    description: 'Order transferred to different server',
    previous_value: { server_id: previousServerId },
    new_value: { server_id: parsed.data.server_id },
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
