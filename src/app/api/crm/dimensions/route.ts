import { NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { crmReportReadRoles, listOrgDimensionDefinitions } from '@/lib/crm/reports'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmReportReadRoles])
  if (roleErr) return roleErr

  const db = createAdminClient()
  const dimensions = await listOrgDimensionDefinitions({ db, user })

  return NextResponse.json({ data: dimensions })
}
