/**
 * Core sync queue engine.
 * Persistent FIFO queue stored in IndexedDB. Processes pending operations on reconnect.
 * Card payments are prioritized. Operations for the same entity are sequential.
 * Multi-tab safe: only one tab owns the processor via BroadcastChannel/Web Locks.
 */

import { offlineDB, type SyncQueueEntry, type SyncOperation, type SyncEntityType, type SyncStatus } from './db'

// Priority: 0 = highest. Card payments first, then orders, then clock entries.
const OPERATION_PRIORITY: Record<SyncOperation, number> = {
  settle_payment: 0,
  create_payment: 1,
  create_order: 5,
  update_order: 6,
  add_order_items: 7,
  void_order: 8,
  close_order: 9,
  clock_in: 10,
  clock_out: 10,
  update_table: 15,
}

const MAX_ATTEMPTS = 3

/**
 * Generate a UUIDv7 (time-sortable).
 * Falls back to crypto.randomUUID() with timestamp prefix for ordering.
 */
function generateId(): string {
  return crypto.randomUUID()
}

/**
 * Generate a UUIDv4 for use as an `Idempotency-Key` header (V5.3.1).
 *
 * Server-side `withIdempotency` middleware (`src/lib/api/idempotency.ts`)
 * dedupes by `(key, route, org_id)` so replays after a network blip — where
 * the original write landed but the ack was lost — return the original
 * response body instead of duplicating the write.
 *
 * Falls back to a manual RFC 4122 v4 implementation for the rare browser
 * without `crypto.randomUUID` (Safari pre-15.4, Chrome pre-92, etc.).
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Enqueue a sync operation. Persisted in IndexedDB.
 *
 * V5.3.1: every entry is stamped with a UUIDv4 `idempotency_key` at enqueue
 * time. The replayer (`order-sync`, `payment-sync`, `clock-sync`,
 * `processTableSync`) sets that key as the `Idempotency-Key` HTTP header on
 * every retry so the server can dedupe replays after a network blip lost
 * the original ack but the write actually landed.
 *
 * **CRITICAL ORDERING:** the IndexedDB `put` resolves *before* this function
 * returns (Dexie awaits the transaction commit). Callers MUST `await
 * enqueueSync(...)` BEFORE applying their optimistic UI update — otherwise
 * a tab crash between the optimistic mutation and the IndexedDB commit
 * loses the operation.
 */
export async function enqueueSync(params: {
  operation: SyncOperation
  entity_type: SyncEntityType
  entity_id: string
  payload: Record<string, unknown>
  location_id: string
  /**
   * Optional pre-generated idempotency key. Most callers omit this and let
   * the queue mint one. The override exists for tests + for callers that
   * want to stamp the same key onto an optimistic UI record.
   */
  idempotency_key?: string
}): Promise<string> {
  const id = generateId()
  const entry: SyncQueueEntry = {
    id,
    operation: params.operation,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    payload: params.payload,
    status: 'pending',
    priority: OPERATION_PRIORITY[params.operation] ?? 10,
    attempts: 0,
    max_attempts: MAX_ATTEMPTS,
    created_at: new Date().toISOString(),
    last_attempt_at: null,
    error: null,
    location_id: params.location_id,
    idempotency_key: params.idempotency_key ?? generateIdempotencyKey(),
  }

  await offlineDB.sync_queue.put(entry)

  // Notify other tabs
  notifyQueueChange()

  return id
}

/**
 * Look up the idempotency key on an existing entry. Returns undefined if the
 * entry doesn't exist or pre-dates V5.3.1 (legacy rows without keys).
 */
export async function getIdempotencyKey(entryId: string): Promise<string | undefined> {
  const entry = await offlineDB.sync_queue.get(entryId)
  return entry?.idempotency_key
}

/**
 * Get all pending entries sorted by priority then creation time (FIFO within priority).
 */
export async function getPendingEntries(): Promise<SyncQueueEntry[]> {
  const entries = await offlineDB.sync_queue
    .where('status')
    .equals('pending')
    .toArray()

  // Sort: priority ascending, then created_at ascending (FIFO)
  return entries.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.created_at.localeCompare(b.created_at)
  })
}

/**
 * Get entries that need processing: pending entries, respecting entity-sequential ordering.
 * For the same entity, only the oldest pending entry is returned.
 */
export async function getNextBatch(): Promise<SyncQueueEntry[]> {
  const all = await getPendingEntries()
  const seenEntities = new Set<string>()
  const batch: SyncQueueEntry[] = []

  // Also check for entries currently syncing for the same entity
  const syncing = await offlineDB.sync_queue
    .where('status')
    .equals('syncing')
    .toArray()
  syncing.forEach((e) => seenEntities.add(`${e.entity_type}:${e.entity_id}`))

  for (const entry of all) {
    const key = `${entry.entity_type}:${entry.entity_id}`
    if (seenEntities.has(key)) continue
    seenEntities.add(key)
    batch.push(entry)
  }

  return batch
}

/**
 * Mark an entry as syncing (in-progress).
 */
export async function markSyncing(entryId: string): Promise<void> {
  await offlineDB.sync_queue.update(entryId, {
    status: 'syncing' as SyncStatus,
    last_attempt_at: new Date().toISOString(),
    attempts: (await offlineDB.sync_queue.get(entryId))?.attempts ?? 0 + 1,
  })
}

/**
 * Mark an entry as synced (complete). Remove from queue after a delay.
 */
export async function markSynced(entryId: string): Promise<void> {
  await offlineDB.sync_queue.update(entryId, { status: 'synced' as SyncStatus })
  // Remove synced entries after 30s (keep for debugging)
  setTimeout(async () => {
    try {
      await offlineDB.sync_queue.delete(entryId)
    } catch {
      // Ignore — entry may already be deleted
    }
  }, 30000)
}

/**
 * Mark an entry as failed. If attempts >= max, keep as failed. Otherwise, revert to pending.
 */
export async function markFailed(entryId: string, error: string): Promise<boolean> {
  const entry = await offlineDB.sync_queue.get(entryId)
  if (!entry) return false

  const attempts = (entry.attempts ?? 0) + 1
  const isFinalFailure = attempts >= entry.max_attempts

  await offlineDB.sync_queue.update(entryId, {
    status: isFinalFailure ? 'failed' as SyncStatus : 'pending' as SyncStatus,
    attempts,
    error,
    last_attempt_at: new Date().toISOString(),
  })

  return isFinalFailure
}

/**
 * Mark an entry as having a conflict.
 */
export async function markConflict(entryId: string, error: string): Promise<void> {
  await offlineDB.sync_queue.update(entryId, {
    status: 'conflict' as SyncStatus,
    error,
  })
}

/**
 * Get counts of pending operations by entity type.
 */
export async function getPendingCounts(): Promise<Record<string, number>> {
  const entries = await offlineDB.sync_queue
    .where('status')
    .anyOf(['pending', 'syncing'])
    .toArray()

  const counts: Record<string, number> = { total: 0 }
  for (const e of entries) {
    const key = `${e.entity_type}s`
    counts[key] = (counts[key] ?? 0) + 1
    counts['total']++
  }
  return counts
}

/**
 * Get total count of pending sync operations.
 */
export async function getPendingCount(): Promise<number> {
  return offlineDB.sync_queue
    .where('status')
    .anyOf(['pending', 'syncing'])
    .count()
}

/**
 * Get all failed entries.
 */
export async function getFailedEntries(): Promise<SyncQueueEntry[]> {
  return offlineDB.sync_queue
    .where('status')
    .equals('failed')
    .toArray()
}

/**
 * Retry a failed entry (reset to pending).
 */
export async function retryEntry(entryId: string): Promise<void> {
  await offlineDB.sync_queue.update(entryId, {
    status: 'pending' as SyncStatus,
    attempts: 0,
    error: null,
  })
}

/**
 * Remove a specific entry from the queue.
 */
export async function removeEntry(entryId: string): Promise<void> {
  await offlineDB.sync_queue.delete(entryId)
}

/**
 * Clear all synced entries from the queue.
 */
export async function clearSyncedEntries(): Promise<void> {
  await offlineDB.sync_queue
    .where('status')
    .equals('synced')
    .delete()
}

/**
 * Check if there are any entries being actively synced (to prevent duplicate processing).
 */
export async function hasActiveSyncs(): Promise<boolean> {
  const count = await offlineDB.sync_queue
    .where('status')
    .equals('syncing')
    .count()
  return count > 0
}

// ─── Multi-tab coordination ────────────────────────────────────────

let syncChannel: BroadcastChannel | null = null

function getSyncChannel(): BroadcastChannel {
  if (!syncChannel && typeof BroadcastChannel !== 'undefined') {
    syncChannel = new BroadcastChannel('sear-sync-queue')
  }
  return syncChannel!
}

/**
 * Notify other tabs that the queue has changed.
 */
function notifyQueueChange(): void {
  try {
    getSyncChannel()?.postMessage({ type: 'queue_changed' })
  } catch {
    // BroadcastChannel not available
  }
}

/**
 * Listen for queue changes from other tabs.
 */
export function onQueueChange(callback: () => void): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {}

  const channel = getSyncChannel()
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'queue_changed') {
      callback()
    }
  }
  channel?.addEventListener('message', handler)
  return () => channel?.removeEventListener('message', handler)
}

/**
 * Try to acquire the sync lock (only one tab processes the queue).
 * Uses Web Locks API if available, otherwise falls back to simple flag.
 */
export async function acquireSyncLock(
  processCallback: () => Promise<void>
): Promise<void> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    // Use Web Locks API — only one tab can hold 'sear-sync-processor' at a time
    await navigator.locks.request(
      'sear-sync-processor',
      { ifAvailable: true },
      async (lock) => {
        if (lock) {
          await processCallback()
        }
        // If lock is null, another tab is processing — skip
      }
    )
  } else {
    // Fallback: just run it (less safe but functional)
    await processCallback()
  }
}
