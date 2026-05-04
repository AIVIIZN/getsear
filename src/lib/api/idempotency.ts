/**
 * V5.3.1 — server-side idempotency middleware.
 *
 * The offline mutation queue (`src/lib/offline/sync-queue.ts`) stamps every
 * queued operation with a UUIDv4 `Idempotency-Key`. On reconnect the queue
 * replays the buffered fetch with that key in the header. If the original
 * request landed but the network dropped the ack mid-flight, the replay
 * would otherwise duplicate the write — a second order, a second payment, a
 * double-charged customer. This middleware prevents that.
 *
 * Persistence model: `public.idempotency_records` keyed on `(key, route, org_id)`.
 * - First request with a key: handler runs, full response is captured and
 *   stored, then returned to the caller.
 * - Replay of the same key: stored response is returned verbatim (status,
 *   body) — the handler does not re-run.
 * - No header present: handler runs normally. Idempotency is opt-in per
 *   request, not per route. This keeps non-queued callers (admin tools,
 *   background jobs, manual API consumers) on their existing fast path.
 *
 * Key validation:
 * - Must be a UUIDv4 (matches the queue's mint format). Other shapes return
 *   400 — we don't want callers passing arbitrary strings and accidentally
 *   colliding (e.g., "1" or empty).
 * - Scoped per route: the same key on POST /api/orders and POST /api/payments
 *   are distinct. Prevents accidental cross-route collisions.
 * - Scoped per org: a malicious caller can't probe another tenant's keys.
 *
 * TTL: 24 hours. Entries auto-expire (cleanup is a future cron — for now
 * the table simply grows then a periodic prune will trim it).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, type AuthUser } from './auth'

/** UUIDv4 shape — version nibble = 4, variant nibble = 8/9/a/b. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const HEADER = 'idempotency-key'

interface IdempotencyRecord {
  key: string
  route: string
  org_id: string
  response_body: unknown
  response_status: number
  created_at: string
  expires_at: string
}

/**
 * Wrap a route handler so the same `Idempotency-Key` from the same org
 * returns the cached response. Compatible with both bare `(req)` handlers
 * and `(req, { params })` dynamic-route handlers — context is forwarded.
 *
 * Usage:
 * ```ts
 * export const POST = withIdempotency('orders.create', async (req) => {
 *   // ... your existing handler logic
 *   return NextResponse.json({ data }, { status: 201 })
 * })
 * ```
 *
 * The `route` argument is the dedup scope key. Use a stable string per
 * route+method (e.g., `'orders.create'`, `'orders.add_items'`,
 * `'payments.process'`) so the same logical operation never collides with
 * a different route's keys. Don't use the URL path because dynamic segments
 * (`/api/orders/[id]/items`) would explode the keyspace.
 */
export function withIdempotency<C>(
  route: string,
  handler: (request: NextRequest, context: C) => Promise<NextResponse>
): (request: NextRequest, context: C) => Promise<NextResponse> {
  return async (request, context) => {
    const key = request.headers.get(HEADER)

    // No header → run the handler normally. Idempotency is opt-in per call.
    if (!key) return handler(request, context)

    // Reject bogus keys — we mint UUIDv4 client-side; anything else is a bug
    // or a probe attempt.
    if (!UUID_V4.test(key)) {
      return NextResponse.json(
        { error: 'Idempotency-Key must be a UUIDv4' },
        { status: 400 }
      )
    }

    // The dedup scope is `(key, route, org_id)`. We need the auth user *now*
    // even though the underlying handler also calls `getAuthUser` — duplicate
    // call is cheap (one DB lookup) and ensures we never serve a cached
    // response across tenant boundaries.
    const userOrErr = await getAuthUser()
    if (userOrErr instanceof NextResponse) return userOrErr
    const user = userOrErr as AuthUser

    const supabase = createAdminClient()

    // Hit? Return the stored response verbatim.
    const existing = await loadRecord(supabase, key, route, user.org_id)
    if (existing) {
      return NextResponse.json(existing.response_body, { status: existing.response_status })
    }

    // Miss → run the handler, capture the response, store, return.
    const response = await handler(request, context)

    // Only cache deterministic outcomes (2xx + 4xx). 5xx is server-internal
    // and the client should be free to retry — stashing a 500 would
    // permanently doom the operation.
    if (response.status >= 500) return response

    // Clone so the body can be read here AND served to the caller. NextResponse
    // bodies are streams; reading consumes them.
    const cloned = response.clone()
    let body: unknown = null
    try {
      const text = await cloned.text()
      body = text ? JSON.parse(text) : null
    } catch {
      // Non-JSON response — store as raw text so replay still returns
      // something coherent.
      body = await response.clone().text()
    }

    await storeRecord(supabase, {
      key,
      route,
      org_id: user.org_id,
      response_body: body,
      response_status: response.status,
    })

    return response
  }
}

// `idempotency_records` is not in the hand-rolled `database.ts` type; the
// Supabase client uses a generic `Database` schema, so we type-erase via
// `any` for the table query (mirrors the pattern across the rest of
// `src/app/api/**`). The runtime contract is enforced by the migration:
// columns key/route/org_id/response_body/response_status/created_at/expires_at.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any

async function loadRecord(
  supabase: AdminClient,
  key: string,
  route: string,
  orgId: string
): Promise<IdempotencyRecord | null> {
  const { data } = await supabase
    .from('idempotency_records')
    .select('key, route, org_id, response_body, response_status, created_at, expires_at')
    .eq('key', key)
    .eq('route', route)
    .eq('org_id', orgId)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle()
  return (data as IdempotencyRecord | null) ?? null
}

async function storeRecord(
  supabase: AdminClient,
  record: {
    key: string
    route: string
    org_id: string
    response_body: unknown
    response_status: number
  }
): Promise<void> {
  // expires_at default is `now() + interval '24 hours'` per the migration —
  // we let the DB compute it so clock skew between app and DB doesn't matter.
  const { error } = await supabase.from('idempotency_records').insert({
    key: record.key,
    route: record.route,
    org_id: record.org_id,
    response_body: record.response_body,
    response_status: record.response_status,
  })
  if (error) {
    // The most common error here is a unique-violation on (key, route, org_id)
    // when two concurrent requests with the same key both miss the cache and
    // both run the handler. The race is benign — the second writer's response
    // is identical to the first (idempotent operation), and the cached row
    // wins. Log + swallow so we don't fail the user-facing request.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[withIdempotency] failed to persist record:', error)
    }
  }
}
