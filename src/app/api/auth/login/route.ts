import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, applyRateLimitHeaders, getClientIp } from '@/lib/api/rate-limit'
import type { User } from '@/types/database'

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
  try {
    // 1. Per-IP rate limit (5 attempts / 15 min — auth tier).
    const ip = getClientIp(request)
    const ipRl = await checkRateLimit('auth', `login:ip:${ip}`)
    if (!ipRl.allowed) {
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
    const emailRl = await checkRateLimit('auth', `login:email:${email.toLowerCase().trim()}`)
    if (!emailRl.allowed) {
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
    console.error('[auth/login] failed:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
