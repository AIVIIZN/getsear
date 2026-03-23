import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser, requireRole, type AuthUser } from './auth'
import { validateBody, validateQuery } from './validate'
import { requireLocation } from './require-location'
import { checkRateLimit, applyRateLimitHeaders, type RateLimitTier, type RateLimitResult } from './rate-limit'
import { internalError } from './error-response'

interface RouteHandlerOptions {
  /** Rate limit tier for this route. Defaults to 'standard'. */
  rateLimit?: RateLimitTier
  /** If set, only users with these roles can access. */
  roles?: string[]
  /** If true, skip auth check (for public routes). */
  isPublic?: boolean
  /** Zod schema for POST/PUT/PATCH body validation. */
  bodySchema?: z.ZodSchema
  /** Zod schema for GET query parameter validation. */
  querySchema?: z.ZodSchema
  /** If true, check location_id from body or query params. */
  checkLocation?: boolean
}

interface HandlerContext<TBody = unknown, TQuery = unknown> {
  user: AuthUser
  body: TBody
  query: TQuery
  request: NextRequest
  params: Record<string, string | string[] | undefined>
  rateLimitResult: RateLimitResult
}

/**
 * Wrap a route handler with standard security middleware:
 * - Authentication
 * - Role checking
 * - Rate limiting
 * - Zod body/query validation
 * - Location authorization
 * - Consistent error handling
 *
 * Usage:
 * ```ts
 * export const POST = createHandler({
 *   roles: ['owner', 'admin'],
 *   bodySchema: mySchema,
 *   rateLimit: 'standard',
 *   checkLocation: true,
 * }, async ({ user, body, request }) => {
 *   // Your handler logic here
 *   return NextResponse.json({ data })
 * })
 * ```
 */
export function createHandler<TBody = unknown, TQuery = unknown>(
  options: RouteHandlerOptions,
  handler: (ctx: HandlerContext<TBody, TQuery>) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string | string[] | undefined>> }
  ) => {
    try {
      // Resolve params
      const resolvedParams = context?.params ? await context.params : {}

      // Auth check
      let user: AuthUser
      if (options.isPublic) {
        user = { id: 'anonymous', email: '', org_id: '', role: 'readonly', location_ids: [] }
      } else {
        const authResult = await getAuthUser()
        if (authResult instanceof NextResponse) return authResult
        user = authResult
      }

      // Role check
      if (options.roles) {
        const roleErr = requireRole(user, options.roles)
        if (roleErr) return roleErr
      }

      // Rate limiting
      const tier = options.rateLimit ?? 'standard'
      const identifier = options.isPublic ? request.headers.get('x-forwarded-for') || '0.0.0.0' : user.id
      const rl = await checkRateLimit(tier, identifier)
      if (!rl.allowed) {
        const res = NextResponse.json(
          { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
          { status: 429 }
        )
        applyRateLimitHeaders(res.headers, rl)
        return res
      }

      // Body validation
      let body: TBody = undefined as TBody
      if (options.bodySchema) {
        body = await validateBody(request, options.bodySchema) as TBody
      }

      // Query validation
      let query: TQuery = undefined as TQuery
      if (options.querySchema) {
        query = validateQuery(request, options.querySchema) as TQuery
      }

      // Location check
      if (options.checkLocation && !options.isPublic) {
        const locationId = extractLocation(body, query, request)
        if (locationId) {
          const locErr = requireLocation(user, locationId)
          if (locErr) return locErr
        }
      }

      // Call handler
      const response = await handler({
        user,
        body,
        query,
        request,
        params: resolvedParams,
        rateLimitResult: rl,
      })

      // Add rate limit headers to response
      applyRateLimitHeaders(response.headers, rl)
      return response
    } catch (err) {
      if (err instanceof NextResponse) return err
      console.error('[RouteHandler] Unhandled error:', err)
      return internalError()
    }
  }
}

function extractLocation(body: unknown, query: unknown, request: NextRequest): string | null {
  if (body && typeof body === 'object' && 'location_id' in body) {
    return (body as Record<string, unknown>).location_id as string
  }
  if (query && typeof query === 'object' && 'location_id' in query) {
    return (query as Record<string, unknown>).location_id as string
  }
  return request.nextUrl.searchParams.get('location_id')
}
