import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { crmGuestComplianceRoles } from '@/lib/crm/api'
import { resolveCrmAttributionWindowDays, summarizeCrmCampaignAttribution } from '@/lib/crm/campaigns'
import type { CrmAttributionEventSummaryInput } from '@/lib/crm/campaigns'
import { crmCampaignResultsQuerySchema } from '@/lib/schemas/crm'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestComplianceRoles])
  if (roleErr) return roleErr

  const { id } = await context.params
  const parsed = crmCampaignResultsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()
  const { data: campaign, error: campaignError } = await supabase
    .from('crm_campaigns')
    .select('id, org_id, name, audience_count, reachability, compliance_checks, created_at')
    .eq('org_id', user.org_id)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (campaignError || !campaign) return apiError(404, 'Campaign not found')

  const attributionWindowDays = resolveCrmAttributionWindowDays(parsed.data.attribution_window, parsed.data.attribution_window_days)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let eventQuery = (supabase.from('crm_attribution_events') as any)
    .select('event_type, event_at, attribution_window, attribution_window_days, baseline_segment, revenue_amount, profit_estimate_amount, cost_amount, excluded_from_roi, exclusion_reason, guest_id, crm_message_sends(sent_at, delivered_at, opened_at, clicked_at, status)')
    .eq('org_id', user.org_id)
    .eq('campaign_id', id)
    .eq('attribution_window', parsed.data.attribution_window)
    .eq('attribution_window_days', attributionWindowDays)
    .order('event_at', { ascending: false })
    .limit(5000)

  if (parsed.data.baseline_segment) eventQuery = eventQuery.eq('baseline_segment', parsed.data.baseline_segment)

  const { data: events, error: eventsError } = await eventQuery
  if (eventsError) return apiError(500, 'Failed to fetch campaign attribution')

  const summaryInput: CrmAttributionEventSummaryInput[] = (events ?? []).map((event: {
    event_type: string
    event_at: string | null
    attribution_window: string
    attribution_window_days: number | null
    baseline_segment: string
    revenue_amount: number | string
    profit_estimate_amount: number | string
    cost_amount: number | string
    excluded_from_roi: boolean | null
    exclusion_reason: string | null
    guest_id: string | null
    crm_message_sends?: { sent_at?: string | null } | null
  }) => ({
    event_type: event.event_type,
    event_at: event.event_at,
    sent_at: event.crm_message_sends?.sent_at ?? null,
    attribution_window: event.attribution_window,
    attribution_window_days: event.attribution_window_days,
    baseline_segment: event.baseline_segment,
    revenue_amount: Number(event.revenue_amount ?? 0),
    profit_estimate_amount: Number(event.profit_estimate_amount ?? 0),
    cost_amount: Number(event.cost_amount ?? 0),
    excluded_from_roi: event.excluded_from_roi,
    exclusion_reason: event.exclusion_reason,
    guest_id: event.guest_id,
  }) as CrmAttributionEventSummaryInput)
  const summary = summarizeCrmCampaignAttribution(summaryInput)

  return NextResponse.json({
    data: {
      campaign,
      attribution_window: parsed.data.attribution_window,
      attribution_window_days: attributionWindowDays,
      baseline_segment: parsed.data.baseline_segment ?? 'all',
      event_count: events?.length ?? 0,
      revenue: {
        attributed_revenue: summary.attributed_revenue,
        attributed_profit_estimate: summary.attributed_profit_estimate,
        attributed_cost: summary.attributed_cost,
        roi_ratio: summary.roi_ratio,
        excluded_revenue: summary.excluded_revenue,
        excluded_guest_count: summary.excluded_guest_count,
      },
      engagement: {
        delivered_count: summary.delivered_count,
        opened_count: summary.opened_count,
        clicked_count: summary.clicked_count,
        redeemed_count: summary.redeemed_count,
        reservation_count: summary.reservation_count,
        order_count: summary.order_count,
        unsubscribe_count: summary.unsubscribe_count,
        complaint_count: summary.complaint_count,
      },
      exclusions: {
        excluded_guest_ids: summary.excluded_guest_ids,
      },
    },
  })
}
