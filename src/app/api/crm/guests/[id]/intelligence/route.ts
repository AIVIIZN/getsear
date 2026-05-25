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
  if ('error' in result && result.error === 'Guest not found') return NextResponse.json({ error: result.error }, { status: 404 })
  if ('error' in result && result.error) return NextResponse.json({ error: result.error }, { status: 500 })

  return NextResponse.json(result.data)
}
