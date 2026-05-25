import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmReportManageRoles, crmReportReadRoles, explainReportDefinition, validateReportMetricSelection } from '@/lib/crm/reports'
import { createCrmReportSchema, listCrmReportsQuerySchema } from '@/lib/schemas/crm'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmReportReadRoles])
  if (roleErr) return roleErr

  const query = listCrmReportsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!query.success) return NextResponse.json({ error: 'Invalid report query', details: query.error.flatten() }, { status: 400 })

  const db = createAdminClient()
  let builder = db
    .from('crm_report_definitions')
    .select('*')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(query.data.limit)

  if (query.data.status) builder = builder.eq('status', query.data.status)
  if (query.data.report_type) builder = builder.eq('report_type', query.data.report_type)

  const { data, error } = await builder
  if (error) return NextResponse.json({ error: 'Failed to fetch CRM reports' }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmReportManageRoles])
  if (roleErr) return roleErr

  const body = await request.json().catch(() => null)
  const parsed = createCrmReportSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid report payload', details: parsed.error.flatten() }, { status: 400 })

  const validation = validateReportMetricSelection(parsed.data)
  if (!validation.ok) return NextResponse.json({ error: 'Invalid metric selection', details: validation.errors, warnings: validation.warnings }, { status: 400 })

  const db = createAdminClient()
  const row = {
    ...parsed.data,
    org_id: user.org_id,
    created_by_user_id: user.id,
    updated_by_user_id: user.id,
    explanation: explainReportDefinition(parsed.data),
  }

  const { data, error } = await db.from('crm_report_definitions').insert(row).select().single()
  if (error || !data) return NextResponse.json({ error: 'Failed to create CRM report' }, { status: 500 })

  await audit.record({
    actor: user,
    action: 'crm_report_created',
    entity_type: 'crm_report',
    entity_id: (data as { id: string }).id,
    after_state: data as Record<string, unknown>,
    request,
    location_id: parsed.data.location_id ?? null,
  })

  return NextResponse.json({ data, warnings: validation.warnings }, { status: 201 })
}
