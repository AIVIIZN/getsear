import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import {
  crmDashboardTemplates,
  crmReportManageRoles,
  crmReportReadRoles,
  validateDashboardWidgets,
} from '@/lib/crm/reports'
import { createCrmDashboardSchema, listCrmDashboardsQuerySchema } from '@/lib/schemas/crm'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmReportReadRoles])
  if (roleErr) return roleErr

  const parsed = listCrmDashboardsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid dashboard query', details: parsed.error.flatten() }, { status: 400 })

  const db = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let builder = (db.from('crm_dashboards') as any)
    .select('*, crm_dashboard_widgets(*)')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(parsed.data.limit)

  if (parsed.data.audience) builder = builder.eq('audience', parsed.data.audience)
  if (parsed.data.status) builder = builder.eq('status', parsed.data.status)

  const { data, error } = await builder
  if (error) {
    return NextResponse.json({
      data: [],
      templates: parsed.data.include_templates ? crmDashboardTemplates : [],
      warning: 'Saved dashboards are unavailable; loaded CRM dashboard templates only.',
    })
  }

  return NextResponse.json({
    data: data ?? [],
    templates: parsed.data.include_templates ? crmDashboardTemplates : [],
  })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmReportManageRoles])
  if (roleErr) return roleErr

  const body = await request.json().catch(() => null)
  const parsed = createCrmDashboardSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid dashboard payload', details: parsed.error.flatten() }, { status: 400 })

  const validation = validateDashboardWidgets(parsed.data.widgets)
  if (!validation.ok) return NextResponse.json({ error: 'Invalid dashboard widgets', details: validation.errors, warnings: validation.warnings }, { status: 400 })

  const db = createAdminClient()
  const { widgets, ...dashboardPayload } = parsed.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dashboard, error: dashboardError } = await (db.from('crm_dashboards') as any)
    .insert({
      ...dashboardPayload,
      org_id: user.org_id,
      created_by_user_id: user.id,
      updated_by_user_id: user.id,
    })
    .select()
    .single()

  if (dashboardError || !dashboard) return NextResponse.json({ error: 'Failed to create CRM dashboard' }, { status: 500 })

  const widgetRows = widgets.map((widget, index) => ({
    ...widget,
    org_id: user.org_id,
    dashboard_id: dashboard.id as string,
    sort_order: index,
    created_by_user_id: user.id,
    updated_by_user_id: user.id,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: savedWidgets, error: widgetError } = await (db.from('crm_dashboard_widgets') as any)
    .insert(widgetRows)
    .select()

  if (widgetError) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.from('crm_dashboards') as any)
      .delete()
      .eq('id', dashboard.id as string)
      .eq('org_id', user.org_id)
    return NextResponse.json({ error: 'Failed to create CRM dashboard widgets' }, { status: 500 })
  }

  const afterState = { ...dashboard, crm_dashboard_widgets: savedWidgets ?? [] } as Record<string, unknown>
  await audit.record({
    actor: user,
    action: 'crm_dashboard_created',
    entity_type: 'crm_dashboard',
    entity_id: dashboard.id as string,
    after_state: afterState,
    request,
    location_id: parsed.data.location_id ?? null,
  })

  return NextResponse.json({ data: afterState, warnings: validation.warnings }, { status: 201 })
}
