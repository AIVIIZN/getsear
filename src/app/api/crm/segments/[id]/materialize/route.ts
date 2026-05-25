import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmGuestComplianceRoles } from '@/lib/crm/api'
import { previewCrmSegment } from '@/lib/crm/segments'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestComplianceRoles])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()
  const { data: segment, error } = await supabase
    .from('crm_segments')
    .select('*')
    .eq('org_id', user.org_id)
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !segment) return NextResponse.json({ error: 'Segment not found' }, { status: 404 })

  const preview = await previewCrmSegment({ user, ruleTree: segment.rule_tree, supabase, sampleLimit: 25 })

  await supabase
    .from('crm_segment_memberships')
    .delete()
    .eq('org_id', user.org_id)
    .eq('segment_id', segment.id)

  const rows = preview.matched_guest_ids.map((guestId) => ({
    org_id: user.org_id,
    segment_id: segment.id,
    guest_id: guestId,
    membership_source: 'materialized',
    added_by_user_id: user.id,
    matched_rules: [],
  }))
  if (rows.length > 0) {
    const { error: insertError } = await supabase.from('crm_segment_memberships').insert(rows)
    if (insertError) return NextResponse.json({ error: 'Failed to materialize segment' }, { status: 500 })
  }

  await supabase
    .from('crm_segments')
    .update({
      status: 'active',
      preview_count: preview.total_count,
      materialized_at: new Date().toISOString(),
      updated_by_user_id: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('org_id', user.org_id)
    .eq('id', segment.id)

  await audit.record({
    actor: user,
    action: 'crm_segment_materialized',
    entity_type: 'crm_segment',
    entity_id: segment.id,
    before_state: segment as Record<string, unknown>,
    after_state: { membership_count: rows.length },
    description: `Materialized CRM segment ${segment.name}`,
    request,
    location_id: segment.location_id ?? null,
  })

  return NextResponse.json({ data: { membership_count: rows.length, sample_guests: preview.sample_guests } })
}
