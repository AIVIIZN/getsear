/**
 * Audit log — STUB.
 *
 * Owned by sister batch 5.4.3. This stub exists so 5.4.2 routes can call
 * `audit.record(...)` and compile before 5.4.3 lands. The real implementation
 * will write a row into `audit_log` with full before/after diffing, manager
 * approval chain, and CSV export support.
 *
 * Until then this stub falls back to writing a row into the existing
 * `audit_log` table directly so we don't lose the audit trail during the
 * window between 5.4.2 shipping and 5.4.3 shipping.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface AuditRecordParams {
  org_id: string
  user_id: string
  /** Optional: the manager whose PIN approved a privileged action. */
  approved_by_user_id?: string | null
  action: string
  entity_type: string
  entity_id: string
  description: string
  before_state?: Record<string, unknown> | null
  after_state?: Record<string, unknown> | null
  reason?: string | null
  location_id?: string | null
}

export const audit = {
  /**
   * Stub recorder. Writes a best-effort row into `audit_log`. Failures are
   * swallowed and console.error'd — never throw from the audit layer because
   * a failed audit must not roll back the user-visible action.
   */
  async record(supabase: SupabaseClient, params: AuditRecordParams): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('audit_log') as any).insert({
        org_id: params.org_id,
        location_id: params.location_id ?? null,
        user_id: params.user_id,
        action: params.action,
        entity_type: params.entity_type,
        entity_id: params.entity_id,
        description: params.description,
        previous_state: params.before_state ?? null,
        new_state: {
          ...(params.after_state ?? {}),
          // Surface manager approval + reason in new_state until 5.4.3 adds
          // dedicated columns.
          approved_by_user_id: params.approved_by_user_id ?? null,
          reason: params.reason ?? null,
        },
      })
    } catch (err) {
      console.error('[audit.record] failed (non-fatal):', err)
    }
  },
}
