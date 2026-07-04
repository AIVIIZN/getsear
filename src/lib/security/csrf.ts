import type { NextRequest } from 'next/server'

/**
 * CSRF protection primitives, shared by the edge middleware and unit tests.
 *
 * Design: double-submit cookie (`sear_csrf`) PLUS an Origin/Referer
 * same-origin check. A mutating API request is allowed when EITHER the
 * request is same-origin OR it carries a matching CSRF token. Cross-site
 * requests satisfy neither and are rejected.
 *
 * The subtle part is `resolveExternalOrigin`. In production the app runs
 * behind nginx which terminates TLS and proxies to Next.js over plain HTTP.
 * That means `request.nextUrl.origin` is `http://<internal-host>` while the
 * browser's `Origin` header is `https://getsear.com`. Comparing the two
 * directly (the old behaviour) rejected EVERY browser mutation — including
 * login — with a 403. We therefore reconstruct the true public origin from
 * the `X-Forwarded-Proto` / `X-Forwarded-Host` headers that nginx sets, and
 * accept a request whose Origin matches either the forwarded origin or the
 * raw `nextUrl.origin` (the latter covers local dev with no proxy).
 */

export const CSRF_COOKIE = 'sear_csrf'
export const CSRF_HEADER = 'x-csrf-token'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Mutating API routes that are exempt from CSRF because they are called by
 * external systems (webhooks) or non-browser device clients that authenticate
 * by other means and never carry a browser Origin/CSRF cookie.
 */
const UNSAFE_CSRF_EXEMPT_ROUTES = [
  '/api/billing/webhook',
  '/api/integrations/resend/webhook',
  '/api/webhooks',
  '/api/terminals/heartbeat',
]

/** Take the first value of a possibly comma-joined forwarded header. */
function firstForwardedValue(value: string | null): string | null {
  if (!value) return null
  const first = value.split(',')[0]?.trim()
  return first ? first : null
}

/**
 * The real public origin the browser sees, reconstructed from proxy headers.
 * Falls back to `nextUrl.origin` when no proxy headers are present (local dev).
 */
export function resolveExternalOrigin(request: NextRequest): string {
  const proto =
    firstForwardedValue(request.headers.get('x-forwarded-proto')) ??
    request.nextUrl.protocol.replace(/:$/, '')

  const host =
    firstForwardedValue(request.headers.get('x-forwarded-host')) ??
    request.headers.get('host') ??
    request.nextUrl.host

  return `${proto}://${host}`
}

/**
 * The set of origins we consider "ourselves". Includes both the proxy-derived
 * public origin and the raw request origin so the check works behind nginx AND
 * in local dev / direct-to-app requests.
 */
function allowedOrigins(request: NextRequest): Set<string> {
  return new Set([request.nextUrl.origin, resolveExternalOrigin(request)])
}

export function isSameOrigin(request: NextRequest): boolean {
  const allowed = allowedOrigins(request)

  const origin = request.headers.get('origin')
  if (origin) return allowed.has(origin)

  const referer = request.headers.get('referer')
  if (!referer) return false

  try {
    return allowed.has(new URL(referer).origin)
  } catch {
    return false
  }
}

export function hasValidCsrfToken(request: NextRequest): boolean {
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value
  const headerToken = request.headers.get(CSRF_HEADER)
  return Boolean(cookieToken && headerToken && cookieToken === headerToken)
}

export function requiresCsrfCheck(request: NextRequest): boolean {
  const { pathname } = request.nextUrl
  if (SAFE_METHODS.has(request.method)) return false
  if (!pathname.startsWith('/api/')) return false
  return !UNSAFE_CSRF_EXEMPT_ROUTES.some((route) => pathname.startsWith(route))
}

/**
 * True when the request must be rejected as cross-site: it is a CSRF-guarded
 * mutation that is neither same-origin nor carrying a valid double-submit token.
 */
export function isCsrfBlocked(request: NextRequest): boolean {
  return (
    requiresCsrfCheck(request) &&
    !isSameOrigin(request) &&
    !hasValidCsrfToken(request)
  )
}
