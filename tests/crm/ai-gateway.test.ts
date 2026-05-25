import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { canUseCrmAiTask, crmAiGatewayRoles } from '@/lib/crm/ai-gateway'
import { crmAiGatewaySchema } from '@/lib/schemas/crm'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('CRM-V11.1 AI gateway', () => {
  it('ships auditable CRM AI tables with tenant RLS and rollback coverage', () => {
    const migration = read('supabase/migrations/20260525210000_add_crm_ai_gateway.sql')
    const rollback = read('supabase/_rollbacks/20260525210000_add_crm_ai_gateway.rollback.sql')

    for (const table of ['crm_ai_prompt_templates', 'crm_ai_audit_logs', 'crm_ai_tool_calls']) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
      expect(migration).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}[\\s\\S]*?org_id uuid NOT NULL REFERENCES public\\.organizations\\(id\\) ON DELETE CASCADE`))
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
      expect(migration).toContain(`tenant_select_${table}`)
      expect(migration).toContain(`service_role_bypass_${table}`)
      expect(rollback).toContain(`DROP TABLE IF EXISTS public.${table}`)
    }

    expect(migration).toContain("task_type text NOT NULL CHECK")
    expect(migration).toContain("provider text NOT NULL CHECK")
    expect(migration).toContain('prompt_redaction_summary jsonb NOT NULL')
    expect(migration).toContain('source_citations jsonb NOT NULL')
    expect(migration).toContain('safety_flags text[] NOT NULL')
  })

  it('validates AI task packets with redacted source context and approval defaults', () => {
    const parsed = crmAiGatewaySchema.parse({
      task_type: 'guest_summary',
      prompt: 'Summarize hospitality context for tonight.',
      sources: [{
        source_id: 'guest-123',
        source_type: 'guest_note',
        title: 'Hospitality note',
        visibility: 'service',
        data: { note_category: 'hospitality', body: 'Likes booth 4', phone: '555-1212' },
      }],
    })

    expect(parsed.approval_required).toBe(true)
    expect(parsed.dry_run).toBe(false)
    expect(parsed.sources[0]?.visibility).toBe('service')
    expect(() => crmAiGatewaySchema.parse({ task_type: 'guest_summary', prompt: 'short' })).toThrow()
  })

  it('keeps CRM AI on Gemini/OpenAI/rules providers and blocks privileged tasks for staff roles', () => {
    const gateway = read('src/lib/crm/ai-gateway.ts')
    const route = read('src/app/api/ai/crm-gateway/route.ts')
    const auditLog = read('src/lib/audit/log.ts')

    expect(gateway).toContain("provider: 'gemini'")
    expect(gateway).toContain("provider: 'openai'")
    expect(gateway).toContain("provider: 'rules'")
    expect(gateway).not.toContain('Anthropic')
    expect(gateway).not.toContain('CLAUDE_MODEL')
    expect(route).toContain('executeCrmAiGateway')
    expect(route).toContain("eq('org_id', user.org_id)")
    expect(gateway).toContain('crm_ai_tool_calls')
    expect(gateway).toContain('crm_ai_retrieve_sources')
    expect(gateway).toContain('crm_ai_safety_filter')
    expect(auditLog).toContain("'crm_ai_gateway_invoked'")
    expect(auditLog).toContain("'crm_ai_gateway_refused'")

    expect(crmAiGatewayRoles).toContain('server')
    expect(canUseCrmAiTask({ role: 'server' }, 'guest_summary')).toBe(true)
    expect(canUseCrmAiTask({ role: 'server' }, 'recovery_message')).toBe(false)
    expect(canUseCrmAiTask({ role: 'manager' }, 'recovery_message')).toBe(true)
  })

  it('enforces hidden-note and payment-sensitive redaction in the gateway implementation', () => {
    const gateway = read('src/lib/crm/ai-gateway.ts')

    expect(gateway).toContain('hidden_note_request_denied')
    expect(gateway).toContain('payment_sensitive_request')
    expect(gateway).toContain('canReadGuestNote')
    expect(gateway).toContain('canReadGuestVisibility')
    expect(gateway).toContain('SENSITIVE_FIELD_PATTERN')
    expect(gateway).toContain('prompt_redaction_summary')
  })
})
