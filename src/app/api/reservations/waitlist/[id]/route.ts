import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateWaitlistSchema = z.object({
  status: z.enum(['waiting', 'notified', 'seated', 'cancelled', 'no_show']).optional(),
  quoted_wait_minutes: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional().nullable(),
})

/** PATCH /api/reservations/waitlist/[id] — update waitlist entry (notify, seat, cancel) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'host', 'server'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = updateWaitlistSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  const updatePayload: Record<string, unknown> = { ...parsed.data }

  // If notifying, record the notification time
  if (parsed.data.status === 'notified') {
    updatePayload.notified_at = new Date().toISOString()
  }

  // If seating, record the seated time
  if (parsed.data.status === 'seated') {
    updatePayload.seated_at = new Date().toISOString()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('waitlist_entries') as any)
    .update(updatePayload)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to update waitlist entry')
  }

  if (!data) {
    return apiError(404, 'Waitlist entry not found')
  }

  return NextResponse.json({ data })
}
