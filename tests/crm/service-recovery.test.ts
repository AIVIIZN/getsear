import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { recommendedRecoveryAction, recoveryDeadlineForSeverity, recoverySourceFromComplaint } from '@/lib/crm/recovery'
import { createCrmRecoveryActionSchema, createCrmRecoveryCaseSchema, resolveCrmRecoveryCaseSchema } from '@/lib/schemas/crm'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('CRM-V9.2 service recovery center', () => {
  it('creates recovery case, action, and follow-up tables with tenant RLS and rollback coverage', () => {
    const migration = read('supabase/migrations/20260525181351_add_crm_service_recovery.sql')
    const rollback = read('supabase/_rollbacks/20260525181351_add_crm_service_recovery.rollback.sql')

    for (const table of ['crm_recovery_cases', 'crm_recovery_actions', 'crm_recovery_followups']) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
      expect(migration).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}[\\s\\S]*?org_id uuid NOT NULL REFERENCES public\\.organizations\\(id\\) ON DELETE CASCADE`))
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
      expect(migration).toContain(`CREATE POLICY "tenant_select" ON public.${table}`)
      expect(rollback).toContain(`DROP TABLE IF EXISTS public.${table}`)
    }

    expect(migration).toContain("status IN ('new', 'assigned', 'in_progress', 'waiting_for_guest', 'resolved', 'closed', 'escalated')")
    expect(migration).toContain('recovered_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL')
    expect(migration).toContain('crm_recovery_cases_complaint_unique_idx')
  })

  it('validates recovery write boundaries', () => {
    const recoveryCase = createCrmRecoveryCaseSchema.parse({
      source_type: 'bad_review',
      severity: 'high',
      issue_summary: 'Guest left a one-star review about slow service.',
      topics: ['service', 'speed'],
    })
    expect(recoveryCase.source_type).toBe('bad_review')
    expect(recoveryCase.topics).toEqual(['service', 'speed'])

    expect(createCrmRecoveryActionSchema.parse({ action_type: 'assign', value_cents: 0 })).toMatchObject({ action_type: 'assign' })
    expect(resolveCrmRecoveryCaseSchema.parse({ resolution_summary: 'Manager called and comped the next visit.' })).toMatchObject({ resolution_summary: 'Manager called and comped the next visit.' })
    expect(() => createCrmRecoveryCaseSchema.parse({ issue_summary: '' })).toThrow()
    expect(() => createCrmRecoveryActionSchema.parse({ action_type: 'refund', value_cents: -1 })).toThrow()
  })

  it('routes negative feedback into case-backed APIs and tracks returns', () => {
    expect(recoverySourceFromComplaint({ source_type: 'review' })).toBe('bad_review')
    expect(recommendedRecoveryAction({ severity: 'critical', topics: [] })).toContain('Owner or GM')
    expect(new Date(recoveryDeadlineForSeverity('critical')).getTime()).toBeGreaterThan(Date.now())

    const feedbackRoute = read('src/app/api/crm/feedback/route.ts')
    const reviewsRoute = read('src/app/api/crm/reviews/route.ts')
    const recoveryRoute = read('src/app/api/crm/recovery/route.ts')
    const resolveRoute = read('src/app/api/crm/recovery/[id]/resolve/route.ts')
    const auditLog = read('src/lib/audit/log.ts')

    expect(feedbackRoute).toContain('createRecoveryCaseFromComplaint')
    expect(reviewsRoute).toContain('createRecoveryCaseFromComplaint')
    expect(recoveryRoute).toContain("eq('org_id', user.org_id)")
    expect(recoveryRoute).toContain('Assigned manager')
    expect(resolveRoute).toContain('Recovered order is not attached to this recovery case guest')
    expect(resolveRoute).toContain("event_type: 'crm.recovery.resolved'")
    expect(auditLog).toContain("'crm_recovery_case_created'")
    expect(auditLog).toContain("'crm_recovery_action_logged'")
    expect(auditLog).toContain("'crm_recovery_case_resolved'")
  })
})
