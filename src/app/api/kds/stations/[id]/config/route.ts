import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

const agingThresholdSchema = z.object({
  menu_category_id: z.string().uuid(),
  menu_category_name: z.string().optional(),
  fresh_max_seconds: z.number().int().min(60).max(7200),
  aging_max_seconds: z.number().int().min(60).max(7200),
  critical_max_seconds: z.number().int().min(60).max(7200),
})

const updateConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  station_type: z.enum(['prep', 'expo']).optional(),
  display_columns: z.number().int().min(2).max(6).optional(),
  font_size: z.enum(['small', 'medium', 'large', 'xlarge']).optional(),
  sound_enabled: z.boolean().optional(),
  sound_volume: z.number().min(0).max(1).optional(),
  failover_printer_id: z.string().uuid().nullable().optional(),
  max_capacity: z.number().int().min(1).max(500).optional(),
  default_fresh_max: z.number().int().min(60).max(7200).optional(),
  default_aging_max: z.number().int().min(60).max(7200).optional(),
  default_critical_max: z.number().int().min(60).max(7200).optional(),
  category_thresholds: z.array(agingThresholdSchema).optional(),
  kitchen_close_auto_minutes: z.number().int().min(0).max(480).optional(),
})

/**
 * GET /api/kds/stations/[id]/config — get station configuration
 *
 * Returns full station config including aging thresholds, display settings,
 * failover config, and category-specific thresholds.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const { id } = await params
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station, error } = await (supabase.from('kds_stations') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !station) {
    return apiError(404, 'Station not found')
  }

  const settings = station.display_settings ?? {}

  return NextResponse.json({
    data: {
      id: station.id,
      name: station.name,
      station_type: station.station_type,
      location_id: station.location_id,
      is_active: station.is_active,
      sort_order: station.sort_order,
      prep_stations: station.prep_stations ?? [],
      display_columns: settings.columns ?? 4,
      font_size: settings.font_size ?? 'medium',
      sound_enabled: settings.sound_enabled ?? true,
      sound_volume: settings.sound_volume ?? 0.5,
      failover_printer_id: settings.failover_printer_id ?? null,
      max_capacity: settings.max_capacity ?? 50,
      default_fresh_max: settings.aging_thresholds?.fresh ?? 300,
      default_aging_max: settings.aging_thresholds?.aging ?? 600,
      default_critical_max: settings.aging_thresholds?.critical ?? 900,
      category_thresholds: settings.category_thresholds ?? [],
      kitchen_close_auto_minutes: settings.kitchen_close_auto_minutes ?? 0,
      last_heartbeat_at: station.last_heartbeat_at,
    },
  })
}

/**
 * PUT /api/kds/stations/[id]/config — update station configuration
 *
 * Requires manager role or higher.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = updateConfigSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()

  // Fetch current station
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: station, error: fetchError } = await (supabase.from('kds_stations') as any)
    .select('*')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (fetchError || !station) {
    return apiError(404, 'Station not found')
  }

  const {
    name,
    station_type,
    display_columns,
    font_size,
    sound_enabled,
    sound_volume,
    failover_printer_id,
    max_capacity,
    default_fresh_max,
    default_aging_max,
    default_critical_max,
    category_thresholds,
    kitchen_close_auto_minutes,
  } = parsed.data

  // Build updated display_settings
  const currentSettings = station.display_settings ?? {}
  const updatedSettings = {
    ...currentSettings,
    ...(display_columns !== undefined && { columns: display_columns }),
    ...(font_size !== undefined && { font_size }),
    ...(sound_enabled !== undefined && { sound_enabled }),
    ...(sound_volume !== undefined && { sound_volume }),
    ...(failover_printer_id !== undefined && { failover_printer_id }),
    ...(max_capacity !== undefined && { max_capacity }),
    ...(kitchen_close_auto_minutes !== undefined && { kitchen_close_auto_minutes }),
    aging_thresholds: {
      ...(currentSettings.aging_thresholds ?? {}),
      ...(default_fresh_max !== undefined && { fresh: default_fresh_max }),
      ...(default_aging_max !== undefined && { aging: default_aging_max }),
      ...(default_critical_max !== undefined && { critical: default_critical_max }),
    },
    ...(category_thresholds !== undefined && { category_thresholds }),
  }

  // Build update payload for the station record itself
  const stationUpdate: Record<string, unknown> = {
    display_settings: updatedSettings,
    updated_at: new Date().toISOString(),
  }

  if (name !== undefined) stationUpdate.name = name
  if (station_type !== undefined) stationUpdate.station_type = station_type

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error: updateError } = await (supabase.from('kds_stations') as any)
    .update(stationUpdate)
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return apiError(500, 'Failed to update station config')
  }

  // Broadcast config update so running KDS clients pick it up on next heartbeat
  if (station.location_id) {
    const channel = supabase.channel(`kds_stations:${station.location_id}`)
    await channel.send({
      type: 'broadcast',
      event: 'station_config_updated',
      payload: {
        station_id: id,
        updated_at: new Date().toISOString(),
      },
    })
  }

  return NextResponse.json({ data: updated })
}
