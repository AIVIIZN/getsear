import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

const updateTimeEntrySchema = z.object({
  clock_in: z.string().optional(),
  clock_out: z.string().optional().nullable(),
  cash_tips: z.string().optional(),
  credit_tips: z.string().optional(),
  notes: z.string().optional().nullable(),
})

/**
 * PATCH /api/staff/time-entries/[id] — edit time entry (manager only)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = updateTimeEntrySchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Verify entry belongs to this org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('time_entries') as any)
    .select('id, org_id, clock_in, clock_out, hourly_rate')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!existing) {
    return apiError(404, 'Time entry not found')
  }

  // Recalculate hours if clock times changed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  }

  const clockIn = new Date(parsed.data.clock_in ?? existing.clock_in)
  const clockOut = parsed.data.clock_out ? new Date(parsed.data.clock_out) : (existing.clock_out ? new Date(existing.clock_out) : null)

  if (clockOut) {
    const totalMinutes = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000)
    const workedHours = totalMinutes / 60
    const regularHours = Math.min(workedHours, 8)
    const overtimeHours = Math.max(0, workedHours - 8)
    const hourlyRate = parseFloat(existing.hourly_rate ?? '0')
    const totalPay = (regularHours * hourlyRate) + (overtimeHours * hourlyRate * 1.5)

    payload.regular_hours = parseFloat(regularHours.toFixed(2))
    payload.overtime_hours = parseFloat(overtimeHours.toFixed(2))
    payload.total_pay = totalPay.toFixed(2)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('time_entries') as any)
    .update(payload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to update time entry')
  }

  return NextResponse.json({ data })
}
