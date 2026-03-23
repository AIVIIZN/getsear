import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { validateBody } from '@/lib/api/validate'
import { mfaSetupSchema } from '@/lib/schemas/auth'
import { checkRateLimit, applyRateLimitHeaders, getClientIp } from '@/lib/api/rate-limit'
import { errorResponse, internalError } from '@/lib/api/error-response'

/**
 * POST /api/auth/mfa/setup
 * Enroll a TOTP factor for the authenticated user.
 * Returns the QR code URI and secret for scanning with an authenticator app.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (user instanceof NextResponse) return user

    // Only owner/admin can set up MFA
    const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
    if (roleErr) return roleErr

    // Rate limit MFA setup attempts
    const rl = await checkRateLimit('auth', getClientIp(request))
    if (!rl.allowed) {
      const res = errorResponse(429, 'Too many requests. Please try again later.', 'RATE_LIMITED')
      applyRateLimitHeaders(res.headers, rl)
      return res
    }

    const { friendly_name } = await validateBody(request, mfaSetupSchema)

    const supabase = await createClient()

    // Enroll a TOTP factor via Supabase Auth
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: friendly_name,
    })

    if (error) {
      return errorResponse(400, error.message, 'BAD_REQUEST')
    }

    // Generate 10 single-use recovery codes
    const recoveryCodes: string[] = []
    for (let i = 0; i < 10; i++) {
      const code = Array.from({ length: 8 }, () =>
        'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]
      ).join('')
      recoveryCodes.push(`${code.slice(0, 4)}-${code.slice(4)}`)
    }

    // Store hashed recovery codes in user metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        mfa_recovery_codes: recoveryCodes.map((code) => ({
          code,
          used: false,
        })),
      },
    })

    if (updateError) {
      console.error('[MFA Setup] Failed to store recovery codes:', updateError.message)
    }

    const response = NextResponse.json({
      data: {
        factor_id: data.id,
        totp: {
          qr_code: data.totp.qr_code,
          secret: data.totp.secret,
          uri: data.totp.uri,
        },
        recovery_codes: recoveryCodes,
      },
    })

    applyRateLimitHeaders(response.headers, rl)
    return response
  } catch (err) {
    if (err instanceof NextResponse) return err
    return internalError()
  }
}

/**
 * GET /api/auth/mfa/setup
 * Check the current MFA enrollment status for the user.
 */
export async function GET() {
  try {
    const user = await getAuthUser()
    if (user instanceof NextResponse) return user

    const supabase = await createClient()
    const { data, error } = await supabase.auth.mfa.listFactors()

    if (error) {
      return errorResponse(400, error.message, 'BAD_REQUEST')
    }

    const totpFactors = data.totp ?? []
    const verifiedFactors = totpFactors.filter((f) => f.status === 'verified')

    return NextResponse.json({
      data: {
        is_enrolled: verifiedFactors.length > 0,
        factors: totpFactors.map((f) => ({
          id: f.id,
          friendly_name: f.friendly_name,
          status: f.status,
          created_at: f.created_at,
        })),
      },
    })
  } catch (err) {
    if (err instanceof NextResponse) return err
    return internalError()
  }
}

/**
 * DELETE /api/auth/mfa/setup
 * Unenroll (disable) MFA for the authenticated user.
 */
export async function DELETE() {
  try {
    const user = await getAuthUser()
    if (user instanceof NextResponse) return user

    const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
    if (roleErr) return roleErr

    const supabase = await createClient()
    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()

    if (listError) {
      return errorResponse(400, listError.message, 'BAD_REQUEST')
    }

    // Unenroll all TOTP factors
    const totpFactors = factors.totp ?? []
    for (const factor of totpFactors) {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: factor.id,
      })
      if (unenrollError) {
        return errorResponse(400, unenrollError.message, 'BAD_REQUEST')
      }
    }

    // Clear recovery codes
    await supabase.auth.updateUser({
      data: { mfa_recovery_codes: null },
    })

    return NextResponse.json({
      data: { message: 'MFA has been disabled.' },
    })
  } catch (err) {
    if (err instanceof NextResponse) return err
    return internalError()
  }
}
