import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  applyRateLimitHeaders,
  checkRateLimit,
  getClientIp,
} from '@/lib/api/rate-limit'
import { audit } from '@/lib/audit/log'
import { getReqLoggerFromRequest } from '@/lib/observability/req-context'
import type { User } from '@/types/database'

type UserWithPin = Pick<
  User,
  | 'id'
  | 'org_id'
  | 'email'
  | 'first_name'
  | 'last_name'
  | 'display_name'
  | 'role'
  | 'location_ids'
  | 'avatar_url'
  | 'pin_hash'
  | 'is_active'
>

const pinLoginSchema = z.object({
  user_id: z.string().uuid(),
  pin: z.string().min(4).max(10),
})

const GENERIC_AUTH_ERROR = 'Incorrect PIN.'

/**
 * POST /api/auth/pin-login
 *
 * SEC-1a (V5.99.7 successor):
 *   - Replaces the in-memory `Map`-based attempt tracker (which reset on every
 *     PM2 worker restart and did not share state across workers) with the
 *     Redis-backed sliding-window rate limiter at `auth` tier (5/15min).
 *   - Per-IP limit defends against a single attacker hammering one terminal.
 *   - Per-user limit defends against an attacker rotating IPs through a proxy
 *     pool against a single account.
 *   - Audit row written on every rate-limit trip via `audit.recordSystem` so
 *     back-office dashboards surface brute-force patterns.
 */
export async function POST(request: NextRequest) {
  const t0 = Date.now()
  const rlog = getReqLoggerFromRequest(request, {
    route: '/api/auth/pin-login',
    method: 'POST',
  })

  try {
    // 1. Per-IP rate limit (5 attempts / 15 min — auth tier).
    const ip = getClientIp(request)
    const ipRl = await checkRateLimit('auth', `pin-login:ip:${ip}`)
    if (!ipRl.allowed) {
      rlog.warn('auth.pin_login.rate_limited_ip', {
        status: 429,
        duration_ms: Date.now() - t0,
      })
      await audit.recordSystem({
        action: 'auth_login_rate_limited',
        entity_type: 'user',
        entity_id: null,
        description: `PIN login throttled at IP layer for ${ip}`,
        reason: 'rate_limit_ip',
        after_state: { scope: 'ip', client_ip: ip, route: 'pin-login' },
        request,
      })
      const res = NextResponse.json(
        {
          error:
            'Too many failed PIN attempts. Please wait 15 minutes before trying again.',
        },
        { status: 429 }
      )
      applyRateLimitHeaders(res.headers, ipRl)
      res.headers.set('Retry-After', String(ipRl.retryAfterSeconds))
      return res
    }

    // Validate body shape with Zod (replaces ad-hoc presence check).
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = pinLoginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'User ID and PIN are required.', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { user_id, pin } = parsed.data

    // 2. Per-user rate limit (defends against attacker rotating IPs).
    const userRl = await checkRateLimit('auth', `pin-login:user:${user_id}`)
    if (!userRl.allowed) {
      rlog.warn('auth.pin_login.rate_limited_user', {
        user_id,
        status: 429,
        duration_ms: Date.now() - t0,
      })
      // Resolve the user's org_id so the audit row lands in the right tenant.
      const adminEarly = createAdminClient()
      const { data: userOrg } = await adminEarly
        .from('users')
        .select('org_id')
        .eq('id', user_id)
        .maybeSingle()
      const orgId = (userOrg as { org_id?: string } | null)?.org_id ?? null
      await audit.recordSystem({
        action: 'auth_login_rate_limited',
        entity_type: 'user',
        entity_id: user_id,
        org_id: orgId,
        description: `PIN login throttled at per-user layer for ${user_id}`,
        reason: 'rate_limit_user',
        after_state: { scope: 'user', user_id, client_ip: ip, route: 'pin-login' },
        request,
      })
      const res = NextResponse.json(
        {
          error:
            'Too many failed PIN attempts on this account. Please wait 15 minutes before trying again.',
          locked_until: userRl.resetAt * 1000,
        },
        { status: 429 }
      )
      applyRateLimitHeaders(res.headers, userRl)
      res.headers.set('Retry-After', String(userRl.retryAfterSeconds))
      return res
    }

    // Fetch user with pin_hash
    const admin = createAdminClient()
    const { data, error: userError } = await admin
      .from('users')
      .select(
        'id, org_id, email, first_name, last_name, display_name, role, location_ids, avatar_url, pin_hash, is_active'
      )
      .eq('id', user_id)
      .single()

    const user = data as UserWithPin | null

    // Use a SINGLE generic 401 for "no user", "deactivated", and "wrong PIN"
    // so an attacker cannot enumerate which condition tripped. The per-user
    // rate-limit slot has already been consumed above.
    if (userError || !user) {
      rlog.warn('auth.pin_login.failed', {
        user_id,
        reason: 'user_not_found',
        status: 401,
        duration_ms: Date.now() - t0,
      })
      const res = NextResponse.json(
        { error: GENERIC_AUTH_ERROR },
        { status: 401 }
      )
      applyRateLimitHeaders(res.headers, userRl)
      return res
    }

    if (!user.is_active) {
      rlog.warn('auth.pin_login.failed', {
        user_id,
        org_id: user.org_id,
        reason: 'inactive_account',
        status: 401,
        duration_ms: Date.now() - t0,
      })
      const res = NextResponse.json(
        { error: GENERIC_AUTH_ERROR },
        { status: 401 }
      )
      applyRateLimitHeaders(res.headers, userRl)
      return res
    }

    if (!user.pin_hash) {
      // Distinct error here — the cashier needs to know to fall back to email.
      rlog.warn('auth.pin_login.failed', {
        user_id,
        org_id: user.org_id,
        reason: 'no_pin_set',
        status: 400,
        duration_ms: Date.now() - t0,
      })
      const res = NextResponse.json(
        {
          error:
            'PIN login is not set up for this account. Use email login instead.',
        },
        { status: 400 }
      )
      applyRateLimitHeaders(res.headers, userRl)
      return res
    }

    // Verify PIN with bcrypt
    const pinValid = await bcrypt.compare(pin, user.pin_hash)
    if (!pinValid) {
      rlog.warn('auth.pin_login.failed', {
        user_id,
        org_id: user.org_id,
        reason: 'invalid_pin',
        status: 401,
        duration_ms: Date.now() - t0,
      })
      const res = NextResponse.json(
        { error: GENERIC_AUTH_ERROR },
        { status: 401 }
      )
      applyRateLimitHeaders(res.headers, userRl)
      return res
    }

    // PIN valid.
    const displayName =
      user.display_name ||
      [user.first_name, user.last_name].filter(Boolean).join(' ') ||
      user.email ||
      'User'

    rlog.info('auth.pin_login.ok', {
      user_id: user.id,
      org_id: user.org_id,
      status: 200,
      duration_ms: Date.now() - t0,
    })

    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        display_name: displayName,
        role: user.role,
        org_id: user.org_id,
        location_ids: user.location_ids ?? [],
        avatar_url: user.avatar_url,
      },
    })
    applyRateLimitHeaders(res.headers, userRl)
    return res
  } catch (err) {
    rlog.error('auth.pin_login.unhandled', {
      err: err instanceof Error ? err.message : String(err),
      err_stack: err instanceof Error ? err.stack : undefined,
      status: 500,
      duration_ms: Date.now() - t0,
    })
    console.error('[auth/pin-login]', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
