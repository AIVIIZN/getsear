import { createHash } from 'node:crypto'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AuthUser } from '@/lib/api/auth'
import { canReadGuestNote, canReadGuestVisibility, crmGuestComplianceRoles, crmGuestManagerRoles } from '@/lib/crm/api'
import { createAdminClient } from '@/lib/supabase/admin'
import type { z } from 'zod'
import type { crmAiGatewaySchema, crmAiProviderSchema, crmAiTaskTypeSchema } from '@/lib/schemas/crm'

export const crmAiGatewayRoles = ['platform_admin', 'owner', 'admin', 'manager', 'marketing', 'analyst', 'server', 'bartender', 'host'] as const
export const crmAiAuditReadRoles = ['platform_admin', 'owner', 'admin', 'manager', 'marketing', 'analyst'] as const

type CrmAiProvider = z.infer<typeof crmAiProviderSchema>
type CrmAiTaskType = z.infer<typeof crmAiTaskTypeSchema>
type CrmAiGatewayInput = z.infer<typeof crmAiGatewaySchema>

type SanitizedSource = {
  source_id: string
  source_type: string
  title: string
  visibility: 'service' | 'manager' | 'owner'
  data: Record<string, unknown>
}

export type CrmAiGatewayResult = {
  status: 'completed' | 'refused' | 'dry_run'
  audit_log_id: string | null
  provider: CrmAiProvider
  model: string
  output: {
    text: string
    confidence: number
    source_citations: string[]
    approval_required: boolean
  } | null
  safety_flags: string[]
  redaction_summary: {
    removed_fields: string[]
    hidden_sources: number
    source_count: number
  }
}

const DISALLOWED_PROMPT_PATTERNS = [
  { pattern: /\b(card number|cvv|cvc|payment token|magstripe|track data)\b/i, flag: 'payment_sensitive_request' },
  { pattern: /\b(ssn|social security|password|api key|secret key|raw sql|drop table)\b/i, flag: 'credential_or_sql_request' },
  { pattern: /\b(race|religion|political|disability|medical diagnosis|health condition|minor only)\b/i, flag: 'protected_or_sensitive_targeting' },
]

const SENSITIVE_FIELD_PATTERN = /(email|phone|address|normalized_value|value_hash|payment|card|token|secret|password|ssn|raw_body|headers)/i

function promptHash(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex')
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function providerFromEnv(): { provider: CrmAiProvider; model: string } {
  if (process.env.GEMINI_API_KEY) return { provider: 'gemini', model: process.env.GEMINI_CRM_MODEL ?? 'gemini-2.0-flash' }
  if (process.env.OPENAI_API_KEY) return { provider: 'openai', model: process.env.OPENAI_CRM_MODEL ?? 'gpt-4.1-mini' }
  return { provider: 'rules', model: 'deterministic-rules' }
}

function promptSafetyFlags(prompt: string, user: Pick<AuthUser, 'role'>): string[] {
  const flags = DISALLOWED_PROMPT_PATTERNS.filter(({ pattern }) => pattern.test(prompt)).map(({ flag }) => flag)
  if (!crmGuestManagerRoles.includes(user.role as never) && /\b(hidden|owner-only|manager note|sensitive note|recovery detail)\b/i.test(prompt)) {
    flags.push('hidden_note_request_denied')
  }
  return [...new Set(flags)]
}

function redactObject(value: Record<string, unknown>, removedFields: Set<string>): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  for (const [key, rawValue] of Object.entries(value)) {
    if (SENSITIVE_FIELD_PATTERN.test(key)) {
      removedFields.add(key)
      continue
    }
    if (Array.isArray(rawValue)) {
      output[key] = rawValue.map((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) return redactObject(item as Record<string, unknown>, removedFields)
        return item
      })
      continue
    }
    if (rawValue && typeof rawValue === 'object') {
      output[key] = redactObject(rawValue as Record<string, unknown>, removedFields)
      continue
    }
    output[key] = rawValue
  }
  return output
}

function sanitizeSources(input: CrmAiGatewayInput, user: Pick<AuthUser, 'role'>): {
  sources: SanitizedSource[]
  removed_fields: string[]
  hidden_sources: number
} {
  const removedFields = new Set<string>()
  let hiddenSources = 0
  const sources = input.sources.flatMap((source): SanitizedSource[] => {
    if (!canReadGuestVisibility(user, source.visibility)) {
      hiddenSources += 1
      return []
    }
    if (source.source_type === 'guest_note' && !canReadGuestNote(user, {
      note_category: typeof source.data.note_category === 'string' ? source.data.note_category : null,
      visibility: source.visibility,
    })) {
      hiddenSources += 1
      return []
    }
    return [{
      source_id: source.source_id,
      source_type: source.source_type,
      title: source.title,
      visibility: source.visibility,
      data: redactObject(source.data, removedFields),
    }]
  })

  return { sources, removed_fields: [...removedFields].sort(), hidden_sources: hiddenSources }
}

function arrayRecords(source: SanitizedSource | undefined): Array<Record<string, unknown>> {
  const records = source?.data.records
  return Array.isArray(records) ? records.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : []
}

function formatMoney(value: unknown): string | null {
  const amount = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(amount)) return null
  return `$${Math.round(amount).toLocaleString()}`
}

function conciseDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  return value.slice(0, 10)
}

function citationsFor(sources: SanitizedSource[], titles: string[]): string[] {
  const known = new Set(sources.map((source) => source.title))
  const citations = titles.filter((title) => known.has(title))
  return citations.length > 0 ? citations : sources.map((source) => source.title).slice(0, 4)
}

function deterministicGuestBrainOutput(taskType: CrmAiTaskType, sources: SanitizedSource[]): {
  text: string
  confidence: number
  source_citations: string[]
} | null {
  if (!['guest_summary', 'server_brief', 'next_best_action'].includes(taskType)) return null

  const guestSource = sources.find((source) => source.title === 'Guest profile and visit totals') ?? sources.find((source) => source.title === 'Guest service identity')
  const guest = guestSource?.data ?? {}
  const serviceContext = sources.find((source) => source.title === 'Current table service context')?.data ?? {}
  const preferences = arrayRecords(sources.find((source) => source.title === 'Guest preferences'))
  const allergies = arrayRecords(sources.find((source) => source.title === 'Active allergy records'))
  const recoveryCases = arrayRecords(sources.find((source) => source.title === 'Service recovery cases'))
  const loyaltyAccounts = arrayRecords(sources.find((source) => source.title === 'Loyalty accounts'))
  const notes = sources.filter((source) => source.source_type === 'guest_note')
  const name = typeof guest.display_name === 'string' ? guest.display_name : 'Guest'
  const lifecycle = typeof guest.lifecycle_stage === 'string' ? guest.lifecycle_stage.replaceAll('_', ' ') : 'unknown lifecycle'
  const spend = formatMoney(guest.total_spend)
  const visits = typeof guest.total_visits === 'number' ? guest.total_visits : Number(guest.total_visits ?? 0)
  const lastVisit = conciseDate(guest.last_visit_at)
  const allergyText = allergies.map((item) => [item.allergen, item.severity].filter(Boolean).join(' - ')).filter(Boolean).slice(0, 3).join('; ')
  const prefText = preferences.map((item) => [item.preference_category, item.preference_key].filter(Boolean).join(': ')).filter(Boolean).slice(0, 3).join('; ')
  const hospitalityNotes = notes.map((source) => typeof source.data.body === 'string' ? source.data.body : '').filter(Boolean).slice(0, 2).join(' ')
  const openRecovery = recoveryCases.find((item) => !['resolved', 'closed'].includes(String(item.status)))
  const birthday = typeof guest.birthday === 'string' ? guest.birthday : null
  const birthdayThisMonth = birthday ? birthday.slice(5, 7) === String(new Date().getUTCMonth() + 1).padStart(2, '0') : false
  const hasLoyalty = loyaltyAccounts.some((item) => String(item.status ?? '').match(/active|enrolled/i))

  if (taskType === 'guest_summary') {
    const lines = [
      `${name}: ${lifecycle}; ${visits} visits${spend ? `; ${spend} lifetime spend` : ''}${lastVisit ? `; last visit ${lastVisit}` : ''}.`,
      prefText || allergyText ? `Known hospitality context: ${[prefText, allergyText].filter(Boolean).join('; ')}.` : 'No preference or allergy source records were provided.',
      openRecovery ? `Open recovery item: ${String(openRecovery.issue_summary ?? 'review before next visit')}.` : 'No open service recovery source records were provided.',
    ]
    return {
      text: lines.join('\n'),
      confidence: sources.length >= 4 ? 0.82 : 0.58,
      source_citations: citationsFor(sources, ['Guest profile and visit totals', 'Guest preferences', 'Active allergy records', 'Service recovery cases']),
    }
  }

  if (taskType === 'server_brief') {
    const tableName = typeof serviceContext.table_name === 'string' && serviceContext.table_name ? ` for ${serviceContext.table_name}` : ''
    const lines = [
      `Table brief${tableName}: greet ${name}${lastVisit ? ` as a returning guest last seen ${lastVisit}` : ' with no prior visit date in the supplied service sources'}.`,
      allergyText ? `Confirm allergy context before ordering: ${allergyText}.` : 'No active allergy source records were provided.',
      hospitalityNotes || prefText ? `Hospitality cue: ${hospitalityNotes || prefText}.` : 'No service-visible hospitality note or preference was provided.',
    ]
    return {
      text: lines.join('\n'),
      confidence: sources.length >= 3 ? 0.76 : 0.5,
      source_citations: citationsFor(sources, ['Guest service identity', 'Current table service context', 'Guest preferences', 'Active allergy records']),
    }
  }

  const action = openRecovery
    ? 'recover'
    : birthdayThisMonth
      ? 'birthday reward'
      : !hasLoyalty
        ? 'loyalty enrollment'
        : lifecycle.includes('vip') || visits >= 8
          ? 'manager greet'
          : lifecycle.includes('lapsed')
            ? 'invite'
            : 'do nothing'
  const reason = openRecovery
    ? `open recovery case: ${String(openRecovery.issue_summary ?? 'needs manager review')}`
    : birthdayThisMonth
      ? 'birthday falls this month in the supplied guest profile'
      : !hasLoyalty
        ? 'no active loyalty account appeared in the supplied sources'
        : lifecycle.includes('vip') || visits >= 8
          ? 'VIP or high-repeat visit evidence in guest profile'
          : lifecycle.includes('lapsed')
            ? 'lapsed lifecycle stage in guest profile'
            : 'no stronger source-backed intervention was indicated'
  return {
    text: `Next best action: ${action}. Reason: ${reason}.`,
    confidence: sources.length >= 4 ? 0.8 : 0.54,
    source_citations: citationsFor(sources, ['Guest profile and visit totals', 'Service recovery cases', 'Loyalty accounts']),
  }
}

function deterministicOutput(taskType: CrmAiTaskType, prompt: string, sources: SanitizedSource[]): {
  text: string
  confidence: number
  source_citations: string[]
} {
  const guestBrainOutput = deterministicGuestBrainOutput(taskType, sources)
  if (guestBrainOutput) return guestBrainOutput

  const sourceTitles = sources.map((source) => source.title).slice(0, 6)
  const citations = sourceTitles.length > 0 ? sourceTitles : ['Operator prompt only; no guest facts were provided.']
  const actionText: Record<CrmAiTaskType, string> = {
    guest_summary: 'Guest summary draft',
    server_brief: 'Server brief draft',
    next_best_action: 'Next best action draft',
    segment_draft: 'Segment draft',
    campaign_draft: 'Campaign draft',
    report_builder: 'Report builder draft',
    recovery_message: 'Recovery message draft',
    data_cleanup: 'Data cleanup recommendation',
  }

  return {
    text: `${actionText[taskType]} based only on ${citations.join(', ')}. Operator request: ${prompt.slice(0, 280)}`,
    confidence: sources.length > 0 ? 0.68 : 0.42,
    source_citations: citations,
  }
}

async function recordGatewayToolCalls(input: {
  org_id: string
  location_id: string | null
  audit_log_id: string | null
  source_count: number
  hidden_sources: number
  removed_fields: string[]
  safety_flags: string[]
}) {
  if (!input.audit_log_id) return
  const admin = createAdminClient()
  await admin
    .from('crm_ai_tool_calls')
    .insert([
      {
        org_id: input.org_id,
        location_id: input.location_id,
        audit_log_id: input.audit_log_id,
        tool_name: 'crm_ai_retrieve_sources',
        tool_input_summary: { requested_sources: input.source_count + input.hidden_sources },
        tool_output_summary: {
          usable_sources: input.source_count,
          hidden_sources: input.hidden_sources,
          removed_fields: input.removed_fields,
        },
        status: 'succeeded',
        safety_flags: [],
        completed_at: new Date().toISOString(),
      },
      {
        org_id: input.org_id,
        location_id: input.location_id,
        audit_log_id: input.audit_log_id,
        tool_name: 'crm_ai_safety_filter',
        tool_input_summary: { checks: ['payment_sensitive_request', 'credential_or_sql_request', 'protected_or_sensitive_targeting', 'hidden_note_request_denied'] },
        tool_output_summary: { allowed: input.safety_flags.length === 0 },
        status: input.safety_flags.length > 0 ? 'refused' : 'succeeded',
        safety_flags: input.safety_flags,
        completed_at: new Date().toISOString(),
      },
    ] as never)
}

async function callModel(provider: CrmAiProvider, model: string, taskType: CrmAiTaskType, prompt: string, sources: SanitizedSource[]) {
  const system = [
    'You are Sear POS GuestBrain for restaurant CRM.',
    'Use only the supplied redacted sources. Do not invent guest facts.',
    'Cite source titles. Never expose payment-sensitive data or hidden notes.',
    'Return concise operational text only; actions requiring sends, merges, discounts, reports, or guest mutations need approval.',
  ].join(' ')
  const sourceText = JSON.stringify(sources.map(({ title, source_type, data }) => ({ title, source_type, data }))).slice(0, 12000)
  const userContent = `Task: ${taskType}\nRequest: ${prompt}\nSources: ${sourceText}`

  if (provider === 'gemini') {
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const result = await client.getGenerativeModel({ model }).generateContent(`${system}\n\n${userContent}`)
    return result.response.text()
  }
  if (provider === 'openai') {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const result = await client.chat.completions.create({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }],
      temperature: 0.1,
    })
    return result.choices[0]?.message.content ?? ''
  }
  return deterministicOutput(taskType, prompt, sources).text
}

export async function executeCrmAiGateway(input: CrmAiGatewayInput, user: AuthUser): Promise<CrmAiGatewayResult> {
  const { provider, model } = providerFromEnv()
  const safetyFlags = promptSafetyFlags(input.prompt, user)
  const sanitized = sanitizeSources(input, user)
  const redactionSummary = {
    removed_fields: sanitized.removed_fields,
    hidden_sources: sanitized.hidden_sources,
    source_count: sanitized.sources.length,
  }
  const admin = createAdminClient()

  if (safetyFlags.length > 0) {
    const { data } = await admin
      .from('crm_ai_audit_logs')
      .insert({
        org_id: user.org_id,
        location_id: input.location_id ?? null,
        guest_id: input.guest_id ?? null,
        prompt_template_id: input.prompt_template_id ?? null,
        actor_user_id: user.id,
        task_type: input.task_type,
        provider,
        model,
        status: 'refused',
        prompt_hash: promptHash(input.prompt),
        prompt_redaction_summary: redactionSummary,
        input_tokens: estimateTokens(input.prompt),
        output_tokens: 0,
        confidence: null,
        output_summary: 'Refused by CRM AI safety filter.',
        source_citations: [],
        safety_flags: safetyFlags,
        approval_required: true,
        request_metadata: input.metadata,
      } as never)
      .select('id')
      .single()
    const auditLogId = (data as { id?: string } | null)?.id ?? null
    await recordGatewayToolCalls({
      org_id: user.org_id,
      location_id: input.location_id ?? null,
      audit_log_id: auditLogId,
      source_count: redactionSummary.source_count,
      hidden_sources: redactionSummary.hidden_sources,
      removed_fields: redactionSummary.removed_fields,
      safety_flags: safetyFlags,
    })

    return {
      status: 'refused',
      audit_log_id: auditLogId,
      provider,
      model,
      output: null,
      safety_flags: safetyFlags,
      redaction_summary: redactionSummary,
    }
  }

  const deterministic = deterministicOutput(input.task_type, input.prompt, sanitized.sources)
  const text = input.dry_run ? deterministic.text : await callModel(provider, model, input.task_type, input.prompt, sanitized.sources).catch(() => deterministic.text)
  const output = {
    text: text || deterministic.text,
    confidence: provider === 'rules' ? deterministic.confidence : Math.min(0.86, deterministic.confidence + 0.1),
    source_citations: deterministic.source_citations,
    approval_required: input.approval_required,
  }

  const { data } = await admin
    .from('crm_ai_audit_logs')
    .insert({
      org_id: user.org_id,
      location_id: input.location_id ?? null,
      guest_id: input.guest_id ?? null,
      prompt_template_id: input.prompt_template_id ?? null,
      actor_user_id: user.id,
      task_type: input.task_type,
      provider,
      model,
      status: input.dry_run ? 'dry_run' : 'completed',
      prompt_hash: promptHash(input.prompt),
      prompt_redaction_summary: redactionSummary,
      input_tokens: estimateTokens([input.prompt, JSON.stringify(sanitized.sources)].join('\n')),
      output_tokens: estimateTokens(output.text),
      confidence: output.confidence,
      output_summary: output.text.slice(0, 2000),
      source_citations: output.source_citations,
      safety_flags: safetyFlags,
      approval_required: output.approval_required,
      request_metadata: input.metadata,
    } as never)
    .select('id')
    .single()
  const auditLogId = (data as { id?: string } | null)?.id ?? null
  await recordGatewayToolCalls({
    org_id: user.org_id,
    location_id: input.location_id ?? null,
    audit_log_id: auditLogId,
    source_count: redactionSummary.source_count,
    hidden_sources: redactionSummary.hidden_sources,
    removed_fields: redactionSummary.removed_fields,
    safety_flags: safetyFlags,
  })

  return {
    status: input.dry_run ? 'dry_run' : 'completed',
    audit_log_id: auditLogId,
    provider,
    model,
    output,
    safety_flags: safetyFlags,
    redaction_summary: redactionSummary,
  }
}

export function crmAiTaskRequiresManager(taskType: CrmAiTaskType): boolean {
  return taskType === 'recovery_message' || taskType === 'data_cleanup' || taskType === 'report_builder'
}

export function canUseCrmAiTask(user: Pick<AuthUser, 'role'>, taskType: CrmAiTaskType): boolean {
  if (!crmAiGatewayRoles.includes(user.role as never)) return false
  if (crmAiTaskRequiresManager(taskType)) return crmGuestManagerRoles.includes(user.role as never) || crmGuestComplianceRoles.includes(user.role as never)
  return true
}
