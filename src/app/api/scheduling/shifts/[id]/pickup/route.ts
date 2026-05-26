import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

type RouteParams = { params: Promise<{ id: string }> }

const pickupSchema = z.object({
  user_id: z.string().uuid(),
})

/**
 * POST /api/scheduling/shifts/[id]/pickup — employee picks up an open shift
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

  const parsed = pickupSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Get shift
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: shift } = await (supabase.from('scheduled_shifts') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (!shift) {
    return apiError(404, 'Shift not found')
  }

  if (shift.user_id) {
    return apiError(409, 'Shift is already assigned')
  }

  // Check for conflicts: user already has a shift at overlapping time
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conflicts } = await (supabase.from('scheduled_shifts') as any)
    .select('id')
    .eq('user_id', parsed.data.user_id)
    .eq('org_id', user.org_id)
    .lt('start_time', shift.end_time)
    .gt('end_time', shift.start_time)
    .limit(1)

  if (conflicts && conflicts.length > 0) {
    return apiError(409, 'Employee has a conflicting shift at this time')
  }

  // Assign the shift
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase.from('scheduled_shifts') as any)
    .update({
      user_id: parsed.data.user_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return apiError(500, 'Failed to pick up shift')
  }

  return NextResponse.json({ data: updated })
}
