import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { assertVersion } from '@/lib/orders/concurrency'

const fireCourseSchema = z.object({
  course: z.number().int().min(1).max(20),
})

/**
 * POST /api/orders/[id]/fire-course — fire a specific course number
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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = fireCourseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'course number is required', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // V5.4.1 optimistic-lock guard.
  const check = await assertVersion(supabase, request, orderId, user.org_id, {
    select: 'id, status, org_id, version',
  })
  if (!check.ok) return check.response

  // Fire all items for the specified course
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: firedItems, error } = await (supabase.from('order_items') as any)
    .update({ is_fired: true, fired_at: now })
    .eq('order_id', orderId)
    .eq('course', parsed.data.course)
    .eq('is_voided', false)
    .eq('is_fired', false)
    .select()

  if (error) {
    return NextResponse.json({ error: 'Failed to fire course' }, { status: 500 })
  }

  // Update order status to fired if not already. We gate on version when the
  // caller asserted one; if the caller's version is stale by now (another
  // writer ran in parallel) we fall through with no order-row update — the
  // course items still got fired, which is the user-intent.
  const status = check.currentRow.status as string
  if (status === 'open' || status === 'draft') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let updateQuery = (supabase.from('orders') as any)
      .update({ status: 'fired', updated_at: now })
      .eq('id', orderId)
      .eq('org_id', user.org_id)
      .in('status', ['open', 'draft'])
    if (check.expectedVersion !== null) {
      updateQuery = updateQuery.eq('version', check.expectedVersion)
    }
    await updateQuery
  }

  // Re-read for fresh version; trigger may or may not have fired depending on
  // the status branch above.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: refreshed } = await (supabase.from('orders') as any)
    .select('version')
    .eq('id', orderId)
    .eq('org_id', user.org_id)
    .maybeSingle()

  const newVersion = (refreshed?.version as number | undefined) ?? check.currentVersion

  return NextResponse.json(
    {
      data: { course: parsed.data.course, items_fired: firedItems?.length ?? 0 },
    },
    { headers: { ETag: `"${newVersion}"` } }
  )
}
