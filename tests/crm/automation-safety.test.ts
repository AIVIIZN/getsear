import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createCrmAutomationSchema, pauseCrmAutomationSchema, testCrmAutomationSchema } from '@/lib/schemas/crm'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('CRM-V8.2 automation safety', () => {
  it('adds additive safety config and frequency-cap indexes with rollback coverage', () => {
    const migration = read('supabase/migrations/20260525201453_add_crm_automation_safety.sql')
    const rollback = read('supabase/_rollbacks/20260525201453_add_crm_automation_safety.rollback.sql')

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS safety_config jsonb NOT NULL')
    expect(migration).toContain("'frequency_cap_count', 1")
    expect(migration).toContain("'frequency_cap_window_hours', 24")
    expect(migration).toContain("'audience_size_limit', 5000")
    expect(migration).toContain('crm_automation_runs_frequency_cap_idx')
    expect(rollback).toContain('DROP INDEX IF EXISTS public.crm_automation_runs_frequency_cap_idx')
    expect(rollback).toContain('DROP COLUMN IF EXISTS safety_config')
  })

  it('validates safety config, preview mode, audience size, and pause input', () => {
    const automation = createCrmAutomationSchema.parse({
      name: 'Safe lapsed winback',
      status: 'active',
      trigger_type: 'lapsed',
      condition_tree: { days_since_last_visit: 45 },
      actions: [{ action_type: 'send_email', config: { template_id: 'winback' } }],
      safety_config: {
        frequency_cap_count: 2,
        frequency_cap_window_hours: 168,
        audience_size_limit: 250,
        estimated_cost_cents: 1200,
        suppression_rules: { suppress_lapsed_winback: false },
        exit_conditions: [{ lifecycle_stage: 'recovered' }],
      },
      measurement: { metric: 'return_visit_30_day' },
    })

    expect(automation.safety_config.frequency_cap_count).toBe(2)
    expect(automation.safety_config.audience_size_limit).toBe(250)
    expect(testCrmAutomationSchema.parse({
      guest_id: '00000000-0000-4000-8000-000000000001',
      audience_size: 200,
    })).toMatchObject({ dry_run: true, preview_mode: true, audience_size: 200 })
    expect(pauseCrmAutomationSchema.parse({ reason: 'Manager review before send' })).toMatchObject({ paused: true })
  })

  it('wires pause switch, audit, preview metadata, failure logs, and frequency-cap enforcement', () => {
    const automationLib = read('src/lib/crm/automations.ts')
    const pauseRoute = read('src/app/api/crm/automations/[id]/pause/route.ts')
    const runsRoute = read('src/app/api/crm/automations/[id]/runs/route.ts')
    const auditLog = read('src/lib/audit/log.ts')

    expect(automationLib).toContain('enforceAutomationSafety')
    expect(automationLib).toContain('recordSkippedAutomationRun')
    expect(automationLib).toContain('frequency_cap_count')
    expect(automationLib).toContain('crm_automation_failures')
    expect(automationLib).toContain('preview_mode')
    expect(pauseRoute).toContain('pauseCrmAutomationSchema')
    expect(pauseRoute).toContain("'crm_automation_paused'")
    expect(runsRoute).toContain("description: result.error ? 'CRM automation run blocked or failed'")
    expect(auditLog).toContain("'crm_automation_paused'")
    expect(auditLog).toContain("'crm_automation_run_started'")
  })
})
