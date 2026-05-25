import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createCrmSegmentSchema, previewCrmSegmentSchema } from '@/lib/schemas/crm'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('CRM-V6.1 visual segment builder', () => {
  it('validates nested rule groups and supported semantic operators', () => {
    const ruleTree = {
      match: 'all',
      rules: [
        { field: 'total_visits', operator: 'greater_than', value: 4 },
        { field: 'email_marketing_consent', operator: 'equals', value: true },
        {
          match: 'any',
          rules: [
            { field: 'tag_slug', operator: 'equals', value: 'regular' },
            { field: 'loyalty_points_balance', operator: 'between', value: [100, 500] },
          ],
        },
      ],
    }

    expect(createCrmSegmentSchema.parse({
      name: 'Reachable regulars',
      segment_type: 'dynamic',
      rule_tree: ruleTree,
    }).rule_tree.rules).toHaveLength(3)
    expect(previewCrmSegmentSchema.parse({ rule_tree: ruleTree }).sample_limit).toBe(8)
    expect(() => createCrmSegmentSchema.parse({
      name: 'Unsafe',
      rule_tree: { match: 'all', rules: [{ field: 'raw_sql', operator: 'contains', value: '1=1' }] },
    })).toThrow()
  })

  it('ships additive segment schema, rollback, RLS, and audit vocabulary', () => {
    const migration = read('supabase/migrations/20260525172341_add_crm_segments.sql')
    const rollback = read('supabase/_rollbacks/20260525172341_add_crm_segments.rollback.sql')
    const auditLog = read('src/lib/audit/log.ts')

    for (const table of ['crm_segments', 'crm_segment_rules', 'crm_segment_memberships', 'crm_segment_preview_runs']) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
      expect(rollback).toContain(`DROP TABLE IF EXISTS public.${table}`)
    }
    expect(migration).toContain("segment_type IN ('dynamic', 'static')")
    expect(migration).toContain("match_mode IN ('all', 'any')")
    expect(migration).toContain('crm_segment_memberships_segment_guest_idx')
    expect(auditLog).toContain("'crm_segment_created'")
    expect(auditLog).toContain("'crm_segment_previewed'")
    expect(auditLog).toContain("'crm_segment_materialized'")
  })

  it('registers CRM-native segment APIs with auth, tenant scoping, preview, and materialization', () => {
    const listRoute = read('src/app/api/crm/segments/route.ts')
    const previewRoute = read('src/app/api/crm/segments/[id]/preview/route.ts')
    const materializeRoute = read('src/app/api/crm/segments/[id]/materialize/route.ts')
    const guestsRoute = read('src/app/api/crm/segments/[id]/guests/route.ts')
    const engine = read('src/lib/crm/segments.ts')

    expect(listRoute).toContain('export async function GET')
    expect(listRoute).toContain('export async function POST')
    expect(listRoute).toContain('getAuthUser()')
    expect(listRoute).toContain("requireRole(user, [...crmGuestComplianceRoles])")
    expect(listRoute).toContain("eq('org_id', user.org_id)")
    expect(listRoute).toContain('previewCrmSegment')
    expect(previewRoute).toContain("action: 'crm_segment_previewed'")
    expect(materializeRoute).toContain("from('crm_segment_memberships')")
    expect(materializeRoute).toContain("action: 'crm_segment_materialized'")
    expect(guestsRoute).toContain('sanitizeGuestForCrmRole')
    expect(engine).toContain("case 'days_since_last_visit'")
    expect(engine).toContain("case 'favorite_item_contains'")
    expect(engine).toContain("case 'loyalty_points_balance'")
  })

  it('ships a real backoffice builder route and sidebar navigation', () => {
    const page = read('src/app/(backoffice)/segments/page.tsx')
    const sidebar = read('src/components/layout/Sidebar.tsx')

    expect(page).toContain('Visual rule builder')
    expect(page).toContain('/api/crm/segments')
    expect(page).toContain('/preview')
    expect(page).toContain('/materialize')
    expect(page).toContain('EmptyState')
    expect(page).toContain('Skeleton')
    expect(sidebar).toContain('href: "/segments"')
  })
})
