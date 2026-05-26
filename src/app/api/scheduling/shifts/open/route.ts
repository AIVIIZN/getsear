import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

/**
 * GET /api/scheduling/shifts/open — list open/unassigned shifts
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { searchParams } = new URL(request.url)
  const locationId = searchParams.get('location_id')

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('scheduled_shifts') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .is('user_id', null)
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true })

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data: shifts, error } = await query

  if (error) {
    return apiError(500, 'Failed to fetch open shifts')
  }

  return NextResponse.json({ data: shifts ?? [] })
}
