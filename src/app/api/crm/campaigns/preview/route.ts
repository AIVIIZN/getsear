import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmGuestComplianceRoles } from '@/lib/crm/api'
import { buildCrmCampaignPreview } from '@/lib/crm/campaigns'
import { fetchActiveRestaurantMemoryRules } from '@/lib/crm/restaurant-memory'
import { previewCrmSegment } from '@/lib/crm/segments'
import { previewCrmCampaignSchema } from '@/lib/schemas/crm'

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

  const parsed = previewCrmCampaignSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()
  let reachability = null
  let audienceCount = 0
  if (parsed.data.segment_id) {
    const { data: segment, error } = await supabase
      .from('crm_segments')
      .select('*')
      .eq('org_id', user.org_id)
      .eq('id', parsed.data.segment_id)
      .is('deleted_at', null)
      .single()

    if (error || !segment) return apiError(404, 'Segment not found')
    const segmentPreview = await previewCrmSegment({ user, ruleTree: segment.rule_tree, supabase })
    reachability = segmentPreview.reachability
    audienceCount = segmentPreview.total_count
  }

  const memoryRules = await fetchActiveRestaurantMemoryRules({ user, db: supabase, appliesTo: 'campaign', locationId: null })
  const preview = buildCrmCampaignPreview(parsed.data, reachability, memoryRules)

  await audit.record({
    actor: user,
    action: 'crm_campaign_previewed',
    entity_type: 'crm_campaign',
    entity_id: parsed.data.segment_id ?? null,
    after_state: { audience_count: audienceCount, preview },
    description: `Previewed CRM campaign ${parsed.data.campaign_type}`,
    request,
    location_id: null,
  })

  return NextResponse.json({ data: { preview, audience_count: audienceCount, reachability } })
}
