import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const createStationSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['prep', 'expo']),
  location_id: z.string().uuid(),
  sort_order: z.number().int().min(0).optional().default(0),
  is_active: z.boolean().optional().default(true),
  settings: z
    .object({
      columns: z.number().int().min(1).max(8).optional(),
      font_size: z.enum(['small', 'medium', 'large']).optional(),
      sound_enabled: z.boolean().optional(),
      aging_thresholds: z
        .object({
          aging: z.number().int().optional(),
          late: z.number().int().optional(),
          critical: z.number().int().optional(),
        })
        .optional(),
      prep_stations: z.array(z.string()).optional(),
    })
    .optional()
    .default({
      columns: 4,
      font_size: 'medium',
      sound_enabled: true,
      prep_stations: [],
    }),
})

/**
 * GET /api/kds/stations — list KDS stations for location
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const locationId = request.nextUrl.searchParams.get('location_id')

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('kds_stations') as any)
    .select('*')
    .eq('org_id', user.org_id)
    .order('sort_order', { ascending: true })

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch KDS stations' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

/**
 * POST /api/kds/stations — create a KDS station
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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createStationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { name, location_id, sort_order, is_active, settings } = parsed.data
  const stationType = parsed.data.type
  const { prep_stations, ...displaySettings } = settings

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('kds_stations') as any)
    .insert({
      org_id: user.org_id,
      name,
      station_type: stationType,
      location_id,
      sort_order,
      is_active,
      prep_stations: prep_stations ?? [],
      display_settings: displaySettings,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create KDS station' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
