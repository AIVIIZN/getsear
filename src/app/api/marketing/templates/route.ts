import { NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { MARKETING_TEMPLATES } from '@/lib/marketing/merge-fields'

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager'])
  if (roleCheck) return roleCheck

  return NextResponse.json({ data: MARKETING_TEMPLATES })
}
