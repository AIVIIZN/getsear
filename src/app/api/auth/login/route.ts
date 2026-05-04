import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, applyRateLimitHeaders, getClientIp } from '@/lib/api/rate-limit'
import { audit } from '@/lib/audit/log'
import { getReqLoggerFromRequest } from '@/lib/observability/req-context'
import type { User } from '@/types/database'

/**
 * Redact an email for audit storage. Keeps the first 2 chars of the local
 * part + the domain + an 8-char SHA-256 prefix so an investigator can match
 * "the same attacker hit alice@x.com 50 times" without storing the full PII.
 *   alice@example.com -> al***@example.com (h:1a2b3c4d)
 */
function redactEmail(raw: string): string {
  const trimmed = raw.toLowerCase().trim()
  const at = trimmed.indexOf('@')
  const hash = createHash('sha256').update(trimmed).digest('hex').slice(0, 8)
  if (at <= 0) return `(invalid) (h:${hash})`
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  const prefix = local.slice(0, Math.min(2, local.length))
  return `${prefix}***@${domain} (h:${hash})`
}

type UserProfile = Pick<
  User,
  'id' | 'org_id' | 'email' | 'first_name' | 'last_name' | 'display_name' | 'role' | 'location_ids' | 'avatar_url' | 'is_active'
>

const GENERIC_AUTH_ERROR = 'Invalid email or password.'

/**
 * POST /api/auth/login
 *
 * SECURITY (V5.99.7):
 *   - Rate-limited per IP AND per email (5 attempts / 15 min) to prevent
 *     credential-stuffing.
 *   - Returns identical 401 for "no such user", "wrong password", and
 *     "deactivated account" branches to prevent user-enumeration.
 *   - On rate-limit, returns 429 with Retry-After header.
 */
export async function POST(request: NextRequest) {
  const t0 = Date.now()
  const rlog = getReqLoggerFromRequest(request, {
    route: '/api/auth/login',
    method: 'POST',
  })

  try {
    // 1. Per-IP rate limit (5 attempts / 15 min — auth tier).
    const ip = getClientIp(request)
    const ipRl = await checkRateLimit('auth', `login:ip:${ip}`)
    if (!ipRl.allowed) {
      rlog.warn('auth.login.rate_limited_ip', {
        status: 429,
        duration_ms: Date.now() - t0,
      })
      // Best-effort audit: we don't know the email yet (rate-limit fired BEFORE
      // body parse). Record an anonymous-tenant-skipped row carrying just IP.
      // recordSystem will silently skip if it can't resolve org_id.
      await audit.recordSystem({
        action: 'auth_login_rate_limited',
        entity_type: 'user',
        entity_id: null,
        description: `Login throttled at IP layer for ${ip}`,
        reason: 'rate_limit_ip',
        after_state: { scope: 'ip', client_ip: ip },
        request,
      })
      const res = NextResponse.json(
        { error: 'Too many login attempts. Please wait 15 minutes before trying again.' },
        { status: 429 }
      )
      applyRateLimitHeaders(res.headers, ipRl)
      res.headers.set('Retry-After', String(ipRl.retryAfterSeconds))
      return res
    }

    const body = (await request.json()) as { email?: string; password?: string }
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      )
    }

    // 2. Per-email rate limit (defends against attacker rotating IPs).
    const emailNormalised = email.toLowerCase().trim()
    const emailRl = await checkRateLimit('auth', `login:email:${emailNormalised}`)
    if (!emailRl.allowed) {
      rlog.warn('auth.login.rate_limited_email', {
        status: 429,
        duration_ms: Date.now() - t0,
      })
      // Audit: now we know the email — recordSystem will resolve the user's
      // org_id by email so the row lands in the correct tenant's audit feed.
      // The full email is NOT stored; only the redacted form + IP.
      await audit.recordSystem({
        action: 'auth_login_rate_limited',
        entity_type: 'user',
        entity_id: null,
        email_attempted: emailNormalised,
        email_redacted: redactEmail(emailNormalised),
        description: `Login throttled at per-email layer (${redactEmail(emailNormalised)})`,
        reason: 'rate_limit_email',
        after_state: { scope: 'email', client_ip: ip, email_redacted: redactEmail(emailNormalised) },
        request,
      })
      const res = NextResponse.json(
        { error: 'Too many login attempts. Please wait 15 minutes before trying again.' },
        { status: 429 }
      )
      applyRateLimitHeaders(res.headers, emailRl)
      res.headers.set('Retry-After', String(emailRl.retryAfterSeconds))
      return res
    }

    // Sign in via Supabase Auth
    const supabase = await createClient()
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password })

    if (authError || !authData.user) {
      rlog.warn('auth.login.failed', {
        status: 401,
        reason: 'invalid_credentials',
        duration_ms: Date.now() - t0,
      })
      const res = NextResponse.json(
        { error: GENERIC_AUTH_ERROR },
        { status: 401 }
      )
      applyRateLimitHeaders(res.headers, ipRl)
      return res
    }

    // Fetch full user profile from the users table
    const admin = createAdminClient()
    const { data, error: profileError } = await admin
      .from('users')
      .select('id, org_id, email, first_name, last_name, display_name, role, location_ids, avatar_url, is_active')
      .eq('id', authData.user.id)
      .single()

    const profile = data as UserProfile | null

    if (profileError || !profile) {
      // Sign out — generic error (no enumeration)
      await supabase.auth.signOut()
      rlog.warn('auth.login.failed', {
        status: 401,
        reason: 'profile_not_found',
        duration_ms: Date.now() - t0,
      })
      const res = NextResponse.json(
        { error: GENERIC_AUTH_ERROR },
        { status: 401 }
      )
      applyRateLimitHeaders(res.headers, ipRl)
      return res
    }

    if (!profile.is_active) {
      // Sign them back out — they shouldn't have a session.
      // Return the SAME generic error as wrong-password to prevent
      // attackers from enumerating active vs deactivated emails.
      await supabase.auth.signOut()
      rlog.warn('auth.login.failed', {
        user_id: profile.id,
        org_id: profile.org_id,
        status: 401,
        reason: 'inactive_account',
        duration_ms: Date.now() - t0,
      })
      const res = NextResponse.json(
        { error: GENERIC_AUTH_ERROR },
        { status: 401 }
      )
      applyRateLimitHeaders(res.headers, ipRl)
      return res
    }

    const displayName =
      profile.display_name ||
      [profile.first_name, profile.last_name].filter(Boolean).join(' ') ||
      profile.email ||
      'User'

    rlog.info('auth.login.ok', {
      user_id: profile.id,
      org_id: profile.org_id,
      status: 200,
      duration_ms: Date.now() - t0,
    })

    const res = NextResponse.json({
      user: {
        id: profile.id,
        email: profile.email,
        display_name: displayName,
        role: profile.role,
        org_id: profile.org_id,
        location_ids: profile.location_ids ?? [],
        avatar_url: profile.avatar_url,
      },
    })
    applyRateLimitHeaders(res.headers, ipRl)
    return res
  } catch (err) {
    rlog.error('auth.login.unhandled', {
      err: err instanceof Error ? err.message : String(err),
      err_stack: err instanceof Error ? err.stack : undefined,
      status: 500,
      duration_ms: Date.now() - t0,
    })
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
