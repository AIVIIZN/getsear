/**
 * Sync processor: processes queue entries by calling the appropriate API routes.
 * Runs only when online. Pauses if connection drops mid-sync.
 */

import {
  getNextBatch,
  markSyncing,
  markSynced,
  markFailed,
  markConflict,
  getPendingCount,
  acquireSyncLock,
  clearSyncedEntries,
} from './sync-queue'
import { processOrderSync } from './order-sync'
import { processPaymentSync } from './payment-sync'
import { processClockSync } from './clock-sync'
import { pingHealth } from './health-check'
import { createConflict } from './conflict-resolver'
import { useOfflineStore } from '@/stores/offline-store'
import type { SyncQueueEntry } from './db'

/** Whether the processor is currently running */
let isProcessing = false

/**
 * Process all pending sync queue entries.
 * Acquires a lock so only one tab processes at a time.
 * Updates the offline store with progress.
 */
export async function processSyncQueue(): Promise<{
  processed: number
  failed: number
  conflicts: number
}> {
  if (isProcessing) return { processed: 0, failed: 0, conflicts: 0 }

  const result = { processed: 0, failed: 0, conflicts: 0 }

  await acquireSyncLock(async () => {
    isProcessing = true
    const store = useOfflineStore.getState()

    try {
      // Verify we're actually online before starting
      const online = await pingHealth()
      if (!online) {
        isProcessing = false
        return
      }

      const totalPending = await getPendingCount()
      if (totalPending === 0) {
        isProcessing = false
        return
      }

      store.actions.setSyncing(true)
      store.actions.setSyncProgress(0, totalPending)

      let completed = 0

      // Process in batches until queue is empty
      while (true) {
        const batch = await getNextBatch()
        if (batch.length === 0) break

        // Check connectivity before each batch
        const stillOnline = await pingHealth()
        if (!stillOnline) {
          store.actions.setConnectionState('offline')
          store.actions.setBannerState('offline')
          break
        }

        for (const entry of batch) {
          try {
            await markSyncing(entry.id)
            await processEntry(entry)
            await markSynced(entry.id)
            result.processed++
            completed++
            store.actions.setSyncProgress(completed, totalPending)
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'

            if (isConflictError(errorMsg)) {
              await markConflict(entry.id, errorMsg)
              await recordConflict(entry, errorMsg)
              result.conflicts++
            } else {
              const isFinal = await markFailed(entry.id, errorMsg)
              if (isFinal) result.failed++
            }
          }
        }
      }

      // Clean up synced entries
      await clearSyncedEntries()

      // Update store
      store.actions.setSyncing(false)
      if (result.conflicts > 0) {
        store.actions.setBannerState('conflict')
      } else {
        store.actions.setBannerState('synced')
        // Auto-hide synced banner after 3 seconds
        setTimeout(() => {
          const current = useOfflineStore.getState()
          if (current.bannerState === 'synced') {
            current.actions.setBannerState('hidden')
          }
        }, 3000)
      }
      store.actions.setLastSyncAt(new Date().toISOString())

    } finally {
      isProcessing = false
    }
  })

  return result
}

async function recordConflict(entry: SyncQueueEntry, errorMsg: string): Promise<void> {
  await createConflict({
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    local_data: entry.payload,
    server_data: { error: errorMsg },
    description: `${entry.entity_type} sync conflict: ${errorMsg}. Review the local change against the current server state before retrying.`,
    location_id: entry.location_id,
  })
}

/**
 * Process a single sync queue entry by routing to the correct handler.
 */
async function processEntry(entry: SyncQueueEntry): Promise<void> {
  switch (entry.entity_type) {
    case 'order':
      await processOrderSync(entry)
      break
    case 'payment':
      await processPaymentSync(entry)
      break
    case 'time_entry':
      await processClockSync(entry)
      break
    case 'table':
      await processTableSync(entry)
      break
    default:
      throw new Error(`Unknown entity type: ${entry.entity_type}`)
  }
}

/**
 * Process a table status sync entry.
 *
 * V5.3.1: stamps the entry's `idempotency_key` onto the request so the
 * server's `withIdempotency` middleware dedupes replays.
 */
async function processTableSync(entry: SyncQueueEntry): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (entry.idempotency_key) headers['Idempotency-Key'] = entry.idempotency_key

  const response = await fetch(`/api/tables/${entry.entity_id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(entry.payload),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `Table sync failed: ${response.status}`)
  }
}

/**
 * Check if an error indicates a conflict (vs a transient failure).
 */
function isConflictError(error: string): boolean {
  const conflictIndicators = [
    'conflict',
    'already assigned',
    'table occupied',
    'version mismatch',
    'version_mismatch',
    'order_version_mismatch',
    '409',
  ]
  const lower = error.toLowerCase()
  return conflictIndicators.some((indicator) => lower.includes(indicator))
}

/**
 * Check if the processor is currently running.
 */
export function isProcessorRunning(): boolean {
  return isProcessing
}
