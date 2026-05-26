import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { audit } from '@/lib/audit/log'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { canUseCrmAiTask, crmAiAuditReadRoles, crmAiGatewayRoles, executeCrmAiGateway } from '@/lib/crm/ai-gateway'
import { createAdminClient } from '@/lib/supabase/admin'
import { crmAiGatewaySchema, listCrmAiAuditQuerySchema } from '@/lib/schemas/crm'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmAiAuditReadRoles])
  if (roleErr) return roleErr

  const parsed = listCrmAiAuditQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()))
  if (!parsed.success) return apiError(400, 'Invalid AI audit query', { details: parsed.error.flatten(), extra: { "details": parsed.error.flatten() } })

  const admin = createAdminClient()
  let query = admin
    .from('crm_ai_audit_logs')
    .select('id, location_id, guest_id, task_type, provider, model, status, prompt_redaction_summary, input_tokens, output_tokens, estimated_cost_cents, confidence, output_summary, source_citations, safety_flags, approval_required, actor_user_id, created_at')
    .eq('org_id', user.org_id)
    .order('created_at', { ascending: false })
    .limit(parsed.data.limit)

  if (parsed.data.task_type) query = query.eq('task_type', parsed.data.task_type)
  if (parsed.data.guest_id) query = query.eq('guest_id', parsed.data.guest_id)
  if (parsed.data.status) query = query.eq('status', parsed.data.status)

  const { data, error } = await query
  if (error) return apiError(500, 'Failed to fetch CRM AI audit logs')

  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmAiGatewayRoles])
  if (roleErr) return roleErr

  const body = await request.json().catch(() => null)
  const parsed = crmAiGatewaySchema.safeParse(body)
  if (!parsed.success) return apiError(400, 'Invalid CRM AI gateway payload', { details: parsed.error.flatten(), extra: { "details": parsed.error.flatten() } })

  if (!canUseCrmAiTask(user, parsed.data.task_type)) {
    return apiError(403, 'Forbidden: insufficient CRM AI task permissions')
  }

  const result = await executeCrmAiGateway(parsed.data, user)
  await audit.record({
    actor: user,
    action: result.status === 'refused' ? 'crm_ai_gateway_refused' : 'crm_ai_gateway_invoked',
    entity_type: 'crm_ai_audit_log',
    entity_id: result.audit_log_id,
    after_state: {
      task_type: parsed.data.task_type,
      provider: result.provider,
      model: result.model,
      status: result.status,
      safety_flags: result.safety_flags,
      redaction_summary: result.redaction_summary,
      approval_required: result.output?.approval_required ?? true,
    },
    description: result.status === 'refused' ? 'CRM AI request refused by safety filter' : 'CRM AI gateway generated an auditable output',
    location_id: parsed.data.location_id ?? null,
    request,
  })

  if (result.status === 'refused') {
    return apiError(422, 'CRM AI request refused by safety filter', { extra: { "audit_log_id": result.audit_log_id, "safety_flags": result.safety_flags, "redaction_summary": result.redaction_summary } })
  }

  return NextResponse.json({ data: result })
}
