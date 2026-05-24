/**
 * GET /api/audit-log/export
 *
 * V5.4.3 — owner-only, manager-PIN-gated, org-scoped CSV export of the
 * audit log. RFC 4180 with a UTF-8 BOM so Excel opens it cleanly.
 *
 * Query params (all optional):
 *   date_from              ISO 8601 timestamp inclusive
 *   date_to                ISO 8601 timestamp inclusive
 *   actor_user_id          uuid
 *   manager_pin_user_id    uuid
 *   action                 string (one of AuditAction)
 *   entity_type            string
 *   search                 substring of description (ilike)
 *   manager_pin            REQUIRED — owner's PIN, validated against pin_hash
 *
 * Auth model:
 *   1. Cookie-session must resolve to a user (else 401).
 *   2. Role must be `owner` (else 403). The export is a privileged
 *      operation — owners only, never managers/admins.
 *   3. Manager-PIN must be supplied + match the calling owner's pin_hash.
 *      This prevents "owner walked away with cookie session live" from
 *      enabling a silent bulk export. The calling owner re-asserts
 *      physical presence.
 *
 * Once those gates pass, the export itself is recorded as an audit row
 * (`audit_log_exported`) so the audit log audits its own export.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { compare } from 'bcryptjs'
import { getAuthUser } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { audit, type AuditAction, type EntityType, type AuditListFilters } from '@/lib/audit/log'
import { badRequest, forbidden, internalError, unauthorized } from '@/lib/api/error-response'
import { checkRateLimit, applyRateLimitHeaders } from '@/lib/api/rate-limit'

const querySchema = z.object({
  date_from: z.string().datetime({ offset: true }).optional(),
  date_to: z.string().datetime({ offset: true }).optional(),
  actor_user_id: z.string().uuid().optional(),
  manager_pin_user_id: z.string().uuid().optional(),
  action: z.string().min(1).max(64).optional(),
  entity_type: z.string().min(1).max(64).optional(),
  search: z.string().max(200).optional(),
  manager_pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be digits only'),
  /** Hard cap to keep the file shippable. */
  limit: z.coerce.number().int().positive().max(50_000).optional(),
})

/** Hard cap on the number of rows we'll include in a single export. */
const EXPORT_HARD_LIMIT = 50_000
/** How many rows we pull per page from Supabase. */
const PAGE_SIZE = 1_000

export async function GET(request: NextRequest) {
  // 1. Auth
  const authResult = await getAuthUser()
  if (authResult instanceof NextResponse) return authResult
  const user = authResult

  // 2. Rate-limit per actor (export is heavy; abuse it and you'll trip
  // the limiter regardless of org size).
  const rl = await checkRateLimit('bulk', user.id)
  if (!rl.allowed) {
    const res = NextResponse.json(
      { error: 'Too many export requests. Please wait.', code: 'RATE_LIMITED' },
      { status: 429 }
    )
    applyRateLimitHeaders(res.headers, rl)
    return res
  }

  // 3. Role gate — owner only.
  if (user.role !== 'owner') {
    return forbidden('Audit log export is restricted to org owners.')
  }

  // 4. Validate query.
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return badRequest('Invalid query parameters', { issues: parsed.error.flatten() })
  }
  const q = parsed.data

  // 5. Validate the manager_pin against the calling owner's own pin_hash.
  // We don't accept any manager's PIN here — the *owner* must re-authenticate.
  const admin = createAdminClient()
  const { data: ownerRow } = await admin
    .from('users')
    .select('id, pin_hash')
    .eq('id', user.id)
    .single()

  const owner = ownerRow as { id: string; pin_hash: string | null } | null
  if (!owner?.pin_hash) {
    return forbidden('Owner has no PIN set. Configure a PIN before exporting the audit log.')
  }

  const pinValid = await compare(q.manager_pin, owner.pin_hash)
  if (!pinValid) {
    // Audit the failed attempt — a brute-force on the owner PIN should be visible.
    await audit.record({
      actor: { id: user.id, email: user.email, org_id: user.org_id, role: user.role },
      action: 'audit_log_exported',
      entity_type: 'audit_log',
      entity_id: null,
      reason: 'failed_owner_pin_validation',
      after_state: { success: false, filters: { ...q, manager_pin: '[redacted]' } },
      request,
    })
    return unauthorized('Invalid PIN.')
  }

  // 6. Stream the export.
  // We page through audit.list() in PAGE_SIZE chunks so a tenant with
  // millions of rows doesn't OOM us. The total cap is EXPORT_HARD_LIMIT.
  const baseFilters: Omit<AuditListFilters, 'limit' | 'offset'> = {
    org_id: user.org_id,
    date_from: q.date_from ?? null,
    date_to: q.date_to ?? null,
    actor_user_id: q.actor_user_id ?? null,
    manager_pin_user_id: q.manager_pin_user_id ?? null,
    action: (q.action as AuditAction | undefined) ?? null,
    entity_type: (q.entity_type as EntityType | undefined) ?? null,
    search: q.search ?? null,
  }

  const cap = Math.min(q.limit ?? EXPORT_HARD_LIMIT, EXPORT_HARD_LIMIT)
  const allRows: Awaited<ReturnType<typeof audit.list>>['rows'] = []

  try {
    for (let offset = 0; offset < cap; offset += PAGE_SIZE) {
      const pageLimit = Math.min(PAGE_SIZE, cap - offset)
      const page = await audit.list({ ...baseFilters, limit: pageLimit, offset })
      allRows.push(...page.rows)
      if (page.rows.length < pageLimit) break
    }
  } catch (err) {
    console.error('[audit-export] page fetch failed', err)
    return internalError('Failed to read audit log.')
  }

  const csv = audit.toCsv(allRows)

  // 7. Audit the successful export itself.
  await audit.record({
    actor: { id: user.id, email: user.email, org_id: user.org_id, role: user.role },
    action: 'audit_log_exported',
    entity_type: 'audit_log',
    entity_id: null,
    reason: 'csv_export',
    after_state: {
      success: true,
      row_count: allRows.length,
      filters: { ...q, manager_pin: '[redacted]' },
    },
    request,
  })

  const filename = `audit-log-${user.org_id}-${new Date().toISOString().slice(0, 10)}.csv`
  const res = new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
  applyRateLimitHeaders(res.headers, rl)
  return res
}
