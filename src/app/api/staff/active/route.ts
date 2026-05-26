import { apiError } from '@/lib/api/error-response'
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
  const { data: activeEntries, error: entriesError } = await supabase.from('time_entries')
    .select('id, user_id, clock_in, location_id')
    .eq('org_id', user.org_id)
    .is('clock_out', null)

  if (entriesError) {
    return apiError(500, 'Failed to fetch active entries')
  }

  if (!activeEntries || activeEntries.length === 0) {
    return NextResponse.json({ data: [] })
  }

  const userIds = activeEntries.map((e: { user_id: string }) => e.user_id)

  const { data: staff, error: staffError } = await supabase.from('users')
    .select('id, first_name, last_name, display_name, avatar_url, role')
    .in('id', userIds)
    .eq('is_active', true)

  if (staffError) {
    return apiError(500, 'Failed to fetch staff')
  }

  type ActiveEntry = { id: string; user_id: string; clock_in: string | null; location_id: string | null }
  const entryMap = new Map(activeEntries.map((e: ActiveEntry) => [e.user_id, e]))

  type StaffRow = { id: string; first_name: string; last_name: string; display_name: string | null; avatar_url: string | null; role: string }
  const result = (staff ?? []).map((s: StaffRow) => {
    const entry = entryMap.get(s.id)
    return {
      ...s,
      clock_in: entry?.clock_in ?? null,
      time_entry_id: entry?.id ?? null,
      location_id: entry?.location_id ?? null,
    }
  })

  return NextResponse.json({ data: result })
}
