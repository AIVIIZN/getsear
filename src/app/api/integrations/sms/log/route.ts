import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { maskPhone } from '@/lib/integrations/sms-templates'

export async function GET(request: NextRequest) {
  const auth = await getAuthUser()
  if (auth instanceof NextResponse) return auth
  const roleCheck = requireRole(auth, ['owner', 'manager'])
  if (roleCheck) return roleCheck

  const { searchParams } = request.nextUrl
  const locationId = searchParams.get('location_id')
  if (!locationId) {
    return apiError(400, 'location_id required')
  }

  const status = searchParams.get('status')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('sms_delivery_log') as any)
    .select('*', { count: 'exact' })
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query

  if (error) {
    return apiError(500, error.message)
  }

  // Mask phone numbers in response
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const masked = (data ?? []).map((entry: any) => ({
    ...entry,
    recipient_phone: maskPhone(entry.recipient_phone ?? ''),
  }))

  return NextResponse.json({
    data: masked,
    meta: { total: count ?? 0, limit, offset },
  })
}
