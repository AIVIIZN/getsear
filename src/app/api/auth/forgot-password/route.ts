import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/api/validate'
import { forgotPasswordSchema } from '@/lib/schemas/auth'
import { checkRateLimit, applyRateLimitHeaders, getClientIp } from '@/lib/api/rate-limit'
import { errorResponse, internalError } from '@/lib/api/error-response'

/**
 * POST /api/auth/forgot-password
 * Trigger a password reset email via Supabase Auth.
 * Always returns success to prevent email enumeration.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: auth tier (5 per 15 min)
    const rl = await checkRateLimit('auth', getClientIp(request))
    if (!rl.allowed) {
      const res = errorResponse(429, 'Too many requests. Please wait before trying again.', 'RATE_LIMITED')
      applyRateLimitHeaders(res.headers, rl)
      return res
    }

    const { email } = await validateBody(request, forgotPasswordSchema)

    const supabase = await createClient()

    // Determine the redirect URL based on environment
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://getsear.com'
    const redirectTo = `${origin}/auth/reset-password`

    // This will send an email if the account exists.
    // We intentionally don't check the error to prevent email enumeration.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    // Always return the same response regardless of whether email exists
    const response = NextResponse.json({
      data: {
        message: 'If an account exists with that email, you will receive a password reset link.',
      },
    })

    applyRateLimitHeaders(response.headers, rl)
    return response
  } catch (err) {
    if (err instanceof NextResponse) return err
    return internalError()
  }
}
