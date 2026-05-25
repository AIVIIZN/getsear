import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmReportReadRoles, explainReportDefinition, validateReportMetricSelection } from '@/lib/crm/reports'
import { previewCrmReportSchema } from '@/lib/schemas/crm'

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmReportReadRoles])
  if (roleErr) return roleErr

  const body = await request.json().catch(() => null)
  const parsed = previewCrmReportSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid report preview payload', details: parsed.error.flatten() }, { status: 400 })

  const validation = validateReportMetricSelection(parsed.data)
  if (!validation.ok) return NextResponse.json({ error: 'Invalid metric selection', details: validation.errors, warnings: validation.warnings }, { status: 400 })

  await audit.record({
    actor: user,
    action: 'crm_report_previewed',
    entity_type: 'crm_report',
    entity_id: null,
    after_state: parsed.data,
    request,
  })

  return NextResponse.json({
    data: {
      status: 'preview',
      metric_keys: parsed.data.metric_keys,
      dimension_keys: parsed.data.dimension_keys,
      filters: parsed.data.filters,
      explanation: explainReportDefinition(parsed.data),
      data_quality_warnings: validation.warnings,
      sample_limit: parsed.data.sample_limit,
    },
  })
}
