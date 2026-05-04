/**
 * V5.4.1 — optimistic-locking helpers for the orders table.
 *
 * Two terminals editing the same order concurrently is the rule, not the
 * exception, on a busy Friday night. Without an If-Match version check the
 * second writer silently overwrites the first ("server fires steak; bartender
 * splits check; the steak vanishes from the kitchen ticket"). Every order-
 * mutating route now reads `If-Match: <version>` from the request, compares
 * it against the live row, and either:
 *
 *   - matches → handler proceeds; the BEFORE-UPDATE trigger
 *               (migration 20260504063720) auto-increments `version`
 *   - missing → handler proceeds AS-IF version 1 (legacy callers, e.g. the
 *               offline replay queue circa V5.3 that doesn't yet thread
 *               versions); we surface a console.warn in dev so we notice
 *   - mismatch → 409 with the current server state, the client shows the
 *                StaleOrderModal, the user re-applies their change manually
 *
 * Why a 409 body shape:
 *   The client needs both the current server state (to render the diff) and
 *   the new version (to retry-with-If-Match after the user merges). We also
 *   return the user-supplied If-Match value so the client can show "you
 *   thought v3 was current; server is at v7".
 *
 * Why no SELECT FOR UPDATE:
 *   The trigger + the conditional UPDATE-WHERE-version-equals are themselves
 *   the lock. Two writers race for the same row's exclusive update lock; the
 *   loser's `.eq('version', expected)` finds zero rows and we 409. Cheaper
 *   than holding a row lock across the handler's full body.
 *
 * Sister tasks:
 *   - 5.4.2 builds the XState order state machine on top of this file.
 *   - 5.4.3 expands `audit_log` so 409s and successful mutations both leave
 *     a trace.
 */

import { NextResponse } from 'next/server'

export const IF_MATCH_HEADER = 'if-match'

/** Shape of a 409 stale-write response. The client knows this contract. */
export interface StaleOrderResponseBody {
  error: 'order_version_mismatch'
  message: string
  /** What the client thought was current. May be `null` if header missing. */
  expected_version: number | null
  /** Current server-side version. */
  current_version: number
  /** Full current order state for the StaleOrderModal diff view. */
  current_state: Record<string, unknown>
}

/**
 * Parse `If-Match` header into a version integer.
 *
 * Accepts:
 *   - bare integer: `If-Match: 7`
 *   - quoted weak/strong ETag: `If-Match: "7"` or `If-Match: W/"7"` (RFC 7232)
 *
 * Returns `null` if the header is absent or unparseable. We treat "absent"
 * permissively (legacy callers) but "unparseable" strictly (returns a 400
 * via {@link assertVersion}'s caller — the parse is separate so callers can
 * distinguish missing-vs-bogus).
 */
export function parseIfMatchVersion(header: string | null): number | null {
  if (header === null || header === '') return null
  // Strip ETag wrappers if present.
  let cleaned = header.trim()
  if (cleaned.startsWith('W/')) cleaned = cleaned.slice(2).trim()
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1)
  }
  const n = Number.parseInt(cleaned, 10)
  if (!Number.isFinite(n) || n < 1) return null
  return n
}

/**
 * Build the canonical 409 response body. Centralized so every route returns
 * the same shape — the StaleOrderModal parses one structure, not 18 variants.
 */
export function build409Body(args: {
  expected_version: number | null
  current_version: number
  current_state: Record<string, unknown>
}): StaleOrderResponseBody {
  return {
    error: 'order_version_mismatch',
    message:
      args.expected_version === null
        ? `Order has been updated. Current version is ${args.current_version}.`
        : `Order was updated by someone else. You sent version ${args.expected_version}; current is ${args.current_version}.`,
    expected_version: args.expected_version,
    current_version: args.current_version,
    current_state: args.current_state,
  }
}

/**
 * Build a NextResponse 409 from {@link build409Body}'s shape. Sets
 * `ETag: "<current_version>"` so the next If-Match-aware client can pull the
 * version straight off the response headers.
 */
export function build409Response(args: {
  expected_version: number | null
  current_version: number
  current_state: Record<string, unknown>
}): NextResponse {
  const body = build409Body(args)
  return NextResponse.json(body, {
    status: 409,
    headers: {
      ETag: `"${args.current_version}"`,
    },
  })
}

/** Minimal shape of the Supabase admin client (avoids a generated-type churn). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any

/**
 * Read an order's version + full row, scoped to the org. Returns `null` if
 * not found (the caller should 404 in that case).
 *
 * The full row is included because if we need to 409 we need the snapshot
 * for the modal diff — making a second roundtrip would be silly when this
 * one is already on the hot path.
 */
export async function loadOrderForVersionCheck(
  supabase: AdminClient,
  orderId: string,
  orgId: string,
  /** Optional select string; defaults to the full order row. */
  select: string = '*'
): Promise<{ version: number; row: Record<string, unknown> } | null> {
  const { data } = await supabase
    .from('orders')
    .select(select)
    .eq('id', orderId)
    .eq('org_id', orgId)
    .maybeSingle()
  if (!data) return null
  const row = data as Record<string, unknown>
  const v = row.version
  // Defensive: a row without `version` is impossible after migration
  // 20260504063720, but just in case (e.g., caller used a select that omits
  // it) treat as v=1 so the lock doesn't silently disengage on a typo.
  const version = typeof v === 'number' && Number.isFinite(v) ? v : 1
  return { version, row }
}

/**
 * Result type for {@link assertVersion}.
 *
 * - `ok: true` — handler may proceed. `expectedVersion` is the value to use
 *   in subsequent UPDATE WHERE clauses.
 * - `ok: false, response: NextResponse` — handler MUST return this response
 *   immediately. Either 404 (order not found), 409 (stale), or 412 (bogus
 *   header). The handler does no further work.
 */
export type AssertVersionResult =
  | {
      ok: true
      /** The version the caller asserted. `null` means no header — proceed
       * unguarded (legacy compat). Pass to {@link checkUpdateAffectedRow}
       * to know whether to gate the UPDATE on version. */
      expectedVersion: number | null
      /** The full current order row, for downstream use. */
      currentRow: Record<string, unknown>
      /** The current server version (== expectedVersion if header present
       * and matched, OR the live version if header absent). */
      currentVersion: number
    }
  | { ok: false; response: NextResponse }

/**
 * Read `If-Match` from the request, load the order, and either greenlight
 * the handler or short-circuit with a 404 / 409 / 412.
 *
 * Usage in a route:
 * ```ts
 * const check = await assertVersion(supabase, request, orderId, user.org_id)
 * if (!check.ok) return check.response
 * // ... do the update, gated by .eq('version', check.expectedVersion)
 * // ... use checkUpdateAffectedRow afterward to detect a TOCTOU race
 * ```
 */
export async function assertVersion(
  supabase: AdminClient,
  request: Request,
  orderId: string,
  orgId: string,
  options: {
    /** Override the default select string for the order load. */
    select?: string
    /**
     * If true, missing `If-Match` is treated as a hard error (412 Precondition
     * Required). Default false (we accept legacy unconditional callers, e.g.
     * pre-V5.4.1 client code paths and the offline queue's V5.3 entries).
     */
    requireHeader?: boolean
  } = {}
): Promise<AssertVersionResult> {
  const headerRaw = request.headers.get(IF_MATCH_HEADER)
  const expected = parseIfMatchVersion(headerRaw)

  // Bogus header (present but unparseable) is always a 400. Distinct from
  // "missing", which is permissive.
  if (headerRaw !== null && headerRaw !== '' && expected === null) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'invalid_if_match',
          message: 'If-Match header must be a positive integer (or quoted ETag).',
        },
        { status: 400 }
      ),
    }
  }

  if (options.requireHeader && expected === null) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'precondition_required',
          message: 'This endpoint requires an If-Match header with the order version.',
        },
        { status: 428 }
      ),
    }
  }

  const loaded = await loadOrderForVersionCheck(
    supabase,
    orderId,
    orgId,
    options.select
  )
  if (!loaded) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Order not found' }, { status: 404 }),
    }
  }

  // No header → unconditional proceed (we still return the current version
  // so the handler can return ETag for the next request).
  if (expected === null) {
    return {
      ok: true,
      expectedVersion: null,
      currentRow: loaded.row,
      currentVersion: loaded.version,
    }
  }

  if (expected !== loaded.version) {
    return {
      ok: false,
      response: build409Response({
        expected_version: expected,
        current_version: loaded.version,
        current_state: loaded.row,
      }),
    }
  }

  return {
    ok: true,
    expectedVersion: expected,
    currentRow: loaded.row,
    currentVersion: loaded.version,
  }
}

/**
 * After running an UPDATE that includes `.eq('version', expectedVersion)`,
 * call this to detect a TOCTOU race: another writer slipped in between
 * {@link assertVersion} and the UPDATE.
 *
 * If `updatedRow` is null/undefined (the conditional UPDATE matched zero
 * rows because the version moved), this re-fetches and returns a 409.
 * If the UPDATE succeeded, returns null and the caller proceeds.
 *
 * Skip this step when `assertVersion` returned `expectedVersion === null`
 * — the handler ran unguarded so a TOCTOU race is impossible to detect
 * (and equally, would have happened in the legacy unconditional path).
 */
export async function checkUpdateAffectedRow(
  supabase: AdminClient,
  orderId: string,
  orgId: string,
  expectedVersion: number | null,
  updatedRow: unknown,
  options: { select?: string } = {}
): Promise<NextResponse | null> {
  // Legacy / unconditional path — nothing to check.
  if (expectedVersion === null) return null
  // The .single() returned a row → success.
  if (updatedRow !== null && updatedRow !== undefined) return null

  // The UPDATE matched zero rows. Either the order vanished (rare; would have
  // been 404 above) OR another writer bumped the version between our SELECT
  // and our UPDATE. Re-fetch and 409 with the new state.
  const fresh = await loadOrderForVersionCheck(
    supabase,
    orderId,
    orgId,
    options.select
  )
  if (!fresh) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }
  return build409Response({
    expected_version: expectedVersion,
    current_version: fresh.version,
    current_state: fresh.row,
  })
}

/**
 * Convenience: read just the version (e.g., for an ETag response header on a
 * GET handler). Cheap; uses a tiny `select`.
 */
export async function getOrderVersion(
  supabase: AdminClient,
  orderId: string,
  orgId: string
): Promise<number | null> {
  const loaded = await loadOrderForVersionCheck(supabase, orderId, orgId, 'version')
  return loaded?.version ?? null
}

/**
 * Bump version explicitly (no-op when relying on the trigger; exported only
 * for handlers that perform an INSERT into a related table without an UPDATE
 * to `orders` itself but still want to invalidate cached versions).
 *
 * Most handlers should NOT call this — performing a regular UPDATE on the
 * orders row (even just `.update({ updated_at: now() })`) is sufficient
 * because the BEFORE-UPDATE trigger handles the increment.
 */
export async function bumpVersion(
  supabase: AdminClient,
  orderId: string,
  orgId: string
): Promise<void> {
  await supabase
    .from('orders')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('org_id', orgId)
}
