import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { validateCrmImportRows } from '@/lib/crm/imports'
import { createCrmImportJobSchema } from '@/lib/schemas/crm'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

const mapping = {
  display_name: 'name',
  email: 'email',
  phone: 'phone',
  birthday: 'birthday',
  consent_status: 'consent',
  consent_source: 'source',
}

describe('CRM-V12.1 import and migration tools', () => {
  it('creates tenant-scoped import tables with rollback coverage', () => {
    const migration = read('supabase/migrations/20260525152428_add_crm_import_tools.sql')
    const rollback = read('supabase/_rollbacks/20260525152428_add_crm_import_tools.rollback.sql')

    for (const table of ['crm_import_jobs', 'crm_import_rows', 'crm_import_mappings']) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
      expect(migration).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}[\\s\\S]*?org_id uuid NOT NULL REFERENCES public\\.organizations\\(id\\) ON DELETE CASCADE`))
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
      expect(migration).toContain(`CREATE POLICY "tenant_select" ON public.${table}`)
      expect(migration).toContain(`CREATE POLICY "tenant_insert" ON public.${table}`)
      expect(rollback).toContain(`DROP TABLE IF EXISTS public.${table}`)
    }

    expect(migration).toContain('crm_import_rows_imported_guest_idx')
    expect(migration).toContain('rollback_safe boolean NOT NULL DEFAULT true')
  })

  it('validates invalid contacts, duplicates, consent, birthdays, missing names, and suspicious data', () => {
    const duplicateHashes = new Set<string>()
    const firstPass = validateCrmImportRows([{ name: 'Existing', email: 'dupe@example.com', consent: 'yes' }], mapping)
    duplicateHashes.add(firstPass.rows[0].email_hash ?? '')

    const result = validateCrmImportRows([
      { name: '', email: 'bad-email', phone: '12', consent: 'yes' },
      { name: 'No Consent', email: 'noconsent@example.com', consent: 'unknown' },
      { name: 'Bad Birthday', email: 'birthday@example.com', birthday: '04/31/1990', consent: 'yes' },
      { name: 'Suspicious', email: 'safe@example.com', consent: 'yes', notes: '<script>alert(1)</script>' },
      { name: 'Duplicate', email: 'dupe@example.com', consent: 'yes' },
      { name: 'Valid Guest', email: 'valid@example.com', phone: '(512) 555-0199', birthday: '1990-04-12', consent: 'granted', source: 'spreadsheet opt-in' },
    ], mapping, { duplicateHashes })

    expect(result.summary.original_row_count).toBe(6)
    expect(result.summary.invalid_row_count).toBe(3)
    expect(result.summary.duplicate_row_count).toBe(1)
    expect(result.summary.valid_row_count).toBe(2)
    expect(result.summary.suspicious_row_count).toBe(1)
    expect(result.rows[0].errors).toEqual(expect.arrayContaining(['missing_name', 'invalid_email', 'invalid_phone']))
    expect(result.rows[1].errors).toContain('missing_consent')
    expect(result.rows[2].errors).toContain('malformed_birthday')
    expect(result.rows[3].warnings).toContain('suspicious_data')
    expect(result.rows[4].validation_status).toBe('duplicate')
    expect(result.rows[5].normalized_data.phone).toBe('+15125550199')
  })

  it('ships authenticated import, report, audit, and rollback API contracts', () => {
    const importRoute = read('src/app/api/crm/imports/route.ts')
    const rollbackRoute = read('src/app/api/crm/imports/[id]/rollback/route.ts')
    const guestsPage = read('src/app/(backoffice)/guests/page.tsx')
    const auditLog = read('src/lib/audit/log.ts')

    expect(createCrmImportJobSchema.parse({
      source_type: 'csv',
      file_name: 'guests.csv',
      mapping,
      rows: [{ name: 'Avery', email: 'avery@example.com', consent: 'yes' }],
      commit: true,
    }).merge_rules.rollback_safe).toBe(true)

    expect(importRoute).toContain('export async function GET')
    expect(importRoute).toContain('export async function POST')
    expect(importRoute).toContain('requireRole(user, [...crmGuestOwnerRoles])')
    expect(importRoute).toContain("from('crm_import_jobs')")
    expect(importRoute).toContain("from('crm_import_rows')")
    expect(importRoute).toContain("from('guests')")
    expect(importRoute).toContain("from('guest_consents')")
    expect(importRoute).toContain("action: input.commit ? 'crm_import_completed' : 'crm_import_validated'")
    expect(rollbackRoute).toContain("status === 'rolled_back'")
    expect(rollbackRoute).toContain("profile_status: 'archived'")
    expect(rollbackRoute).toContain("action: 'crm_import_rolled_back'")
    expect(guestsPage).toContain('Import guests')
    expect(guestsPage).toContain('/api/crm/imports')
    expect(guestsPage).toContain('Import valid rows')
    expect(guestsPage).toContain('validation_status')
    expect(auditLog).toContain("'crm_import_validated'")
    expect(auditLog).toContain("'crm_import_completed'")
    expect(auditLog).toContain("'crm_import_rolled_back'")
  })
})
