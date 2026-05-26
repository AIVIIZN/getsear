import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'

const HEARTBEAT_TIMEOUT_MS = 90000 // 90 seconds = 3 missed heartbeats
const DEGRADED_THRESHOLD_MS = 60000 // 60 seconds = intermittent

/**
 * GET /api/kds/stations/[id]/status — get station online/offline status
 *
 * Returns:
 *   is_online — true if heartbeat within 90s
 *   is_degraded — true if heartbeat between 60-90s
 *   last_heartbeat_at — ISO timestamp of last heartbeat
 *   failover_active — true if currently routing to backup printer
 *   backup_printer_id — configured backup printer ID (if any)
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
    .select('id, name, last_heartbeat_at, display_settings')
    .eq('id', id)
    .eq('org_id', user.org_id)
    .single()

  if (error || !station) {
    return apiError(404, 'Station not found')
  }

  const lastHeartbeat = station.last_heartbeat_at
    ? new Date(station.last_heartbeat_at).getTime()
    : 0
  const elapsed = Date.now() - lastHeartbeat
  const isOnline = elapsed < HEARTBEAT_TIMEOUT_MS
  const isDegraded = elapsed >= DEGRADED_THRESHOLD_MS && elapsed < HEARTBEAT_TIMEOUT_MS
  const failoverActive = !isOnline && !!(station.display_settings?.failover_printer_id)
  const backupPrinterId = station.display_settings?.failover_printer_id ?? null

  // Get live metrics if available
  const liveMetrics = station.display_settings?.live_metrics ?? null

  return NextResponse.json({
    data: {
      station_id: id,
      station_name: station.name,
      is_online: isOnline,
      is_degraded: isDegraded,
      last_heartbeat_at: station.last_heartbeat_at,
      failover_active: failoverActive,
      backup_printer_id: backupPrinterId,
      live_metrics: liveMetrics,
    },
  })
}
