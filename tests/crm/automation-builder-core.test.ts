import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createCrmAutomationSchema, testCrmAutomationSchema } from '@/lib/schemas/crm'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('CRM-V8.1 automation builder core', () => {
  it('creates automation tables with tenant RLS and rollback coverage', () => {
    const migration = read('supabase/migrations/20260525194808_add_crm_automation_builder_core.sql')
    const rollback = read('supabase/_rollbacks/20260525194808_add_crm_automation_builder_core.rollback.sql')

    for (const table of ['crm_automations', 'crm_automation_triggers', 'crm_automation_actions', 'crm_automation_enrollments', 'crm_automation_runs', 'crm_automation_failures']) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
      expect(migration).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}[\\s\\S]*?org_id uuid NOT NULL REFERENCES public\\.organizations\\(id\\) ON DELETE CASCADE`))
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
      expect(migration).toContain(`CREATE POLICY "tenant_select_${table}" ON public.${table}`)
      expect(rollback).toContain(`DROP TABLE IF EXISTS public.${table}`)
    }

    expect(migration).toContain("'lapsed'")
    expect(migration).toContain("'negative_feedback'")
    expect(migration).toContain("'create_recovery'")
    expect(migration).toContain('crm_automation_runs_automation_idx')
  })

  it('validates builder triggers, ordered actions, and safe test input', () => {
    const automation = createCrmAutomationSchema.parse({
      name: 'Lapsed guest winback',
      status: 'active',
      trigger_type: 'lapsed',
      condition_tree: { days_since_last_visit: 45 },
      actions: [
        { action_type: 'add_note', config: { note: 'Entered lapsed winback automation.' } },
        { action_type: 'send_email', config: { template_id: 'winback' } },
      ],
      measurement: { metric: 'return_visit_30_day' },
    })

    expect(automation.trigger_type).toBe('lapsed')
    expect(automation.actions).toHaveLength(2)
    expect(testCrmAutomationSchema.parse({ guest_id: '00000000-0000-4000-8000-000000000001' })).toMatchObject({ dry_run: true })
    expect(() => createCrmAutomationSchema.parse({ name: 'Broken', trigger_type: 'unknown', actions: [] })).toThrow()
    expect(() => testCrmAutomationSchema.parse({})).toThrow()
  })

  it('wires API routes for lapsed tests and negative feedback recovery creation', () => {
    const automationLib = read('src/lib/crm/automations.ts')
    const route = read('src/app/api/crm/automations/route.ts')
    const testRoute = read('src/app/api/crm/automations/[id]/test/route.ts')
    const runsRoute = read('src/app/api/crm/automations/[id]/runs/route.ts')
    const auditLog = read('src/lib/audit/log.ts')

    expect(automationLib).toContain('resolveLapsedGuest')
    expect(automationLib).toContain("lifecycle_stage !== 'lapsed'")
    expect(automationLib).toContain('createRecoveryCaseFromComplaint')
    expect(automationLib).toContain("action.action_type === 'create_recovery'")
    expect(route).toContain("eq('org_id', user.org_id)")
    expect(route).toContain('createCrmAutomationSchema')
    expect(testRoute).toContain("mode: 'test'")
    expect(runsRoute).toContain("mode: 'run'")
    expect(auditLog).toContain("'crm_automation_created'")
    expect(auditLog).toContain("'crm_automation_run_started'")
  })
})
