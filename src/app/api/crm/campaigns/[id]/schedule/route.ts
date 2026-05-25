import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmGuestComplianceRoles } from '@/lib/crm/api'
import { assessCrmCampaignCompliance, buildCrmCampaignSendRows } from '@/lib/crm/campaigns'
import { previewCrmSegment } from '@/lib/crm/segments'
import { scheduleCrmCampaignSchema } from '@/lib/schemas/crm'

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

  const parsed = scheduleCrmCampaignSchema.safeParse(body)
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
  if (!campaign.segment_id) return NextResponse.json({ error: 'Campaign needs a segment before scheduling' }, { status: 422 })

  const { data: segment, error: segmentError } = await supabase
    .from('crm_segments')
    .select('*')
    .eq('org_id', user.org_id)
    .eq('id', campaign.segment_id)
    .is('deleted_at', null)
    .single()

  if (segmentError || !segment) return NextResponse.json({ error: 'Segment not found' }, { status: 404 })

  const segmentPreview = await previewCrmSegment({ user, ruleTree: segment.rule_tree, supabase })
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
      scheduled_for: parsed.data.scheduled_for ?? campaign.scheduled_for,
      metadata: campaign.metadata ?? {},
    },
    reachability: segmentPreview.reachability,
    scheduled_for: parsed.data.scheduled_for ?? campaign.scheduled_for,
  })

  if (!compliance.can_send) {
    return NextResponse.json({
      error: 'Campaign failed compliance checks',
      details: compliance.blocking_reasons,
      compliance,
    }, { status: 422 })
  }

  const holdoutCount = Math.floor(segmentPreview.matched_guest_ids.length * (parsed.data.holdout_percent / 100))
  const { data: variants } = await supabase
    .from('crm_campaign_variants')
    .select('id, weight, subject, message_body, sms_body')
    .eq('org_id', user.org_id)
    .eq('campaign_id', campaign.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: job, error: jobError } = await (supabase.from('crm_campaign_send_jobs') as any)
    .insert({
      org_id: user.org_id,
      campaign_id: campaign.id,
      segment_id: campaign.segment_id,
      location_id: campaign.location_id,
      requested_by_user_id: user.id,
      approved_by_user_id: user.id,
      status: 'scheduled',
      approval_status: 'approved',
      scheduled_for: parsed.data.scheduled_for ?? campaign.scheduled_for,
      throttle_per_minute: parsed.data.throttle_per_minute,
      holdout_percent: parsed.data.holdout_percent,
      audience_count: segmentPreview.total_count,
      queued_count: Math.max(0, (segmentPreview.matched_guest_ids.length - holdoutCount) * compliance.channels.length),
      holdout_count: holdoutCount * compliance.channels.length,
      compliance_snapshot: compliance,
      metadata: { ...parsed.data.metadata, approval_note: parsed.data.approval_note ?? null },
    })
    .select()
    .single()

  if (jobError || !job) return NextResponse.json({ error: 'Failed to create send job' }, { status: 500 })

  const rows = buildCrmCampaignSendRows({
    campaign: { ...campaign, org_id: user.org_id },
    job_id: job.id,
    guest_ids: segmentPreview.matched_guest_ids,
    compliance,
    scheduled_for: job.scheduled_for,
    holdout_percent: parsed.data.holdout_percent,
    variants: variants ?? [],
  })
  if (rows.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sends, error: sendsError } = await (supabase.from('crm_message_sends') as any)
      .insert(rows)
      .select('id, guest_id, channel, status')
    if (sendsError) return NextResponse.json({ error: 'Failed to queue message sends' }, { status: 500 })
    if (sends?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('crm_message_events') as any).insert(sends.map((send: { id: string; guest_id: string | null; channel: string; status: string }) => ({
        org_id: user.org_id,
        campaign_id: campaign.id,
        send_job_id: job.id,
        send_id: send.id,
        guest_id: send.guest_id,
        event_type: send.status === 'holdout' ? 'holdout' : 'queued',
        payload: { channel: send.channel },
      })))
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('crm_message_events') as any).insert({
    org_id: user.org_id,
    campaign_id: campaign.id,
    send_job_id: job.id,
    event_type: 'scheduled',
    payload: { compliance, queued_count: job.queued_count, holdout_count: job.holdout_count },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('crm_campaigns') as any)
    .update({
      status: 'scheduled',
      scheduled_for: job.scheduled_for,
      compliance_checks: compliance,
      updated_by_user_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', user.org_id)
    .eq('id', campaign.id)

  await audit.record({
    actor: user,
    action: 'crm_campaign_scheduled',
    entity_type: 'crm_campaign',
    entity_id: campaign.id,
    before_state: campaign as Record<string, unknown>,
    after_state: { job, compliance },
    description: `Scheduled CRM campaign ${campaign.name}`,
    request,
    location_id: campaign.location_id ?? null,
  })

  return NextResponse.json({ data: { job, compliance } }, { status: 201 })
}
