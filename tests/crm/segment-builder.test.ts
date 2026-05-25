import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCrmSegmentDraft } from '@/lib/crm/segment-ai-draft'
import { calculateCrmReachabilitySummary, type GuestSegmentFacts } from '@/lib/crm/segments'
import { buildCrmSegmentDraftSchema, createCrmSegmentSchema, previewCrmSegmentSchema } from '@/lib/schemas/crm'

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

describe('CRM-V6.2 AI segment draft', () => {
  it('turns natural language into a validated segment draft without saving it', async () => {
    const result = await buildCrmSegmentDraft('VIP regulars who have not visited in 60 days and can receive email')

    expect(result.status).toBe('draft')
    if (result.status !== 'draft') throw new Error('Expected draft')
    expect(result.draft.rule_tree.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'is_vip', operator: 'equals', value: true }),
      expect.objectContaining({ field: 'days_since_last_visit', operator: 'days_since', value: 60 }),
      expect.objectContaining({ field: 'email_marketing_consent', operator: 'equals', value: true }),
    ]))
    expect(createCrmSegmentSchema.parse({
      name: result.draft.name,
      description: result.draft.description,
      match_mode: result.draft.match_mode,
      rule_tree: result.draft.rule_tree,
    }).rule_tree.rules.length).toBeGreaterThan(0)
  })

  it('refuses unsafe targeting and registers the draft-only API/UI review flow', async () => {
    const result = await buildCrmSegmentDraft('Target guests by religion and political party')
    const route = read('src/app/api/ai/build-segment/route.ts')
    const page = read('src/app/(backoffice)/segments/page.tsx')
    const auditLog = read('src/lib/audit/log.ts')

    expect(result.status).toBe('refused')
    if (result.status !== 'refused') throw new Error('Expected refusal')
    expect(result.safety_flags).toContain('protected_class_targeting')
    expect(buildCrmSegmentDraftSchema.parse({ prompt: 'lapsed guests who can receive sms' }).sample_limit).toBe(5)
    expect(route).toContain('buildCrmSegmentDraft')
    expect(route).toContain("status === 'refused'")
    expect(route).toContain("action: 'crm_segment_ai_drafted'")
    expect(auditLog).toContain("'crm_segment_ai_drafted'")
    expect(page).toContain('/api/ai/build-segment')
    expect(page).toContain('Approve draft')
    expect(page).toContain('disabled={!name.trim() || Boolean(aiDraft)}')
    expect(page).toContain('disabled={!selectedId || Boolean(aiDraft)}')
  })
})

describe('CRM-V6.3 reachability and campaign readiness', () => {
  function guest(overrides: Partial<GuestSegmentFacts>): GuestSegmentFacts {
    return {
      id: overrides.id ?? crypto.randomUUID(),
      display_name: overrides.display_name ?? 'Guest',
      lifecycle_stage: overrides.lifecycle_stage ?? 'regular',
      total_spend: overrides.total_spend ?? 0,
      total_visits: overrides.total_visits ?? 0,
      average_check: overrides.average_check ?? 0,
      last_visit_at: overrides.last_visit_at ?? null,
      birthday: overrides.birthday ?? null,
      location_id: overrides.location_id ?? null,
      is_vip: overrides.is_vip ?? false,
      tag_slugs: overrides.tag_slugs ?? [],
      tag_categories: overrides.tag_categories ?? [],
      email_marketing_consent: overrides.email_marketing_consent ?? false,
      sms_marketing_consent: overrides.sms_marketing_consent ?? false,
      push_marketing_consent: overrides.push_marketing_consent ?? false,
      loyalty_points_balance: overrides.loyalty_points_balance ?? 0,
      loyalty_tier: overrides.loyalty_tier ?? null,
      favorite_items: overrides.favorite_items ?? [],
      order_channels: overrides.order_channels ?? [],
      contact_channels: overrides.contact_channels ?? [],
      suppressed_channels: overrides.suppressed_channels ?? [],
    }
  }

  it('excludes suppressed and unconsented guests from sendable channel counts', () => {
    const summary = calculateCrmReachabilitySummary([
      guest({ contact_channels: ['email', 'phone'], email_marketing_consent: true, sms_marketing_consent: true }),
      guest({ contact_channels: ['email'], email_marketing_consent: true, suppressed_channels: ['email'] }),
      guest({ contact_channels: ['phone'], sms_marketing_consent: false }),
    ])

    expect(summary.total_count).toBe(3)
    expect(summary.channels.email.reachable_count).toBe(1)
    expect(summary.channels.email.exclusions.suppressed).toBe(1)
    expect(summary.channels.sms.reachable_count).toBe(1)
    expect(summary.channels.sms.exclusions.missing_consent).toBe(1)
    expect(summary.channels.push.reachable_count).toBe(0)
    expect(summary.channels.receipt.reachable_count).toBe(3)
    expect(summary.estimated_audience_cost_cents).toBeGreaterThan(0)
  })

  it('surfaces reachability in the segment API and UI preview contract', () => {
    const engine = read('src/lib/crm/segments.ts')
    const route = read('src/app/api/crm/segments/[id]/preview/route.ts')
    const materializeRoute = read('src/app/api/crm/segments/[id]/materialize/route.ts')
    const page = read('src/app/(backoffice)/segments/page.tsx')

    expect(engine).toContain("from('suppression_entries')")
    expect(engine).toContain("from('guest_contact_points')")
    expect(engine).toContain('calculateCrmReachabilitySummary')
    expect(route).toContain('reachability: preview.reachability')
    expect(materializeRoute).toContain('reachability: preview.reachability')
    expect(page).toContain('Campaign readiness')
    expect(page).toContain('estimated_audience_cost_cents')
  })
})
