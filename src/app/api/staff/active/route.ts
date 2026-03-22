import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

/**
 * GET /api/staff/active — list currently clocked-in staff (for PIN login grid)
 */
export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const supabase = createAdminClient()

  // Find all active time entries (no clock_out) for this org
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: activeEntries, error: entriesError } = await (supabase.from('time_entries') as any)
    .select('id, user_id, clock_in, location_id')
    .eq('org_id', user.org_id)
    .is('clock_out', null)

  if (entriesError) {
    return NextResponse.json({ error: 'Failed to fetch active entries' }, { status: 500 })
  }

  if (!activeEntries || activeEntries.length === 0) {
    return NextResponse.json({ data: [] })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userIds = activeEntries.map((e: any) => e.user_id)

  const { data: staff, error: staffError } = await (supabase.from('users') as any)
    .select('id, first_name, last_name, display_name, avatar_url, role')
    .in('id', userIds)
    .eq('is_active', true)

  if (staffError) {
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entryMap = new Map(activeEntries.map((e: any) => [e.user_id, e]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (staff ?? []).map((s: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entry = entryMap.get(s.id) as any
    return {
      ...s,
      clock_in: entry?.clock_in ?? null,
      time_entry_id: entry?.id ?? null,
      location_id: entry?.location_id ?? null,
    }
  })

  return NextResponse.json({ data: result })
}
