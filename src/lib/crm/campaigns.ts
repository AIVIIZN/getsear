import type { CrmReachabilityChannel, CrmReachabilitySummary } from '@/lib/crm/segments'
import type { z } from 'zod'
import type { createCrmCampaignSchema, previewCrmCampaignSchema } from '@/lib/schemas/crm'

export type CrmCampaignInput = z.infer<typeof createCrmCampaignSchema>
export type CrmCampaignPreviewInput = z.infer<typeof previewCrmCampaignSchema>

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
  if (channels.sms && !fallbackBody(input, 'sms').toLowerCase().includes('stop')) required_next_steps.push('Add SMS opt-out language before send pipeline approval.')
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
