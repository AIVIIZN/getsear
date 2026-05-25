import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { getHardwareReadiness } from '@/lib/hardware/readiness'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleCheck = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleCheck) return roleCheck

  const locationId = request.nextUrl.searchParams.get('location_id') ?? undefined
  const data = await getHardwareReadiness(user.org_id, locationId)

  return NextResponse.json({ data })
}
