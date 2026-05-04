/**
 * V5.4.3 — pure RFC 4180 CSV emitter for audit log exports.
 *
 * Kept dependency-free so vitest unit tests can import it without
 * pulling in the Supabase admin client (which needs env vars at module
 * load and breaks the test runner).
 *
 * Spec (per build-pipeline/versions/V5_OPERATIONAL.md → 5.4.3):
 *   - UTF-8 with BOM (Excel auto-detects encoding)
 *   - CRLF line endings
 *   - Header (fixed order):
 *     timestamp,action,actor_email,manager_pin_email,target_id,before,after,reason
 *   - Fields containing ", CR, LF, or , are quoted
 *   - Embedded " is doubled
 */

export interface AuditCsvRow {
  created_at: string
  action: string
  actor_email: string | null
  manager_pin_user_email: string | null
  entity_id: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  reason: string | null
}

export const AUDIT_CSV_HEADER =
  'timestamp,action,actor_email,manager_pin_email,target_id,before,after,reason'

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = typeof value === 'string' ? value : JSON.stringify(value)
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCsv(rows: AuditCsvRow[]): string {
  const lines: string[] = [AUDIT_CSV_HEADER]
  for (const r of rows) {
    lines.push(
      [
        r.created_at,
        r.action,
        r.actor_email ?? '',
        r.manager_pin_user_email ?? '',
        r.entity_id ?? '',
        r.before_state,
        r.after_state,
        r.reason ?? '',
      ]
        .map(csvEscape)
        .join(',')
    )
  }
  // CRLF per RFC 4180; UTF-8 BOM (﻿) so Excel auto-detects the encoding.
  return '﻿' + lines.join('\r\n') + '\r\n'
}
