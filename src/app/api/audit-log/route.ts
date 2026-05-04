/**
 * GET /api/audit-log
 *
 * V5.4.3 — paginated, filterable read of the audit log for the
 * back-office UI. Owner + admin + manager roles only (cashiers/servers
 * cannot pull other employees' actions). Always tenant-scoped.
 *
 * The CSV export lives at /api/audit-log/export and is owner-only +
 * PIN-gated. This endpoint is the lighter "show me the table" query.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/api/auth'
import { audit, type AuditAction, type EntityType } from '@/lib/audit/log'
import { badRequest, forbidden } from '@/lib/api/error-response'
import { checkRateLimit, applyRateLimitHeaders } from '@/lib/api/rate-limit'

const querySchema = z.object({
  date_from: z.string().datetime({ offset: true }).optional(),
  date_to: z.string().datetime({ offset: true }).optional(),
  actor_user_id: z.string().uuid().optional(),
  manager_pin_user_id: z.string().uuid().optional(),
  action: z.string().min(1).max(64).optional(),
  entity_type: z.string().min(1).max(64).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
})

const READABLE_ROLES = new Set(['owner', 'admin', 'manager'])

export async function GET(request: NextRequest) {
  const authResult = await getAuthUser()
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  const rl = await checkRateLimit('standard', user.id)
  if (!rl.allowed) {
    const res = NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429 }
    )
    applyRateLimitHeaders(res.headers, rl)
    return res
  }

  if (!READABLE_ROLES.has(user.role)) {
    return forbidden('Audit log access is restricted to managers and above.')
  }

  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return badRequest('Invalid query parameters', { issues: parsed.error.flatten() })
  }
  const q = parsed.data

  const { rows, total } = await audit.list({
    org_id: user.org_id,
    date_from: q.date_from ?? null,
    date_to: q.date_to ?? null,
    actor_user_id: q.actor_user_id ?? null,
    manager_pin_user_id: q.manager_pin_user_id ?? null,
    action: (q.action as AuditAction | undefined) ?? null,
    entity_type: (q.entity_type as EntityType | undefined) ?? null,
    search: q.search ?? null,
    limit: q.limit ?? 100,
    offset: q.offset ?? 0,
  })

  const res = NextResponse.json({ data: rows, total })
  applyRateLimitHeaders(res.headers, rl)
  return res
}
