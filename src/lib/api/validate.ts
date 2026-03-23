import { NextRequest } from 'next/server'
import { z, ZodError } from 'zod'
import { validationError, badRequest } from './error-response'

/**
 * Validate the JSON body of a request against a Zod schema.
 * Returns the parsed data on success, or throws a NextResponse error.
 *
 * Usage:
 * ```ts
 * const data = await validateBody(request, mySchema)
 * // data is fully typed and validated
 * ```
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<T> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw badRequest('Invalid JSON in request body')
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    throw formatZodError(result.error)
  }
  return result.data
}

/**
 * Validate URL search params against a Zod schema.
 * Converts searchParams to a plain object first.
 *
 * Usage:
 * ```ts
 * const query = validateQuery(request, querySchema)
 * ```
 */
export function validateQuery<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): T {
  const params = request.nextUrl.searchParams
  const obj: Record<string, string> = {}
  params.forEach((value, key) => {
    obj[key] = value
  })

  const result = schema.safeParse(obj)
  if (!result.success) {
    throw formatZodError(result.error)
  }
  return result.data
}

/**
 * Validate route params (e.g., [id]) against a Zod schema.
 *
 * Usage:
 * ```ts
 * const { id } = validateParams({ id: params.id }, paramsSchema)
 * ```
 */
export function validateParams<T>(
  params: Record<string, string | string[] | undefined>,
  schema: z.ZodSchema<T>
): T {
  const result = schema.safeParse(params)
  if (!result.success) {
    throw formatZodError(result.error)
  }
  return result.data
}

/**
 * Format a Zod error into a consistent API error response.
 */
function formatZodError(error: ZodError) {
  const flattened = error.flatten()
  return validationError(
    flattened.fieldErrors as Record<string, string[]>,
    flattened.formErrors
  )
}

/**
 * Common Zod primitives used across schemas.
 */
export const zodUuid = z.string().uuid('Must be a valid UUID')
export const zodPaginationPage = z.coerce.number().int().min(1).default(1)
export const zodPaginationLimit = z.coerce.number().int().min(1).max(100).default(50)
export const zodDateString = z.string().datetime({ offset: true }).or(z.string().date())
export const zodOptionalUuid = z.string().uuid().optional().nullable()
export const zodMoney = z.string().regex(/^\d+\.\d{2}$/, 'Must be a decimal with 2 places (e.g., "12.50")')
export const zodMoneyCents = z.number().int().min(0)
