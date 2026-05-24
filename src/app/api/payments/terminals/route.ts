/**
 * /api/payments/terminals
 *
 * GET  — list registered payment terminals for the caller's org.
 * POST — register a discovered device. Manager-PIN required. Rejects any
 *        device whose driver isn't `'live'` for the org's bound processor.
 *
 * The persistence target is a `payment_terminals` table provisioned by the
 * sister migration task (5.2.0a). If the table is missing at runtime we
 * gracefully degrade per the spec: GET returns [], POST returns 200 with a
 * `warning` field. We never fabricate row IDs — the warned response uses a
 * synthetic `pending:` prefix so callers can detect the deferred state.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser } from '@/lib/api/auth'
import { validateManagerPinForAction } from '@/lib/auth/manager-pin'
import { applyRateLimitHeaders } from '@/lib/api/rate-limit'
import { requireProcessorBinding } from '@/lib/payments/processor-binding'
import { COMPATIBILITY_MATRIX } from '@/lib/payments/compatibility-matrix'
import { getDriver } from '@/lib/payments/terminal-registry'

const PG_UNDEFINED_TABLE = '42P01'

const registerSchema = z.object({
  device_class: z.string().min(1).max(64),
  identifier: z.string().min(1).max(255),
  manager_pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be digits only'),
  /** Optional human label, e.g. "Bar pinpad" */
  name: z.string().min(1).max(120).optional(),
})

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('payment_terminals') as any)
    .select('id, device_class, mfg, model, identifier, last_seen_at, status')
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })

  if (error) {
    const code = (error as { code?: string }).code
    if (code === PG_UNDEFINED_TABLE) {
      // Sister migration 5.2.0a hasn't merged. Don't 500 — return empty list
      // so the UI can render its empty state.
      return NextResponse.json({ data: [] })
    }
    console.error('[GET /api/payments/terminals] failed:', error)
    return NextResponse.json({ error: 'Failed to load terminals' }, { status: 500 })
  }

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { device_class, identifier, manager_pin, name } = parsed.data

  const supabase = createAdminClient()

  // SEC-1a: canonical helper validates against active managers only.
  const pinResult = await validateManagerPinForAction({
    actor: user,
    pin: manager_pin,
    request,
    supabase,
  })
  if (pinResult.kind === 'rate_limited') {
    const res = NextResponse.json({ error: 'Too many PIN attempts. Please wait 15 minutes before trying again.' }, { status: 429 })
    applyRateLimitHeaders(res.headers, pinResult.rateLimit)
    res.headers.set('Retry-After', String(pinResult.rateLimit.retryAfterSeconds))
    return res
  }
  if (pinResult.kind === 'invalid') {
    return NextResponse.json({ error: 'Invalid manager PIN' }, { status: 403 })
  }
  const validatingManagerId = pinResult.manager_user_id

  // Resolve the org's bound processor.
  let binding
  try {
    binding = await requireProcessorBinding(user.org_id)
  } catch (err) {
    return NextResponse.json(
      {
        error: 'No processor binding for this org',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 400 }
    )
  }

  // Compatibility check — single source of truth.
  const matrixEntry = COMPATIBILITY_MATRIX[device_class]
  if (!matrixEntry) {
    return NextResponse.json(
      { error: `Unknown device_class: ${device_class}`, code: 'unknown_device_class' },
      { status: 400 }
    )
  }

  const cert = matrixEntry.processors[binding.processor]
  if (cert !== 'live') {
    const reason =
      cert === 'pending_cert'
        ? `Driver ${device_class} is pending Valor EMV certification — not enabled in production.`
        : cert === 'unsupported_until_psp_listed'
        ? `${device_class} requires Valor on the platform PSP allowlist; status: not yet listed.`
        : `${device_class} is not supported with processor ${binding.processor}.`
    return NextResponse.json(
      { error: reason, code: 'driver_not_certified', cert_status: cert ?? null },
      { status: 400 }
    )
  }

  // Driver registry sanity check — every 'live' device_class must have a
  // driver file. (Tap-to-Pay platforms intentionally have no driver and
  // can never be 'live' here without a code change.)
  const driver = getDriver(device_class)
  if (!driver) {
    return NextResponse.json(
      {
        error: `No driver registered for ${device_class}`,
        code: 'no_driver',
      },
      { status: 500 }
    )
  }

  // Insert — if `payment_terminals` doesn't exist yet, fall back to a
  // synthetic success (per spec, sister migration may not have merged).
  const insertRow = {
    org_id: user.org_id,
    device_class,
    identifier,
    mfg: driver.meta.mfg,
    model: driver.meta.model,
    name: name ?? `${driver.meta.mfg} ${driver.meta.model}`,
    status: 'registered',
    registered_by: user.id,
    registered_with_manager_id: validatingManagerId,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('payment_terminals') as any)
    .insert(insertRow)
    .select('id, device_class, status')
    .single()

  if (error) {
    const code = (error as { code?: string }).code
    if (code === PG_UNDEFINED_TABLE) {
      // Sister migration 5.2.0a hasn't merged. Return success-with-warning so
      // the UI can render the deferred state without prompting a real failure.
      return NextResponse.json({
        data: {
          id: `pending:${device_class}:${identifier}`,
          device_class,
          status: 'pending_persistence',
        },
        warning:
          'terminals table not yet provisioned; binding deferred until migration 5.2.0a lands',
      })
    }
    console.error('[POST /api/payments/terminals] insert failed:', error)
    return NextResponse.json(
      { error: 'Failed to register terminal' },
      { status: 500 }
    )
  }

  return NextResponse.json({ data })
}
