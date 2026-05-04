/**
 * Request-context helpers (V7.1.2).
 *
 * Reads the `x-request-id` header (set by `src/middleware.ts`) and returns a
 * pre-bound logger. Use from any API route handler:
 *
 *   const rlog = await getReqLogger({ route: '/api/orders/[id]/items', method: 'POST' })
 *   rlog.info('order.add_items.start')
 *   // ...
 *   rlog.info('order.add_items.ok', { status: 201, duration_ms: Date.now() - t0 })
 *
 * The returned logger pre-fills `req_id` (and any extras you pass) so each
 * subsequent log line is automatically correlated to the request.
 */

import { headers } from 'next/headers'
import { boundLogger, type BoundLogger, type LogFields } from './logger'

/**
 * Returns a logger pre-bound with the request's correlation ID.
 *
 * If the middleware did not run (e.g. a non-matching route, or a unit test
 * with no headers shim) the `req_id` falls back to `'unknown'` so the line
 * is still parseable.
 */
export async function getReqLogger(extra: LogFields = {}): Promise<BoundLogger> {
  const h = await headers()
  const reqId = h.get('x-request-id') ?? 'unknown'
  return boundLogger({ req_id: reqId, ...extra })
}

/**
 * Sync variant that takes an explicit `Request`/`NextRequest`. Useful when
 * the route already holds the request object and we want to avoid the async
 * `headers()` dynamic-API call.
 */
export function getReqLoggerFromRequest(
  request: { headers: { get: (name: string) => string | null } },
  extra: LogFields = {}
): BoundLogger {
  const reqId = request.headers.get('x-request-id') ?? 'unknown'
  return boundLogger({ req_id: reqId, ...extra })
}
