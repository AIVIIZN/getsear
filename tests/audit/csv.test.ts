/**
 * V5.4.3 — unit tests for the audit log CSV emitter.
 *
 * The CSV must be RFC 4180 compliant:
 *   - UTF-8 with BOM
 *   - CRLF line endings
 *   - fields containing ", CR, LF, or , are quoted
 *   - embedded " is doubled
 *
 * Header order is fixed (the spec mandates it) so downstream consumers
 * can map by index without inspecting the header line.
 */

import { describe, expect, it } from 'vitest'
import { toCsv, type AuditCsvRow } from '../../src/lib/audit/csv'

const baseRow: AuditCsvRow = {
  created_at: '2026-05-03T19:00:00.000Z',
  action: 'payment_voided',
  actor_email: 'alice@example.com',
  manager_pin_user_email: 'bob@example.com',
  entity_id: 'pay-1',
  before_state: { amount_cents: 4200, status: 'completed' },
  after_state: { amount_cents: 4200, status: 'voided' },
  reason: 'Customer changed mind',
}

describe('toCsv', () => {
  it('starts with a UTF-8 BOM', () => {
    const csv = toCsv([])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('uses CRLF line endings', () => {
    const csv = toCsv([baseRow])
    // Strip BOM, then split — every line break must be \r\n.
    const body = csv.slice(1)
    expect(body.includes('\n')).toBe(true)
    // No bare LFs (every \n must be preceded by \r).
    const lines = body.split('\r\n')
    expect(lines.length).toBeGreaterThanOrEqual(2)
    for (const line of lines) {
      expect(line.includes('\n')).toBe(false)
    }
  })

  it('emits the spec header in order', () => {
    const csv = toCsv([])
    const header = csv.slice(1).split('\r\n')[0]
    expect(header).toBe(
      'timestamp,action,actor_email,manager_pin_email,target_id,before,after,reason'
    )
  })

  it('serialises a row with all fields populated', () => {
    const csv = toCsv([baseRow])
    const lines = csv.slice(1).split('\r\n')
    expect(lines[1]).toContain('2026-05-03T19:00:00.000Z')
    expect(lines[1]).toContain('payment_voided')
    expect(lines[1]).toContain('alice@example.com')
    expect(lines[1]).toContain('bob@example.com')
    expect(lines[1]).toContain('pay-1')
    // before/after are JSON; they will be quoted because they contain ","
    expect(lines[1]).toMatch(/"\{""amount_cents"":4200,""status"":""completed""\}"/)
  })

  it('quotes fields containing commas, quotes, or newlines', () => {
    const row: AuditCsvRow = {
      ...baseRow,
      reason: 'Hello, "world"\nnewline',
    }
    const csv = toCsv([row])
    const dataLine = csv.slice(1).split('\r\n')[1]
    // The reason field is the last column. RFC 4180: quotes doubled,
    // whole field wrapped in quotes because it contains ",", '"', and '\n'.
    expect(dataLine.endsWith('"Hello, ""world""\nnewline"')).toBe(true)
  })

  it('handles null fields as empty strings', () => {
    const row: AuditCsvRow = {
      ...baseRow,
      manager_pin_user_email: null,
      actor_email: null,
      entity_id: null,
      before_state: null,
      after_state: null,
      reason: null,
    }
    const csv = toCsv([row])
    const dataLine = csv.slice(1).split('\r\n')[1]
    // Empty fields appear as adjacent commas; trailing newline
    expect(dataLine).toBe('2026-05-03T19:00:00.000Z,payment_voided,,,,,,')
  })

  it('emits one data line per row plus the header', () => {
    const rows: AuditCsvRow[] = [baseRow, baseRow, baseRow]
    const csv = toCsv(rows)
    // BOM + header + 3 data lines + trailing CRLF → 5 elements after split
    const lines = csv.slice(1).split('\r\n')
    expect(lines.length).toBe(5)
    expect(lines[4]).toBe('') // trailing CRLF
  })
})
