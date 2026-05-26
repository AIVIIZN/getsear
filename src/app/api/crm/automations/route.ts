import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { createCrmAutomation, crmAutomationManageRoles, crmAutomationReadRoles } from '@/lib/crm/automations'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCrmAutomationSchema, listCrmAutomationsQuerySchema } from '@/lib/schemas/crm'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmAutomationReadRoles])
  if (roleErr) return roleErr

  const parsed = listCrmAutomationsQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const db = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (db.from('crm_automations') as any)
    .select('*, crm_automation_triggers(id, trigger_type, config, is_active), crm_automation_actions(id, step_order, action_type, config, is_active)')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(parsed.data.limit)

  if (parsed.data.status) query = query.eq('status', parsed.data.status)
  if (parsed.data.trigger_type) query = query.eq('trigger_type', parsed.data.trigger_type)

  const { data, error } = await query
  if (error) return apiError(500, 'Failed to fetch automations')

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmAutomationManageRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = createCrmAutomationSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const db = createAdminClient()
  const { automation, error } = await createCrmAutomation({ db, user, automation: parsed.data })
  if (error || !automation) return apiError(500, error ?? 'Failed to create automation')

  await audit.record({
    actor: user,
    action: 'crm_automation_created',
    entity_type: 'crm_automation',
    entity_id: automation.id as string,
    after_state: automation,
    description: `Created CRM automation ${parsed.data.name}`,
    request,
    location_id: (automation.location_id as string | null) ?? null,
  })

  return NextResponse.json({ data: automation }, { status: 201 })
}
