/**
 * Manager-PIN gating — centralised validation with brute-force protection.
 *
 * V5.99.7 (security remediation):
 *   - Single canonical `validateManagerPin(supabase, orgId, pin)` used by every
 *     privileged route (void, comp, walkout, refund, payments/void, drawer-open,
 *     discount, etc.). Filters by is_active=true so terminated managers cannot
 *     authorise actions until pin_hash is rotated.
 *   - `verifyManagerPinWithRateLimit(...)` adds Redis-backed rate limit + per-org
 *     lockout + audit-log entries on every failure and on lockout — fixing the
 *     ~17-min keyspace brute force on /api/auth/verify-manager-pin.
 *
 * SCOPE — only the bare PIN check + rate limit/audit. Threshold logic (e.g.
 * "voids over $100 require PIN") stays in the route so amount/role policy is
 * visible at the call site.
 */

import bcrypt from 'bcryptjs'
import type { NextRequest } from 'next/server'
import { audit } from '@/lib/audit/log'
import {
  checkRateLimit,
  getClientIp,
  type RateLimitResult,
} from '@/lib/api/rate-limit'
import type { AuthUser } from '@/lib/api/auth'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of a basic (no-rate-limit) PIN check used by mutating routes. */
export interface PinValidationResult {
  /** Manager user id whose PIN matched, or null on no match / no managers. */
  manager_user_id: string | null
}

/** Result of a rate-limited PIN verification used by /api/auth/verify-manager-pin. */
export type RateLimitedPinResult =
  | {
      kind: 'rate_limited'
      scope: 'ip' | 'user' | 'org'
      rateLimit: RateLimitResult
    }
  | {
      kind: 'invalid'
      manager_user_id: null
      ipRateLimit: RateLimitResult
    }
  | {
      kind: 'valid'
      manager_user_id: string
      manager_role: string
      manager_display_name: string
      ipRateLimit: RateLimitResult
    }

// ---------------------------------------------------------------------------
// Manager-PIN check (basic) — used by mutating routes that already gate on
// role/threshold and only need to verify the supplied PIN.
// ---------------------------------------------------------------------------

const MANAGER_ROLES = ['owner', 'admin', 'manager'] as const

/**
 * Basic PIN validation, NO rate limit. Returns the manager user_id whose PIN
 * matched (active managers only) or null. Use this in mutating routes
 * (void/comp/discount/refund) where rate limit is enforced upstream by IP+user
 * or where a single failed PIN attempt is acceptable.
 */
export async function validateManagerPin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgId: string,
  pin: string
): Promise<string | null> {
  if (!pin || typeof pin !== 'string') return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: managers } = await (supabase.from('users') as any)
    .select('id, pin_hash')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .in('role', MANAGER_ROLES as unknown as string[])
    .not('pin_hash', 'is', null)

  if (!managers || managers.length === 0) return null

  for (const mgr of managers as Array<{ id: string; pin_hash: string | null }>) {
    if (!mgr.pin_hash) continue
    try {
      const ok = await bcrypt.compare(pin, mgr.pin_hash)
      if (ok) return mgr.id
    } catch {
      // bcrypt errors -> treat as no-match, continue
      continue
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Rate-limited PIN verification — for /api/auth/verify-manager-pin
// ---------------------------------------------------------------------------

/**
 * Bound the brute-force keyspace by:
 *   1. Rate limit per IP   (5 attempts / 15 min — auth tier).
 *   2. Rate limit per user (5 attempts / 15 min — auth tier).
 *   3. Rate limit per org  (10 attempts / 15 min — pin-verify tier; protects
 *      against an attacker rotating user sessions or workers).
 * On every failed PIN attempt and every lockout we write an audit row so the
 * back-office UI surfaces the brute-force pattern.
 */
export async function verifyManagerPinWithRateLimit(args: {
  caller: AuthUser
  pin: string
  request: NextRequest | Request
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
}): Promise<RateLimitedPinResult> {
  const { caller, pin, request, supabase } = args
  const ip = getClientIp(request as Request)

  // 1. Per-IP rate limit (auth tier — 5/15min).
  const ipKey = `pin-verify:ip:${ip}`
  const ipRl = await checkRateLimit('auth', ipKey)
  if (!ipRl.allowed) {
    await recordPinFailure({
      caller,
      reason: 'rate_limit_ip',
      request,
      ip,
    })
    return { kind: 'rate_limited', scope: 'ip', rateLimit: ipRl }
  }

  // 2. Per-user rate limit (auth tier — prevents single-cookie brute force).
  const userKey = `pin-verify:user:${caller.id}`
  const userRl = await checkRateLimit('auth', userKey)
  if (!userRl.allowed) {
    await recordPinFailure({
      caller,
      reason: 'rate_limit_user',
      request,
      ip,
    })
    return { kind: 'rate_limited', scope: 'user', rateLimit: userRl }
  }

  // 3. Per-org rate limit (pin-verify tier — 10/15min; defends against
  //    multiple cashier sessions iterating against the same org's managers).
  const orgKey = `pin-verify:org:${caller.org_id}`
  const orgRl = await checkRateLimit('auth', orgKey)
  if (!orgRl.allowed) {
    await recordPinFailure({
      caller,
      reason: 'rate_limit_org_lockout',
      request,
      ip,
      lockout: true,
    })
    return { kind: 'rate_limited', scope: 'org', rateLimit: orgRl }
  }

  // Quick PIN-format guard. We deliberately do NOT consume an extra rate-limit
  // slot here — slots already incremented above are sufficient.
  if (typeof pin !== 'string' || pin.length < 4 || pin.length > 8) {
    await recordPinFailure({
      caller,
      reason: 'invalid_format',
      request,
      ip,
    })
    return { kind: 'invalid', manager_user_id: null, ipRateLimit: ipRl }
  }

  // 4. Walk active managers and bcrypt-compare.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: managers } = await (supabase.from('users') as any)
    .select('id, display_name, first_name, last_name, email, role, pin_hash')
    .eq('org_id', caller.org_id)
    .eq('is_active', true)
    .in('role', MANAGER_ROLES as unknown as string[])
    .not('pin_hash', 'is', null)

  if (!managers || managers.length === 0) {
    await recordPinFailure({
      caller,
      reason: 'no_managers_available',
      request,
      ip,
    })
    return { kind: 'invalid', manager_user_id: null, ipRateLimit: ipRl }
  }

  for (const mgr of managers as Array<{
    id: string
    display_name: string | null
    first_name: string | null
    last_name: string | null
    email: string | null
    role: string
    pin_hash: string | null
  }>) {
    if (!mgr.pin_hash) continue
    try {
      const ok = await bcrypt.compare(pin, mgr.pin_hash)
      if (ok) {
        const displayName =
          mgr.display_name ||
          [mgr.first_name, mgr.last_name].filter(Boolean).join(' ') ||
          mgr.email ||
          'Manager'
        return {
          kind: 'valid',
          manager_user_id: mgr.id,
          manager_role: mgr.role,
          manager_display_name: displayName,
          ipRateLimit: ipRl,
        }
      }
    } catch {
      continue
    }
  }

  // No match — record failure for audit/forensics.
  await recordPinFailure({
    caller,
    reason: 'invalid_pin',
    request,
    ip,
  })

  return { kind: 'invalid', manager_user_id: null, ipRateLimit: ipRl }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function recordPinFailure(args: {
  caller: AuthUser
  reason: string
  request: NextRequest | Request
  ip: string
  lockout?: boolean
}): Promise<void> {
  const { caller, reason, request, lockout } = args
  // Best-effort — audit.record never throws.
  await audit.record({
    actor: caller,
    action: lockout ? 'manager_pin_lockout' : 'manager_pin_verify_failed',
    entity_type: 'user',
    entity_id: caller.id,
    description: lockout
      ? `Manager-PIN verification locked out (${reason})`
      : `Manager-PIN verification failed (${reason})`,
    reason,
    request,
  })
}
