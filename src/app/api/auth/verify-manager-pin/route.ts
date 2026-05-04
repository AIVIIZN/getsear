import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { verifyManagerPinWithRateLimit } from '@/lib/auth/manager-pin'
import { applyRateLimitHeaders } from '@/lib/api/rate-limit'

/**
 * POST /api/auth/verify-manager-pin
 *
 * Verifies a 4-digit PIN belongs to a user with manager/admin/owner role.
 * Used for mid-shift approvals (voids, comps, discounts, overrides).
 * Does NOT create a session — just validates and returns the manager's identity.
 *
 * SECURITY (V5.99.7):
 *   - Rate-limited per IP, per caller user_id, AND per org (15-min sliding window).
 *   - Every failed attempt + lockout writes an audit_log row.
 *   - Filters by is_active=true so terminated managers cannot authorise.
 */
export async function POST(request: NextRequest) {
  // Caller must be authenticated (any role)
  const caller = await getAuthUser()
  if (caller instanceof NextResponse) return caller

  let body: { pin?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { pin } = body
  if (!pin || typeof pin !== 'string' || pin.length !== 4) {
    return NextResponse.json({ error: 'A 4-digit PIN is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const result = await verifyManagerPinWithRateLimit({
    caller,
    pin,
    request,
    supabase,
  })

  if (result.kind === 'rate_limited') {
    const res = NextResponse.json(
      {
        error: 'Too many PIN attempts. Please wait 15 minutes before trying again.',
        scope: result.scope,
      },
      { status: 429 }
    )
    applyRateLimitHeaders(res.headers, result.rateLimit)
    res.headers.set('Retry-After', String(result.rateLimit.retryAfterSeconds))
    return res
  }

  if (result.kind === 'invalid') {
    const res = NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
    applyRateLimitHeaders(res.headers, result.ipRateLimit)
    return res
  }

  // Valid PIN
  const res = NextResponse.json({
    data: {
      user_id: result.manager_user_id,
      display_name: result.manager_display_name,
      role: result.manager_role,
    },
  })
  applyRateLimitHeaders(res.headers, result.ipRateLimit)
  return res
}
