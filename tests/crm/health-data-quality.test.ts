import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { buildCrmHealthCandidate } from '@/lib/crm/health'
import { listCrmHealthQuerySchema, reviewCrmHealthIssueSchema } from '@/lib/schemas/crm'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('CRM-V12.3 health and data quality', () => {
  it('creates tenant-scoped health issue and data-quality run tables with rollback coverage', () => {
    const migration = read('supabase/migrations/20260525225500_add_crm_health_data_quality.sql')
    const rollback = read('supabase/_rollbacks/20260525225500_add_crm_health_data_quality.rollback.sql')

    for (const table of ['crm_data_quality_runs', 'crm_health_issues']) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
      expect(migration).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}[\\s\\S]*?org_id uuid NOT NULL REFERENCES public\\.organizations\\(id\\) ON DELETE CASCADE`))
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
      expect(migration).toContain(`tenant_select_${table}`)
      expect(migration).toContain(`service_role_bypass_${table}`)
      expect(rollback).toContain(`DROP TABLE IF EXISTS public.${table}`)
    }

    expect(migration).toContain('impact_score numeric(10,2) NOT NULL DEFAULT 0')
    expect(migration).toContain('fix_preview jsonb NOT NULL')
    expect(migration).toContain("issue_type IN ('duplicate_rate', 'no_contact', 'missing_consent', 'invalid_email', 'invalid_phone', 'unlinked_checks', 'unmatched_reservations', 'weak_identity', 'old_inactive_segment', 'broken_automation', 'failed_send')")
  })

  it('builds ranked safe-fix candidates from data-quality counts', () => {
    const issue = buildCrmHealthCandidate({
      issue_type: 'missing_consent',
      affected_record_count: 18,
      scanned_count: 100,
      title: 'Missing consent',
      description: 'Contacts need proof before marketing.',
      affected_table: 'guest_contact_points',
      fix_strategy: 'consent_review',
      fix_preview: { action: 'review_consent_source_before_marketing', requires_operator_approval: true },
      impact_weight: 35,
    })

    expect(issue).not.toBeNull()
    expect(issue?.impact_score).toBeGreaterThan(50)
    expect(issue?.severity).toBe('high')
    expect(issue?.fix_preview).toMatchObject({ requires_operator_approval: true })
    expect(issue?.ai_suggestion.recommendation).toContain('No cleanup runs without operator review')
    expect(buildCrmHealthCandidate({
      issue_type: 'invalid_email',
      affected_record_count: 0,
      scanned_count: 10,
      title: 'None',
      description: 'No issue',
      affected_table: 'guest_contact_points',
      fix_strategy: 'contact_cleanup',
      fix_preview: {},
      impact_weight: 10,
    })).toBeNull()
  })

  it('ships authenticated scan, review, audit, and CRM Health page contracts', () => {
    const route = read('src/app/api/crm/health/route.ts')
    const page = read('src/app/(backoffice)/crm-health/page.tsx')
    const sidebar = read('src/components/layout/Sidebar.tsx')
    const auditLog = read('src/lib/audit/log.ts')

    expect(listCrmHealthQuerySchema.parse({ include_scan: 'false', limit: '10' }).include_scan).toBe(false)
    expect(listCrmHealthQuerySchema.parse({ limit: '10' }).include_scan).toBe(false)
    expect(reviewCrmHealthIssueSchema.parse({
      issue_id: '00000000-0000-0000-0000-000000000000',
      action: 'approve_fix',
      metadata: { source: 'test' },
    }).action).toBe('approve_fix')

    expect(route).toContain('export async function GET')
    expect(route).toContain('export async function POST')
    expect(route).toContain('requireRole(user, [...crmHealthReadRoles])')
    expect(route).toContain('collectCrmHealthCandidates')
    expect(route).toContain("from('crm_data_quality_runs')")
    expect(route).toContain("from('crm_health_issues')")
    expect(route).toContain("action: 'crm_health_scan_run'")
    expect(route).toContain("'crm_health_issue_reviewed'")
    expect(page).toContain('CRM Health')
    expect(page).toContain('/api/crm/health')
    expect(page).toContain('Safe fix preview')
    expect(page).toContain('Approve preview')
    expect(page).toContain('Skeleton')
    expect(page).toContain('EmptyState')
    expect(sidebar).toContain('/crm-health')
    expect(auditLog).toContain("'crm_health_scan_run'")
    expect(auditLog).toContain("'crm_health_issue_reviewed'")
  })
})
