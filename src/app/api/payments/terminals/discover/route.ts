import { apiError } from '@/lib/api/error-response'
/**
 * POST /api/payments/terminals/discover
 *
 * Triggers an mDNS / USB / Bluetooth / Tap-to-Pay scan and returns the merged
 * discovered-device list filtered by the org's bound processor.
 *
 * Auth: required.
 * Manager-PIN: required (sister 5.2.0c UI prompts for PIN before calling).
 *
 * Body: optional `{ manager_pin?: string, timeout_ms?: number }`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { validateManagerPinForAction } from '@/lib/auth/manager-pin'
import { applyRateLimitHeaders } from '@/lib/api/rate-limit'
import { requireProcessorBinding } from '@/lib/payments/processor-binding'
import { autoDetect } from '@/lib/payments/auto-detect'
import { audit } from '@/lib/audit/log'

const bodySchema = z.object({
  manager_pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be digits only'),
  timeout_ms: z.number().int().min(500).max(15000).optional(),
})

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Manager PIN is required', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  // SEC-1a: canonical helper validates against ACTIVE managers only.
  const supabase = createAdminClient()
  const pinResult = await validateManagerPinForAction({
    actor: user,
    pin: parsed.data.manager_pin,
    request,
    supabase,
  })
  if (pinResult.kind === 'rate_limited') {
    const res = apiError(429, 'Too many PIN attempts. Please wait 15 minutes before trying again.')
    applyRateLimitHeaders(res.headers, pinResult.rateLimit)
    res.headers.set('Retry-After', String(pinResult.rateLimit.retryAfterSeconds))
    return res
  }
  if (pinResult.kind === 'invalid') {
    return apiError(403, 'Invalid manager PIN')
  }
  const validatingManagerId = pinResult.manager_user_id

  // Resolve the org's bound processor — discovery is processor-aware.
  let binding
  try {
    binding = await requireProcessorBinding(user.org_id)
  } catch (err) {
    return apiError(400, 'No processor binding for this org. Onboarding incomplete.', { details: err instanceof Error ? err.message : String(err), extra: { "details": err instanceof Error ? err.message : String(err) } })
  }

  const devices = await autoDetect(binding.processor, {
    timeoutMs: parsed.data.timeout_ms ?? 5000,
  })

  // CLAUDE.md mandates an audit_log entry for every manager-PIN-gated action.
  await audit.record({
    actor: user,
    manager_pin_user_id: validatingManagerId,
    action: 'terminal_discovered',
    entity_type: 'terminal',
    entity_id: null,
    description: `Terminal discovery scan (${binding.processor}) — ${devices.length} device(s) found`,
    after_state: {
      processor: binding.processor,
      device_count: devices.length,
      timeout_ms: parsed.data.timeout_ms ?? 5000,
    },
    location_id: null,
  })

  return NextResponse.json({ data: devices })
}
