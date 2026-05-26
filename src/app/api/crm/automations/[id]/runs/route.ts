import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmAutomationManageRoles, crmAutomationReadRoles, runCrmAutomation } from '@/lib/crm/automations'
import { createAdminClient } from '@/lib/supabase/admin'
import { testCrmAutomationSchema } from '@/lib/schemas/crm'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmAutomationReadRoles])
  if (roleErr) return roleErr

  const { id } = await params
  const db = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.from('crm_automation_runs') as any)
    .select('*, crm_automation_failures(id, failure_type, message, retryable, resolved_at, created_at)')
    .eq('org_id', user.org_id)
    .eq('automation_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return apiError(500, 'Failed to fetch automation runs')
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const parsed = testCrmAutomationSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const { id } = await params
  const db = createAdminClient()
  const result = await runCrmAutomation({ db, user, automationId: id, testInput: { ...parsed.data, dry_run: false }, mode: 'run' })

  await audit.record({
    actor: user,
    action: 'crm_automation_run_started',
    entity_type: 'crm_automation',
    entity_id: id,
    after_state: {
      result: result.result,
      error: result.error ?? null,
      status: result.status,
    } as Record<string, unknown>,
    description: result.error ? 'CRM automation run blocked or failed' : 'Ran CRM automation',
    request,
  })

  if (result.error) return apiError(result.status, result.error, { extra: { "data": result.result } })

  return NextResponse.json({ data: result.result }, { status: 201 })
}
