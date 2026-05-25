export const crmHealthReadRoles = ['platform_admin', 'owner', 'admin', 'manager', 'marketing', 'analyst'] as const
export const crmHealthReviewRoles = ['platform_admin', 'owner', 'admin', 'manager'] as const

export type CrmHealthIssueType =
  | 'duplicate_rate'
  | 'no_contact'
  | 'missing_consent'
  | 'invalid_email'
  | 'invalid_phone'
  | 'unlinked_checks'
  | 'unmatched_reservations'
  | 'weak_identity'
  | 'old_inactive_segment'
  | 'broken_automation'
  | 'failed_send'

export type CrmHealthCandidate = {
  issue_key: string
  issue_type: CrmHealthIssueType
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  impact_score: number
  affected_record_count: number
  affected_table: string
  affected_record_ids: string[]
  evidence: Record<string, unknown>
  fix_strategy: 'review_required' | 'merge_preview' | 'consent_review' | 'contact_cleanup' | 'link_records' | 'archive_or_repair' | 'retry_or_suppress'
  fix_preview: Record<string, unknown>
  ai_suggestion: Record<string, unknown>
}

type QueryableDb = {
  from: (table: string) => {
    select: (...args: unknown[]) => QueryBuilder
  }
}

type QueryResult = {
  data?: unknown[] | null
  count?: number | null
}

type QueryBuilder = PromiseLike<QueryResult> & {
  select: (...args: unknown[]) => QueryBuilder
  eq: (...args: unknown[]) => QueryBuilder
  is: (...args: unknown[]) => QueryBuilder
  limit: (...args: unknown[]) => QueryBuilder
}

function clampImpact(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100))
}

function severityFor(impact: number): CrmHealthCandidate['severity'] {
  if (impact >= 80) return 'critical'
  if (impact >= 55) return 'high'
  if (impact >= 25) return 'medium'
  return 'low'
}

export function buildCrmHealthCandidate(input: {
  issue_type: CrmHealthIssueType
  affected_record_count: number
  scanned_count: number
  title: string
  description: string
  affected_table: string
  affected_record_ids?: string[]
  fix_strategy: CrmHealthCandidate['fix_strategy']
  fix_preview: Record<string, unknown>
  evidence?: Record<string, unknown>
  impact_weight: number
}): CrmHealthCandidate | null {
  if (input.affected_record_count <= 0) return null
  const rate = input.scanned_count > 0 ? input.affected_record_count / input.scanned_count : input.affected_record_count
  const impact = clampImpact((rate * 100) + input.impact_weight + Math.min(input.affected_record_count, 25))

  return {
    issue_key: `${input.issue_type}:${input.affected_table}`,
    issue_type: input.issue_type,
    title: input.title,
    description: input.description,
    severity: severityFor(impact),
    impact_score: impact,
    affected_record_count: input.affected_record_count,
    affected_table: input.affected_table,
    affected_record_ids: input.affected_record_ids ?? [],
    evidence: { scanned_count: input.scanned_count, issue_rate: rate, ...(input.evidence ?? {}) },
    fix_strategy: input.fix_strategy,
    fix_preview: input.fix_preview,
    ai_suggestion: {
      model_policy: 'safe_preview_only',
      confidence: impact >= 55 ? 'high' : 'medium',
      recommendation: 'Review the preview, confirm source evidence, then approve or dismiss. No cleanup runs without operator review.',
    },
  }
}

export async function collectCrmHealthCandidates(db: unknown, orgId: string): Promise<{
  candidates: CrmHealthCandidate[]
  scanned_counts: Record<string, number>
  issue_counts: Record<CrmHealthIssueType, number>
}> {
  const client = db as QueryableDb
  const [guestsResult, contactsResult, consentsResult, mergeResult, segmentsResult, automationsResult, sendsResult] = await Promise.all([
    client.from('guests').select('id, display_name, profile_status', { count: 'exact' }).eq('org_id', orgId).is('deleted_at', null).limit(500),
    client.from('guest_contact_points').select('id, guest_id, contact_type, normalized_value, value', { count: 'exact' }).eq('org_id', orgId).is('deleted_at', null).limit(1000),
    client.from('guest_consents').select('id, guest_id, channel, purpose, status', { count: 'exact' }).eq('org_id', orgId).limit(1000),
    client.from('guest_merge_candidates').select('id, primary_guest_id, candidate_guest_id, confidence_score, status', { count: 'exact' }).eq('org_id', orgId).eq('status', 'pending').limit(100),
    client.from('crm_segments').select('id, name, status, updated_at', { count: 'exact' }).eq('org_id', orgId).limit(200),
    client.from('crm_automations').select('id, name, status, updated_at', { count: 'exact' }).eq('org_id', orgId).limit(200),
    client.from('crm_message_sends').select('id, status, guest_id, created_at', { count: 'exact' }).eq('org_id', orgId).limit(500),
  ])

  const guests = (guestsResult.data ?? []) as Array<{ id: string; display_name?: string | null }>
  const contacts = (contactsResult.data ?? []) as Array<{ id: string; guest_id: string; contact_type: string; normalized_value?: string | null; value?: string | null }>
  const consents = (consentsResult.data ?? []) as Array<{ guest_id: string; channel: string; purpose: string; status: string }>
  const mergeCandidates = (mergeResult.data ?? []) as Array<{ id: string; primary_guest_id: string; candidate_guest_id: string; confidence_score?: number | null }>
  const segments = (segmentsResult.data ?? []) as Array<{ id: string; name: string; status: string; updated_at?: string | null }>
  const automations = (automationsResult.data ?? []) as Array<{ id: string; name: string; status: string; updated_at?: string | null }>
  const sends = (sendsResult.data ?? []) as Array<{ id: string; status: string; guest_id?: string | null; created_at?: string | null }>

  const guestIdsWithContact = new Set(contacts.map((contact) => contact.guest_id))
  const noContactGuests = guests.filter((guest) => !guestIdsWithContact.has(guest.id))
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const phoneRegex = /^\+?[1-9]\d{7,14}$/
  const invalidEmailContacts = contacts.filter((contact) => contact.contact_type === 'email' && !emailRegex.test(contact.normalized_value ?? contact.value ?? ''))
  const invalidPhoneContacts = contacts.filter((contact) => contact.contact_type === 'phone' && !phoneRegex.test(contact.normalized_value ?? contact.value ?? ''))
  const consentKeys = new Set(consents.filter((consent) => consent.status === 'granted').map((consent) => `${consent.guest_id}:${consent.channel}:${consent.purpose}`))
  const missingConsentContacts = contacts.filter((contact) => {
    if (contact.contact_type !== 'email' && contact.contact_type !== 'phone') return false
    const channel = contact.contact_type === 'phone' ? 'sms' : 'email'
    return !consentKeys.has(`${contact.guest_id}:${channel}:marketing`)
  })
  const weakIdentityGuests = guests.filter((guest) => {
    const guestContacts = contacts.filter((contact) => contact.guest_id === guest.id)
    return guestContacts.length === 1 && !guest.display_name?.trim()
  })
  const staleCutoff = Date.now() - 1000 * 60 * 60 * 24 * 90
  const oldInactiveSegments = segments.filter((segment) => segment.status !== 'active' && new Date(segment.updated_at ?? 0).getTime() < staleCutoff)
  const brokenAutomations = automations.filter((automation) => automation.status === 'active' && new Date(automation.updated_at ?? 0).getTime() < staleCutoff)
  const failedSends = sends.filter((send) => ['failed', 'bounced', 'blocked'].includes(send.status))

  const scanned_counts = {
    guests: guestsResult.count ?? guests.length,
    contacts: contactsResult.count ?? contacts.length,
    consents: consentsResult.count ?? consents.length,
    merge_candidates: mergeResult.count ?? mergeCandidates.length,
    segments: segmentsResult.count ?? segments.length,
    automations: automationsResult.count ?? automations.length,
    message_sends: sendsResult.count ?? sends.length,
  }

  const candidates = [
    buildCrmHealthCandidate({
      issue_type: 'duplicate_rate',
      affected_record_count: mergeCandidates.length,
      scanned_count: scanned_counts.guests,
      title: 'Duplicate guest candidates need review',
      description: 'Open identity matches can split spend, consent, loyalty, and server notes across profiles.',
      affected_table: 'guest_merge_candidates',
      affected_record_ids: mergeCandidates.map((row) => row.id),
      impact_weight: 30,
      fix_strategy: 'merge_preview',
      fix_preview: { action: 'review_merge_candidates', candidate_ids: mergeCandidates.map((row) => row.id).slice(0, 10), requires_operator_approval: true },
    }),
    buildCrmHealthCandidate({
      issue_type: 'no_contact',
      affected_record_count: noContactGuests.length,
      scanned_count: scanned_counts.guests,
      title: 'Guests have no reachable contact',
      description: 'Profiles without email or phone cannot receive loyalty, recovery, or reservation follow-up.',
      affected_table: 'guests',
      affected_record_ids: noContactGuests.map((row) => row.id),
      impact_weight: 20,
      fix_strategy: 'contact_cleanup',
      fix_preview: { action: 'request_contact_at_next_visit', guest_ids: noContactGuests.map((row) => row.id).slice(0, 10), requires_operator_approval: true },
    }),
    buildCrmHealthCandidate({
      issue_type: 'missing_consent',
      affected_record_count: missingConsentContacts.length,
      scanned_count: contacts.length,
      title: 'Reachable guests are missing marketing consent',
      description: 'Contacts without granted consent must be excluded from marketing until proof is reviewed.',
      affected_table: 'guest_contact_points',
      affected_record_ids: missingConsentContacts.map((row) => row.id),
      impact_weight: 35,
      fix_strategy: 'consent_review',
      fix_preview: { action: 'review_consent_source_before_marketing', contact_point_ids: missingConsentContacts.map((row) => row.id).slice(0, 10), requires_operator_approval: true },
    }),
    buildCrmHealthCandidate({
      issue_type: 'invalid_email',
      affected_record_count: invalidEmailContacts.length,
      scanned_count: contacts.length,
      title: 'Invalid email addresses block campaigns',
      description: 'Malformed email contacts should be corrected or suppressed before sends.',
      affected_table: 'guest_contact_points',
      affected_record_ids: invalidEmailContacts.map((row) => row.id),
      impact_weight: 25,
      fix_strategy: 'contact_cleanup',
      fix_preview: { action: 'suppress_or_correct_invalid_email', contact_point_ids: invalidEmailContacts.map((row) => row.id).slice(0, 10), requires_operator_approval: true },
    }),
    buildCrmHealthCandidate({
      issue_type: 'invalid_phone',
      affected_record_count: invalidPhoneContacts.length,
      scanned_count: contacts.length,
      title: 'Invalid phone numbers block SMS and reservations',
      description: 'Malformed phone contacts should be corrected before SMS, reservations, or recovery outreach.',
      affected_table: 'guest_contact_points',
      affected_record_ids: invalidPhoneContacts.map((row) => row.id),
      impact_weight: 25,
      fix_strategy: 'contact_cleanup',
      fix_preview: { action: 'suppress_or_correct_invalid_phone', contact_point_ids: invalidPhoneContacts.map((row) => row.id).slice(0, 10), requires_operator_approval: true },
    }),
    buildCrmHealthCandidate({
      issue_type: 'weak_identity',
      affected_record_count: weakIdentityGuests.length,
      scanned_count: scanned_counts.guests,
      title: 'Weak guest identities reduce match confidence',
      description: 'Sparse profiles make duplicate detection, reporting, and AI recommendations less reliable.',
      affected_table: 'guests',
      affected_record_ids: weakIdentityGuests.map((row) => row.id),
      impact_weight: 18,
      fix_strategy: 'review_required',
      fix_preview: { action: 'enrich_identity_from_visits_or_imports', guest_ids: weakIdentityGuests.map((row) => row.id).slice(0, 10), requires_operator_approval: true },
    }),
    buildCrmHealthCandidate({
      issue_type: 'old_inactive_segment',
      affected_record_count: oldInactiveSegments.length,
      scanned_count: scanned_counts.segments,
      title: 'Inactive segments are stale',
      description: 'Old inactive audiences can confuse campaign setup and report templates.',
      affected_table: 'crm_segments',
      affected_record_ids: oldInactiveSegments.map((row) => row.id),
      impact_weight: 12,
      fix_strategy: 'archive_or_repair',
      fix_preview: { action: 'archive_or_refresh_segments', segment_ids: oldInactiveSegments.map((row) => row.id).slice(0, 10), requires_operator_approval: true },
    }),
    buildCrmHealthCandidate({
      issue_type: 'broken_automation',
      affected_record_count: brokenAutomations.length,
      scanned_count: scanned_counts.automations,
      title: 'Active automations need health review',
      description: 'Long-untouched active automations should be tested before launch traffic increases.',
      affected_table: 'crm_automations',
      affected_record_ids: brokenAutomations.map((row) => row.id),
      impact_weight: 22,
      fix_strategy: 'archive_or_repair',
      fix_preview: { action: 'run_automation_test_or_pause', automation_ids: brokenAutomations.map((row) => row.id).slice(0, 10), requires_operator_approval: true },
    }),
    buildCrmHealthCandidate({
      issue_type: 'failed_send',
      affected_record_count: failedSends.length,
      scanned_count: scanned_counts.message_sends,
      title: 'Failed sends need cleanup',
      description: 'Failed, bounced, or blocked messages should be reviewed before retrying or suppressing contacts.',
      affected_table: 'crm_message_sends',
      affected_record_ids: failedSends.map((row) => row.id),
      impact_weight: 28,
      fix_strategy: 'retry_or_suppress',
      fix_preview: { action: 'retry_or_suppress_after_review', send_ids: failedSends.map((row) => row.id).slice(0, 10), requires_operator_approval: true },
    }),
  ].filter((candidate): candidate is CrmHealthCandidate => Boolean(candidate))

  const issue_counts = candidates.reduce((acc, issue) => {
    acc[issue.issue_type] = issue.affected_record_count
    return acc
  }, {} as Record<CrmHealthIssueType, number>)

  return { candidates: candidates.sort((a, b) => b.impact_score - a.impact_score), scanned_counts, issue_counts }
}
