import type { AuthUser } from './auth'
import { locationAccessDenied } from './error-response'

/**
 * Verify the authenticated user has access to the given location.
 *
 * A user can access a location if:
 * 1. Their role is 'platform_admin' (superuser)
 * 2. Their role is 'owner' (access to all locations in the org)
 * 3. The location_id is in their location_ids array
 *
 * Throws a 403 NextResponse if access is denied.
 *
 * Usage:
 * ```ts
 * const user = await getAuthUser()
 * if (user instanceof NextResponse) return user
 * const locationCheck = requireLocation(user, locationId)
 * if (locationCheck) return locationCheck
 * ```
 */
export function requireLocation(
  user: AuthUser,
  locationId: string | null | undefined
) {
  // If no location_id provided, skip the check (some routes are org-wide)
  if (!locationId) return null

  // Platform admins and owners have access to all locations
  if (user.role === 'platform_admin' || user.role === 'owner') {
    return null
  }

  // Check if user is assigned to this location
  if (user.location_ids && user.location_ids.includes(locationId)) {
    return null
  }

  return locationAccessDenied(locationId)
}

/**
 * Extract location_id from request body, query params, or route context.
 * Used as a convenience to pair with requireLocation.
 */
export function extractLocationId(
  body?: Record<string, unknown>,
  searchParams?: URLSearchParams
): string | null {
  if (body?.location_id && typeof body.location_id === 'string') {
    return body.location_id
  }
  if (searchParams?.get('location_id')) {
    return searchParams.get('location_id')
  }
  return null
}
