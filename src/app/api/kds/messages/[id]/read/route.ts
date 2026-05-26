import { apiError } from '@/lib/api/error-response'
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
    return apiError(400, 'Invalid JSON')
  }

  const stationId = (body as Record<string, unknown>)?.station_id
  if (!stationId || typeof stationId !== 'string') {
    return apiError(400, 'station_id is required')
  }

  const supabase = createAdminClient()

  // Update message read status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: message, error: fetchError } = await (supabase.from('kds_messages') as any)
    .select('id, read_by')
    .eq('id', id)
    .single()

  if (fetchError || !message) {
    return apiError(404, 'Message not found')
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
    return apiError(500, 'Failed to mark message as read')
  }

  return NextResponse.json({ data: { id, read_by: readBy } })
}
