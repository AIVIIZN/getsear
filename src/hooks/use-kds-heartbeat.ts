'use client'

import { useEffect, useRef, useCallback } from 'react'

const HEARTBEAT_INTERVAL_MS = 30000 // 30 seconds

interface HeartbeatPayload {
  active_ticket_count: number
  active_item_count: number
  utilization_pct: number
}

interface HeartbeatResponse {
  data: {
    station_id: string
    heartbeat_at: string
    config: Record<string, unknown>
    was_offline: boolean
  }
}

/**
 * Hook that sends POST /api/kds/stations/[id]/heartbeat every 30 seconds.
 * Includes live station metrics. Receives back configuration updates.
 *
 * @param stationId - The station ID to send heartbeats for
 * @param getMetrics - Function that returns current station metrics
 * @param onConfigUpdate - Callback when config changes are received
 * @param onRecovery - Callback when station recovers from offline state
 */
export function useKdsHeartbeat(
  stationId: string | null,
  getMetrics: () => HeartbeatPayload,
  onConfigUpdate?: (config: Record<string, unknown>) => void,
  onRecovery?: () => void
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const getMetricsRef = useRef(getMetrics)
  const onConfigUpdateRef = useRef(onConfigUpdate)
  const onRecoveryRef = useRef(onRecovery)

  // Keep refs current
  getMetricsRef.current = getMetrics
  onConfigUpdateRef.current = onConfigUpdate
  onRecoveryRef.current = onRecovery

  const sendHeartbeat = useCallback(async () => {
    if (!stationId) return

    try {
      const metrics = getMetricsRef.current()

      const res = await fetch(`/api/kds/stations/${stationId}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metrics),
      })

      if (res.ok) {
        const json: HeartbeatResponse = await res.json()

        // If the server says we were offline, trigger recovery
        if (json.data.was_offline && onRecoveryRef.current) {
          onRecoveryRef.current()
        }

        // If config has changed, notify the consumer
        if (json.data.config && onConfigUpdateRef.current) {
          onConfigUpdateRef.current(json.data.config)
        }
      }
    } catch {
      // Heartbeat failed — network issue. Next heartbeat will retry.
      console.warn('[KDS Heartbeat] Failed to send heartbeat')
    }
  }, [stationId])

  useEffect(() => {
    if (!stationId) return

    // Send initial heartbeat immediately
    sendHeartbeat()

    // Set up interval
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [stationId, sendHeartbeat])
}
