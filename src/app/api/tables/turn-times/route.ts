import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const querySchema = z.object({
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  group_by: z.enum(['daypart', 'server', 'table', 'day_of_week']).default('daypart'),
  location_id: z.string().uuid().optional(),
})

/**
 * GET /api/tables/turn-times — Turn time reporting
 * Returns average turn time grouped by daypart, server, table, or day of week.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { date_from, date_to, group_by } = parsed.data
  const supabase = createAdminClient()

  // Query table_history for turn time data. Fetch related names separately:
  // production PostgREST relationship aliases have drifted before, and turn
  // coaching should not 500 because an embed cannot be resolved.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('table_history') as any)
    .select('id, table_id, server_id, seated_at, cleared_at, guest_count')
    .eq('org_id', user.org_id)
    .gte('seated_at', `${date_from}T00:00:00Z`)
    .lte('seated_at', `${date_to}T23:59:59Z`)
    .not('cleared_at', 'is', null)
    .order('seated_at', { ascending: false })
    .limit(1000)

  if (parsed.data.location_id) {
    query = query.eq('location_id', parsed.data.location_id)
  }

  const { data: records, error } = await query

  if (error) {
    return apiError(500, 'Failed to fetch turn times')
  }

  if (!records || records.length === 0) {
    return NextResponse.json({
      data: {
        summary: { avg_turn_time: 0, total_turns: 0, min_turn_time: 0, max_turn_time: 0 },
        grouped: [],
      },
    })
  }

  const rows = records as Array<{
    id: string
    table_id: string | null
    server_id: string | null
    seated_at: string
    cleared_at: string
    guest_count: number | null
  }>

  const tableIds = [...new Set(rows.map((record) => record.table_id).filter(Boolean))] as string[]
  const serverIds = [...new Set(rows.map((record) => record.server_id).filter(Boolean))] as string[]

  const tableMap = new Map<string, string>()
  if (tableIds.length > 0) {
    const { data: tables } = await supabase.from('tables')
      .select('id, name')
      .eq('org_id', user.org_id)
      .in('id', tableIds)

    for (const table of tables ?? []) {
      tableMap.set(table.id, table.name)
    }
  }

  const serverMap = new Map<string, string>()
  if (serverIds.length > 0) {
    const { data: users } = await supabase.from('users')
      .select('id, first_name, last_name, display_name')
      .eq('org_id', user.org_id)
      .in('id', serverIds)

    for (const server of users ?? []) {
      serverMap.set(
        server.id,
        server.display_name || `${server.first_name ?? ''} ${server.last_name ?? ''}`.trim() || 'Unknown',
      )
    }
  }

  // Calculate turn times
  const turnTimes = rows.map((r) => {
    const seatedAt = new Date(r.seated_at)
    const clearedAt = new Date(r.cleared_at)
    const turnMinutes = Math.round((clearedAt.getTime() - seatedAt.getTime()) / 60000)
    const hour = seatedAt.getHours()
    let daypart = 'dinner'
    if (hour >= 5 && hour < 10) daypart = 'breakfast'
    else if (hour >= 10 && hour < 11) daypart = 'brunch'
    else if (hour >= 11 && hour < 15) daypart = 'lunch'
    else if (hour >= 21) daypart = 'late_night'

    const dayOfWeek = seatedAt.toLocaleDateString('en-US', { weekday: 'long' })
    const tableName = r.table_id ? (tableMap.get(r.table_id) ?? 'Unknown') : 'Unknown'
    const serverName = r.server_id ? (serverMap.get(r.server_id) ?? 'Unknown') : 'Unknown'

    return {
      turn_minutes: turnMinutes,
      daypart,
      day_of_week: dayOfWeek,
      table_name: tableName,
      table_id: r.table_id,
      server_id: r.server_id,
      server_name: serverName,
      guest_count: r.guest_count ?? 0,
    }
  })

  // Overall summary
  const allTimes = turnTimes.map((t: { turn_minutes: number }) => t.turn_minutes)
  const summary = {
    avg_turn_time: Math.round(allTimes.reduce((a: number, b: number) => a + b, 0) / allTimes.length),
    total_turns: allTimes.length,
    min_turn_time: Math.min(...allTimes),
    max_turn_time: Math.max(...allTimes),
  }

  // Group by requested dimension
  const groupMap = new Map<string, number[]>()

  for (const t of turnTimes) {
    let key = ''
    switch (group_by) {
      case 'daypart':
        key = t.daypart
        break
      case 'server':
        key = t.server_name
        break
      case 'table':
        key = t.table_name
        break
      case 'day_of_week':
        key = t.day_of_week
        break
    }
    const existing = groupMap.get(key) ?? []
    existing.push(t.turn_minutes)
    groupMap.set(key, existing)
  }

  const grouped = Array.from(groupMap.entries()).map(([label, times]) => ({
    label,
    avg_turn_time: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    count: times.length,
    min: Math.min(...times),
    max: Math.max(...times),
  }))

  return NextResponse.json({ data: { summary, grouped } })
}
