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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = rejectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
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
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (queueItem.status !== 'pending') {
    return NextResponse.json(
      { error: `Cannot reject order with status: ${queueItem.status}` },
      { status: 400 }
    )
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
    return NextResponse.json({ error: 'Failed to reject order' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
