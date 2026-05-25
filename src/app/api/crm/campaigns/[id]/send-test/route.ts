import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmGuestComplianceRoles } from '@/lib/crm/api'
import { assessCrmCampaignCompliance } from '@/lib/crm/campaigns'
import { testSendCrmCampaignSchema } from '@/lib/schemas/crm'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestComplianceRoles])
  if (roleErr) return roleErr

  const { id } = await context.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = testSendCrmCampaignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: campaign, error: campaignError } = await supabase
    .from('crm_campaigns')
    .select('*')
    .eq('org_id', user.org_id)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (campaignError || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const compliance = assessCrmCampaignCompliance({
    campaign: {
      campaign_type: campaign.campaign_type,
      goal: campaign.goal,
      offer: campaign.offer,
      tone: campaign.tone,
      brand_voice: campaign.brand_voice,
      primary_channel: campaign.primary_channel,
      secondary_channels: campaign.secondary_channels ?? [],
      subject: campaign.subject,
      preheader: campaign.preheader,
      message_body: campaign.message_body,
      sms_body: campaign.sms_body,
      mobile_body: campaign.mobile_body,
      receipt_body: campaign.receipt_body,
      scheduled_for: campaign.scheduled_for,
      metadata: campaign.metadata ?? {},
    },
    reachability: campaign.reachability && Object.keys(campaign.reachability).length ? campaign.reachability : null,
  })

  const bodyPreview =
    parsed.data.channel === 'sms' ? campaign.sms_body :
      parsed.data.channel === 'push' ? campaign.mobile_body :
        parsed.data.channel === 'receipt' ? campaign.receipt_body :
          campaign.message_body

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: send, error: sendError } = await (supabase.from('crm_message_sends') as any)
    .insert({
      org_id: user.org_id,
      campaign_id: campaign.id,
      guest_id: parsed.data.guest_id ?? null,
      channel: parsed.data.channel,
      status: 'test_sent',
      is_test: true,
      recipient_snapshot: {
        recipient_email: parsed.data.recipient_email ?? null,
        recipient_phone: parsed.data.recipient_phone ?? null,
        guest_id: parsed.data.guest_id ?? null,
      },
      compliance_snapshot: compliance,
      subject: parsed.data.channel === 'email' ? campaign.subject ?? null : null,
      body_preview: (bodyPreview ?? campaign.message_body).slice(0, 500),
      metadata: { ...parsed.data.metadata, provider_dispatch: 'deferred_to_marketing_worker' },
      sent_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (sendError || !send) return NextResponse.json({ error: 'Failed to record test send' }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('crm_message_events') as any).insert({
    org_id: user.org_id,
    campaign_id: campaign.id,
    send_id: send.id,
    guest_id: parsed.data.guest_id ?? null,
    event_type: 'test_sent',
    payload: { channel: parsed.data.channel, compliance },
  })

  await audit.record({
    actor: user,
    action: 'crm_campaign_test_sent',
    entity_type: 'crm_campaign',
    entity_id: campaign.id,
    after_state: { send, compliance },
    description: `Recorded CRM campaign test send for ${campaign.name}`,
    request,
    location_id: campaign.location_id ?? null,
  })

  return NextResponse.json({ data: { send, compliance } }, { status: 201 })
}
