import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

/**
 * GET /api/catering/calendar — calendar view data (events by date range)
 * Query params: start (YYYY-MM-DD), end (YYYY-MM-DD), location_id
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const params = request.nextUrl.searchParams
  const start = params.get('start')
  const end = params.get('end')
  const locationId = params.get('location_id')

  if (!start || !end) {
    return NextResponse.json(
      { error: 'start and end date params are required (YYYY-MM-DD)' },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('catering_events') as any)
    .select('id, event_name, event_date, event_time, guest_count, status, contact_name, total')
    .eq('org_id', user.org_id)
    .gte('event_date', start)
    .lte('event_date', end)
    .neq('status', 'cancelled')
    .order('event_date', { ascending: true })

  if (locationId) query = query.eq('location_id', locationId)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}
