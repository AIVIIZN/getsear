import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const publishSchema = z.object({
  location_id: z.string().uuid(),
  week_start: z.string(),
})

/**
 * POST /api/scheduling/publish — publish schedule for a week
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = publishSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { location_id, week_start } = parsed.data
  const supabase = createAdminClient()

  // Calculate week end
  const startDate = new Date(week_start + 'T00:00:00Z')
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 7)
  const weekEnd = endDate.toISOString().split('T')[0]

  const now = new Date().toISOString()

  // Set published_at on all draft shifts for the week
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (supabase.from('scheduled_shifts') as any)
    .update({ published_at: now, updated_at: now })
    .eq('org_id', user.org_id)
    .eq('location_id', location_id)
    .gte('start_time', `${week_start}T00:00:00Z`)
    .lt('start_time', `${weekEnd}T00:00:00Z`)
    .is('published_at', null)
    .select('id, user_id')

  if (error) {
    return apiError(500, 'Failed to publish schedule')
  }

  const publishedCount = updated?.length ?? 0

  // Get unique users to notify
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const affectedUserIds = [...new Set((updated ?? []).map((s: any) => s.user_id).filter(Boolean))]

  return NextResponse.json({
    data: {
      success: true,
      publishedShifts: publishedCount,
      affectedEmployees: affectedUserIds.length,
      weekStart: week_start,
    },
  })
}
