import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { assessCrmCampaignCompliance, buildCrmCampaignPreview, buildCrmCampaignSendRows } from '@/lib/crm/campaigns'
import { createCrmCampaignSchema, previewCrmCampaignSchema, scheduleCrmCampaignSchema, testSendCrmCampaignSchema } from '@/lib/schemas/crm'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('CRM-V7.1 campaign wizard', () => {
  const campaignInput = {
    segment_id: crypto.randomUUID(),
    name: 'Lapsed regulars win-back',
    campaign_type: 'win_back',
    goal: 'Bring lapsed regulars back this week.',
    offer: 'Seasonal chef feature.',
    tone: 'warm',
    brand_voice: 'hospitality',
    primary_channel: 'email',
    secondary_channels: ['sms', 'push', 'receipt'],
    subject: 'We saved you a seat',
    preheader: 'A personal invite from the team.',
    message_body: 'Hi {{guest.first_name}}, we have missed seeing you. You can unsubscribe any time.',
    sms_body: 'We have missed you at Sear. Reply STOP to opt out.',
    mobile_body: 'We have missed you. Come by this week.',
    receipt_body: 'Ask your server about joining the next guest list.',
  } as const

  it('validates campaign intent, audience, channels, copy, and schedule payloads', () => {
    const parsed = createCrmCampaignSchema.parse(campaignInput)

    expect(parsed.campaign_type).toBe('win_back')
    expect(parsed.primary_channel).toBe('email')
    expect(parsed.secondary_channels).toEqual(['sms', 'push', 'receipt'])
    expect(previewCrmCampaignSchema.parse(campaignInput).message_body).toContain('missed')
    expect(() => createCrmCampaignSchema.parse({
      ...campaignInput,
      campaign_type: 'political_targeting',
    })).toThrow()
  })

  it('renders supported email, SMS, mobile, and receipt previews with readiness math', () => {
    const preview = buildCrmCampaignPreview(campaignInput, {
      total_count: 12,
      estimated_audience_cost_cents: 18,
      channels: {
        email: { reachable_count: 10, excluded_count: 2, estimated_cost_cents: 2, exclusions: { missing_consent: 1, suppressed: 1, missing_contact: 0 } },
        sms: { reachable_count: 4, excluded_count: 8, estimated_cost_cents: 6, exclusions: { missing_consent: 6, suppressed: 1, missing_contact: 1 } },
        push: { reachable_count: 3, excluded_count: 9, estimated_cost_cents: 0, exclusions: { missing_consent: 9, suppressed: 0, missing_contact: 0 } },
        receipt: { reachable_count: 12, excluded_count: 0, estimated_cost_cents: 0, exclusions: { missing_consent: 0, suppressed: 0, missing_contact: 0 } },
      },
    })

    expect(preview.channels.email?.subject).toBe('We saved you a seat')
    expect(preview.channels.sms?.body).toContain('STOP')
    expect(preview.channels.push?.estimated_reachable_count).toBe(3)
    expect(preview.channels.receipt?.body).toContain('server')
    expect(preview.compliance.can_schedule).toBe(true)
  })

  it('ships additive CRM campaign schema, rollback, RLS, and audit vocabulary', () => {
    const migration = read('supabase/migrations/20260525183000_add_crm_campaign_wizard.sql')
    const rollback = read('supabase/_rollbacks/20260525183000_add_crm_campaign_wizard.rollback.sql')
    const auditLog = read('src/lib/audit/log.ts')

    for (const table of ['crm_campaigns', 'crm_campaign_variants', 'crm_message_templates']) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
      expect(rollback).toContain(`DROP TABLE IF EXISTS public.${table}`)
    }
    expect(migration).toContain("campaign_type IN ('email', 'sms', 'push'")
    expect(migration).toContain('tenant_select_crm_campaigns')
    expect(auditLog).toContain("'crm_campaign_created'")
    expect(auditLog).toContain("'crm_campaign_previewed'")
  })

  it('registers CRM-native campaign APIs and a real backoffice wizard route', () => {
    const listRoute = read('src/app/api/crm/campaigns/route.ts')
    const previewRoute = read('src/app/api/crm/campaigns/preview/route.ts')
    const page = read('src/app/(backoffice)/campaigns/page.tsx')
    const sidebar = read('src/components/layout/Sidebar.tsx')

    expect(listRoute).toContain('export async function GET')
    expect(listRoute).toContain('export async function POST')
    expect(listRoute).toContain("requireRole(user, [...crmGuestComplianceRoles])")
    expect(listRoute).toContain("eq('org_id', user.org_id)")
    expect(listRoute).toContain('previewCrmSegment')
    expect(previewRoute).toContain('buildCrmCampaignPreview')
    expect(page).toContain('Campaign wizard')
    expect(page).toContain('/api/crm/campaigns/preview')
    expect(page).toContain('/api/crm/campaigns')
    expect(page).toContain('Email subject')
    expect(page).toContain('SMS body')
    expect(page).toContain('Receipt body')
    expect(sidebar).toContain('href: "/campaigns"')
  })
})

describe('CRM-V7.2 campaign compliance and send pipeline', () => {
  const reachability = {
    total_count: 3,
    estimated_audience_cost_cents: 3.4,
    channels: {
      email: { reachable_count: 2, excluded_count: 1, estimated_cost_cents: 0.4, exclusions: { missing_consent: 1, suppressed: 0, missing_contact: 0 } },
      sms: { reachable_count: 2, excluded_count: 1, estimated_cost_cents: 3, exclusions: { missing_consent: 0, suppressed: 1, missing_contact: 0 } },
      push: { reachable_count: 0, excluded_count: 3, estimated_cost_cents: 0, exclusions: { missing_consent: 3, suppressed: 0, missing_contact: 0 } },
      receipt: { reachable_count: 3, excluded_count: 0, estimated_cost_cents: 0, exclusions: { missing_consent: 0, suppressed: 0, missing_contact: 0 } },
    },
  }

  const campaign = {
    campaign_type: 'win_back',
    goal: 'Bring back lapsed regulars.',
    offer: 'Chef feature.',
    tone: 'warm',
    brand_voice: 'hospitality',
    primary_channel: 'email',
    secondary_channels: ['sms'],
    subject: 'We saved you a seat',
    preheader: 'A quick invite.',
    message_body: 'Hi {{guest.first_name}}, we miss you. Unsubscribe any time.',
    sms_body: 'We miss you at Sear. Reply STOP to opt out.',
    mobile_body: null,
    receipt_body: null,
    scheduled_for: '2026-05-25T18:00:00.000Z',
    metadata: {
      business_address: '123 Main St, Phoenix, AZ',
      sender_identity: 'Sear Restaurant',
    },
  } as const

  it('blocks non-compliant campaigns with actionable reasons', () => {
    const blocked = assessCrmCampaignCompliance({
      campaign: {
        ...campaign,
        subject: '',
        message_body: 'Hi {{guest.first_name}}, we miss you.',
        sms_body: 'Come back soon.',
        metadata: {},
      },
      reachability,
    })

    expect(blocked.can_send).toBe(false)
    expect(blocked.blocking_reasons).toContain('Add a physical business address to metadata.business_address for CAN-SPAM compliance.')
    expect(blocked.blocking_reasons).toContain('Email sends need a subject.')
    expect(blocked.blocking_reasons).toContain('Email body needs unsubscribe or opt-out language.')
    expect(blocked.blocking_reasons).toContain('SMS body needs STOP opt-out language.')
  })

  it('allows compliant opted-in campaigns and builds queued send rows with holdouts', () => {
    const compliance = assessCrmCampaignCompliance({ campaign, reachability })
    expect(compliance.can_send).toBe(true)
    expect(compliance.reachable_count).toBe(4)
    expect(compliance.channels).toEqual(['email', 'sms'])

    const rows = buildCrmCampaignSendRows({
      campaign: { ...campaign, id: crypto.randomUUID(), org_id: crypto.randomUUID() },
      job_id: crypto.randomUUID(),
      guest_ids: [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()],
      compliance,
      holdout_percent: 34,
    })

    expect(rows).toHaveLength(6)
    expect(rows.filter((row) => row.status === 'holdout')).toHaveLength(2)
    expect(rows.filter((row) => row.status === 'queued')).toHaveLength(4)
  })

  it('ships send pipeline schema, rollback, APIs, validation, and audit vocabulary', () => {
    const migration = read('supabase/migrations/20260525191200_add_crm_campaign_send_pipeline.sql')
    const rollback = read('supabase/_rollbacks/20260525191200_add_crm_campaign_send_pipeline.rollback.sql')
    const scheduleRoute = read('src/app/api/crm/campaigns/[id]/schedule/route.ts')
    const testRoute = read('src/app/api/crm/campaigns/[id]/send-test/route.ts')
    const auditLog = read('src/lib/audit/log.ts')

    for (const table of ['crm_campaign_send_jobs', 'crm_message_sends', 'crm_message_events']) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`)
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
      expect(rollback).toContain(`DROP TABLE IF EXISTS public.${table}`)
    }
    expect(migration).toContain('tenant_select_crm_message_sends')
    expect(scheduleCrmCampaignSchema.parse({ throttle_per_minute: 25, holdout_percent: 10 }).throttle_per_minute).toBe(25)
    expect(testSendCrmCampaignSchema.parse({ channel: 'email', recipient_email: 'owner@getsear.com' }).channel).toBe('email')
    expect(scheduleRoute).toContain('assessCrmCampaignCompliance')
    expect(scheduleRoute).toContain('crm_campaign_send_jobs')
    expect(scheduleRoute).toContain('crm_message_sends')
    expect(testRoute).toContain('crm_message_events')
    expect(auditLog).toContain("'crm_campaign_scheduled'")
    expect(auditLog).toContain("'crm_campaign_test_sent'")
  })
})
