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
  '/api/integrations/resend/webhook',
  '/api/terminals/activate',
  '/api/terminals/heartbeat',
  '/api/observability/rum',
]

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

  if (pathname === '/version') {
    const response = NextResponse.next()
    response.headers.set('x-request-id', reqId)
    return response
  }

  // Public routes: refresh session for cookie hygiene but skip auth redirect.
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    const { supabaseResponse } = await updateSession(request)
    supabaseResponse.headers.set('x-request-id', reqId)
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
