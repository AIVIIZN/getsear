import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { applyRateLimitHeaders, checkRateLimit, getClientIp } from '@/lib/api/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const rl = await checkRateLimit('auth', `logout:${getClientIp(request)}`)
    if (!rl.allowed) {
      const res = apiError(429, 'Too many sign-out requests. Please wait before trying again.')
      applyRateLimitHeaders(res.headers, rl)
      res.headers.set('Retry-After', String(rl.retryAfterSeconds))
      return res
    }

    const supabase = await createClient()
    await supabase.auth.signOut()

    const res = NextResponse.json({ success: true })
    applyRateLimitHeaders(res.headers, rl)
    return res
  } catch {
    return apiError(500, 'Failed to sign out. Please try again.')
  }
}
