import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { crmGuestManagerRoles } from '@/lib/crm/api'
import { recalculateGuestIntelligence } from '@/lib/crm/intelligence'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestManagerRoles])
  if (roleErr) return roleErr

  const { id } = await params
  const result = await recalculateGuestIntelligence({ user, guestId: id, request })
  if ('error' in result && result.error === 'Guest not found') return apiError(404, result.error)
  if ('error' in result && result.error) return apiError(500, result.error)

  return NextResponse.json(result.data)
}
