import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const PUBLIC_ROUTES = [
  '/login',
  '/pin-login',
  '/_next/static',
  '/_next/image',
  '/favicon.ico',
  '/api/auth',
  '/api/webhooks',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes through without auth check
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    const { supabaseResponse } = await updateSession(request)
    return supabaseResponse
  }

  const { user, supabaseResponse } = await updateSession(request)

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return Response.redirect(url)
  }

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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
