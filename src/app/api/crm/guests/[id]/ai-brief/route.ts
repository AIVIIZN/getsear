import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { crmAiGatewayRoles, canUseCrmAiTask } from '@/lib/crm/ai-gateway'
import { generateGuestBrain } from '@/lib/crm/guest-brain'
import { crmGuestBrainSchema } from '@/lib/schemas/crm'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmAiGatewayRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = crmGuestBrainSchema.safeParse(body ?? {})
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  for (const task of parsed.data.tasks) {
    if (!canUseCrmAiTask(user, task)) {
      return NextResponse.json({ error: 'Forbidden: insufficient CRM AI task permissions' }, { status: 403 })
    }
  }

  const { id } = await params
  const result = await generateGuestBrain({ user, guestId: id, request: parsed.data })
  if ('error' in result && result.error === 'Guest not found') return NextResponse.json({ error: result.error }, { status: 404 })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 })

  return NextResponse.json(result.data)
}
