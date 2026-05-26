import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmGuestComplianceRoles } from '@/lib/crm/api'
import { resolveCrmAttributionWindowDays, shouldCountCrmAttributionRevenue } from '@/lib/crm/campaigns'
import { createCrmAttributionEventSchema } from '@/lib/schemas/crm'

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
    return apiError(400, 'Invalid JSON')
  }

  const parsed = createCrmAttributionEventSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()
  const { data: campaign, error: campaignError } = await supabase
    .from('crm_campaigns')
    .select('id, name, location_id, org_id')
    .eq('org_id', user.org_id)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (campaignError || !campaign) return apiError(404, 'Campaign not found')

  let sentAt: string | null = null
  if (parsed.data.send_id) {
    const { data: send, error: sendError } = await supabase
      .from('crm_message_sends')
      .select('id, sent_at, scheduled_for, status')
      .eq('org_id', user.org_id)
      .eq('campaign_id', id)
      .eq('id', parsed.data.send_id)
      .single()
    if (sendError || !send) return apiError(404, 'Message send not found for campaign')
    sentAt = send.sent_at ?? send.scheduled_for ?? null
    if (send.status === 'holdout' && !parsed.data.excluded_from_roi) {
      return apiError(422, 'Holdout sends must be excluded from ROI attribution.')
    }
  }

  const attributionWindowDays = resolveCrmAttributionWindowDays(parsed.data.attribution_window, parsed.data.attribution_window_days)
  const roiDecision = shouldCountCrmAttributionRevenue({
    event_type: parsed.data.event_type,
    event_at: parsed.data.event_at ?? new Date().toISOString(),
    sent_at: sentAt,
    attribution_window: parsed.data.attribution_window,
    attribution_window_days: attributionWindowDays,
    baseline_segment: parsed.data.baseline_segment,
    revenue_amount: parsed.data.revenue_amount,
    profit_estimate_amount: parsed.data.profit_estimate_amount,
    cost_amount: parsed.data.cost_amount,
    excluded_from_roi: parsed.data.excluded_from_roi,
    exclusion_reason: parsed.data.exclusion_reason ?? null,
    guest_id: parsed.data.guest_id ?? null,
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event, error: eventError } = await (supabase.from('crm_attribution_events') as any)
    .insert({
      org_id: user.org_id,
      campaign_id: id,
      location_id: parsed.data.location_id ?? campaign.location_id ?? null,
      send_job_id: parsed.data.send_job_id ?? null,
      send_id: parsed.data.send_id ?? null,
      guest_id: parsed.data.guest_id ?? null,
      order_id: parsed.data.order_id ?? null,
      event_type: parsed.data.event_type,
      event_at: parsed.data.event_at ?? new Date().toISOString(),
      attribution_window: parsed.data.attribution_window,
      attribution_window_days: attributionWindowDays,
      baseline_segment: parsed.data.baseline_segment,
      revenue_amount: parsed.data.revenue_amount,
      profit_estimate_amount: parsed.data.profit_estimate_amount,
      cost_amount: parsed.data.cost_amount,
      excluded_from_roi: !roiDecision.count,
      exclusion_reason: roiDecision.reason,
      attribution_rule_snapshot: {
        ...parsed.data.attribution_rule_snapshot,
        sent_at: sentAt,
        roi_decision: roiDecision,
      },
      metadata: parsed.data.metadata,
    })
    .select()
    .single()

  if (eventError || !event) return apiError(500, 'Failed to record attribution event')

  await audit.record({
    actor: user,
    action: 'crm_campaign_attribution_recorded',
    entity_type: 'crm_attribution_event',
    entity_id: event.id,
    after_state: event as Record<string, unknown>,
    description: `Recorded CRM campaign attribution for ${campaign.name}`,
    request,
    location_id: event.location_id ?? null,
  })

  return NextResponse.json({ data: event }, { status: 201 })
}
