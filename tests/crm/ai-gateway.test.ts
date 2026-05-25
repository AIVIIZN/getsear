import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCrmAiAssistantGatewayPayload, buildCrmAiTaskPacket, crmAiAssistantIds } from '@/lib/crm/ai-assistants'
import { canUseCrmAiTask, crmAiGatewayRoles } from '@/lib/crm/ai-gateway'
import { crmAiGatewaySchema, crmAiTaskPacketSchema } from '@/lib/schemas/crm'

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

describe('CRM-V11.2 GuestBrain outputs', () => {
  it('registers a guest AI brief endpoint with audited gateway execution', () => {
    const route = read('src/app/api/crm/guests/[id]/ai-brief/route.ts')
    const service = read('src/lib/crm/guest-brain.ts')
    const schemas = read('src/lib/schemas/crm.ts')

    expect(schemas).toContain("crmGuestBrainTaskSchema = z.enum(['guest_summary', 'server_brief', 'next_best_action'])")
    expect(route).toContain('crmGuestBrainSchema.safeParse')
    expect(route).toContain('canUseCrmAiTask')
    expect(route).toContain('generateGuestBrain')
    expect(service).toContain('executeCrmAiGateway')
    expect(service).toContain("feature: 'guest_brain'")
  })

  it('keeps GuestBrain source-backed and prevents owner analytics in server briefs', () => {
    const service = read('src/lib/crm/guest-brain.ts')
    const gateway = read('src/lib/crm/ai-gateway.ts')

    expect(service).toContain('Guest profile and visit totals')
    expect(service).toContain('Guest service identity')
    expect(service).toContain("visibility: 'owner'")
    expect(service).toContain('function serviceOnlySources')
    expect(service).toContain("if (task === 'server_brief') return serviceOnlySources(visible)")
    expect(service).toContain('source_citations')
    expect(gateway).toContain('deterministicGuestBrainOutput')
    expect(gateway).toContain('No preference or allergy source records were provided.')
    expect(gateway).toContain('Next best action:')
    expect(service).toContain('Omit owner-only analytics')
  })
})

describe('CRM-V11.3 CRM AI assistants', () => {
  it('registers every assistant as an AiTaskPacket with bounded cost policy', () => {
    expect(crmAiAssistantIds()).toEqual([
      'segment_assistant',
      'campaign_writer',
      'report_assistant',
      'insight_explainer',
      'anomaly_detection',
      'recovery_assistant',
      'data_cleanup_assistant',
      'manager_daily_brief',
      'menu_preference_intelligence',
    ])

    for (const assistant_id of crmAiAssistantIds()) {
      const packet = crmAiTaskPacketSchema.parse(buildCrmAiTaskPacket({
        assistant_id,
        prompt: 'Draft the safest next CRM operator recommendation from these source facts.',
      }))

      expect(packet.max_input_tokens).toBeGreaterThanOrEqual(2400)
      expect(packet.max_output_tokens).toBeGreaterThanOrEqual(700)
      expect(packet.estimated_cost_cents).toBeGreaterThan(0)
      expect(packet.metadata.cost_policy).toMatchObject({
        provider_order: ['gemini', 'openai', 'rules'],
        estimated_cost_cents: packet.estimated_cost_cents,
      })
    }
  })

  it('routes assistant packets through the CRM gateway without bypassing approval gates', () => {
    const gatedAssistants = [
      'segment_assistant',
      'campaign_writer',
      'report_assistant',
      'recovery_assistant',
      'data_cleanup_assistant',
      'menu_preference_intelligence',
    ] as const

    for (const assistant_id of gatedAssistants) {
      const packet = buildCrmAiTaskPacket({
        assistant_id,
        prompt: 'Draft an operator-facing recommendation that may become a saved CRM action.',
        dry_run: true,
      })
      const gatewayPayload = crmAiGatewaySchema.parse(buildCrmAiAssistantGatewayPayload(packet))

      expect(gatewayPayload.approval_required).toBe(true)
      expect(gatewayPayload.metadata.ai_task_packet).toMatchObject({
        assistant_id,
        approval_actions: expect.arrayContaining(packet.approval_actions),
        estimated_cost_cents: packet.estimated_cost_cents,
      })
      expect(packet.approval_actions.length).toBeGreaterThan(0)
    }
  })

  it('keeps read-only assistants cost-routed and non-mutating', () => {
    for (const assistant_id of ['insight_explainer', 'anomaly_detection', 'manager_daily_brief'] as const) {
      const packet = buildCrmAiTaskPacket({
        assistant_id,
        prompt: 'Explain what changed today for the manager without applying any CRM data changes.',
        sources: [{ source_id: 'manual', source_type: 'manual_context', title: 'Manual context', visibility: 'manager', data: { read_only: true } }],
      })
      const gatewayPayload = buildCrmAiAssistantGatewayPayload(packet)

      expect(packet.approval_required).toBe(false)
      expect(packet.approval_actions).toEqual([])
      expect(gatewayPayload.metadata.ai_task_packet).toMatchObject({
        assistant_id,
        approval_actions: [],
      })
      expect(gatewayPayload.sources.map((source) => source.title)).toContain('Manual context')
    }
  })
})
