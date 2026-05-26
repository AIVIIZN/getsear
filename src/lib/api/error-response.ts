import { NextResponse } from 'next/server'

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PRECONDITION_REQUIRED'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST'
  | 'MFA_REQUIRED'
  | 'MFA_INVALID'
  | 'ACCOUNT_LOCKED'
  | 'LOCATION_ACCESS_DENIED'

interface ApiErrorPayload {
  error: string
  code: ApiErrorCode
  message: string
  action: string
  details?: unknown
  [key: string]: unknown
}

interface ApiErrorOptions {
  code?: ApiErrorCode
  action?: string
  details?: unknown
  extra?: Record<string, unknown>
}

const DEFAULT_ACTION_BY_CODE: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: 'Fix the highlighted fields and try again.',
  UNAUTHORIZED: 'Sign in again to continue.',
  FORBIDDEN: 'Ask a manager to grant access.',
  NOT_FOUND: 'Go back and refresh the page.',
  CONFLICT: 'Refresh the page, review the latest changes, and try again.',
  RATE_LIMITED: 'Wait a moment, then try again.',
  PRECONDITION_REQUIRED: 'Refresh the order and try the change again.',
  INTERNAL_ERROR: 'Try again. If it still fails, contact support.',
  BAD_REQUEST: 'Review the request and try again.',
  MFA_REQUIRED: 'Complete multi-factor verification to continue.',
  MFA_INVALID: 'Check the code and try again.',
  ACCOUNT_LOCKED: 'Wait for the lockout to expire or ask a manager for help.',
  LOCATION_ACCESS_DENIED: 'Switch locations or ask a manager for access.',
}

function codeForStatus(status: number): ApiErrorCode {
  if (status === 400) return 'BAD_REQUEST'
  if (status === 401) return 'UNAUTHORIZED'
  if (status === 403) return 'FORBIDDEN'
  if (status === 404) return 'NOT_FOUND'
  if (status === 409) return 'CONFLICT'
  if (status === 422) return 'VALIDATION_ERROR'
  if (status === 428) return 'PRECONDITION_REQUIRED'
  if (status === 429) return 'RATE_LIMITED'
  return 'INTERNAL_ERROR'
}

function sentenceCase(message: string): string {
  const trimmed = message.trim()
  if (!trimmed) return 'Something went wrong.'
  const withCapital = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  return /[.!?]$/.test(withCapital) ? withCapital : `${withCapital}.`
}

function toDisplayMessage(error: unknown): string {
  if (typeof error === 'string') return sentenceCase(error)
  if (error instanceof Error) return sentenceCase(error.message)
  return 'Something went wrong.'
}

/**
 * Build a consistent API error response.
 * Every error from any route returns the same shape:
 * { error: string, code: string, message: string, action: string, details?: unknown }
 */
export function errorResponse(
  status: number,
  error: unknown,
  code: ApiErrorCode,
  details?: unknown,
  action?: string,
  extra?: Record<string, unknown>
): NextResponse<ApiErrorPayload> {
  const message = toDisplayMessage(error)
  const body: ApiErrorPayload = {
    ...(extra ?? {}),
    error: message,
    code,
    message,
    action: action ?? DEFAULT_ACTION_BY_CODE[code],
  }
  if (details) {
    body.details = details
  }
  return NextResponse.json(body, { status })
}

export function apiError(
  status: number,
  error: unknown,
  options: ApiErrorOptions = {}
): NextResponse<ApiErrorPayload> {
  const code = options.code ?? codeForStatus(status)
  return errorResponse(status, error, code, options.details, options.action, options.extra)
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
