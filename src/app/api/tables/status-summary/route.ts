import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

/**
 * GET /api/tables/status-summary — count of tables by status
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('location_id') ?? user.location_ids[0]
  const floorPlanId = searchParams.get('floor_plan_id')

  if (!locationId) {
    return apiError(400, 'location_id is required')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('tables') as any)
    .select('status')
    .eq('org_id', user.org_id)
    .eq('location_id', locationId)
    .eq('is_active', true)

  if (floorPlanId) {
    query = query.eq('floor_plan_id', floorPlanId)
  }

  const { data, error } = await query

  if (error) {
    return apiError(500, 'Failed to fetch status summary')
  }

  // Count by status
  const counts: Record<string, number> = {}
  const allStatuses = [
    'available', 'seated', 'ordered', 'served',
    'check_presented', 'dirty', 'reserved', 'needs_attention',
  ]

  for (const status of allStatuses) {
    counts[status] = 0
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    const status = row.status as string
    counts[status] = (counts[status] ?? 0) + 1
  }

  return NextResponse.json({
    data: {
      counts,
      total: (data ?? []).length,
    },
  })
}
