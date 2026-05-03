import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/terminals/heartbeat
 * Called every 60 seconds from the device to update last_heartbeat_at.
 * Public endpoint — uses terminal_id from body (stored in localStorage on device).
 */
export async function POST(request: Request) {
  let body: { terminal_id: string; current_user_id?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { terminal_id, current_user_id } = body

  if (!terminal_id) {
    return NextResponse.json(
      { error: 'terminal_id is required' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const updatePayload: Record<string, unknown> = {
    last_heartbeat_at: new Date().toISOString(),
    is_online: true,
    updated_at: new Date().toISOString(),
  }

  if (current_user_id !== undefined) {
    updatePayload.current_user_id = current_user_id ?? null
  }

  const { error } = await supabase.from('terminals')
    .update(updatePayload)
    .eq('id', terminal_id)
    .eq('is_active', true)

  if (error) {
    console.error('Terminal heartbeat error:', error)
    return NextResponse.json(
      { error: 'Failed to update heartbeat' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
