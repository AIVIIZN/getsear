import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const seatFromWaitlistSchema = z.object({
  table_id: z.string().uuid().optional(),
})

/** POST /api/reservations/waitlist/[id]/seat — seat from waitlist */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'host', 'server'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    // Body is optional
  }

  const parsed = seatFromWaitlistSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Verify entry exists and is in a valid state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchErr } = await (supabase.from('waitlist_entries') as any)
    .select('id, status')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (fetchErr || !existing) {
    return apiError(404, 'Waitlist entry not found')
  }

  if (existing.status !== 'waiting' && existing.status !== 'notified') {
    return apiError(400, `Cannot seat entry with status "${existing.status}"`)
  }

  const updatePayload: Record<string, unknown> = {
    status: 'seated',
    seated_at: new Date().toISOString(),
  }
  if (parsed.data.table_id) {
    updatePayload.table_id = parsed.data.table_id
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('waitlist_entries') as any)
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to seat from waitlist')
  }

  // Reposition remaining waitlist entries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: remaining } = await (supabase.from('waitlist_entries') as any)
    .select('id')
    .eq('org_id', user.org_id)
    .eq('status', 'waiting')
    .order('position', { ascending: true })

  if (remaining && remaining.length > 0) {
    for (let i = 0; i < remaining.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('waitlist_entries') as any)
        .update({ position: i + 1 })
        .eq('id', remaining[i].id)
    }
  }

  return NextResponse.json({ data })
}
