import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
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
      { error: `Cannot accept order with status: ${queueItem.status}` },
      { status: 400 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('online_order_queue') as any)
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to accept order' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
