/**
 * Offline mutation queue (V5.3.1).
 *
 * Spec-shaped wrapper around `mutation_queue` in IndexedDB (Dexie).
 *
 * Contract:
 * - Every queued mutation gets a UUIDv4 idempotency key written to IndexedDB
 *   BEFORE the optimistic UI update fires.
 * - Replay is FIFO. The server dedupes by `Idempotency-Key` header (5.3.1
 *   server contract) so at-most-once delivery is preserved on retries.
 * - After `MAX_ATTEMPTS` (3) server-side rejections, the entry is marked
 *   'failed' — the user can manually retry via the offline UI (sister 5.3.2).
 *
 * This module intentionally lives alongside the older `sync-queue.ts`
 * (operation-typed queue used by the existing order/payment/clock pipelines)
 * — they share a Dexie database but use independent tables.
 */

import { offlineDB, type QueuedMutation, type MutationStatus } from './db'

/** Server-side rejection ceiling before an entry is marked 'failed'. */
export const MAX_ATTEMPTS = 3

/** UUIDv4 — used both as the queue entry id AND the Idempotency-Key header. */
function uuidv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // RFC 4122 v4 fallback (extremely rare in modern browsers).
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export interface EnqueueInput {
  url: string
  method: QueuedMutation['method']
  body: unknown
  /** Optional extra headers. The replayer ALWAYS sets Idempotency-Key + Content-Type. */
  headers?: Record<string, string>
  /** Override default MAX_ATTEMPTS (rare). */
  maxAttempts?: number
}

/**
 * Persist a mutation to IndexedDB and return the generated idempotency key.
 *
 * **CRITICAL ORDERING:** the caller MUST `await enqueue(...)` BEFORE applying
 * the optimistic UI update. If the tab dies between the optimistic mutation
 * and the IndexedDB commit, the operation is lost. Order matters.
 *
 * Returns the UUIDv4 idempotency key — the caller can stamp it onto the
 * client-side optimistic record so the eventual server response can be
 * correlated.
 */
export async function enqueue(input: EnqueueInput): Promise<string> {
  const id = uuidv4()
  const entry: QueuedMutation = {
    id,
    url: input.url,
    method: input.method,
    body: input.body,
    headers: input.headers ?? {},
    status: 'pending',
    attempts: 0,
    max_attempts: input.maxAttempts ?? MAX_ATTEMPTS,
    created_at: new Date().toISOString(),
    last_attempt_at: null,
    last_error: null,
  }
  await offlineDB.mutation_queue.put(entry)
  notifyChange()
  return id
}

/** Get all pending entries, FIFO by created_at. */
export async function getPending(): Promise<QueuedMutation[]> {
  const all = await offlineDB.mutation_queue.where('status').equals('pending').toArray()
  return all.sort((a, b) => a.created_at.localeCompare(b.created_at))
}

/** Get all failed entries (for the offline UI's manual retry list). */
export async function getFailed(): Promise<QueuedMutation[]> {
  const all = await offlineDB.mutation_queue.where('status').equals('failed').toArray()
  return all.sort((a, b) => a.created_at.localeCompare(b.created_at))
}

/** Total of pending + syncing entries (UI counter). */
export async function getPendingCount(): Promise<number> {
  return offlineDB.mutation_queue.where('status').anyOf(['pending', 'syncing']).count()
}

/** Look up one entry by id (idempotency key). */
export async function getById(id: string): Promise<QueuedMutation | undefined> {
  return offlineDB.mutation_queue.get(id)
}

/** Status mutations — exported so the replayer (`sync.ts`) can update entries. */
export async function setStatus(id: string, status: MutationStatus): Promise<void> {
  await offlineDB.mutation_queue.update(id, { status })
  notifyChange()
}

export async function recordAttempt(id: string, error: string | null): Promise<QueuedMutation | undefined> {
  const entry = await offlineDB.mutation_queue.get(id)
  if (!entry) return undefined
  const attempts = entry.attempts + 1
  const isFinalFailure = attempts >= entry.max_attempts
  const next: Partial<QueuedMutation> = {
    attempts,
    last_attempt_at: new Date().toISOString(),
    last_error: error,
    status: error ? (isFinalFailure ? 'failed' : 'pending') : 'synced',
  }
  await offlineDB.mutation_queue.update(id, next)
  notifyChange()
  return { ...entry, ...next } as QueuedMutation
}

/** Manual retry from the offline UI — resets a failed entry to pending. */
export async function retry(id: string): Promise<void> {
  await offlineDB.mutation_queue.update(id, {
    status: 'pending',
    attempts: 0,
    last_error: null,
  })
  notifyChange()
}

/** Discard an entry permanently (user pressed "abandon" in the offline UI). */
export async function discard(id: string): Promise<void> {
  await offlineDB.mutation_queue.delete(id)
  notifyChange()
}

/** Drop synced entries — called periodically to keep the queue table small. */
export async function clearSynced(): Promise<void> {
  await offlineDB.mutation_queue.where('status').equals('synced').delete()
}

// ─── Cross-tab change notification ─────────────────────────────────
//
// Multiple tabs share IndexedDB. When one tab enqueues or transitions a
// mutation, broadcast so other tabs (and the offline-store) can refresh.

const CHANNEL_NAME = 'sear-mutation-queue'
let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME)
  return channel
}

function notifyChange(): void {
  try {
    getChannel()?.postMessage({ type: 'mutation_queue_changed' })
  } catch {
    // BroadcastChannel may be torn down during page unload — safe to ignore.
  }
}

/** Subscribe to cross-tab changes. Returns an unsubscribe function. */
export function onChange(callback: () => void): () => void {
  const ch = getChannel()
  if (!ch) return () => {}
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'mutation_queue_changed') callback()
  }
  ch.addEventListener('message', handler)
  return () => ch.removeEventListener('message', handler)
}
