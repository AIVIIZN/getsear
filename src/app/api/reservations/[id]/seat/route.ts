import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const seatSchema = z.object({
  table_id: z.string().uuid().optional(),
})

/** POST /api/reservations/[id]/seat — mark reservation as seated */
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
    // Body is optional for seat action
  }

  const parsed = seatSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Verify reservation exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchErr } = await (supabase.from('reservations') as any)
    .select('id, status')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (fetchErr || !existing) {
    return apiError(404, 'Reservation not found')
  }

  if (existing.status === 'cancelled' || existing.status === 'no_show') {
    return apiError(400, `Cannot seat reservation with status "${existing.status}"`)
  }

  const updatePayload: Record<string, unknown> = { status: 'seated' }
  if (parsed.data.table_id) {
    updatePayload.table_id = parsed.data.table_id
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('reservations') as any)
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to seat reservation')
  }

  return NextResponse.json({ data })
}
