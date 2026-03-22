import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/**
 * GET /api/franchise/royalties — list royalty calculations
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin'])
  if (roleErr) return roleErr

  const params = request.nextUrl.searchParams
  const locationId = params.get('location_id')
  const status = params.get('status')
  const periodStart = params.get('period_start')
  const periodEnd = params.get('period_end')
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '50', 10)))
  const offset = (page - 1) * limit

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('franchise_royalties') as any)
    .select('*', { count: 'exact' })
    .eq('org_id', user.org_id)
    .order('period_start', { ascending: false })
    .range(offset, offset + limit - 1)

  if (locationId) query = query.eq('location_id', locationId)
  if (status) query = query.eq('status', status)
  if (periodStart) query = query.gte('period_start', periodStart)
  if (periodEnd) query = query.lte('period_end', periodEnd)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch royalties' }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: { page, limit, total: count ?? 0 },
  })
}
