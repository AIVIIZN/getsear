import type { AuthUser } from '@/lib/api/auth'
import { canReadGuestVisibility } from '@/lib/crm/api'
import { executeCrmAiGateway, type CrmAiGatewayResult } from '@/lib/crm/ai-gateway'
import { fetchActiveRestaurantMemoryRules, restaurantMemoryRulesToSource } from '@/lib/crm/restaurant-memory'
import { createAdminClient } from '@/lib/supabase/admin'
import type { z } from 'zod'
import type { crmAiSourceSchema, crmGuestBrainSchema, crmGuestBrainTaskSchema } from '@/lib/schemas/crm'

type DbClient = ReturnType<typeof createAdminClient>
type GuestBrainTask = z.infer<typeof crmGuestBrainTaskSchema>
type GuestBrainInput = z.infer<typeof crmGuestBrainSchema>
type CrmAiSource = z.infer<typeof crmAiSourceSchema>

type GuestBrainOutput = {
  task_type: GuestBrainTask
  audit_log_id: string | null
  status: CrmAiGatewayResult['status']
  text: string
  confidence: number
  source_citations: string[]
  approval_required: boolean
  safety_flags: string[]
  redaction_summary: CrmAiGatewayResult['redaction_summary']
}

function source(source: CrmAiSource): CrmAiSource {
  return source
}

function serviceOnlySources(sources: CrmAiSource[]): CrmAiSource[] {
  return sources.filter((item) => item.visibility === 'service')
}

function sourcesForTask(task: GuestBrainTask, sources: CrmAiSource[], user: Pick<AuthUser, 'role'>): CrmAiSource[] {
  const visible = sources.filter((item) => canReadGuestVisibility(user, item.visibility))
  if (task === 'server_brief') return serviceOnlySources(visible)
  return visible
}

function promptForTask(task: GuestBrainTask): string {
  if (task === 'guest_summary') {
    return 'Create exactly 3 manager-useful lines about this guest using only cited CRM sources. Include uncertainty when evidence is missing.'
  }
  if (task === 'server_brief') {
    return 'Create a concise table-side hospitality brief using only service-visible sources. Omit owner-only analytics, spend ranking, and hidden notes.'
  }
  return 'Choose one next best action from invite, birthday reward, do nothing, manager greet, recover, loyalty enrollment, or reservation priority. Explain the source-backed reason.'
}

async function fetchGuestBrainSources(input: {
  db: DbClient
  user: Pick<AuthUser, 'org_id'>
  guestId: string
  request: GuestBrainInput
}): Promise<{ guestFound: boolean; sources: CrmAiSource[] }> {
  const { db, user, guestId, request } = input
  const { data: guest } = await db
    .from('guests')
    .select('id, display_name, preferred_name, birthday, lifecycle_stage, is_vip, total_visits, total_spend, average_check, first_visit_at, last_visit_at, last_order_id, location_id')
    .eq('id', guestId)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!guest) return { guestFound: false, sources: [] }

  const [
    { data: notes },
    { data: preferences },
    { data: allergies },
    { data: consents },
    { data: tags },
    { data: recoveryCases },
    { data: loyaltyAccounts },
  ] = await Promise.all([
    db.from('guest_notes').select('id, note_category, visibility, body, pinned, created_at').eq('guest_id', guestId).eq('org_id', user.org_id).is('deleted_at', null).order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(12),
    db.from('guest_preferences').select('id, preference_category, preference_key, preference_value, confidence, source, last_observed_at').eq('guest_id', guestId).eq('org_id', user.org_id).is('deleted_at', null).limit(12),
    db.from('guest_allergies').select('id, allergen, severity, reaction_notes, source, verified_at').eq('guest_id', guestId).eq('org_id', user.org_id).eq('is_active', true).is('deleted_at', null).limit(8),
    db.from('guest_consents').select('channel, purpose, status, granted_at, revoked_at').eq('guest_id', guestId).eq('org_id', user.org_id).is('deleted_at', null).limit(20),
    db.from('guest_tags').select('id, crm_tags(name, slug, tag_category, is_sensitive)').eq('guest_id', guestId).eq('org_id', user.org_id).is('deleted_at', null).limit(12),
    db.from('crm_recovery_cases').select('id, severity, status, issue_summary, recommended_action, followup_due_at, created_at').eq('guest_id', guestId).eq('org_id', user.org_id).order('created_at', { ascending: false }).limit(5),
    db.from('crm_loyalty_accounts').select('id, status, points_balance, lifetime_points, tier_name, enrolled_at').eq('guest_id', guestId).eq('org_id', user.org_id).limit(4),
  ])

  const sources: CrmAiSource[] = [
    source({
      source_id: `guest-identity:${guestId}`,
      source_type: 'guest',
      title: 'Guest service identity',
      visibility: 'service',
      data: {
        id: (guest as { id: string }).id,
        display_name: (guest as { display_name: string }).display_name,
        preferred_name: (guest as { preferred_name: string | null }).preferred_name,
        last_visit_at: (guest as { last_visit_at: string | null }).last_visit_at,
      },
    }),
    source({
      source_id: `guest:${guestId}`,
      source_type: 'guest',
      title: 'Guest profile and visit totals',
      visibility: 'owner',
      data: guest as Record<string, unknown>,
    }),
  ]

  const memoryRules = await fetchActiveRestaurantMemoryRules({
    db,
    user,
    appliesTo: request.tasks.includes('next_best_action') ? 'next_best_action' : 'guest_summary',
    locationId: request.location_id ?? null,
  })
  if (memoryRules.length > 0) sources.push(source(restaurantMemoryRulesToSource(memoryRules)))

  if (request.table_id || request.table_name || request.order_id || request.service_context) {
    sources.push(source({
      source_id: `service-context:${guestId}`,
      source_type: 'manual_context',
      title: 'Current table service context',
      visibility: 'service',
      data: {
        table_id: request.table_id ?? null,
        table_name: request.table_name ?? null,
        order_id: request.order_id ?? null,
        service_context: request.service_context ?? null,
      },
    }))
  }

  for (const note of notes ?? []) {
    const visibility = (note as { visibility: 'service' | 'manager' | 'owner' }).visibility
    sources.push(source({
      source_id: `guest-note:${(note as { id: string }).id}`,
      source_type: 'guest_note',
      title: `Guest note: ${(note as { note_category: string }).note_category}`,
      visibility,
      data: note as Record<string, unknown>,
    }))
  }

  const groupedSources: Array<[string, CrmAiSource['source_type'], CrmAiSource['visibility'], unknown]> = [
    ['Guest preferences', 'guest_preference', 'service', preferences ?? []],
    ['Active allergy records', 'guest_allergy', 'service', allergies ?? []],
    ['Consent status', 'guest_consent', 'manager', consents ?? []],
    ['Guest tags', 'guest', 'manager', tags ?? []],
    ['Service recovery cases', 'crm_recovery_case', 'manager', recoveryCases ?? []],
    ['Loyalty accounts', 'guest', 'service', loyaltyAccounts ?? []],
  ]

  for (const [title, source_type, visibility, data] of groupedSources) {
    sources.push(source({
      source_id: `${title.toLowerCase().replaceAll(' ', '-')}:${guestId}`,
      source_type,
      title,
      visibility,
      data: { records: data },
    }))
  }

  return { guestFound: true, sources }
}

export async function generateGuestBrain(input: {
  user: AuthUser
  guestId: string
  request: GuestBrainInput
}): Promise<{ data: { guest_id: string; outputs: GuestBrainOutput[] } } | { error: string }> {
  const db = createAdminClient()
  const { guestFound, sources } = await fetchGuestBrainSources({ db, user: input.user, guestId: input.guestId, request: input.request })
  if (!guestFound) return { error: 'Guest not found' }

  const outputs: GuestBrainOutput[] = []
  for (const task of input.request.tasks) {
    const taskSources = sourcesForTask(task, sources, input.user)
    const result = await executeCrmAiGateway({
      task_type: task,
      prompt: promptForTask(task),
      guest_id: input.guestId,
      location_id: input.request.location_id ?? null,
      dry_run: input.request.dry_run,
      approval_required: true,
      sources: taskSources,
      metadata: {
        feature: 'guest_brain',
        server_brief_service_only: task === 'server_brief',
        source_titles: taskSources.map((item) => item.title),
      },
    }, input.user)

    outputs.push({
      task_type: task,
      audit_log_id: result.audit_log_id,
      status: result.status,
      text: result.output?.text ?? '',
      confidence: result.output?.confidence ?? 0,
      source_citations: result.output?.source_citations ?? [],
      approval_required: result.output?.approval_required ?? true,
      safety_flags: result.safety_flags,
      redaction_summary: result.redaction_summary,
    })
  }

  return { data: { guest_id: input.guestId, outputs } }
}
