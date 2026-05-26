import { apiError } from '@/lib/api/error-response'
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
    return apiError(400, 'Invalid JSON')
  }

  const parsed = crmGuestBrainSchema.safeParse(body ?? {})
  if (!parsed.success) {
    return apiError(400, 'Validation failed', { details: parsed.error.issues, extra: { "details": parsed.error.issues } })
  }

  for (const task of parsed.data.tasks) {
    if (!canUseCrmAiTask(user, task)) {
      return apiError(403, 'Forbidden: insufficient CRM AI task permissions')
    }
  }

  const { id } = await params
  const result = await generateGuestBrain({ user, guestId: id, request: parsed.data })
  if ('error' in result && result.error === 'Guest not found') return apiError(404, result.error)
  if ('error' in result) return apiError(500, result.error)

  return NextResponse.json(result.data)
}
