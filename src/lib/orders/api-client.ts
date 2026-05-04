/**
 * V5.4.1 — order-mutation client helper.
 *
 * Centralizes the optimistic-lock dance for callers in src/components/pos/
 * and src/app/(pos)/{route}/page.tsx, and for the offline replay queue:
 *
 *   1. Send `If-Match: <version>` on every mutating request.
 *   2. On 409 with `error: 'order_version_mismatch'`, surface the conflict via
 *      a global event the StaleOrderModal listens for. The caller's promise
 *      rejects with a typed `StaleOrderError` so it can also handle locally.
 *   3. On 2xx, read the new version off the `ETag` response header and feed
 *      it back into the order store so subsequent mutations carry the right
 *      `If-Match`.
 *
 * Why an event bus + typed throw, not just a callback:
 *   - The modal lives at the layout level, not inside every component that
 *     mutates an order. Plumbing a callback through 40+ call sites would be
 *     noise; the event bus lets the modal subscribe once.
 *   - Typed throw means component code can ALSO catch and react locally
 *     (e.g., revert an optimistic Zustand update) without forcing the modal
 *     to be the only consumer.
 *
 * No external deps: this is a thin wrapper around `fetch` + `EventTarget`.
 */

export const STALE_ORDER_EVENT = 'sear:stale-order'

/**
 * Body shape returned by every server route on a 409 stale-write. Mirrors
 * `StaleOrderResponseBody` in `src/lib/orders/concurrency.ts`.
 */
export interface StaleOrderConflict {
  error: 'order_version_mismatch'
  message: string
  expected_version: number | null
  current_version: number
  current_state: Record<string, unknown>
}

/**
 * Custom error thrown on 409. Callers can `instanceof` check this to handle
 * stale conflicts distinctly from network errors / validation errors.
 */
export class StaleOrderError extends Error {
  readonly conflict: StaleOrderConflict
  readonly orderId: string
  readonly attemptedRequest: { url: string; method: string; body?: unknown }
  constructor(args: {
    conflict: StaleOrderConflict
    orderId: string
    attemptedRequest: { url: string; method: string; body?: unknown }
  }) {
    super(args.conflict.message)
    this.name = 'StaleOrderError'
    this.conflict = args.conflict
    this.orderId = args.orderId
    this.attemptedRequest = args.attemptedRequest
  }
}

/** Detail shape carried on the global stale-order event. */
export interface StaleOrderEventDetail {
  orderId: string
  conflict: StaleOrderConflict
  /** What the user tried to do — for the "Re-apply" button on the modal. */
  attemptedRequest: { url: string; method: string; body?: unknown }
}

/**
 * Fire-and-forget global event. The StaleOrderModal listens for this on
 * mount; bypass listeners are SSR-safe (we no-op when window is undefined).
 */
export function emitStaleOrder(detail: StaleOrderEventDetail): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(STALE_ORDER_EVENT, { detail }))
}

/** Parse an ETag header value (`"7"` or `W/"7"`) into a version integer. */
export function parseETagVersion(headerValue: string | null): number | null {
  if (!headerValue) return null
  let cleaned = headerValue.trim()
  if (cleaned.startsWith('W/')) cleaned = cleaned.slice(2).trim()
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1)
  }
  const n = Number.parseInt(cleaned, 10)
  return Number.isFinite(n) && n >= 1 ? n : null
}

export interface OrderMutationOptions {
  method?: 'POST' | 'PATCH' | 'DELETE' | 'PUT'
  /** JSON-serializable body. */
  body?: unknown
  /**
   * The order's current known version. Sent as `If-Match`. If undefined,
   * the request is unconditional (legacy path / unguarded routes).
   */
  ifMatchVersion?: number | null
  /** Additional headers (Idempotency-Key, etc.). Merged into the request. */
  headers?: Record<string, string>
  /**
   * Disable the global stale-order event firing. Useful for callers that
   * want to handle 409 locally and not show the modal (e.g., the offline
   * replay queue, which surfaces conflicts via its own UI).
   */
  silent?: boolean
  /**
   * Abort signal for fetch cancellation.
   */
  signal?: AbortSignal
}

export interface OrderMutationResult<T = unknown> {
  data: T
  /** New order version from response ETag, if present. */
  newVersion: number | null
  /** Raw HTTP status. */
  status: number
}

/**
 * Mutate an order via a `/api/orders/*` route with optimistic-lock support.
 *
 * On 409 stale-write:
 *   - Emits the `STALE_ORDER_EVENT` (unless `silent`).
 *   - Throws `StaleOrderError`. Callers MAY catch and handle locally.
 *
 * On other non-2xx:
 *   - Throws plain `Error` with the server's `error`/`message` if available.
 */
export async function mutateOrder<T = unknown>(
  url: string,
  orderId: string,
  options: OrderMutationOptions = {}
): Promise<OrderMutationResult<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (options.ifMatchVersion !== undefined && options.ifMatchVersion !== null) {
    headers['If-Match'] = String(options.ifMatchVersion)
  }

  const init: RequestInit = {
    method: options.method ?? 'POST',
    headers,
    signal: options.signal,
  }
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body)
  }

  const res = await fetch(url, init)
  const newVersion = parseETagVersion(res.headers.get('ETag'))

  // 409 with our discriminator → stale-order conflict.
  if (res.status === 409) {
    const body = await res.json().catch(() => null) as Partial<StaleOrderConflict> | null
    if (body && body.error === 'order_version_mismatch') {
      const conflict = body as StaleOrderConflict
      const attempted = {
        url,
        method: init.method ?? 'POST',
        body: options.body,
      }
      if (!options.silent) {
        emitStaleOrder({ orderId, conflict, attemptedRequest: attempted })
      }
      throw new StaleOrderError({
        conflict,
        orderId,
        attemptedRequest: attempted,
      })
    }
    // Non-stale 409 (e.g., "auto-gratuity already applied") — fall through to
    // the generic error path.
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as { error?: string; message?: string }
    throw new Error(errBody.message ?? errBody.error ?? `Request failed: ${res.status}`)
  }

  const json = await res.json().catch(() => ({})) as { data?: T } & Record<string, unknown>
  // Most routes return `{ data: ... }`; some (like /send) return additional
  // sibling fields. Hand back the whole shape if data isn't present, so
  // callers don't lose info.
  const data = (json.data !== undefined ? json.data : (json as unknown as T))
  return { data, newVersion, status: res.status }
}
