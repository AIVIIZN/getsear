import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmGuestComplianceRoles } from '@/lib/crm/api'
import { buildCrmCampaignPreview, summarizeCrmCampaignAttribution } from '@/lib/crm/campaigns'
import type { CrmAttributionEventSummaryInput } from '@/lib/crm/campaigns'
import { fetchActiveRestaurantMemoryRules } from '@/lib/crm/restaurant-memory'
import { previewCrmSegment } from '@/lib/crm/segments'
import { createCrmCampaignSchema, listCrmCampaignsQuerySchema } from '@/lib/schemas/crm'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestComplianceRoles])
  if (roleErr) return roleErr

  const parsed = listCrmCampaignsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('crm_campaigns') as any)
    .select('*, crm_segments(id, name, preview_count)')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(parsed.data.limit)

  if (parsed.data.status) query = query.eq('status', parsed.data.status)
  if (parsed.data.segment_id) query = query.eq('segment_id', parsed.data.segment_id)

  const { data, error } = await query
  if (error) return apiError(500, 'Failed to fetch campaigns')

  const campaigns = data ?? []
  const campaignIds = campaigns.map((campaign: { id: string }) => campaign.id)
  const attributionByCampaign = new Map<string, ReturnType<typeof summarizeCrmCampaignAttribution>>()
  if (campaignIds.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: attributionEvents } = await (supabase.from('crm_attribution_events') as any)
      .select('campaign_id, event_type, event_at, attribution_window, attribution_window_days, baseline_segment, revenue_amount, profit_estimate_amount, cost_amount, excluded_from_roi, exclusion_reason, guest_id, crm_message_sends(sent_at)')
      .eq('org_id', user.org_id)
      .eq('attribution_window', '7_day')
      .in('campaign_id', campaignIds)
      .limit(5000)

    const grouped = new Map<string, Array<{
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
    }>>()
    for (const event of attributionEvents ?? []) {
      const bucket = grouped.get(event.campaign_id) ?? []
      bucket.push(event)
      grouped.set(event.campaign_id, bucket)
    }
    for (const [campaignId, events] of grouped) {
      const summaryInput: CrmAttributionEventSummaryInput[] = events.map((event) => ({
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
      attributionByCampaign.set(campaignId, summarizeCrmCampaignAttribution(summaryInput))
    }
  }

  return NextResponse.json({
    data: campaigns.map((campaign: { id: string }) => ({
      ...campaign,
      latest_revenue_attribution: attributionByCampaign.get(campaign.id) ?? null,
    })),
  })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestComplianceRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = createCrmCampaignSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()
  const { data: segment, error: segmentError } = await supabase
    .from('crm_segments')
    .select('*')
    .eq('org_id', user.org_id)
    .eq('id', parsed.data.segment_id)
    .is('deleted_at', null)
    .single()

  if (segmentError || !segment) return apiError(404, 'Segment not found')

  const segmentPreview = await previewCrmSegment({ user, ruleTree: segment.rule_tree, supabase })
  const memoryRules = await fetchActiveRestaurantMemoryRules({ user, db: supabase, appliesTo: 'campaign', locationId: parsed.data.location_id ?? null })
  const campaignPreview = buildCrmCampaignPreview(parsed.data, segmentPreview.reachability, memoryRules)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: campaign, error } = await (supabase.from('crm_campaigns') as any)
    .insert({
      ...parsed.data,
      org_id: user.org_id,
      created_by_user_id: user.id,
      updated_by_user_id: user.id,
      audience_count: segmentPreview.total_count,
      reachability: segmentPreview.reachability,
      preview: campaignPreview,
      compliance_checks: campaignPreview.compliance,
    })
    .select()
    .single()

  if (error || !campaign) return apiError(500, 'Failed to create campaign')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('crm_campaign_variants') as any).insert({
    org_id: user.org_id,
    campaign_id: campaign.id,
    variant_key: 'A',
    name: 'Primary',
    subject: parsed.data.subject ?? null,
    message_body: parsed.data.message_body,
    sms_body: parsed.data.sms_body ?? null,
    preview: campaignPreview,
  })

  await audit.record({
    actor: user,
    action: 'crm_campaign_created',
    entity_type: 'crm_campaign',
    entity_id: campaign.id,
    after_state: campaign as Record<string, unknown>,
    description: `Created CRM campaign ${campaign.name}`,
    request,
    location_id: campaign.location_id ?? null,
  })

  return NextResponse.json({ data: { ...campaign, crm_segments: { id: segment.id, name: segment.name, preview_count: segment.preview_count } } }, { status: 201 })
}
