/**
 * Audit log — STUB (5.4.2 cycle 2).
 *
 * Owned by sister batch 5.4.3. This stub mirrors the REAL public surface area
 * published in `v5-batch-5.4.3-audit-log/src/lib/audit/log.ts` so 5.4.2 routes
 * (comp / void / payments-refund) can compile against the same shape before
 * INTEGRATE.sh overwrites this file with the real implementation.
 *
 * The stub falls back to a best-effort insert into `audit_log` so the trail
 * isn't blank during the merge window. Errors are swallowed — never throw
 * from the audit layer because a failed audit must not roll back the user-
 * visible action.
 */

import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AuthUser } from '@/lib/api/auth'

// ---------------------------------------------------------------------------
// Action vocabulary — kept in sync with 5.4.3's enum so call sites that pass
// `'order_comped' | 'order_voided' | 'payment_refunded' | ...` resolve.
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
  | 'staff_role_changed'
  | 'staff_clocked_out_by_manager'
  // Customers
  | 'customer_merged'
  | 'customer_data_exported'
  // Tenant admin
  | 'audit_log_exported'
  | 'org_settings_changed'
  | 'terminal_registered'
  | 'terminal_removed'

export type EntityType =
  | 'payment'
  | 'order'
  | 'cash_drawer'
  | 'cash_event'
  | 'user'
  | 'customer'
  | 'organization'
  | 'terminal'
  | 'audit_log'
  | 'campaign'
  | 'menu_item'
  | 'discount'
  | 'house_account'

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

function extractIp(req: NextRequest | Request | undefined): string | null {
  if (!req) return null
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim() || null
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return null
}

function extractUserAgent(req: NextRequest | Request | undefined): string | null {
  if (!req) return null
  return req.headers.get('user-agent') || null
}

/**
 * Stub recorder. Mirrors 5.4.3's signature; writes a best-effort row into
 * `audit_log`. Failures are swallowed and console.error'd.
 */
async function record(
  input: AuditRecordInput
): Promise<{ id: string | null; error: string | null }> {
  try {
    const admin = createAdminClient()
    const description =
      input.description ||
      `${input.action.replace(/_/g, ' ')} on ${input.entity_type}${
        input.entity_id ? ` ${input.entity_id}` : ''
      }`

    const row = {
      org_id: input.actor.org_id,
      location_id: input.location_id ?? null,
      user_id: input.actor.id,
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      description,
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from('audit_log') as any)
      .insert(row)
      .select('id')
      .single()

    if (error) {
      console.error('[audit] insert failed (stub)', {
        action: input.action,
        entity_type: input.entity_type,
        error: error.message,
      })
      return { id: null, error: error.message }
    }

    return { id: (data as { id: string } | null)?.id ?? null, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown audit error'
    console.error('[audit] unexpected error (stub)', { action: input.action, message })
    return { id: null, error: message }
  }
}

export const audit = {
  record,
}
