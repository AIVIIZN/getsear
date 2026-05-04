/**
 * Optimistic-locking helper — STUB.
 *
 * Owned by sister batch 5.4.1. This stub exists so that batch 5.4.2 routes
 * (comp / void / refund) can statically import `assertVersion` and compile
 * before 5.4.1 lands. When 5.4.1 merges, it will overwrite this file with
 * the real implementation (orders.version column + If-Match header).
 *
 * Until then this is a documented no-op that always reports "version OK"
 * so the call site behaves correctly in both directions:
 *   - If the caller passes If-Match, we silently accept (no row gets locked).
 *   - If the caller passes nothing, we silently accept.
 *
 * IMPORTANT: this is intentionally permissive. Do not add real locking
 * here — it belongs in 5.4.1.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface VersionCheckResult {
  ok: boolean
  current_version?: number
  current_state?: Record<string, unknown>
}

/**
 * Assert that the row's current `version` matches the value the caller has.
 * The caller passes the value from the request's `If-Match` header.
 *
 * Stub: returns `{ ok: true }` unconditionally. Real impl in 5.4.1 will
 * SELECT the row, compare versions, and return `{ ok: false, current_state }`
 * on mismatch (route then translates to HTTP 409).
 */
export async function assertVersion(
  _supabase: SupabaseClient,
  _table: string,
  _id: string,
  _expectedVersion: number | null
): Promise<VersionCheckResult> {
  return { ok: true }
}

/**
 * Increment the row's `version` column atomically as part of an update.
 * Stub: returns the same updates dict. Real impl in 5.4.1 will append
 * `version: version + 1` and gate on the version match.
 */
export function bumpVersion<T extends Record<string, unknown>>(updates: T): T {
  return updates
}
