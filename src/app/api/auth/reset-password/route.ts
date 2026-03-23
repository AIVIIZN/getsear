import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/api/validate'
import { resetPasswordSchema } from '@/lib/schemas/auth'
import { checkRateLimit, applyRateLimitHeaders, getClientIp } from '@/lib/api/rate-limit'
import { errorResponse, internalError } from '@/lib/api/error-response'

/**
 * POST /api/auth/reset-password
 * Update the user's password after clicking the reset link.
 * The reset token is handled by Supabase Auth automatically through the URL callback.
 * The user session is established when they click the reset link.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const rl = await checkRateLimit('auth', getClientIp(request))
    if (!rl.allowed) {
      const res = errorResponse(429, 'Too many requests. Please wait.', 'RATE_LIMITED')
      applyRateLimitHeaders(res.headers, rl)
      return res
    }

    const { password } = await validateBody(request, resetPasswordSchema)

    const supabase = await createClient()

    // The user must have a valid session from the reset link
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return errorResponse(401, 'Invalid or expired reset link. Please request a new one.', 'UNAUTHORIZED')
    }

    // Update the password
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    if (updateError) {
      return errorResponse(400, updateError.message, 'BAD_REQUEST')
    }

    const response = NextResponse.json({
      data: {
        message: 'Password updated successfully. You can now sign in with your new password.',
      },
    })

    applyRateLimitHeaders(response.headers, rl)
    return response
  } catch (err) {
    if (err instanceof NextResponse) return err
    return internalError()
  }
}
