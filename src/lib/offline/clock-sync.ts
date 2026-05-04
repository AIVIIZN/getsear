/**
 * Clock in/out sync with time drift detection.
 * Offline clock entries use device time. On sync, compares to server time.
 * If drift >2 minutes, flags entry for manager review.
 */

import type { SyncQueueEntry } from './db'
import { getTimeDrift } from './health-check'

/** Maximum acceptable time drift in milliseconds (2 minutes) */
const MAX_DRIFT_MS = 2 * 60 * 1000

/**
 * Process a clock in/out sync entry.
 */
export async function processClockSync(entry: SyncQueueEntry): Promise<void> {
  const payload = entry.payload

  // Check time drift
  const drift = await getTimeDrift()
  const isDrifted = drift !== null && Math.abs(drift) > MAX_DRIFT_MS

  const endpoint = entry.operation === 'clock_in'
    ? '/api/staff/clock-in'
    : '/api/staff/clock-out'

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (entry.idempotency_key) headers['Idempotency-Key'] = entry.idempotency_key

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...payload,
      client_id: entry.entity_id,
      offline_created: true,
      time_drift_ms: drift,
      needs_review: isDrifted,
      device_time: payload.timestamp,
      notes: isDrifted
        ? `[OFFLINE] Clock ${entry.operation === 'clock_in' ? 'in' : 'out'} recorded offline. Device time drift: ${Math.round((drift ?? 0) / 1000)}s. Flagged for manager review.`
        : `[OFFLINE] Clock ${entry.operation === 'clock_in' ? 'in' : 'out'} recorded offline.`,
    }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    if (response.status === 409) return // Already recorded
    throw new Error(body.error ?? `Clock sync failed: ${response.status}`)
  }
}

/**
 * Create an offline clock-in entry in the sync queue.
 * Used by the clock-in UI when offline.
 */
export function buildClockInPayload(params: {
  staff_id: string
  location_id: string
  pin_validated: boolean
}): Record<string, unknown> {
  return {
    staff_id: params.staff_id,
    location_id: params.location_id,
    timestamp: new Date().toISOString(),
    pin_validated_offline: params.pin_validated,
    device_time: Date.now(),
  }
}

/**
 * Create an offline clock-out entry in the sync queue.
 */
export function buildClockOutPayload(params: {
  staff_id: string
  location_id: string
  time_entry_id?: string
}): Record<string, unknown> {
  return {
    staff_id: params.staff_id,
    location_id: params.location_id,
    time_entry_id: params.time_entry_id,
    timestamp: new Date().toISOString(),
    device_time: Date.now(),
  }
}
