import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmFeedbackManageRoles, crmFeedbackReadRoles } from '@/lib/crm/feedback'
import { createAdminClient } from '@/lib/supabase/admin'
import { createCrmSurveySchema } from '@/lib/schemas/crm'

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmFeedbackReadRoles])
  if (roleErr) return roleErr

  const db = createAdminClient()
  const { data, error } = await db
    .from('crm_surveys')
    .select('*')
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  if (error) return apiError(500, 'Failed to fetch surveys')
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmFeedbackManageRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const parsed = createCrmSurveySchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('crm_surveys')
    .insert({
      ...parsed.data,
      org_id: user.org_id,
      created_by_user_id: user.id,
    })
    .select()
    .single()

  if (error || !data) return apiError(500, 'Failed to create survey')

  await audit.record({
    actor: user,
    action: 'crm_survey_created',
    entity_type: 'crm_survey',
    entity_id: data.id,
    after_state: data as Record<string, unknown>,
    description: `Created CRM survey ${data.name}`,
    request,
    location_id: data.location_id ?? null,
  })

  return NextResponse.json({ data }, { status: 201 })
}
