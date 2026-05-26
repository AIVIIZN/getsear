import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

const clockInSchema = z.object({
  location_id: z.string().uuid(),
})

/**
 * POST /api/staff/[id]/clock-in — create time entry, return entry ID
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = clockInSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Verify staff exists and is active
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: staff, error: staffError } = await (supabase.from('users') as any)
    .select('id, org_id, role, hourly_rate, is_active')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (staffError || !staff) {
    return apiError(404, 'Staff member not found')
  }

  if (!staff.is_active) {
    return apiError(400, 'Staff member is inactive')
  }

  // Check if already clocked in
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeEntry } = await (supabase.from('time_entries') as any)
    .select('id')
    .eq('user_id', id)
    .eq('org_id', user.org_id)
    .is('clock_out', null)
    .limit(1)
    .maybeSingle()

  if (activeEntry) {
    return apiError(409, 'Staff member is already clocked in')
  }

  const now = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error } = await (supabase.from('time_entries') as any)
    .insert({
      org_id: user.org_id,
      location_id: parsed.data.location_id,
      user_id: id,
      clock_in: now,
      role_during_shift: staff.role,
      hourly_rate: staff.hourly_rate ?? '0.00',
      cash_tips: '0.00',
      credit_tips: '0.00',
      tip_out_given: '0.00',
      tip_out_received: '0.00',
      is_approved: false,
    })
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to clock in')
  }

  return NextResponse.json({ data: entry }, { status: 201 })
}
