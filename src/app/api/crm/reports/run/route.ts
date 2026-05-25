import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmReportManageRoles, explainReportDefinition, validateReportMetricSelection } from '@/lib/crm/reports'
import { crmDimensionKeySchema, crmMetricKeySchema, runCrmReportSchema } from '@/lib/schemas/crm'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmReportManageRoles])
  if (roleErr) return roleErr

  const body = await request.json().catch(() => null)
  const parsed = runCrmReportSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid report run payload', details: parsed.error.flatten() }, { status: 400 })

  const db = createAdminClient()
  let metricKeys = parsed.data.metric_keys ?? []
  let dimensionKeys = parsed.data.dimension_keys
  let filters = parsed.data.filters

  if (parsed.data.report_definition_id) {
    const { data: report, error } = await db
      .from('crm_report_definitions')
      .select('*')
      .eq('id', parsed.data.report_definition_id)
      .eq('org_id', user.org_id)
      .is('deleted_at', null)
      .single()
    if (error || !report) return NextResponse.json({ error: 'Report definition not found' }, { status: 404 })
    metricKeys = crmMetricKeySchema.array().parse((report as { metric_keys: unknown }).metric_keys)
    dimensionKeys = crmDimensionKeySchema.array().parse((report as { dimension_keys: unknown }).dimension_keys)
    filters = (report as { filters: Record<string, unknown> }).filters
  }

  const validation = validateReportMetricSelection({ metric_keys: metricKeys, dimension_keys: dimensionKeys })
  if (!validation.ok) return NextResponse.json({ error: 'Invalid metric selection', details: validation.errors, warnings: validation.warnings }, { status: 400 })

  const status = parsed.data.preview ? 'preview' : 'queued'
  const now = new Date().toISOString()
  const { data, error } = await db
    .from('crm_report_runs')
    .insert({
      org_id: user.org_id,
      report_definition_id: parsed.data.report_definition_id ?? null,
      requested_by_user_id: user.id,
      status,
      metric_keys: metricKeys,
      dimension_keys: dimensionKeys,
      filters,
      result_summary: {},
      data_quality_warnings: validation.warnings,
      explanation: explainReportDefinition({ metric_keys: metricKeys, dimension_keys: dimensionKeys }),
      started_at: now,
      completed_at: parsed.data.preview ? now : null,
    })
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Failed to start CRM report run' }, { status: 500 })

  await audit.record({
    actor: user,
    action: 'crm_report_run_started',
    entity_type: 'crm_report_run',
    entity_id: (data as { id: string }).id,
    after_state: data as Record<string, unknown>,
    request,
  })

  return NextResponse.json({ data }, { status: 202 })
}
