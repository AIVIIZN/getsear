/**
 * Optimistic-locking helper — STUB (5.4.2 cycle 2).
 *
 * Owned by sister batch 5.4.1. This stub mirrors the REAL signatures published
 * in `v5-batch-5.4.1-optimistic-locking/src/lib/orders/concurrency.ts` so the
 * 5.4.2 routes can compile against the same surface area before INTEGRATE.sh
 * overwrites this file with the real implementation.
 *
 * Behavior here is intentionally permissive (always reports "version OK") so
 * that pre-merge local builds and the vitest state-machine tests don't depend
 * on the orders.version column actually existing yet. Real semantics arrive
 * with 5.4.1's migration + helpers.
 */

import { NextResponse } from 'next/server'

export const IF_MATCH_HEADER = 'if-match'

export interface StaleOrderResponseBody {
  error: 'order_version_mismatch'
  message: string
  expected_version: number | null
  current_version: number
  current_state: Record<string, unknown>
}

export type AssertVersionResult =
  | {
      ok: true
      expectedVersion: number | null
      currentRow: Record<string, unknown>
      currentVersion: number
    }
  | { ok: false; response: NextResponse }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any

/**
 * Stub: parse If-Match header. Mirrors real impl's signature.
 */
export function parseIfMatchVersion(header: string | null): number | null {
  if (header === null || header === '') return null
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
 * Stub: build409Body. Real impl in 5.4.1.
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
 * Stub: build409Response. Real impl in 5.4.1.
 */
export function build409Response(args: {
  expected_version: number | null
  current_version: number
  current_state: Record<string, unknown>
}): NextResponse {
  return NextResponse.json(build409Body(args), {
    status: 409,
    headers: { ETag: `"${args.current_version}"` },
  })
}

/**
 * Stub: assertVersion. Real signature is hardcoded to the `orders` table and
 * returns the loaded row + current version on success, or a NextResponse on
 * failure (404 / 409 / 412 / 400). Here we always succeed so 5.4.2 routes
 * compile and behave correctly post-merge once 5.4.1 ships.
 */
export async function assertVersion(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _supabase: AdminClient,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _request: Request,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _orderId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _orgId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options: { select?: string; requireHeader?: boolean } = {}
): Promise<AssertVersionResult> {
  return {
    ok: true,
    expectedVersion: null,
    currentRow: {},
    currentVersion: 1,
  }
}

/**
 * Stub: bumpVersion. Real signature performs its OWN UPDATE on the orders row
 * — the BEFORE-UPDATE trigger from 5.4.1's migration handles the increment.
 * Most handlers don't need to call this at all (any UPDATE on the row triggers
 * the bump); it's kept here only so import sites resolve.
 */
export async function bumpVersion(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _supabase: AdminClient,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _orderId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _orgId: string
): Promise<void> {
  // no-op stub
}

/**
 * Stub: checkUpdateAffectedRow. Real impl re-fetches and 409s on TOCTOU.
 */
export async function checkUpdateAffectedRow(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _supabase: AdminClient,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _orderId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _orgId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _expectedVersion: number | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _updatedRow: unknown,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options: { select?: string } = {}
): Promise<NextResponse | null> {
  return null
}

/**
 * Stub: getOrderVersion. Real impl returns the row's version column.
 */
export async function getOrderVersion(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _supabase: AdminClient,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _orderId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _orgId: string
): Promise<number | null> {
  return 1
}
