import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const updateReservationSchema = z.object({
  customer_name: z.string().min(1).max(200).optional(),
  customer_phone: z.string().max(20).optional().nullable(),
  customer_email: z.string().email().optional().nullable(),
  party_size: z.number().int().min(1).max(100).optional(),
  reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reservation_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  table_id: z.string().uuid().optional().nullable(),
  status: z.enum(['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show']).optional(),
  notes: z.string().max(2000).optional().nullable(),
  special_requests: z.string().max(2000).optional().nullable(),
})

/** PATCH /api/reservations/[id] — update a reservation */
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

  const parsed = updateReservationSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('reservations') as any)
    .update(parsed.data)
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to update reservation')
  }

  if (!data) {
    return apiError(404, 'Reservation not found')
  }

  return NextResponse.json({ data })
}

/** DELETE /api/reservations/[id] — cancel a reservation */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager', 'host', 'server'])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('reservations') as any)
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to cancel reservation')
  }

  if (!data) {
    return apiError(404, 'Reservation not found')
  }

  return NextResponse.json({ data })
}
