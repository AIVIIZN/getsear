import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

/**
 * POST /api/kds/messages/[id]/read — mark a message as read by this station
 *
 * Body:
 *   station_id — the station marking the message as read
 */
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

  const stationId = (body as Record<string, unknown>)?.station_id
  if (!stationId || typeof stationId !== 'string') {
    return NextResponse.json({ error: 'station_id is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Update message read status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: message, error: fetchError } = await (supabase.from('kds_messages') as any)
    .select('id, read_by')
    .eq('id', id)
    .single()

  if (fetchError || !message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  // Add this station to the read_by array if not already present
  const readBy: string[] = message.read_by ?? []
  if (!readBy.includes(stationId)) {
    readBy.push(stationId)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase.from('kds_messages') as any)
    .update({
      read_by: readBy,
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to mark message as read' }, { status: 500 })
  }

  return NextResponse.json({ data: { id, read_by: readBy } })
}
