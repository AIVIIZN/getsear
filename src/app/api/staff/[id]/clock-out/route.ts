import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

const clockOutSchema = z.object({
  cash_tips: z.string().optional(),
}).optional()

/**
 * POST /api/staff/[id]/clock-out — close active time entry, calculate total_minutes
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    // body is optional for clock-out
  }

  const parsed = clockOutSchema?.safeParse(body)
  if (parsed && !parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // Find active time entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeEntry, error: findError } = await (supabase.from('time_entries') as any)
    .select('*')
    .eq('user_id', id)
    .eq('org_id', user.org_id)
    .is('clock_out', null)
    .limit(1)
    .maybeSingle()

  if (findError || !activeEntry) {
    return NextResponse.json({ error: 'No active clock-in found' }, { status: 404 })
  }

  const now = new Date()
  const clockIn = new Date(activeEntry.clock_in)
  const totalMinutes = Math.round((now.getTime() - clockIn.getTime()) / 60000)

  // Get break minutes for this entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: breaks } = await (supabase.from('break_entries') as any)
    .select('duration_minutes, break_type')
    .eq('time_entry_id', activeEntry.id)
    .not('end_time', 'is', null)

  let unpaidBreakMinutes = 0
  if (breaks) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    unpaidBreakMinutes = breaks.reduce((sum: number, b: any) => {
      return b.break_type === 'unpaid' ? sum + (b.duration_minutes ?? 0) : sum
    }, 0)
  }

  const workedMinutes = Math.max(0, totalMinutes - unpaidBreakMinutes)
  const regularHours = Math.min(workedMinutes / 60, 8)
  const overtimeHours = Math.max(0, workedMinutes / 60 - 8)
  const hourlyRate = parseFloat(activeEntry.hourly_rate ?? '0')
  const totalPay = (regularHours * hourlyRate) + (overtimeHours * hourlyRate * 1.5)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = {
    clock_out: now.toISOString(),
    regular_hours: parseFloat(regularHours.toFixed(2)),
    overtime_hours: parseFloat(overtimeHours.toFixed(2)),
    total_pay: totalPay.toFixed(2),
    updated_at: now.toISOString(),
  }

  if (parsed?.success && parsed.data?.cash_tips) {
    updatePayload.cash_tips = parsed.data.cash_tips
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entry, error } = await (supabase.from('time_entries') as any)
    .update(updatePayload)
    .eq('id', activeEntry.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to clock out' }, { status: 500 })
  }

  return NextResponse.json({ data: entry })
}
