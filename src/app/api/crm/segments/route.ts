import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmGuestComplianceRoles } from '@/lib/crm/api'
import { flattenCrmSegmentRules, previewCrmSegment } from '@/lib/crm/segments'
import { createCrmSegmentSchema, listCrmSegmentsQuerySchema } from '@/lib/schemas/crm'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestComplianceRoles])
  if (roleErr) return roleErr

  const parsed = listCrmSegmentsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()
  let query = supabase
    .from('crm_segments')
    .select('*, crm_segment_preview_runs(id, total_count, created_at)')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(parsed.data.limit)

  if (parsed.data.status) query = query.eq('status', parsed.data.status)
  if (parsed.data.search) query = query.ilike('name', `%${parsed.data.search.replace(/[%_]/g, '\\$&')}%`)

  const { data, error } = await query
  if (error) return apiError(500, 'Failed to fetch segments')

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
    return apiError(400, 'Invalid JSON')
  }

  const parsed = createCrmSegmentSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const supabase = createAdminClient()
  const preview = await previewCrmSegment({ user, ruleTree: parsed.data.rule_tree, supabase })

  const { data: previewRun, error: previewError } = await supabase
    .from('crm_segment_preview_runs')
    .insert({
      org_id: user.org_id,
      segment_id: null,
      requested_by_user_id: user.id,
      rule_tree: parsed.data.rule_tree,
      total_count: preview.total_count,
      sample_guest_ids: preview.sample_guests.map((guest) => guest.id),
      sample_guests: preview.sample_guests,
      runtime_ms: preview.runtime_ms,
      metadata: { source: 'create_segment', reachability: preview.reachability },
    })
    .select()
    .single()

  if (previewError || !previewRun) {
    return apiError(500, 'Failed to preview segment')
  }

  const { data: segment, error } = await supabase
    .from('crm_segments')
    .insert({
      ...parsed.data,
      org_id: user.org_id,
      created_by_user_id: user.id,
      updated_by_user_id: user.id,
      preview_count: preview.total_count,
      last_preview_run_id: previewRun.id,
    })
    .select()
    .single()

  if (error || !segment) {
    return apiError(500, 'Failed to create segment')
  }

  const rules = flattenCrmSegmentRules(parsed.data.rule_tree).map((rule) => ({
    org_id: user.org_id,
    segment_id: segment.id,
    sort_order: rule.sort_order,
    parent_rule_id: null,
    field_key: rule.field,
    operator: rule.operator,
    value: rule.value ?? null,
  }))
  if (rules.length > 0) {
    const { error: rulesError } = await supabase.from('crm_segment_rules').insert(rules)
    if (rulesError) return apiError(409, 'Segment created but rule persistence failed')
  }

  await supabase
    .from('crm_segment_preview_runs')
    .update({ segment_id: segment.id })
    .eq('id', previewRun.id)
    .eq('org_id', user.org_id)

  await audit.record({
    actor: user,
    action: 'crm_segment_created',
    entity_type: 'crm_segment',
    entity_id: segment.id,
    after_state: segment as Record<string, unknown>,
    description: `Created CRM segment ${segment.name}`,
    request,
    location_id: segment.location_id ?? null,
  })

  return NextResponse.json({ data: { ...segment, preview_run: previewRun, sample_guests: preview.sample_guests, reachability: preview.reachability } }, { status: 201 })
}
