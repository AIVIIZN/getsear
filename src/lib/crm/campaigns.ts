import type { CrmReachabilityChannel, CrmReachabilitySummary } from '@/lib/crm/segments'
import type { z } from 'zod'
import type { createCrmCampaignSchema, createCrmAttributionEventSchema, previewCrmCampaignSchema, scheduleCrmCampaignSchema, testSendCrmCampaignSchema } from '@/lib/schemas/crm'

export type CrmCampaignInput = z.infer<typeof createCrmCampaignSchema>
export type CrmCampaignPreviewInput = z.infer<typeof previewCrmCampaignSchema>
export type ScheduleCrmCampaignInput = z.infer<typeof scheduleCrmCampaignSchema>
export type TestSendCrmCampaignInput = z.infer<typeof testSendCrmCampaignSchema>
export type CrmAttributionEventInput = z.infer<typeof createCrmAttributionEventSchema>

export type CrmAttributionEventSummaryInput = {
  event_type: CrmAttributionEventInput['event_type']
  event_at?: string | null
  sent_at?: string | null
  attribution_window: CrmAttributionEventInput['attribution_window']
  attribution_window_days?: number | null
  baseline_segment: CrmAttributionEventInput['baseline_segment']
  revenue_amount: number
  profit_estimate_amount: number
  cost_amount: number
  excluded_from_roi?: boolean | null
  exclusion_reason?: string | null
  guest_id?: string | null
}

export type CrmCampaignPreview = {
  channels: Partial<Record<CrmReachabilityChannel, {
    label: string
    body: string
    subject?: string | null
    preheader?: string | null
    supported: boolean
    estimated_reachable_count: number
    estimated_cost_cents: number
  }>>
  compliance: {
    can_schedule: boolean
    warnings: string[]
    required_next_steps: string[]
  }
}

export type CrmCampaignCompliance = {
  can_send: boolean
  blocking_reasons: string[]
  warnings: string[]
  reachable_count: number
  channels: CrmReachabilityChannel[]
}

const channelLabels: Record<CrmReachabilityChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  push: 'Mobile push',
  receipt: 'Receipt',
}

const channelMap = {
  email: 'email',
  sms: 'sms',
  push: 'push',
  guest_portal: 'push',
  receipt: 'receipt',
  qr: 'receipt',
} as const

const attributionWindowDays: Record<CrmAttributionEventInput['attribution_window'], number> = {
  same_day: 0,
  '7_day': 7,
  '14_day': 14,
  '30_day': 30,
  '45_day': 45,
  custom: 7,
}

const revenueEventTypes = new Set<CrmAttributionEventInput['event_type']>(['redeemed', 'reservation', 'order', 'revenue', 'profit_estimate'])

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function fallbackBody(input: CrmCampaignPreviewInput, channel: CrmReachabilityChannel): string {
  const offer = input.offer ? ` ${input.offer}` : ''
  const message = normalizeWhitespace(input.message_body)
  if (channel === 'sms') return normalizeWhitespace(input.sms_body || `${message}${offer} Reply STOP to opt out.`).slice(0, 320)
  if (channel === 'push') return normalizeWhitespace(input.mobile_body || `${input.goal}${offer}`).slice(0, 500)
  if (channel === 'receipt') return normalizeWhitespace(input.receipt_body || `${input.goal}${offer}`).slice(0, 700)
  return message
}

function selectedChannels(input: CrmCampaignPreviewInput): CrmReachabilityChannel[] {
  const channels = [input.primary_channel, ...input.secondary_channels]
    .map((channel) => channelMap[channel])
    .filter((channel, index, arr): channel is CrmReachabilityChannel => Boolean(channel) && arr.indexOf(channel) === index)
  return channels.length ? channels : ['email']
}

function metadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const value = (metadata as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function hasUnsubscribeLanguage(body: string | null | undefined): boolean {
  const normalized = (body ?? '').toLowerCase()
  return normalized.includes('unsubscribe') || normalized.includes('opt out') || normalized.includes('opt-out')
}

function hasSmsStopLanguage(body: string | null | undefined): boolean {
  return (body ?? '').toLowerCase().includes('stop')
}

function scheduledHour(scheduledFor?: string | null): number | null {
  if (!scheduledFor) return null
  const date = new Date(scheduledFor)
  if (Number.isNaN(date.getTime())) return null
  return date.getHours()
}

export function resolveCrmAttributionWindowDays(
  attributionWindow: CrmAttributionEventInput['attribution_window'],
  customDays?: number | null,
): number {
  if (attributionWindow === 'custom') return Math.max(0, Math.min(365, customDays ?? attributionWindowDays.custom))
  return attributionWindowDays[attributionWindow]
}

export function shouldCountCrmAttributionRevenue(event: CrmAttributionEventSummaryInput): { count: boolean; reason: string | null } {
  if (event.excluded_from_roi) return { count: false, reason: event.exclusion_reason ?? 'manually_excluded' }
  if (event.baseline_segment === 'would_have_visited') return { count: false, reason: 'baseline_would_have_visited' }
  if (!revenueEventTypes.has(event.event_type)) return { count: false, reason: 'non_revenue_event' }
  if (event.revenue_amount <= 0 && event.profit_estimate_amount <= 0) return { count: false, reason: 'no_revenue_or_profit' }

  if (event.sent_at && event.event_at) {
    const sentAt = new Date(event.sent_at)
    const eventAt = new Date(event.event_at)
    if (!Number.isNaN(sentAt.getTime()) && !Number.isNaN(eventAt.getTime())) {
      const windowDays = resolveCrmAttributionWindowDays(event.attribution_window, event.attribution_window_days)
      const windowEnd = new Date(sentAt)
      if (windowDays === 0) {
        windowEnd.setHours(23, 59, 59, 999)
      } else {
        windowEnd.setDate(windowEnd.getDate() + windowDays)
      }
      if (eventAt < sentAt) return { count: false, reason: 'before_send' }
      if (eventAt > windowEnd) return { count: false, reason: 'outside_attribution_window' }
    }
  }

  return { count: true, reason: null }
}

export function summarizeCrmCampaignAttribution(events: CrmAttributionEventSummaryInput[]) {
  const summary = {
    delivered_count: 0,
    opened_count: 0,
    clicked_count: 0,
    redeemed_count: 0,
    reservation_count: 0,
    order_count: 0,
    unsubscribe_count: 0,
    complaint_count: 0,
    attributed_revenue: 0,
    attributed_profit_estimate: 0,
    attributed_cost: 0,
    excluded_guest_count: 0,
    excluded_revenue: 0,
    roi_ratio: null as number | null,
    excluded_guest_ids: new Set<string>(),
  }

  for (const event of events) {
    if (event.event_type === 'delivered') summary.delivered_count += 1
    if (event.event_type === 'opened') summary.opened_count += 1
    if (event.event_type === 'clicked') summary.clicked_count += 1
    if (event.event_type === 'redeemed') summary.redeemed_count += 1
    if (event.event_type === 'reservation') summary.reservation_count += 1
    if (event.event_type === 'order') summary.order_count += 1
    if (event.event_type === 'unsubscribed') summary.unsubscribe_count += 1
    if (event.event_type === 'complained') summary.complaint_count += 1

    const roiDecision = shouldCountCrmAttributionRevenue(event)
    if (roiDecision.count) {
      summary.attributed_revenue += event.revenue_amount
      summary.attributed_profit_estimate += event.profit_estimate_amount
      summary.attributed_cost += event.cost_amount
    } else if (revenueEventTypes.has(event.event_type)) {
      summary.excluded_revenue += event.revenue_amount
      if (event.guest_id) summary.excluded_guest_ids.add(event.guest_id)
    }
  }

  summary.excluded_guest_count = summary.excluded_guest_ids.size
  summary.roi_ratio = summary.attributed_cost > 0
    ? Number(((summary.attributed_profit_estimate - summary.attributed_cost) / summary.attributed_cost).toFixed(4))
    : null

  return {
    ...summary,
    excluded_guest_ids: Array.from(summary.excluded_guest_ids),
  }
}

function campaignChannels(input: Pick<CrmCampaignPreviewInput, 'primary_channel' | 'secondary_channels'>): CrmReachabilityChannel[] {
  return selectedChannels({
    campaign_type: 'email',
    goal: '',
    offer: null,
    tone: 'warm',
    brand_voice: 'hospitality',
    subject: null,
    preheader: null,
    message_body: '',
    sms_body: null,
    mobile_body: null,
    receipt_body: null,
    ...input,
  })
}

export function assessCrmCampaignCompliance(input: {
  campaign: CrmCampaignPreviewInput & { metadata?: Record<string, unknown> | null; scheduled_for?: string | null }
  reachability?: CrmReachabilitySummary | null
  scheduled_for?: string | null
}): CrmCampaignCompliance {
  const blocking_reasons: string[] = []
  const warnings: string[] = []
  const channels = campaignChannels(input.campaign)
  const scheduled_for = input.scheduled_for ?? input.campaign.scheduled_for
  const businessAddress = metadataString(input.campaign.metadata, 'business_address')
  const senderIdentity = metadataString(input.campaign.metadata, 'sender_identity')

  if (!input.reachability) blocking_reasons.push('Run audience readiness before scheduling.')
  if (!businessAddress) blocking_reasons.push('Add a physical business address to metadata.business_address for CAN-SPAM compliance.')
  if (!senderIdentity) blocking_reasons.push('Add sender identity to metadata.sender_identity before scheduling.')
  if (channels.includes('email')) {
    if (!input.campaign.subject?.trim()) blocking_reasons.push('Email sends need a subject.')
    if (!hasUnsubscribeLanguage(input.campaign.message_body)) blocking_reasons.push('Email body needs unsubscribe or opt-out language.')
  }
  if (channels.includes('sms') && !hasSmsStopLanguage(input.campaign.sms_body)) {
    blocking_reasons.push('SMS body needs STOP opt-out language.')
  }

  const hour = scheduledHour(scheduled_for)
  if (hour !== null && (hour < 8 || hour >= 21)) {
    blocking_reasons.push('Schedule is outside quiet hours; use 8 AM-9 PM local restaurant time.')
  }

  const sensitiveCopy = `${input.campaign.goal} ${input.campaign.message_body} ${input.campaign.sms_body ?? ''}`.toLowerCase()
  if (/(health|medical|religion|political|children|financial hardship)/.test(sensitiveCopy)) {
    warnings.push('Sensitive targeting language detected; manager approval and legal review are recommended.')
  }

  const reachable_count = channels.reduce((sum, channel) => {
    return sum + (input.reachability?.channels[channel]?.reachable_count ?? 0)
  }, 0)
  if (input.reachability && reachable_count === 0) blocking_reasons.push('No reachable opted-in guests for selected channels.')

  return {
    can_send: blocking_reasons.length === 0,
    blocking_reasons,
    warnings,
    reachable_count,
    channels,
  }
}

export function buildCrmCampaignPreview(
  input: CrmCampaignPreviewInput,
  reachability?: CrmReachabilitySummary | null,
): CrmCampaignPreview {
  const channels: CrmCampaignPreview['channels'] = {}
  for (const channel of selectedChannels(input)) {
    const readiness = reachability?.channels[channel]
    channels[channel] = {
      label: channelLabels[channel],
      subject: channel === 'email' ? input.subject ?? `${input.goal}` : null,
      preheader: channel === 'email' ? input.preheader ?? input.offer ?? null : null,
      body: fallbackBody(input, channel),
      supported: true,
      estimated_reachable_count: readiness?.reachable_count ?? 0,
      estimated_cost_cents: readiness?.estimated_cost_cents ?? 0,
    }
  }

  const warnings: string[] = []
  const required_next_steps: string[] = []
  if (channels.email && !input.subject?.trim()) warnings.push('Email campaigns need a subject before scheduling.')
  if (channels.email && !hasUnsubscribeLanguage(input.message_body)) required_next_steps.push('Add email unsubscribe language before send pipeline approval.')
  if (channels.sms && !hasSmsStopLanguage(fallbackBody(input, 'sms'))) required_next_steps.push('Add SMS opt-out language before send pipeline approval.')
  if (!reachability) required_next_steps.push('Select a segment and run audience readiness before scheduling.')

  return {
    channels,
    compliance: {
      can_schedule: required_next_steps.length === 0 && warnings.length === 0,
      warnings,
      required_next_steps,
    },
  }
}

export function buildCrmCampaignSendRows(input: {
  campaign: CrmCampaignPreviewInput & { id: string; org_id: string; subject?: string | null; scheduled_for?: string | null; metadata?: Record<string, unknown> | null }
  job_id: string
  guest_ids: string[]
  compliance: CrmCampaignCompliance
  scheduled_for?: string | null
  holdout_percent?: number
  variants?: Array<{ id: string; weight?: number | null; subject?: string | null; message_body?: string | null; sms_body?: string | null }>
}) {
  const holdoutCount = Math.floor(input.guest_ids.length * ((input.holdout_percent ?? 0) / 100))
  const variants = input.variants?.length ? input.variants : []
  const totalWeight = variants.reduce((sum, variant) => sum + Math.max(0, variant.weight ?? 0), 0)

  function variantForIndex(index: number) {
    if (!variants.length || totalWeight <= 0) return null
    const bucket = index % totalWeight
    let cursor = 0
    for (const variant of variants) {
      cursor += Math.max(0, variant.weight ?? 0)
      if (bucket < cursor) return variant
    }
    return variants[0]
  }

  return input.guest_ids.map((guest_id, index) => {
    const isHoldout = index < holdoutCount
    const variant = variantForIndex(index)
    return input.compliance.channels.map((channel) => ({
      org_id: input.campaign.org_id,
      campaign_id: input.campaign.id,
      send_job_id: input.job_id,
      variant_id: variant?.id ?? null,
      guest_id,
      channel,
      status: isHoldout ? 'holdout' : 'queued',
      is_test: false,
      recipient_snapshot: { guest_id },
      compliance_snapshot: input.compliance,
      subject: channel === 'email' ? variant?.subject ?? input.campaign.subject ?? null : null,
      body_preview: ((channel === 'sms' ? variant?.sms_body : variant?.message_body) ?? fallbackBody(input.campaign, channel)).slice(0, 500),
      scheduled_for: input.scheduled_for ?? input.campaign.scheduled_for ?? null,
      metadata: { source: 'crm_campaign_send_pipeline' },
    }))
  }).flat()
}
