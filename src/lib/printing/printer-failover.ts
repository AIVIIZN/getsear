/**
 * Kitchen Printer Failover Manager
 *
 * Monitors KDS station heartbeats and automatically reroutes print jobs
 * to fallback printers when a station goes offline. Uses Supabase Realtime
 * for instant offline detection and a periodic health check as a safety net.
 *
 * Fallback chain: Primary KDS -> Backup Printer -> Expo Printer -> Error banner
 */

import { createAdminClient } from '@/lib/supabase/admin'

const HEARTBEAT_TIMEOUT_MS = 60000 // 60 seconds — station considered offline
const HEALTH_CHECK_INTERVAL_MS = 15000 // Check every 15 seconds

type StationStatus = 'online' | 'offline' | 'degraded'

interface StationInfo {
  id: string
  name: string
  stationType: string
  status: StationStatus
  lastHeartbeatAt: string | null
  primaryPrinterId: string | null
  fallbackPrinterId: string | null
  expoPrinterId: string | null
}

interface FailoverEvent {
  stationId: string
  stationName: string
  primaryPrinterId: string
  fallbackPrinterId: string
  reason: string
  startedAt: string
  resolvedAt: string | null
}

interface FailoverCallbacks {
  onStationOffline?: (station: StationInfo, fallbackPrinterId: string | null) => void
  onStationOnline?: (station: StationInfo) => void
  onFailoverError?: (station: StationInfo, error: string) => void
}

export class PrinterFailoverManager {
  private locationId: string
  private orgId: string
  private stationStatuses: Map<string, StationInfo> = new Map()
  private activeFailovers: Map<string, FailoverEvent> = new Map()
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private realtimeSubscription: any = null
  private monitoring = false
  private callbacks: FailoverCallbacks = {}

  constructor(
    orgId: string,
    locationId: string,
    callbacks: FailoverCallbacks = {}
  ) {
    this.orgId = orgId
    this.locationId = locationId
    this.callbacks = callbacks
  }

  /**
   * Start monitoring all KDS stations at this location.
   */
  async startMonitoring(): Promise<void> {
    if (this.monitoring) return
    this.monitoring = true

    // Initial health check
    await this.performHealthCheck()

    // Periodic health check as safety net
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck()
    }, HEALTH_CHECK_INTERVAL_MS)

    // Subscribe to realtime heartbeat updates
    this.subscribeToHeartbeats()
  }

  /**
   * Stop monitoring and clean up.
   */
  stopMonitoring(): void {
    this.monitoring = false

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }

    if (this.realtimeSubscription) {
      const supabase = createAdminClient()
      supabase.removeChannel(this.realtimeSubscription)
      this.realtimeSubscription = null
    }
  }

  /**
   * Get the current status of all monitored stations.
   */
  getStationStatuses(): StationInfo[] {
    return Array.from(this.stationStatuses.values())
  }

  /**
   * Get all currently active failover events.
   */
  getActiveFailovers(): FailoverEvent[] {
    return Array.from(this.activeFailovers.values())
  }

  /**
   * Check whether monitoring is active.
   */
  get isMonitoring(): boolean {
    return this.monitoring
  }

  /**
   * Perform a health check on all stations at this location.
   */
  private async performHealthCheck(): Promise<void> {
    const supabase = createAdminClient()
    const now = Date.now()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: stations, error } = await (supabase.from('kds_stations') as any)
      .select('id, name, station_type, last_heartbeat_at, terminal_id, display_settings, is_active')
      .eq('location_id', this.locationId)
      .eq('is_active', true)

    if (error || !stations) return

    for (const station of stations as Array<{
      id: string
      name: string
      station_type: string
      last_heartbeat_at: string | null
      terminal_id: string | null
      display_settings: Record<string, unknown> | null
    }>) {
      const lastHeartbeat = station.last_heartbeat_at
        ? new Date(station.last_heartbeat_at).getTime()
        : 0
      const elapsed = now - lastHeartbeat

      const displaySettings = station.display_settings ?? {}
      const fallbackPrinterId = (displaySettings.failover_printer_id as string) ?? null
      const expoPrinterId = (displaySettings.expo_printer_id as string) ?? null
      const primaryPrinterId = (displaySettings.primary_printer_id as string) ?? station.terminal_id

      const prevStatus = this.stationStatuses.get(station.id)?.status

      let newStatus: StationStatus
      if (elapsed > HEARTBEAT_TIMEOUT_MS) {
        newStatus = 'offline'
      } else if (elapsed > HEARTBEAT_TIMEOUT_MS * 0.75) {
        newStatus = 'degraded'
      } else {
        newStatus = 'online'
      }

      const stationInfo: StationInfo = {
        id: station.id,
        name: station.name,
        stationType: station.station_type,
        status: newStatus,
        lastHeartbeatAt: station.last_heartbeat_at,
        primaryPrinterId,
        fallbackPrinterId,
        expoPrinterId,
      }

      this.stationStatuses.set(station.id, stationInfo)

      // State transitions
      if (newStatus === 'offline' && prevStatus !== 'offline') {
        await this.handleStationOffline(stationInfo)
      } else if (newStatus === 'online' && prevStatus === 'offline') {
        await this.handleStationOnline(stationInfo)
      }
    }
  }

  /**
   * Handle a station going offline — activate failover chain.
   */
  private async handleStationOffline(station: StationInfo): Promise<void> {
    // Determine fallback printer using the chain:
    // Primary KDS -> Backup Printer -> Expo Printer -> Error
    const fallbackPrinterId = station.fallbackPrinterId ?? station.expoPrinterId

    if (!fallbackPrinterId) {
      this.callbacks.onFailoverError?.(
        station,
        `No fallback printer configured for ${station.name}`
      )
      return
    }

    // Record the failover event
    const failoverEvent: FailoverEvent = {
      stationId: station.id,
      stationName: station.name,
      primaryPrinterId: station.primaryPrinterId ?? station.id,
      fallbackPrinterId,
      reason: 'KDS station heartbeat timeout',
      startedAt: new Date().toISOString(),
      resolvedAt: null,
    }

    this.activeFailovers.set(station.id, failoverEvent)

    // Log to database
    await this.logFailoverEvent(failoverEvent)

    // Notify callback
    this.callbacks.onStationOffline?.(station, fallbackPrinterId)
  }

  /**
   * Handle a station coming back online — resolve failover.
   */
  private async handleStationOnline(station: StationInfo): Promise<void> {
    const failover = this.activeFailovers.get(station.id)
    if (failover) {
      failover.resolvedAt = new Date().toISOString()

      // Update the failover log in the database
      await this.resolveFailoverEvent(station.id, failover.resolvedAt)

      this.activeFailovers.delete(station.id)
    }

    // Notify callback
    this.callbacks.onStationOnline?.(station)
  }

  /**
   * Subscribe to Supabase Realtime for station heartbeat changes.
   */
  private subscribeToHeartbeats(): void {
    const supabase = createAdminClient()

    this.realtimeSubscription = supabase
      .channel(`failover-monitor:${this.locationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'kds_stations',
          filter: `location_id=eq.${this.locationId}`,
        },
        (payload) => {
          const station = payload.new as {
            id: string
            name: string
            station_type: string
            last_heartbeat_at: string | null
            display_settings: Record<string, unknown> | null
            terminal_id: string | null
          }

          const displaySettings = station.display_settings ?? {}
          const now = Date.now()
          const lastHeartbeat = station.last_heartbeat_at
            ? new Date(station.last_heartbeat_at).getTime()
            : 0
          const elapsed = now - lastHeartbeat

          let newStatus: StationStatus
          if (elapsed > HEARTBEAT_TIMEOUT_MS) {
            newStatus = 'offline'
          } else if (elapsed > HEARTBEAT_TIMEOUT_MS * 0.75) {
            newStatus = 'degraded'
          } else {
            newStatus = 'online'
          }

          const prevStatus = this.stationStatuses.get(station.id)?.status

          const stationInfo: StationInfo = {
            id: station.id,
            name: station.name,
            stationType: station.station_type,
            status: newStatus,
            lastHeartbeatAt: station.last_heartbeat_at,
            primaryPrinterId: (displaySettings.primary_printer_id as string) ?? station.terminal_id,
            fallbackPrinterId: (displaySettings.failover_printer_id as string) ?? null,
            expoPrinterId: (displaySettings.expo_printer_id as string) ?? null,
          }

          this.stationStatuses.set(station.id, stationInfo)

          // Handle state transitions
          if (newStatus === 'offline' && prevStatus !== 'offline') {
            this.handleStationOffline(stationInfo)
          } else if (newStatus === 'online' && prevStatus === 'offline') {
            this.handleStationOnline(stationInfo)
          }
        }
      )
      .subscribe()
  }

  /**
   * Log a failover event to the print_failover_log table.
   */
  private async logFailoverEvent(event: FailoverEvent): Promise<void> {
    const supabase = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('print_failover_log') as any).insert({
      org_id: this.orgId,
      location_id: this.locationId,
      station_name: event.stationName,
      station_id: event.stationId,
      primary_printer_id: event.primaryPrinterId,
      fallback_printer_id: event.fallbackPrinterId,
      reason: event.reason,
      started_at: event.startedAt,
      resolved_at: null,
    })
  }

  /**
   * Mark a failover event as resolved in the database.
   */
  private async resolveFailoverEvent(stationId: string, resolvedAt: string): Promise<void> {
    const supabase = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('print_failover_log') as any)
      .update({ resolved_at: resolvedAt })
      .eq('station_id', stationId)
      .eq('location_id', this.locationId)
      .is('resolved_at', null)
  }
}
