import type { AuthUser } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CrmSegmentRuleGroupInput, CrmSegmentRuleInput } from '@/lib/schemas/crm'

type DbClient = ReturnType<typeof createAdminClient>
export type CrmSegmentRule = CrmSegmentRuleInput
export type CrmSegmentRuleGroup = CrmSegmentRuleGroupInput

export type GuestSegmentFacts = {
  id: string
  display_name: string
  lifecycle_stage: string
  total_spend: number
  total_visits: number
  average_check: number
  last_visit_at: string | null
  birthday: string | null
  location_id: string | null
  is_vip: boolean
  tag_slugs: string[]
  tag_categories: string[]
  email_marketing_consent: boolean
  sms_marketing_consent: boolean
  push_marketing_consent: boolean
  loyalty_points_balance: number
  loyalty_tier: string | null
  favorite_items: string[]
  order_channels: string[]
  contact_channels: string[]
  suppressed_channels: string[]
}

export type CrmSegmentPreview = {
  total_count: number
  reachability: CrmReachabilitySummary
  sample_guests: Array<{
    id: string
    display_name: string
    lifecycle_stage: string
    total_spend: number
    total_visits: number
    matched_rules: string[]
    reachable_channels: CrmReachabilityChannel[]
  }>
  matched_guest_ids: string[]
  runtime_ms: number
}

export type CrmReachabilityChannel = 'email' | 'sms' | 'push' | 'receipt'

export type CrmReachabilitySummary = {
  total_count: number
  estimated_audience_cost_cents: number
  channels: Record<CrmReachabilityChannel, {
    reachable_count: number
    excluded_count: number
    estimated_cost_cents: number
    exclusions: {
      missing_consent: number
      suppressed: number
      missing_contact: number
    }
  }>
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function normalizeArrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value]
}

function daysSince(value: string | null): number | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000))
}

function guestFactValue(guest: GuestSegmentFacts, field: CrmSegmentRule['field']): unknown {
  switch (field) {
    case 'lifecycle_stage': return guest.lifecycle_stage
    case 'total_spend': return guest.total_spend
    case 'total_visits': return guest.total_visits
    case 'average_check': return guest.average_check
    case 'days_since_last_visit': return daysSince(guest.last_visit_at)
    case 'birthday_month': return guest.birthday?.slice(5, 7) ?? null
    case 'location_id': return guest.location_id
    case 'is_vip': return guest.is_vip
    case 'tag_slug': return guest.tag_slugs
    case 'tag_category': return guest.tag_categories
    case 'email_marketing_consent': return guest.email_marketing_consent
    case 'sms_marketing_consent': return guest.sms_marketing_consent
    case 'loyalty_points_balance': return guest.loyalty_points_balance
    case 'loyalty_tier': return guest.loyalty_tier
    case 'favorite_item_contains': return guest.favorite_items
    case 'order_channel': return guest.order_channels
  }
}

function compareRule(guest: GuestSegmentFacts, rule: CrmSegmentRule): boolean {
  const actual = guestFactValue(guest, rule.field)
  const expected = rule.value
  if (rule.operator === 'exists') return Array.isArray(actual) ? actual.length > 0 : actual !== null && actual !== undefined && actual !== ''
  if (rule.operator === 'not_exists') return Array.isArray(actual) ? actual.length === 0 : actual === null || actual === undefined || actual === ''

  if (rule.operator === 'contains') {
    const needle = stringValue(expected)?.toLowerCase()
    if (!needle) return false
    return normalizeArrayValue(actual).some((value) => stringValue(value)?.toLowerCase().includes(needle))
  }

  if (rule.operator === 'equals' || rule.operator === 'not_equals') {
    const expectedValues = normalizeArrayValue(expected).map((value) => stringValue(value)?.toLowerCase()).filter(Boolean)
    const actualValues = normalizeArrayValue(actual).map((value) => stringValue(value)?.toLowerCase()).filter(Boolean)
    const hasMatch = expectedValues.some((value) => actualValues.includes(value))
    return rule.operator === 'equals' ? hasMatch : !hasMatch
  }

  if (rule.operator === 'between') {
    const [min, max] = normalizeArrayValue(expected).map(numberValue)
    const numericActual = numberValue(actual)
    return numericActual !== null && min !== null && max !== null && numericActual >= min && numericActual <= max
  }

  if (rule.operator === 'days_since') {
    const numericActual = numberValue(actual)
    const expectedDays = numberValue(expected)
    return numericActual !== null && expectedDays !== null && numericActual >= expectedDays
  }

  if (rule.operator === 'count_at_least') {
    const expectedCount = numberValue(expected)
    const actualCount = Array.isArray(actual) ? actual.length : numberValue(actual)
    return actualCount !== null && expectedCount !== null && actualCount >= expectedCount
  }

  const numericActual = numberValue(actual)
  const numericExpected = numberValue(expected)
  if (numericActual === null || numericExpected === null) return false
  if (rule.operator === 'greater_than') return numericActual > numericExpected
  if (rule.operator === 'less_than') return numericActual < numericExpected
  return false
}

function ruleLabel(rule: CrmSegmentRule): string {
  return `${rule.field}.${rule.operator}`
}

function evaluateGroup(guest: GuestSegmentFacts, group: CrmSegmentRuleGroup): { matched: boolean; labels: string[] } {
  const results = group.rules.map((ruleOrGroup) => {
    if ('field' in ruleOrGroup) {
      const matched = compareRule(guest, ruleOrGroup)
      return { matched, labels: matched ? [ruleLabel(ruleOrGroup)] : [] }
    }
    return evaluateGroup(guest, ruleOrGroup)
  })
  const matched = group.match === 'all' ? results.every((result) => result.matched) : results.some((result) => result.matched)
  return { matched, labels: matched ? results.flatMap((result) => result.labels) : [] }
}

function hasSuppression(guest: GuestSegmentFacts, channel: string) {
  return guest.suppressed_channels.includes(channel) || guest.suppressed_channels.includes('all')
}

function channelReadiness(guest: GuestSegmentFacts, channel: CrmReachabilityChannel) {
  if (channel === 'email') {
    const hasContact = guest.contact_channels.includes('email')
    return {
      reachable: hasContact && guest.email_marketing_consent && !hasSuppression(guest, 'email'),
      missing_consent: hasContact && !guest.email_marketing_consent,
      suppressed: hasSuppression(guest, 'email'),
      missing_contact: !hasContact,
    }
  }
  if (channel === 'sms') {
    const hasContact = guest.contact_channels.includes('phone')
    return {
      reachable: hasContact && guest.sms_marketing_consent && !hasSuppression(guest, 'sms'),
      missing_consent: hasContact && !guest.sms_marketing_consent,
      suppressed: hasSuppression(guest, 'sms'),
      missing_contact: !hasContact,
    }
  }
  if (channel === 'push') {
    return {
      reachable: guest.push_marketing_consent && !hasSuppression(guest, 'push'),
      missing_consent: !guest.push_marketing_consent,
      suppressed: hasSuppression(guest, 'push'),
      missing_contact: false,
    }
  }

  const hasReceiptContact = guest.contact_channels.includes('email') || guest.contact_channels.includes('phone')
  return {
    reachable: hasReceiptContact && !hasSuppression(guest, 'all'),
    missing_consent: false,
    suppressed: hasSuppression(guest, 'all'),
    missing_contact: !hasReceiptContact,
  }
}

const CHANNEL_COST_CENTS: Record<CrmReachabilityChannel, number> = {
  email: 0.2,
  sms: 1.5,
  push: 0,
  receipt: 0,
}

export function calculateCrmReachabilitySummary(matches: GuestSegmentFacts[]): CrmReachabilitySummary {
  const channels = {
    email: emptyReachabilityChannel(),
    sms: emptyReachabilityChannel(),
    push: emptyReachabilityChannel(),
    receipt: emptyReachabilityChannel(),
  }

  for (const guest of matches) {
    for (const channel of Object.keys(channels) as CrmReachabilityChannel[]) {
      const readiness = channelReadiness(guest, channel)
      if (readiness.reachable) {
        channels[channel].reachable_count += 1
        channels[channel].estimated_cost_cents += CHANNEL_COST_CENTS[channel]
      } else {
        channels[channel].excluded_count += 1
        if (readiness.suppressed) channels[channel].exclusions.suppressed += 1
        else if (readiness.missing_contact) channels[channel].exclusions.missing_contact += 1
        else if (readiness.missing_consent) channels[channel].exclusions.missing_consent += 1
      }
    }
  }

  return {
    total_count: matches.length,
    estimated_audience_cost_cents: Object.values(channels).reduce((sum, channel) => sum + channel.estimated_cost_cents, 0),
    channels,
  }
}

function emptyReachabilityChannel() {
  return {
    reachable_count: 0,
    excluded_count: 0,
    estimated_cost_cents: 0,
    exclusions: {
      missing_consent: 0,
      suppressed: 0,
      missing_contact: 0,
    },
  }
}

async function loadSegmentFacts(supabase: DbClient, user: Pick<AuthUser, 'org_id'>): Promise<GuestSegmentFacts[]> {
  const { data: guests, error } = await supabase
    .from('guests')
    .select('id, display_name, lifecycle_stage, total_spend, total_visits, average_check, last_visit_at, birthday, location_id, is_vip')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)

  if (error) throw new Error('Failed to load guests for segment preview')
  const guestIds = (guests ?? []).map((guest: { id: string }) => guest.id)
  if (guestIds.length === 0) return []

  const [
    { data: tags },
    { data: consents },
    { data: contactPoints },
    { data: suppressions },
    { data: loyalty },
    { data: orders },
    { data: orderItems },
  ] = await Promise.all([
    supabase
      .from('guest_tags')
      .select('guest_id, crm_tags(slug, tag_category)')
      .eq('org_id', user.org_id)
      .is('deleted_at', null)
      .in('guest_id', guestIds),
    supabase
      .from('guest_consents')
      .select('guest_id, channel, purpose, status')
      .eq('org_id', user.org_id)
      .eq('purpose', 'marketing')
      .in('guest_id', guestIds),
    supabase
      .from('guest_contact_points')
      .select('guest_id, contact_type')
      .eq('org_id', user.org_id)
      .is('deleted_at', null)
      .in('guest_id', guestIds),
    supabase
      .from('suppression_entries')
      .select('guest_id, channel, purpose, expires_at')
      .eq('org_id', user.org_id)
      .in('guest_id', guestIds)
      .in('purpose', ['marketing', 'all']),
    supabase
      .from('crm_loyalty_accounts')
      .select('guest_id, points_balance, crm_loyalty_tiers(name)')
      .eq('org_id', user.org_id)
      .eq('status', 'active')
      .in('guest_id', guestIds),
    supabase
      .from('orders')
      .select('id, customer_id, order_type')
      .eq('org_id', user.org_id)
      .in('customer_id', guestIds)
      .eq('status', 'closed'),
    supabase
      .from('order_items')
      .select('order_id, name')
      .eq('org_id', user.org_id),
  ])

  const tagFacts = new Map<string, { slugs: string[]; categories: string[] }>()
  for (const row of tags ?? []) {
    const tag = Array.isArray(row.crm_tags) ? row.crm_tags[0] : row.crm_tags
    if (!tag) continue
    const current = tagFacts.get(row.guest_id) ?? { slugs: [], categories: [] }
    if (tag.slug) current.slugs.push(tag.slug)
    if (tag.tag_category) current.categories.push(tag.tag_category)
    tagFacts.set(row.guest_id, current)
  }

  const consentFacts = new Map<string, { email: boolean; sms: boolean; push: boolean }>()
  for (const row of consents ?? []) {
    const current = consentFacts.get(row.guest_id) ?? { email: false, sms: false, push: false }
    if (row.status === 'granted' && row.channel === 'email') current.email = true
    if (row.status === 'granted' && row.channel === 'sms') current.sms = true
    if (row.status === 'granted' && row.channel === 'push') current.push = true
    consentFacts.set(row.guest_id, current)
  }

  const contactFacts = new Map<string, string[]>()
  for (const row of contactPoints ?? []) {
    contactFacts.set(row.guest_id, [...(contactFacts.get(row.guest_id) ?? []), row.contact_type])
  }

  const now = Date.now()
  const suppressionFacts = new Map<string, string[]>()
  for (const row of suppressions ?? []) {
    if (row.expires_at && new Date(row.expires_at).getTime() <= now) continue
    suppressionFacts.set(row.guest_id, [...(suppressionFacts.get(row.guest_id) ?? []), row.channel])
  }

  const loyaltyFacts = new Map<string, { points: number; tier: string | null }>()
  for (const row of loyalty ?? []) {
    const tier = Array.isArray(row.crm_loyalty_tiers) ? row.crm_loyalty_tiers[0] : row.crm_loyalty_tiers
    loyaltyFacts.set(row.guest_id, {
      points: Number(row.points_balance ?? 0),
      tier: tier?.name ?? null,
    })
  }

  const orderFacts = new Map<string, { orderIds: string[]; channels: string[] }>()
  for (const row of orders ?? []) {
    if (!row.customer_id) continue
    const current = orderFacts.get(row.customer_id) ?? { orderIds: [], channels: [] }
    current.orderIds.push(row.id)
    if (row.order_type) current.channels.push(row.order_type)
    orderFacts.set(row.customer_id, current)
  }

  const orderToGuest = new Map<string, string>()
  for (const [guestId, fact] of orderFacts.entries()) {
    for (const orderId of fact.orderIds) orderToGuest.set(orderId, guestId)
  }
  const itemFacts = new Map<string, string[]>()
  for (const row of orderItems ?? []) {
    const guestId = orderToGuest.get(row.order_id)
    if (!guestId || !row.name) continue
    itemFacts.set(guestId, [...(itemFacts.get(guestId) ?? []), row.name])
  }

  return (guests ?? []).map((guest) => {
    const tag = tagFacts.get(guest.id)
    const consent = consentFacts.get(guest.id)
    const loyaltyFact = loyaltyFacts.get(guest.id)
    const orderFact = orderFacts.get(guest.id)
    return {
      id: guest.id,
      display_name: guest.display_name,
      lifecycle_stage: guest.lifecycle_stage,
      total_spend: Number(guest.total_spend ?? 0),
      total_visits: Number(guest.total_visits ?? 0),
      average_check: Number(guest.average_check ?? 0),
      last_visit_at: guest.last_visit_at,
      birthday: guest.birthday,
      location_id: guest.location_id,
      is_vip: Boolean(guest.is_vip),
      tag_slugs: tag?.slugs ?? [],
      tag_categories: tag?.categories ?? [],
      email_marketing_consent: consent?.email ?? false,
      sms_marketing_consent: consent?.sms ?? false,
      push_marketing_consent: consent?.push ?? false,
      loyalty_points_balance: loyaltyFact?.points ?? 0,
      loyalty_tier: loyaltyFact?.tier ?? null,
      favorite_items: itemFacts.get(guest.id) ?? [],
      order_channels: orderFact?.channels ?? [],
      contact_channels: contactFacts.get(guest.id) ?? [],
      suppressed_channels: suppressionFacts.get(guest.id) ?? [],
    }
  })
}

export async function previewCrmSegment(input: {
  user: Pick<AuthUser, 'org_id'>
  ruleTree: CrmSegmentRuleGroup
  sampleLimit?: number
  supabase?: DbClient
}): Promise<CrmSegmentPreview> {
  const started = Date.now()
  const supabase = input.supabase ?? createAdminClient()
  const facts = await loadSegmentFacts(supabase, input.user)
  const matches = facts.flatMap((guest) => {
    const result = evaluateGroup(guest, input.ruleTree)
    return result.matched ? [{ guest, matched_rules: result.labels }] : []
  })
  const matchedGuests = matches.map((match) => match.guest)
  const reachability = calculateCrmReachabilitySummary(matchedGuests)

  return {
    total_count: matches.length,
    reachability,
    matched_guest_ids: matches.map((match) => match.guest.id),
    runtime_ms: Date.now() - started,
    sample_guests: matches.slice(0, input.sampleLimit ?? 8).map((match) => ({
      id: match.guest.id,
      display_name: match.guest.display_name,
      lifecycle_stage: match.guest.lifecycle_stage,
      total_spend: match.guest.total_spend,
      total_visits: match.guest.total_visits,
      matched_rules: match.matched_rules,
      reachable_channels: (['email', 'sms', 'push', 'receipt'] as CrmReachabilityChannel[])
        .filter((channel) => channelReadiness(match.guest, channel).reachable),
    })),
  }
}

export function flattenCrmSegmentRules(group: CrmSegmentRuleGroup): Array<CrmSegmentRule & { sort_order: number; parent_rule_id: null }> {
  return group.rules.flatMap((ruleOrGroup, index) => {
    if ('field' in ruleOrGroup) return [{ ...ruleOrGroup, sort_order: index, parent_rule_id: null }]
    return flattenCrmSegmentRules(ruleOrGroup).map((rule, nestedIndex) => ({
      ...rule,
      sort_order: index * 100 + nestedIndex,
      parent_rule_id: null,
    }))
  })
}
