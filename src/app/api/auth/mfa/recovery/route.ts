import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/api/validate'
import { mfaRecoverySchema } from '@/lib/schemas/auth'
import { checkRateLimit, applyRateLimitHeaders, getClientIp } from '@/lib/api/rate-limit'
import { errorResponse, internalError } from '@/lib/api/error-response'

interface RecoveryCodeEntry {
  code: string
  used: boolean
}

/**
 * POST /api/auth/mfa/recovery
 * Use a recovery code to bypass TOTP verification.
 * Recovery codes are single-use.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: auth tier
    const rl = await checkRateLimit('auth', getClientIp(request))
    if (!rl.allowed) {
      const res = errorResponse(429, 'Too many attempts. Please wait.', 'RATE_LIMITED')
      applyRateLimitHeaders(res.headers, rl)
      return res
    }

    const { recovery_code } = await validateBody(request, mfaRecoverySchema)

    const supabase = await createClient()

    // Get the current user (they should have completed password auth already)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return errorResponse(401, 'Unauthorized', 'UNAUTHORIZED')
    }

    // Check recovery codes in user metadata
    const recoveryCodes: RecoveryCodeEntry[] = user.user_metadata?.mfa_recovery_codes ?? []

    if (recoveryCodes.length === 0) {
      return errorResponse(400, 'No recovery codes found. Contact your administrator.', 'BAD_REQUEST')
    }

    // Normalize the input code (strip dashes and whitespace, uppercase)
    const normalizedInput = recovery_code.replace(/[-\s]/g, '').toUpperCase()

    const matchIndex = recoveryCodes.findIndex((entry) => {
      const normalizedStored = entry.code.replace(/[-\s]/g, '').toUpperCase()
      return normalizedStored === normalizedInput && !entry.used
    })

    if (matchIndex === -1) {
      return errorResponse(401, 'Invalid or already used recovery code.', 'MFA_INVALID')
    }

    // Mark the code as used
    recoveryCodes[matchIndex].used = true

    const { error: updateError } = await supabase.auth.updateUser({
      data: { mfa_recovery_codes: recoveryCodes },
    })

    if (updateError) {
      console.error('[MFA Recovery] Failed to mark code as used:', updateError.message)
    }

    const remainingCodes = recoveryCodes.filter((c) => !c.used).length

    const response = NextResponse.json({
      data: {
        message: 'Recovery code accepted. You are now logged in.',
        remaining_codes: remainingCodes,
        warning: remainingCodes <= 2
          ? `Only ${remainingCodes} recovery codes remaining. Generate new codes in Settings > Security.`
          : undefined,
      },
    })

    applyRateLimitHeaders(response.headers, rl)
    return response
  } catch (err) {
    if (err instanceof NextResponse) return err
    return internalError()
  }
}
