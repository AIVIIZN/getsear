import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmGuestComplianceRoles } from '@/lib/crm/api'
import { buildCrmSegmentDraft } from '@/lib/crm/segment-ai-draft'
import { buildCrmSegmentDraftSchema } from '@/lib/schemas/crm'

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestComplianceRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = buildCrmSegmentDraftSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const result = await buildCrmSegmentDraft(parsed.data.prompt)
  await audit.record({
    actor: user,
    action: 'crm_segment_ai_drafted',
    entity_type: 'crm_segment',
    entity_id: null,
    after_state: result.status === 'draft'
      ? { provider: result.draft.provider, confidence: result.draft.confidence, rule_tree: result.draft.rule_tree }
      : { refused: true, safety_flags: result.safety_flags },
    description: result.status === 'draft' ? 'Drafted CRM segment from natural language' : 'Refused unsafe CRM segment draft',
    request,
  })

  if (result.status === 'refused') {
    return NextResponse.json({ error: result.reason, safety_flags: result.safety_flags }, { status: 422 })
  }

  return NextResponse.json({ data: result.draft })
}
