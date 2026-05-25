import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { crmAutomationManageRoles, pauseCrmAutomation } from '@/lib/crm/automations'
import { createAdminClient } from '@/lib/supabase/admin'
import { pauseCrmAutomationSchema } from '@/lib/schemas/crm'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmAutomationManageRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = pauseCrmAutomationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const { id } = await params
  const db = createAdminClient()
  const result = await pauseCrmAutomation({ db, user, automationId: id, pause: parsed.data })
  if (result.error || !result.automation) {
    return NextResponse.json({ error: result.error ?? 'Failed to update automation pause state' }, { status: result.status })
  }

  await audit.record({
    actor: user,
    action: 'crm_automation_paused',
    entity_type: 'crm_automation',
    entity_id: id,
    after_state: result.automation,
    description: parsed.data.paused ? 'Paused CRM automation' : 'Resumed CRM automation',
    request,
    location_id: (result.automation.location_id as string | null) ?? null,
  })

  return NextResponse.json({ data: result.automation })
}
