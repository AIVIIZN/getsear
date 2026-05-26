import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

type RouteContext = { params: Promise<{ userId: string }> }

/**
 * GET /api/scheduling/availability/:userId — get availability for a specific user
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { userId } = await context.params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('staff_availability') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .eq('user_id', userId)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    return apiError(500, 'Failed to fetch availability')
  }

  return NextResponse.json({ data: data ?? [] })
}
