import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmGuestComplianceRoles } from '@/lib/crm/api'
import { buildCrmCampaignPreview } from '@/lib/crm/campaigns'
import { previewCrmSegment } from '@/lib/crm/segments'
import { createCrmCampaignSchema, listCrmCampaignsQuerySchema } from '@/lib/schemas/crm'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestComplianceRoles])
  if (roleErr) return roleErr

  const parsed = listCrmCampaignsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
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
  if (error) return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createCrmCampaignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: segment, error: segmentError } = await supabase
    .from('crm_segments')
    .select('*')
    .eq('org_id', user.org_id)
    .eq('id', parsed.data.segment_id)
    .is('deleted_at', null)
    .single()

  if (segmentError || !segment) return NextResponse.json({ error: 'Segment not found' }, { status: 404 })

  const segmentPreview = await previewCrmSegment({ user, ruleTree: segment.rule_tree, supabase })
  const campaignPreview = buildCrmCampaignPreview(parsed.data, segmentPreview.reachability)

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

  if (error || !campaign) return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })

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
