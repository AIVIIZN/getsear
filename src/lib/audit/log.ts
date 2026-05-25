/**
 * Audit log — V5.4.3 expansion.
 *
 * Single entry point for every privileged action in the system (void, comp,
 * discount, cash drop, manager override, drawer-open, refund, settlement,
 * chargeback, customer merge, etc). Each call inserts an APPEND-ONLY row
 * into `public.audit_log` with full forensic context:
 *   - actor (user_id, user_name, user_role) — who initiated
 *   - manager_pin_user_id                    — who *authorised* via PIN
 *   - action, entity_type, entity_id         — what + on what
 *   - before_state, after_state              — typed jsonb snapshots
 *   - reason                                 — free-text rationale
 *   - ip_address, user_agent, terminal_id    — request context
 *
 * The table has no UPDATE or DELETE policy for authenticated callers
 * (migration 20260504063726). Service-role bypasses RLS for support
 * tooling that needs to purge a tenant on offboarding.
 *
 * Sister tasks:
 *   - 5.4.1 (optimistic locking) — captures `before_state` from the
 *     If-Match snapshot the route already loaded.
 *   - 5.4.2 (comp/void/refund routes) — calls audit.record(...) at the
 *     end of every successful mutation.
 *
 * USAGE:
 * ```ts
 * import { audit } from '@/lib/audit/log'
 *
 * await audit.record({
 *   actor: user,                            // AuthUser from getAuthUser()
 *   manager_pin_user_id: pinAuthorizer?.id, // null if no PIN required
 *   action: 'payment_voided',
 *   entity_type: 'payment',
 *   entity_id: payment.id,
 *   before_state: paymentBefore,
 *   after_state: paymentAfter,
 *   reason: body.reason,
 *   description: `Voided $${(amount/100).toFixed(2)} payment`,
 *   request,                                // optional, captures IP + UA
 *   location_id: payment.location_id,
 *   terminal_id: terminalId,
 * })
 * ```
 */

import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AuthUser } from '@/lib/api/auth'
import { toCsv as csvSerialize, type AuditCsvRow } from '@/lib/audit/csv'

// ---------------------------------------------------------------------------
// Action vocabulary — narrow string union of every privileged action so the
// type system catches typos. Add new actions here, never inline.
// ---------------------------------------------------------------------------
export type AuditAction =
  // Payments
  | 'payment_voided'
  | 'payment_refunded'
  | 'payment_chargeback_received'
  | 'payment_chargeback_disputed'
  | 'payment_settled'
  // Orders
  | 'order_voided'
  | 'order_comped'
  | 'order_reopened'
  | 'order_discount_applied'
  | 'order_modified_after_close'
  // Cash management
  | 'cash_drawer_opened'
  | 'cash_drawer_count_open'
  | 'cash_drawer_count_close'
  | 'cash_drawer_variance'
  | 'cash_drop'
  | 'cash_pickup'
  | 'cash_paid_in'
  | 'cash_paid_out'
  // Staff / auth
  | 'manager_override'
  | 'manager_pin_changed'
  | 'manager_pin_verify_failed'
  | 'manager_pin_lockout'
  | 'auth_login_failed'
  | 'staff_role_changed'
  | 'staff_clocked_out_by_manager'
  | 'auth_login_rate_limited'
  // Customers
  | 'customer_merged'
  | 'customer_data_exported'
  | 'crm_guest_created'
  | 'crm_guest_updated'
  | 'crm_guest_note_added'
  | 'crm_guest_tagged'
  | 'crm_guest_attached_to_order'
  | 'crm_guest_detached_from_order'
  | 'crm_guest_merged'
  | 'crm_guest_merge_dismissed'
  | 'crm_guest_kept_separate'
  | 'crm_guest_household_marked'
  | 'crm_guest_consent_updated'
  | 'crm_guest_intelligence_recalculated'
  | 'crm_privacy_request_created'
  | 'crm_privacy_request_updated'
  | 'crm_privacy_data_exported'
  | 'crm_privacy_guest_anonymized'
  | 'crm_import_validated'
  | 'crm_import_completed'
  | 'crm_import_rolled_back'
  | 'crm_loyalty_program_created'
  | 'crm_loyalty_account_enrolled'
  | 'crm_loyalty_points_earned'
  | 'crm_loyalty_reward_created'
  | 'crm_loyalty_reward_redeemed'
  | 'crm_loyalty_review_item_updated'
  | 'crm_segment_created'
  | 'crm_segment_updated'
  | 'crm_segment_ai_drafted'
  | 'crm_segment_previewed'
  | 'crm_segment_materialized'
  // Tenant admin
  | 'audit_log_exported'
  | 'org_settings_changed'
  | 'terminal_registered'
  | 'terminal_removed'
  | 'terminal_discovered'
  // Menu
  | 'menu_photo_generated'

export type EntityType =
  | 'payment'
  | 'order'
  | 'cash_drawer'
  | 'cash_event'
  | 'user'
  | 'customer'
  | 'guest'
  | 'guest_note'
  | 'guest_tag'
  | 'guest_merge_candidate'
  | 'guest_household'
  | 'privacy_request'
  | 'crm_import_job'
  | 'loyalty_program'
  | 'loyalty_account'
  | 'loyalty_ledger'
  | 'loyalty_reward'
  | 'loyalty_redemption'
  | 'loyalty_review_item'
  | 'crm_segment'
  | 'organization'
  | 'terminal'
  | 'audit_log'
  | 'campaign'
  | 'menu_item'
  | 'discount'
  | 'house_account'

// ---------------------------------------------------------------------------
// Public input shape
// ---------------------------------------------------------------------------
export interface AuditRecordInput {
  actor: Pick<AuthUser, 'id' | 'email' | 'org_id' | 'role'>
  manager_pin_user_id?: string | null
  action: AuditAction
  entity_type: EntityType
  entity_id: string | null
  before_state?: Record<string, unknown> | null
  after_state?: Record<string, unknown> | null
  reason?: string | null
  description?: string
  location_id?: string | null
  terminal_id?: string | null
  /** Pass the NextRequest to auto-capture IP and user-agent. */
  request?: NextRequest | Request
}

// ---------------------------------------------------------------------------
// Internal: best-effort actor name lookup (cached in-process per actor.id)
// ---------------------------------------------------------------------------
const userNameCache = new Map<string, { name: string | null; role: string | null }>()

async function getActorMeta(
  actorId: string,
  fallbackEmail: string | null
): Promise<{ user_name: string | null; user_role: string | null }> {
  const cached = userNameCache.get(actorId)
  if (cached) {
    return { user_name: cached.name, user_role: cached.role }
  }

  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('first_name, last_name, display_name, role, email')
    .eq('id', actorId)
    .single()

  const profile = data as
    | { first_name?: string | null; last_name?: string | null; display_name?: string | null; role?: string | null; email?: string | null }
    | null

  const name =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    profile?.email ||
    fallbackEmail ||
    null
  const role = profile?.role ?? null

  userNameCache.set(actorId, { name, role })
  return { user_name: name, user_role: role }
}

function extractIp(req: NextRequest | Request | undefined): string | null {
  if (!req) return null
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    // First entry in XFF is the original client.
    return xff.split(',')[0]!.trim() || null
  }
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return null
}

function extractUserAgent(req: NextRequest | Request | undefined): string | null {
  if (!req) return null
  return req.headers.get('user-agent') || null
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Insert an audit row. NEVER throws — audit failures must not break the
 * caller's mutation. Errors are logged to console.error (and Sentry once
 * wired) so on-call sees them, but the calling route returns success.
 */
async function record(input: AuditRecordInput): Promise<{ id: string | null; error: string | null }> {
  try {
    const admin = createAdminClient()
    const { user_name, user_role } = await getActorMeta(input.actor.id, input.actor.email ?? null)

    const description =
      input.description ||
      `${input.action.replace(/_/g, ' ')} on ${input.entity_type}${input.entity_id ? ` ${input.entity_id}` : ''}`

    const row = {
      org_id: input.actor.org_id,
      location_id: input.location_id ?? null,
      user_id: input.actor.id,
      user_name,
      user_role: user_role as never, // text column accepts any string
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      description,
      // Mirror to deprecated columns for backward compat with old readers.
      previous_state: input.before_state ?? null,
      new_state: input.after_state ?? null,
      before_state: input.before_state ?? null,
      after_state: input.after_state ?? null,
      reason: input.reason ?? null,
      manager_pin_user_id: input.manager_pin_user_id ?? null,
      ip_address: extractIp(input.request),
      user_agent: extractUserAgent(input.request),
      terminal_id: input.terminal_id ?? null,
    }

    const { data, error } = await admin
      .from('audit_log')
      .insert(row as never)
      .select('id')
      .single()

    if (error) {
      console.error('[audit] insert failed', { action: input.action, entity_type: input.entity_type, error: error.message })
      return { id: null, error: error.message }
    }

    return { id: (data as { id: string } | null)?.id ?? null, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown audit error'
    console.error('[audit] unexpected error', { action: input.action, message })
    return { id: null, error: message }
  }
}

// ---------------------------------------------------------------------------
// System (pre-auth) audit — for events that fire BEFORE we know which user
// the request belongs to (e.g., login rate-limit, signup abuse, password
// reset throttle). We attempt to resolve the org_id by email so the row
// lands in the correct tenant; if the email matches no user we skip the
// insert (we can't guess which tenant to attribute a stranger's action to).
// ---------------------------------------------------------------------------
export interface SystemAuditInput {
  action: AuditAction
  entity_type: EntityType
  entity_id?: string | null
  /** Plaintext email the request was attempted with — used to resolve org_id. */
  email_attempted?: string | null
  /** Pre-redacted/hashed email to store in the audit row metadata. */
  email_redacted?: string | null
  /** Override the resolved org_id. Use only when caller already knows it. */
  org_id?: string | null
  description?: string
  reason?: string | null
  before_state?: Record<string, unknown> | null
  after_state?: Record<string, unknown> | null
  request?: NextRequest | Request
}

/**
 * Audit a system-level (pre-auth) event. Best-effort: returns silently if
 * org_id cannot be resolved. The audit_log row carries user_id=null.
 */
async function recordSystem(input: SystemAuditInput): Promise<{ id: string | null; error: string | null }> {
  try {
    const admin = createAdminClient()

    let orgId = input.org_id ?? null
    if (!orgId && input.email_attempted) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO(5.99.7): tighten Supabase generated-types coverage so we can drop the `any` cast
      const { data } = await (admin.from('users') as any)
        .select('org_id')
        .eq('email', input.email_attempted.toLowerCase().trim())
        .maybeSingle()
      orgId = (data as { org_id?: string } | null)?.org_id ?? null
    }

    if (!orgId) {
      // No tenant attribution possible — skip silently. The 4xx response
      // already returned to the client is the security boundary.
      return { id: null, error: null }
    }

    const description =
      input.description ||
      `${input.action.replace(/_/g, ' ')} (system event)`

    const row = {
      org_id: orgId,
      location_id: null,
      user_id: null,
      user_name: input.email_redacted ?? null,
      user_role: null as never,
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      description,
      previous_state: input.before_state ?? null,
      new_state: input.after_state ?? null,
      before_state: input.before_state ?? null,
      after_state: input.after_state ?? null,
      reason: input.reason ?? null,
      manager_pin_user_id: null,
      ip_address: extractIp(input.request),
      user_agent: extractUserAgent(input.request),
      terminal_id: null,
    }

    const { data, error } = await admin
      .from('audit_log')
      .insert(row as never)
      .select('id')
      .single()

    if (error) {
      console.error('[audit] system insert failed', { action: input.action, error: error.message })
      return { id: null, error: error.message }
    }
    return { id: (data as { id: string } | null)?.id ?? null, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown audit error'
    console.error('[audit] system unexpected error', { action: input.action, message })
    return { id: null, error: message }
  }
}

// ---------------------------------------------------------------------------
// Query API — used by the back-office page + CSV export
// ---------------------------------------------------------------------------
export interface AuditListFilters {
  org_id: string
  date_from?: string | null
  date_to?: string | null
  actor_user_id?: string | null
  manager_pin_user_id?: string | null
  action?: AuditAction | null
  entity_type?: EntityType | null
  /** Free-text search against description. */
  search?: string | null
  limit?: number
  offset?: number
}

export interface AuditListRow {
  id: string
  created_at: string
  action: string
  entity_type: string
  entity_id: string | null
  description: string
  user_id: string | null
  user_name: string | null
  user_role: string | null
  manager_pin_user_id: string | null
  manager_pin_user_name: string | null
  manager_pin_user_email: string | null
  actor_email: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  reason: string | null
  ip_address: string | null
}

const MAX_LIST_LIMIT = 500
const DEFAULT_LIST_LIMIT = 100

async function list(filters: AuditListFilters): Promise<{ rows: AuditListRow[]; total: number }> {
  const admin = createAdminClient()
  const limit = Math.min(filters.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT)
  const offset = Math.max(filters.offset ?? 0, 0)

  let q = admin
    .from('audit_log')
    .select(
      'id, created_at, action, entity_type, entity_id, description, user_id, user_name, user_role, manager_pin_user_id, before_state, after_state, reason, ip_address',
      { count: 'exact' }
    )
    .eq('org_id', filters.org_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (filters.date_from) q = q.gte('created_at', filters.date_from)
  if (filters.date_to) q = q.lte('created_at', filters.date_to)
  if (filters.actor_user_id) q = q.eq('user_id', filters.actor_user_id)
  if (filters.manager_pin_user_id) q = q.eq('manager_pin_user_id', filters.manager_pin_user_id)
  if (filters.action) q = q.eq('action', filters.action)
  if (filters.entity_type) q = q.eq('entity_type', filters.entity_type)
  if (filters.search) q = q.ilike('description', `%${filters.search.replace(/[%_]/g, '\\$&')}%`)

  const { data, count, error } = await q
  if (error) {
    console.error('[audit] list failed', { error: error.message })
    return { rows: [], total: 0 }
  }

  const baseRows = (data ?? []) as Array<Omit<AuditListRow, 'manager_pin_user_name' | 'manager_pin_user_email' | 'actor_email'>>

  // Resolve actor + manager-PIN user emails/names in a single batch.
  const idsToHydrate = new Set<string>()
  for (const r of baseRows) {
    if (r.user_id) idsToHydrate.add(r.user_id)
    if (r.manager_pin_user_id) idsToHydrate.add(r.manager_pin_user_id)
  }

  const userMap = new Map<string, { email: string | null; name: string | null }>()
  if (idsToHydrate.size > 0) {
    const { data: users } = await admin
      .from('users')
      .select('id, email, first_name, last_name, display_name')
      .in('id', Array.from(idsToHydrate))
      .eq('org_id', filters.org_id)

    for (const u of (users ?? []) as Array<{
      id: string
      email: string | null
      first_name: string | null
      last_name: string | null
      display_name: string | null
    }>) {
      const name =
        u.display_name ||
        [u.first_name, u.last_name].filter(Boolean).join(' ') ||
        u.email ||
        null
      userMap.set(u.id, { email: u.email, name })
    }
  }

  const rows: AuditListRow[] = baseRows.map((r) => {
    const actor = r.user_id ? userMap.get(r.user_id) : null
    const pinner = r.manager_pin_user_id ? userMap.get(r.manager_pin_user_id) : null
    return {
      ...r,
      actor_email: actor?.email ?? null,
      manager_pin_user_name: pinner?.name ?? null,
      manager_pin_user_email: pinner?.email ?? null,
    }
  })

  return { rows, total: count ?? rows.length }
}

// ---------------------------------------------------------------------------
// CSV — delegates to the dependency-free serialiser in ./csv.ts so tests
// can exercise it without needing the Supabase env vars.
// ---------------------------------------------------------------------------
function toCsv(rows: AuditListRow[]): string {
  // AuditListRow has a strict superset of the CSV row shape, so the cast is safe.
  return csvSerialize(rows as AuditCsvRow[])
}

// ---------------------------------------------------------------------------
// Namespace export — call sites use `audit.record(...)` / `audit.list(...)`.
// ---------------------------------------------------------------------------
export const audit = {
  record,
  recordSystem,
  list,
  toCsv,
}
