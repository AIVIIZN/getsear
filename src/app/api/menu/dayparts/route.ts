import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { parseTimeToMinutes } from '@/lib/menu/daypart-engine'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/

const createDaypartSchema = z.object({
  location_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  start_time: z.string().regex(timeRegex, 'Must be HH:MM (24h)'),
  end_time: z.string().regex(timeRegex, 'Must be HH:MM (24h)'),
  days: z.array(z.number().int().min(0).max(6)).min(1, 'At least one day required'),
  sections: z.array(z.string().max(50)).default([]),
  is_active: z.boolean().default(true),
})

// ---------------------------------------------------------------------------
// Overlap detection
// ---------------------------------------------------------------------------

interface DaypartRow {
  id: string
  start_time: string
  end_time: string
  days: number[]
  sections: string[]
}

function daypartsOverlap(a: DaypartRow, b: DaypartRow): boolean {
  // Check day overlap first
  const sharedDays = a.days.filter((d) => b.days.includes(d))
  if (sharedDays.length === 0) return false

  // Check section overlap: empty sections = "all", so overlaps with everything
  if (a.sections.length > 0 && b.sections.length > 0) {
    const sharedSections = a.sections.filter((s) => b.sections.includes(s))
    if (sharedSections.length === 0) return false
  }

  // Check time overlap (handle overnight)
  const aStart = parseTimeToMinutes(a.start_time)
  const aEnd = parseTimeToMinutes(a.end_time)
  const bStart = parseTimeToMinutes(b.start_time)
  const bEnd = parseTimeToMinutes(b.end_time)

  // Expand overnight ranges for comparison
  const aRanges = aEnd > aStart
    ? [{ start: aStart, end: aEnd }]
    : [{ start: aStart, end: 1440 }, { start: 0, end: aEnd }]

  const bRanges = bEnd > bStart
    ? [{ start: bStart, end: bEnd }]
    : [{ start: bStart, end: 1440 }, { start: 0, end: bEnd }]

  for (const ar of aRanges) {
    for (const br of bRanges) {
      if (ar.start < br.end && br.start < ar.end) {
        return true
      }
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// GET /api/menu/dayparts — List dayparts for a location
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const locationId = request.nextUrl.searchParams.get('location_id')
  if (!locationId) {
    return NextResponse.json({ error: 'location_id is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('menu_dayparts')
    .select('*')
    .eq('org_id', user.org_id)
    .eq('location_id', locationId)
    .order('start_time', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch dayparts' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

// ---------------------------------------------------------------------------
// POST /api/menu/dayparts — Create a new daypart
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createDaypartSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()

  // Check for overlapping dayparts in the same location
  const { data: existing } = await supabase
    .from('menu_dayparts')
    .select('id, start_time, end_time, days, sections')
    .eq('org_id', user.org_id)
    .eq('location_id', parsed.data.location_id)
    .eq('is_active', true)

  if (existing) {
    const newDaypart: DaypartRow = {
      id: '',
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
      days: parsed.data.days,
      sections: parsed.data.sections,
    }

    for (const ex of existing) {
      if (daypartsOverlap(ex as DaypartRow, newDaypart)) {
        return NextResponse.json(
          {
            error: `Overlaps with existing daypart "${(ex as DaypartRow & { name?: string }).id}". Dayparts cannot overlap for the same section and day.`,
          },
          { status: 409 },
        )
      }
    }
  }

  const { data, error } = await supabase
    .from('menu_dayparts')
    .insert({
      org_id: user.org_id,
      ...parsed.data,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create daypart' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
