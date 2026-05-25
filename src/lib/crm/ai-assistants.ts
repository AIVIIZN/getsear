import type { z } from 'zod'
import type { crmAiGatewaySchema, crmAiSourceSchema, crmAiTaskPacketSchema } from '@/lib/schemas/crm'

type CrmAiSource = z.infer<typeof crmAiSourceSchema>
export type CrmAiTaskPacket = z.infer<typeof crmAiTaskPacketSchema>
export type CrmAiGatewayPayload = z.infer<typeof crmAiGatewaySchema>

type AssistantId = CrmAiTaskPacket['assistant_id']
type ApprovalAction = CrmAiTaskPacket['approval_actions'][number]

type AssistantConfig = {
  task_type: CrmAiTaskPacket['task_type']
  purpose: string
  max_input_tokens: number
  max_output_tokens: number
  approval_actions: ApprovalAction[]
  default_sources: CrmAiSource[]
}

const assistantConfigs: Record<AssistantId, AssistantConfig> = {
  segment_assistant: {
    task_type: 'segment_draft',
    purpose: 'Draft or explain CRM audience segments from behavioral, consent, loyalty, menu, and lifecycle signals.',
    max_input_tokens: 2400,
    max_output_tokens: 700,
    approval_actions: ['save_segment', 'apply_tag'],
    default_sources: [{ source_id: 'segment-fields', source_type: 'crm_segment', title: 'CRM segment semantic fields', visibility: 'manager', data: { approval_gate: 'operator_required_before_segment_save_or_tagging' } }],
  },
  campaign_writer: {
    task_type: 'campaign_draft',
    purpose: 'Draft campaign copy, channel variants, offers, and send-readiness notes.',
    max_input_tokens: 3200,
    max_output_tokens: 1200,
    approval_actions: ['send_campaign'],
    default_sources: [{ source_id: 'campaign-policy', source_type: 'crm_campaign', title: 'CRM campaign compliance and Restaurant Memory policy', visibility: 'manager', data: { approval_gate: 'operator_required_before_campaign_send' } }],
  },
  report_assistant: {
    task_type: 'report_builder',
    purpose: 'Draft report definitions, metric mixes, dashboard actions, and schedule handoffs.',
    max_input_tokens: 3600,
    max_output_tokens: 1000,
    approval_actions: ['save_report'],
    default_sources: [{ source_id: 'semantic-report-layer', source_type: 'crm_report', title: 'CRM semantic metric layer', visibility: 'manager', data: { approval_gate: 'operator_required_before_report_save' } }],
  },
  insight_explainer: {
    task_type: 'report_builder',
    purpose: 'Explain metric movement, campaign ROI, loyalty shifts, and recovery trends without applying changes.',
    max_input_tokens: 3200,
    max_output_tokens: 900,
    approval_actions: [],
    default_sources: [{ source_id: 'insight-context', source_type: 'manual_context', title: 'CRM insight context', visibility: 'manager', data: { read_only: true } }],
  },
  anomaly_detection: {
    task_type: 'report_builder',
    purpose: 'Call out unusual drops, spikes, missing data, and suspicious CRM or reporting patterns.',
    max_input_tokens: 3600,
    max_output_tokens: 900,
    approval_actions: [],
    default_sources: [{ source_id: 'anomaly-context', source_type: 'manual_context', title: 'CRM anomaly detection context', visibility: 'manager', data: { read_only: true } }],
  },
  recovery_assistant: {
    task_type: 'recovery_message',
    purpose: 'Draft service recovery summaries, manager actions, and guest follow-up language.',
    max_input_tokens: 2800,
    max_output_tokens: 900,
    approval_actions: ['create_recovery_case', 'resolve_recovery_case'],
    default_sources: [{ source_id: 'recovery-policy', source_type: 'crm_recovery_case', title: 'Service recovery policy', visibility: 'manager', data: { approval_gate: 'manager_required_before_recovery_action' } }],
  },
  data_cleanup_assistant: {
    task_type: 'data_cleanup',
    purpose: 'Recommend duplicate cleanup, merge candidates, missing consent fixes, and data-quality repairs.',
    max_input_tokens: 3600,
    max_output_tokens: 900,
    approval_actions: ['merge_guest', 'cleanup_data', 'apply_tag', 'remove_tag'],
    default_sources: [{ source_id: 'data-quality-policy', source_type: 'manual_context', title: 'CRM data cleanup policy', visibility: 'owner', data: { approval_gate: 'operator_required_before_merge_tag_or_cleanup' } }],
  },
  manager_daily_brief: {
    task_type: 'next_best_action',
    purpose: "Summarize today's guest, recovery, campaign, loyalty, and menu-preference priorities for managers.",
    max_input_tokens: 4200,
    max_output_tokens: 1000,
    approval_actions: [],
    default_sources: [{ source_id: 'daily-brief-context', source_type: 'manual_context', title: 'Manager daily brief context', visibility: 'manager', data: { read_only: true } }],
  },
  menu_preference_intelligence: {
    task_type: 'next_best_action',
    purpose: 'Explain menu affinities and hospitality cues for segments, guests, campaigns, and recovery follow-up.',
    max_input_tokens: 3000,
    max_output_tokens: 800,
    approval_actions: ['apply_tag'],
    default_sources: [{ source_id: 'menu-preference-context', source_type: 'guest_preference', title: 'Menu preference intelligence context', visibility: 'manager', data: { approval_gate: 'operator_required_before_preference_tagging' } }],
  },
}

function estimateCostCents(inputTokens: number, outputTokens: number): number {
  return Math.min(500, Math.ceil(inputTokens * 0.00015 + outputTokens * 0.0006))
}

export function crmAiAssistantIds(): AssistantId[] {
  return Object.keys(assistantConfigs) as AssistantId[]
}

export function buildCrmAiTaskPacket(input: {
  assistant_id: AssistantId
  prompt: string
  location_id?: string | null
  guest_id?: string | null
  dry_run?: boolean
  sources?: CrmAiSource[]
  metadata?: Record<string, unknown>
}): CrmAiTaskPacket {
  const config = assistantConfigs[input.assistant_id]
  const approvalRequired = config.approval_actions.length > 0
  const sources = [...config.default_sources, ...(input.sources ?? [])].slice(0, 24)
  return {
    assistant_id: input.assistant_id,
    task_type: config.task_type,
    prompt: input.prompt,
    location_id: input.location_id ?? null,
    guest_id: input.guest_id ?? null,
    dry_run: input.dry_run ?? false,
    approval_required: approvalRequired,
    max_input_tokens: config.max_input_tokens,
    max_output_tokens: config.max_output_tokens,
    estimated_cost_cents: estimateCostCents(config.max_input_tokens, config.max_output_tokens),
    approval_actions: config.approval_actions,
    sources,
    metadata: {
      assistant_id: input.assistant_id,
      purpose: config.purpose,
      cost_policy: {
        max_input_tokens: config.max_input_tokens,
        max_output_tokens: config.max_output_tokens,
        estimated_cost_cents: estimateCostCents(config.max_input_tokens, config.max_output_tokens),
        provider_order: ['gemini', 'openai', 'rules'],
      },
      approval_actions: config.approval_actions,
      ...(input.metadata ?? {}),
    },
  }
}

export function buildCrmAiAssistantGatewayPayload(packet: CrmAiTaskPacket): CrmAiGatewayPayload {
  return {
    task_type: packet.task_type,
    prompt: packet.prompt,
    location_id: packet.location_id,
    guest_id: packet.guest_id,
    dry_run: packet.dry_run,
    approval_required: packet.approval_required,
    sources: packet.sources,
    metadata: {
      ...packet.metadata,
      ai_task_packet: {
        assistant_id: packet.assistant_id,
        approval_actions: packet.approval_actions,
        max_input_tokens: packet.max_input_tokens,
        max_output_tokens: packet.max_output_tokens,
        estimated_cost_cents: packet.estimated_cost_cents,
      },
    },
  }
}
