import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const rejectSchema = z.object({
  rejection_reason: z.string().min(1).max(500),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = rejectSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Verify queue item ownership and status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: queueItem } = await (supabase.from('online_order_queue') as any)
    .select('id, status, org_id')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .maybeSingle()

  if (!queueItem) {
    return apiError(404, 'Order not found')
  }

  if (queueItem.status !== 'pending') {
    return apiError(400, `Cannot reject order with status: ${queueItem.status}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('online_order_queue') as any)
    .update({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejection_reason: parsed.data.rejection_reason,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to reject order')
  }

  return NextResponse.json({ data })
}
