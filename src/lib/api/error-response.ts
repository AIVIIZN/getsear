import { NextResponse } from 'next/server'

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST'
  | 'MFA_REQUIRED'
  | 'MFA_INVALID'
  | 'ACCOUNT_LOCKED'
  | 'LOCATION_ACCESS_DENIED'

interface ApiErrorPayload {
  error: string
  code: ApiErrorCode
  details?: Record<string, unknown>
}

/**
 * Build a consistent API error response.
 * Every error from any route returns the same shape:
 * { error: string, code: string, details?: object }
 */
export function errorResponse(
  status: number,
  error: string,
  code: ApiErrorCode,
  details?: Record<string, unknown>
): NextResponse<ApiErrorPayload> {
  const body: ApiErrorPayload = { error, code }
  if (details) {
    body.details = details
  }
  return NextResponse.json(body, { status })
}

/** 400 Bad Request */
export function badRequest(error: string, details?: Record<string, unknown>): NextResponse<ApiErrorPayload> {
  return errorResponse(400, error, 'BAD_REQUEST', details)
}

/** 400 Validation Error — use for Zod failures */
export function validationError(
  fieldErrors: Record<string, string[]>,
  formErrors?: string[]
): NextResponse<ApiErrorPayload> {
  return errorResponse(400, 'Validation failed', 'VALIDATION_ERROR', {
    fieldErrors,
    ...(formErrors && formErrors.length > 0 ? { formErrors } : {}),
  })
}

/** 401 Unauthorized */
export function unauthorized(error = 'Unauthorized'): NextResponse<ApiErrorPayload> {
  return errorResponse(401, error, 'UNAUTHORIZED')
}

/** 403 Forbidden */
export function forbidden(error = 'Forbidden: insufficient permissions'): NextResponse<ApiErrorPayload> {
  return errorResponse(403, error, 'FORBIDDEN')
}

/** 403 Location access denied */
export function locationAccessDenied(locationId: string): NextResponse<ApiErrorPayload> {
  return errorResponse(403, 'Access denied to this location', 'LOCATION_ACCESS_DENIED', {
    location_id: locationId,
  })
}

/** 404 Not Found */
export function notFound(resource = 'Resource'): NextResponse<ApiErrorPayload> {
  return errorResponse(404, `${resource} not found`, 'NOT_FOUND')
}

/** 409 Conflict */
export function conflict(error: string): NextResponse<ApiErrorPayload> {
  return errorResponse(409, error, 'CONFLICT')
}

/** 429 Rate Limited */
export function rateLimited(retryAfterSeconds: number): NextResponse<ApiErrorPayload> {
  const res = errorResponse(429, `Too many requests. Please wait ${retryAfterSeconds} seconds.`, 'RATE_LIMITED', {
    retry_after: retryAfterSeconds,
  })
  res.headers.set('Retry-After', String(retryAfterSeconds))
  return res
}

/** 500 Internal Error — never expose stack traces */
export function internalError(error = 'An unexpected error occurred. Please try again.'): NextResponse<ApiErrorPayload> {
  return errorResponse(500, error, 'INTERNAL_ERROR')
}

/** MFA required during login */
export function mfaRequired(factorId: string): NextResponse<ApiErrorPayload> {
  return errorResponse(403, 'MFA verification required', 'MFA_REQUIRED', {
    factor_id: factorId,
  })
}

/** MFA code invalid */
export function mfaInvalid(error = 'Invalid authentication code'): NextResponse<ApiErrorPayload> {
  return errorResponse(401, error, 'MFA_INVALID')
}
