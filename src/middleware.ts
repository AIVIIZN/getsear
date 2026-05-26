import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { log, makeReqId } from '@/lib/observability/logger'

const PUBLIC_ROUTES = [
  '/login',
  '/pin-login',
  '/register',
  '/version',
  '/_next/static',
  '/_next/image',
  '/favicon.ico',
  '/api/auth',
  '/api/webhooks',
  '/api/billing/webhook',
  '/api/integrations/resend/webhook',
  '/api/terminals/activate',
  '/api/terminals/heartbeat',
  '/api/observability/rum',
  '/email-previews',
]

const CSRF_COOKIE = 'sear_csrf'
const CSRF_HEADER = 'x-csrf-token'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const UNSAFE_CSRF_EXEMPT_ROUTES = [
  '/api/billing/webhook',
  '/api/integrations/resend/webhook',
  '/api/webhooks',
  '/api/terminals/heartbeat',
]

function ensureCsrfCookie(request: NextRequest, response: NextResponse): void {
  if (request.cookies.get(CSRF_COOKIE)?.value) return

  response.cookies.set(CSRF_COOKIE, crypto.randomUUID(), {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
}

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (origin) return origin === request.nextUrl.origin

  const referer = request.headers.get('referer')
  if (!referer) return false

  try {
    return new URL(referer).origin === request.nextUrl.origin
  } catch {
    return false
  }
}

function hasValidCsrfToken(request: NextRequest): boolean {
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value
  const headerToken = request.headers.get(CSRF_HEADER)
  return Boolean(cookieToken && headerToken && cookieToken === headerToken)
}

function requiresCsrfCheck(request: NextRequest): boolean {
  const { pathname } = request.nextUrl
  if (SAFE_METHODS.has(request.method)) return false
  if (!pathname.startsWith('/api/')) return false
  return !UNSAFE_CSRF_EXEMPT_ROUTES.some((route) => pathname.startsWith(route))
}

/**
 * Edge middleware.
 *
 * Responsibilities:
 *   1. Assign a correlation ID (`x-request-id`) on every incoming request
 *      and thread it forward to route handlers (via `request.headers`) and
 *      back to the client (via the response header). (V7.1.2)
 *   2. Log API-route entries as one-line JSON to stdout. The route handler
 *      then emits an exit-time log line via the bound logger so a single
 *      request produces a request-start + request-end pair sharing a req_id.
 *   3. Public-route guard + Supabase-session refresh + auth-redirect.
 *
 * IMPORTANT: keep `updateSession` immediately followed by the auth check —
 * see the Supabase note in `src/lib/supabase/middleware.ts`.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Honour an upstream-supplied request id (e.g. from a load balancer that
  // already issued one) so the same id flows end-to-end. Otherwise generate
  // a fresh 16-char base36 id (no extra deps).
  const reqId = request.headers.get('x-request-id') ?? makeReqId()

  // Mutate the request headers so route handlers downstream see the same
  // x-request-id we logged here. NextResponse.next({ request }) inside
  // updateSession will pick this up and forward it.
  request.headers.set('x-request-id', reqId)

  // Log API-route entries only — page renders + static assets would 10x
  // the log volume without adding observability value.
  if (pathname.startsWith('/api/')) {
    log.info('http.request', {
      req_id: reqId,
      method: request.method,
      route: pathname,
    })
  }

  if (requiresCsrfCheck(request) && !isSameOrigin(request) && !hasValidCsrfToken(request)) {
    return NextResponse.json(
      {
        error: 'Cross-site request blocked.',
        code: 'FORBIDDEN',
        message: 'Cross-site request blocked.',
        action: 'Refresh the page and try again from Sear.',
      },
      { status: 403, headers: { 'x-request-id': reqId } }
    )
  }

  if (pathname === '/version') {
    const response = NextResponse.next()
    response.headers.set('x-request-id', reqId)
    ensureCsrfCookie(request, response)
    return response
  }

  if (pathname === '/api/billing/webhook') {
    const response = NextResponse.next()
    response.headers.set('x-request-id', reqId)
    return response
  }

  if (pathname.startsWith('/email-previews') && process.env.NODE_ENV !== 'production') {
    const response = NextResponse.next()
    response.headers.set('x-request-id', reqId)
    ensureCsrfCookie(request, response)
    return response
  }

  // Public routes: refresh session for cookie hygiene but skip auth redirect.
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    const { supabaseResponse } = await updateSession(request)
    supabaseResponse.headers.set('x-request-id', reqId)
    ensureCsrfCookie(request, supabaseResponse)
    return supabaseResponse
  }

  const { user, supabaseResponse } = await updateSession(request)

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    const redirect = Response.redirect(url) as Response
    // Response.redirect returns a plain Response; we can't mutate its
    // headers post-construction. The id still appears in the access log
    // we emitted above — that's sufficient for correlation on auth-fail.
    return redirect
  }

  supabaseResponse.headers.set('x-request-id', reqId)
  ensureCsrfCookie(request, supabaseResponse)
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)',
  ],
}
