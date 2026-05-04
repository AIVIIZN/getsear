/**
 * Offline mutation queue replayer (V5.3.1).
 *
 * On `online` events (or manual triggers), drain the IndexedDB mutation queue
 * FIFO. For each entry, POST the buffered request with an `Idempotency-Key`
 * header equal to the entry's UUIDv4 id. The server dedupes by that key, so
 * replays after a server-acked-but-client-lost-confirmation network blip are
 * safe — at-most-once delivery.
 *
 * Failure policy:
 * - 2xx → mark `synced`.
 * - 409 conflict → also treated as resolved (server already has the write —
 *   typically a duplicate idempotency key means the original landed).
 * - 4xx (except 409) / 5xx / network error → record attempt. After
 *   MAX_ATTEMPTS (3) cumulative server-side rejections, mark `failed`.
 * - Replay loop is FIFO and bails on the first network error so we don't
 *   thrash the network during a partial outage.
 */

import { getPending, recordAttempt, clearSynced, MAX_ATTEMPTS } from './queue'
import type { QueuedMutation } from './db'

let isReplaying = false

export interface ReplayResult {
  attempted: number
  succeeded: number
  failed: number
  /** True if the loop bailed because a request hit a network error mid-drain. */
  haltedOnNetworkError: boolean
}

/**
 * Replay all pending mutations FIFO. Idempotent — concurrent calls are a no-op
 * (the second caller returns immediately). Web Locks would be stricter but
 * `online` events fire on a single tab at a time.
 */
export async function replayQueue(): Promise<ReplayResult> {
  const result: ReplayResult = { attempted: 0, succeeded: 0, failed: 0, haltedOnNetworkError: false }
  if (isReplaying) return result
  isReplaying = true
  try {
    const entries = await getPending()
    for (const entry of entries) {
      result.attempted++
      const outcome = await sendOne(entry)
      if (outcome === 'synced') {
        result.succeeded++
      } else if (outcome === 'failed') {
        result.failed++
      } else if (outcome === 'network_error') {
        // Bail — preserve FIFO. The next `online` event (or manual retry)
        // resumes from where we left off.
        result.haltedOnNetworkError = true
        break
      }
      // 'pending_retry' just leaves the entry pending for the next pass
    }
    await clearSynced()
  } finally {
    isReplaying = false
  }
  return result
}

type SendOutcome = 'synced' | 'pending_retry' | 'failed' | 'network_error'

/**
 * Send one queued mutation. Returns the outcome — caller updates counters.
 */
async function sendOne(entry: QueuedMutation): Promise<SendOutcome> {
  let response: Response
  try {
    response = await fetch(entry.url, {
      method: entry.method,
      headers: {
        'Content-Type': 'application/json',
        ...entry.headers,
        // Spec: server dedupes by Idempotency-Key. Set LAST so the entry's id
        // always wins over caller-supplied headers.
        'Idempotency-Key': entry.id,
      },
      body: entry.body == null ? null : JSON.stringify(entry.body),
    })
  } catch (err) {
    // Network error — connection died mid-replay. Record the attempt so the
    // counter increments, but don't burn through MAX_ATTEMPTS for offline.
    // We treat network errors as "halt and resume later", not server rejections.
    const message = err instanceof Error ? err.message : 'network error'
    await recordAttemptSafe(entry.id, message, /* isServerRejection */ false)
    return 'network_error'
  }

  if (response.ok) {
    await recordAttempt(entry.id, null)
    return 'synced'
  }

  // 409 = idempotency-key collision => server already has this write. Treat as success.
  if (response.status === 409) {
    await recordAttempt(entry.id, null)
    return 'synced'
  }

  // 4xx (except 409) or 5xx — server rejection. Increment attempts.
  const errBody = await response.text().catch(() => '')
  const error = `HTTP ${response.status}: ${errBody.slice(0, 200) || response.statusText}`
  const updated = await recordAttempt(entry.id, error)
  if (updated?.status === 'failed') return 'failed'
  return 'pending_retry'
}

/**
 * Like recordAttempt but for network errors — we don't want to increment
 * the server-rejection counter (the server never saw the request).
 */
async function recordAttemptSafe(id: string, error: string, isServerRejection: boolean): Promise<void> {
  if (isServerRejection) {
    await recordAttempt(id, error)
    return
  }
  // Don't increment attempts; just stamp the error and leave it pending.
  const { offlineDB } = await import('./db')
  await offlineDB.mutation_queue.update(id, {
    last_attempt_at: new Date().toISOString(),
    last_error: error,
    status: 'pending',
  })
}

/** Whether a replay is in progress right now (UI can show a spinner). */
export function isReplayInProgress(): boolean {
  return isReplaying
}

/**
 * Wire up the global `online` event so reconnects automatically drain the queue.
 * Returns a cleanup function. Call this once per page (idempotent — re-calling
 * returns a fresh cleanup).
 */
export function installOnlineReplayHook(opts?: {
  onResult?: (result: ReplayResult) => void
}): () => void {
  if (typeof window === 'undefined') return () => {}

  const handler = () => {
    void replayQueue().then((r) => opts?.onResult?.(r))
  }
  window.addEventListener('online', handler)

  // If we mount while already online and there are pending entries, kick a replay.
  if (navigator.onLine) {
    void replayQueue().then((r) => opts?.onResult?.(r))
  }

  return () => window.removeEventListener('online', handler)
}

/** Re-export ceiling so the offline UI can show "X of MAX_ATTEMPTS". */
export { MAX_ATTEMPTS }
