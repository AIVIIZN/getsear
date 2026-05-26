import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

const breakStartSchema = z.object({
  break_type: z.enum(['paid', 'unpaid']).default('unpaid'),
})

/**
 * POST /api/staff/[id]/break-start — start break
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params

  let body: unknown = {}
  try {
    body = await request.json()
  } catch {
    // default to unpaid break
  }

  const parsed = breakStartSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Find active time entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeEntry, error: findError } = await (supabase.from('time_entries') as any)
    .select('id')
    .eq('user_id', id)
    .eq('org_id', user.org_id)
    .is('clock_out', null)
    .limit(1)
    .maybeSingle()

  if (findError || !activeEntry) {
    return apiError(404, 'Staff member is not clocked in')
  }

  // Check for active break
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeBreak } = await (supabase.from('break_entries') as any)
    .select('id')
    .eq('time_entry_id', activeEntry.id)
    .is('end_time', null)
    .limit(1)
    .maybeSingle()

  if (activeBreak) {
    return apiError(409, 'Break is already in progress')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: breakEntry, error } = await (supabase.from('break_entries') as any)
    .insert({
      time_entry_id: activeEntry.id,
      break_type: parsed.data.break_type,
      start_time: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to start break')
  }

  return NextResponse.json({ data: breakEntry }, { status: 201 })
}
