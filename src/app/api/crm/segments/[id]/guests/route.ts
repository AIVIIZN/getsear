import { apiError } from '@/lib/api/error-response'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { crmGuestComplianceRoles, sanitizeGuestForCrmRole } from '@/lib/crm/api'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmGuestComplianceRoles])
  if (roleErr) return roleErr

  const { id } = await params
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('crm_segment_memberships')
    .select('id, added_at, guests(*)')
    .eq('org_id', user.org_id)
    .eq('segment_id', id)
    .order('added_at', { ascending: false })
    .limit(100)

  if (error) return apiError(500, 'Failed to fetch segment guests')

  return NextResponse.json({
    data: (data ?? []).flatMap((row) => {
      const guest = Array.isArray(row.guests) ? row.guests[0] : row.guests
      return guest ? [sanitizeGuestForCrmRole(guest as Record<string, unknown>, user)] : []
    }),
  })
}
