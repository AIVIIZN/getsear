import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { upsertClick } from '@/lib/marketing/analytics'

/**
 * GET /api/marketing/track/click?r={tracking_id}&u={base64_url}
 *
 * Email click redirect. PUBLIC endpoint. Decodes the base64-encoded
 * destination URL, records the click against the recipient identified by
 * `tracking_id`, and 302s the user to the destination.
 *
 * Security:
 *   - tracking_id must be a UUID v4 (zod-validated).
 *   - Decoded URL must be http: or https:. Anything else (javascript:,
 *     data:, file:, vbscript:, blob:, etc.) is rejected with a generic
 *     400 — we deliberately do NOT echo the rejected URL back.
 *   - The redirect status (302) is set explicitly to avoid the default
 *     307 which can leak request method semantics.
 *
 * Performance budget: <100ms. One indexed read + one indexed write.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  r: z.string().uuid(),
  u: z.string().min(1),
})

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

function badRequest(): NextResponse {
  return NextResponse.json(
    { code: 'invalid_request' },
    { status: 400, headers: { 'Cache-Control': 'no-store' } }
  )
}

/**
 * Decode a URL-safe or standard base64 string. Returns null on any failure.
 *
 * Email-template emitters tend to strip `=` padding, so we tolerate both
 * URL-safe (`-_`) and standard (`+/`) alphabets and re-pad as needed.
 */
function decodeBase64Url(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
    const buf = Buffer.from(padded, 'base64')
    if (buf.length === 0) return null
    const decoded = buf.toString('utf-8')
    // Reject anything with embedded NULs or control characters that could
    // confuse downstream URL parsers.
    for (let i = 0; i < decoded.length; i++) {
      const code = decoded.charCodeAt(i)
      if (code < 0x20 || code === 0x7f) return null
    }
    return decoded
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const parsed = QuerySchema.safeParse({
    r: request.nextUrl.searchParams.get('r') ?? undefined,
    u: request.nextUrl.searchParams.get('u') ?? undefined,
  })

  if (!parsed.success) return badRequest()

  const decoded = decodeBase64Url(parsed.data.u)
  if (!decoded) return badRequest()

  let target: URL
  try {
    target = new URL(decoded)
  } catch {
    return badRequest()
  }

  if (!ALLOWED_PROTOCOLS.has(target.protocol)) {
    return badRequest()
  }

  // Record the click before redirecting. If the DB write fails we still
  // honor the redirect — the user-experience contract trumps analytics.
  try {
    await upsertClick(parsed.data.r, target.toString())
  } catch {
    // Swallow; click telemetry is best-effort.
  }

  return NextResponse.redirect(target.toString(), {
    status: 302,
    headers: { 'Cache-Control': 'no-store' },
  })
}
