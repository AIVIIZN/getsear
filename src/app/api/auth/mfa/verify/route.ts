import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/api/validate'
import { mfaVerifySchema } from '@/lib/schemas/auth'
import { checkRateLimit, applyRateLimitHeaders, getClientIp } from '@/lib/api/rate-limit'
import { errorResponse, internalError } from '@/lib/api/error-response'

/**
 * POST /api/auth/mfa/verify
 * Verify a TOTP code during login or factor enrollment.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: auth tier (5 per 15 min)
    const rl = await checkRateLimit('auth', getClientIp(request))
    if (!rl.allowed) {
      const res = errorResponse(429, 'Too many verification attempts. Please wait.', 'RATE_LIMITED')
      applyRateLimitHeaders(res.headers, rl)
      return res
    }

    const { factor_id, challenge_id, code } = await validateBody(request, mfaVerifySchema)

    const supabase = await createClient()

    const { data, error } = await supabase.auth.mfa.verify({
      factorId: factor_id,
      challengeId: challenge_id,
      code,
    })

    if (error) {
      const response = errorResponse(401, 'Invalid authentication code. Please try again.', 'MFA_INVALID')
      applyRateLimitHeaders(response.headers, rl)
      return response
    }

    const response = NextResponse.json({
      data: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user,
      },
    })

    applyRateLimitHeaders(response.headers, rl)
    return response
  } catch (err) {
    if (err instanceof NextResponse) return err
    return internalError()
  }
}
