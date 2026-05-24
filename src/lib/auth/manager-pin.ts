/**
 * Manager-PIN gating — centralised validation with brute-force protection.
 *
 * V5.99.7 (security remediation):
 *   - `validateManagerPinForAction(...)` is the canonical request-aware helper
 *     for privileged routes (void, comp, walkout, refund, payments/void,
 *     discount, etc.). It filters by is_active=true, rate-limits attempts, and
 *     audits every failure / lockout.
 *   - `validateManagerPin(...)` remains a basic 4-6 digit bcrypt check for
 *     legacy non-request contexts.
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

export type ManagerPinActionResult =
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
      ipRateLimit: RateLimitResult
    }

// ---------------------------------------------------------------------------
// Manager-PIN check (basic) — used by mutating routes that already gate on
// role/threshold and only need to verify the supplied PIN.
// ---------------------------------------------------------------------------

const MANAGER_ROLES = ['owner', 'admin', 'manager'] as const

/**
 * Basic PIN validation, NO rate limit. Returns the manager user_id whose PIN
 * matched (active managers only) or null. Request handlers should prefer
 * validateManagerPinForAction so failed approvals are audited/rate-limited.
 */
export async function validateManagerPin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO(5.99.7): replace with typed Supabase client once supabase-generated types cover all helper signatures
  supabase: any,
  orgId: string,
  pin: string
): Promise<string | null> {
  if (!isPinFormatValid(pin)) return null

  const manager = await findActiveManagerByPin(supabase, orgId, pin)
  return manager?.id ?? null
}

export async function validateManagerPinForAction(args: {
  actor: AuthUser
  pin: string
  request: NextRequest | Request
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO(5.99.7): replace with typed Supabase client once supabase-generated types cover all helper signatures
  supabase: any
}): Promise<ManagerPinActionResult> {
  const result = await verifyManagerPinWithRateLimit({
    caller: args.actor,
    pin: args.pin,
    request: args.request,
    supabase: args.supabase,
  })

  if (result.kind === 'valid') {
    return {
      kind: 'valid',
      manager_user_id: result.manager_user_id,
      ipRateLimit: result.ipRateLimit,
    }
  }
  return result
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO(5.99.7): replace with typed Supabase client once supabase-generated types cover all helper signatures
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
  if (!isPinFormatValid(pin)) {
    await recordPinFailure({
      caller,
      reason: 'invalid_format',
      request,
      ip,
    })
    return { kind: 'invalid', manager_user_id: null, ipRateLimit: ipRl }
  }

  // 4. Walk active managers and bcrypt-compare.
  const managers = await loadActiveManagersWithPin(supabase, caller.org_id)

  if (!managers || managers.length === 0) {
    await recordPinFailure({
      caller,
      reason: 'no_managers_available',
      request,
      ip,
    })
    return { kind: 'invalid', manager_user_id: null, ipRateLimit: ipRl }
  }

  const manager = await matchManagerPin(managers, pin)
  if (manager) {
    const displayName =
      manager.display_name ||
      [manager.first_name, manager.last_name].filter(Boolean).join(' ') ||
      manager.email ||
      'Manager'
    return {
      kind: 'valid',
      manager_user_id: manager.id,
      manager_role: manager.role,
      manager_display_name: displayName,
      ipRateLimit: ipRl,
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

function isPinFormatValid(pin: string): boolean {
  return typeof pin === 'string' && pin.length >= 4 && pin.length <= 6 && /^\d+$/.test(pin)
}

async function findActiveManagerByPin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO(5.99.7): replace with typed Supabase client once supabase-generated types cover all helper signatures
  supabase: any,
  orgId: string,
  pin: string
): Promise<ManagerPinRow | null> {
  const managers = await loadActiveManagersWithPin(supabase, orgId)
  if (!managers || managers.length === 0) return null
  return matchManagerPin(managers, pin)
}

interface ManagerPinRow {
  id: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  role: string
  pin_hash: string | null
}

async function loadActiveManagersWithPin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO(5.99.7): replace with typed Supabase client once supabase-generated types cover all helper signatures
  supabase: any,
  orgId: string
): Promise<ManagerPinRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO(5.99.7): drop cast when Supabase generated-types include the chain return shape on `.from('users')`
  const { data: managers } = await (supabase.from('users') as any)
    .select('id, display_name, first_name, last_name, email, role, pin_hash')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .in('role', MANAGER_ROLES as unknown as string[])
    .not('pin_hash', 'is', null)

  return (managers ?? []) as ManagerPinRow[]
}

async function matchManagerPin(managers: ManagerPinRow[], pin: string): Promise<ManagerPinRow | null> {
  for (const mgr of managers) {
    if (!mgr.pin_hash) continue
    try {
      const ok = await bcrypt.compare(pin, mgr.pin_hash)
      if (ok) {
        return mgr
      }
    } catch {
      continue
    }
  }
  return null
}

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
