import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  createCrmTagSchema,
  createGuestContactPointSchema,
  createGuestNoteSchema,
  createGuestSchema,
  guestLifecycleStageSchema,
  guestNoteCategorySchema,
} from '@/lib/schemas/crm'

const root = process.cwd()
const migrationPath = path.join(root, 'supabase', 'migrations', '20260525113405_add_crm_guest_core_schema.sql')
const visibilityMigrationPath = path.join(root, 'supabase', 'migrations', '20260525114831_tighten_crm_guest_note_visibility.sql')
const rollbackPath = path.join(root, 'supabase', '_rollbacks', '20260525113405_add_crm_guest_core_schema.rollback.sql')
const visibilityRollbackPath = path.join(root, 'supabase', '_rollbacks', '20260525114831_tighten_crm_guest_note_visibility.rollback.sql')

const migrationSql = readFileSync(migrationPath, 'utf8')
const visibilityMigrationSql = readFileSync(visibilityMigrationPath, 'utf8')
const rollbackSql = readFileSync(rollbackPath, 'utf8')
const visibilityRollbackSql = readFileSync(visibilityRollbackPath, 'utf8')

const crmGuestTables = [
  'guests',
  'guest_contact_points',
  'guest_identifiers',
  'guest_notes',
  'guest_preferences',
  'guest_allergies',
  'crm_tags',
  'guest_tags',
  'guest_timeline_events',
]

describe('CRM-V1.1 guest core schema', () => {
  it('creates every CRM guest core table with tenant scope and rollback coverage', () => {
    for (const table of crmGuestTables) {
      expect(migrationSql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
      expect(migrationSql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}[\\s\\S]*?org_id uuid NOT NULL REFERENCES public\\.organizations\\(id\\) ON DELETE CASCADE`))
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
      expect(rollbackSql).toContain(`DROP TABLE IF EXISTS public.${table}`)
    }
  })

  it('adds the required lookup indexes for search, lifecycle, last visit, and primary contact hashes', () => {
    expect(migrationSql).toContain('guests_lifecycle_stage_idx')
    expect(migrationSql).toContain('guests_last_visit_at_idx')
    expect(migrationSql).toContain('guests_search_document_idx')
    expect(migrationSql).toContain('guest_contact_points_primary_email_hash_idx')
    expect(migrationSql).toContain('guest_contact_points_primary_phone_hash_idx')
    expect(migrationSql).toContain("WHERE contact_type = 'email' AND is_primary = true AND deleted_at IS NULL")
    expect(migrationSql).toContain("WHERE contact_type = 'phone' AND is_primary = true AND deleted_at IS NULL")
  })

  it('uses tenant-scoped RLS for reads and writes instead of permissive policies', () => {
    expect(migrationSql).toContain('org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())')
    expect(migrationSql).not.toMatch(/WITH CHECK \(true\)/i)
    expect(migrationSql).not.toMatch(/USING \(true\)/i)

    for (const table of crmGuestTables.filter((table) => table !== 'guest_notes')) {
      expect(migrationSql).toContain(`CREATE POLICY "tenant_select" ON public.${table}`)
      expect(migrationSql).toContain(`CREATE POLICY "tenant_insert" ON public.${table}`)
      expect(migrationSql).toContain(`CREATE POLICY "tenant_update" ON public.${table}`)
      expect(migrationSql).toContain(`CREATE POLICY "tenant_delete" ON public.${table}`)
    }
  })

  it('defines sensitive guest notes and gates them to manager-plus roles', () => {
    expect(migrationSql).toContain("'sensitive'")
    expect(migrationSql).toContain('tenant_select_service_notes')
    expect(migrationSql).toContain("(visibility = 'service' AND note_category <> 'sensitive')")
    expect(migrationSql).toContain("visibility IN ('manager', 'owner')")
    expect(migrationSql).toContain("(visibility = 'manager' AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('platform_admin', 'owner', 'admin', 'manager'))")
    expect(migrationSql).toContain("(visibility = 'owner' AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('platform_admin', 'owner', 'admin'))")
    expect(visibilityMigrationSql).toContain('DROP POLICY IF EXISTS "tenant_select_service_notes" ON public.guest_notes')
    expect(visibilityMigrationSql).toContain("(visibility = 'service' AND note_category <> 'sensitive')")
    expect(visibilityRollbackSql).toContain("note_category <> 'sensitive'")
    expect(guestNoteCategorySchema.options).toContain('sensitive')

    const note = createGuestNoteSchema.parse({
      guest_id: '11111111-1111-4111-8111-111111111111',
      note_category: 'sensitive',
      visibility: 'owner',
      body: 'Guest asked that this recovery context stay manager-only.',
    })

    expect(note.note_category).toBe('sensitive')
    expect(note.visibility).toBe('owner')
  })

  it('exports Zod schemas for the CRM guest write boundary', () => {
    expect(guestLifecycleStageSchema.options).toContain('first_time')
    expect(guestLifecycleStageSchema.options).toContain('do_not_contact')

    expect(createGuestSchema.parse({
      display_name: 'Avery Stone',
      lifecycle_stage: 'regular',
      birthday: '1988-04-12',
    })).toMatchObject({
      display_name: 'Avery Stone',
      lifecycle_stage: 'regular',
      profile_status: 'active',
      is_vip: false,
    })

    expect(createGuestContactPointSchema.parse({
      guest_id: '11111111-1111-4111-8111-111111111111',
      contact_type: 'email',
      value: 'avery@example.com',
      value_hash: 'a'.repeat(64),
      is_primary: true,
    }).contact_type).toBe('email')

    expect(createCrmTagSchema.parse({
      name: 'VIP',
      slug: 'vip',
      tag_category: 'lifecycle',
    }).tag_category).toBe('lifecycle')
  })
})
