import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCrmCampaignPreview } from '@/lib/crm/campaigns'
import { createCrmCampaignSchema, previewCrmCampaignSchema } from '@/lib/schemas/crm'

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
    message_body: 'Hi {{guest.first_name}}, we have missed seeing you.',
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
