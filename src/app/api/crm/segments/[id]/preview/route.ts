import { apiError } from '@/lib/api/error-response'
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

  if (error || !segment) return apiError(404, 'Segment not found')

  const preview = await previewCrmSegment({ user, ruleTree: segment.rule_tree, supabase })
  const { data: run, error: runError } = await supabase
    .from('crm_segment_preview_runs')
    .insert({
      org_id: user.org_id,
      segment_id: segment.id,
      requested_by_user_id: user.id,
      rule_tree: segment.rule_tree,
      total_count: preview.total_count,
      sample_guest_ids: preview.sample_guests.map((guest) => guest.id),
      sample_guests: preview.sample_guests,
      runtime_ms: preview.runtime_ms,
      metadata: { reachability: preview.reachability },
    })
    .select()
    .single()

  if (runError || !run) return apiError(500, 'Failed to save preview')

  await supabase
    .from('crm_segments')
    .update({ preview_count: preview.total_count, last_preview_run_id: run.id, updated_by_user_id: user.id, updated_at: new Date().toISOString() })
    .eq('org_id', user.org_id)
    .eq('id', segment.id)

  await audit.record({
    actor: user,
    action: 'crm_segment_previewed',
    entity_type: 'crm_segment',
    entity_id: segment.id,
    after_state: { preview_count: preview.total_count, sample_guest_ids: preview.sample_guests.map((guest) => guest.id), reachability: preview.reachability },
    description: `Previewed CRM segment ${segment.name}`,
    request,
    location_id: segment.location_id ?? null,
  })

  return NextResponse.json({ data: { ...preview, run_id: run.id } })
}
