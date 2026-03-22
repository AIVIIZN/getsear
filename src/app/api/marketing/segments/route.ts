import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/**
 * GET /api/marketing/segments — preview segment with filter criteria
 * Returns customers matching the given segment criteria.
 * Query params: min_visits, max_visits, min_spend, max_spend,
 *               last_visit_within_days, tags (comma separated)
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const params = request.nextUrl.searchParams
  const minVisits = params.get('min_visits')
  const maxVisits = params.get('max_visits')
  const minSpend = params.get('min_spend')
  const maxSpend = params.get('max_spend')
  const lastVisitDays = params.get('last_visit_within_days')
  const tags = params.get('tags')
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') ?? '50', 10)))
  const offset = (page - 1) * limit

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('customers') as any)
    .select('id, first_name, last_name, email, phone, total_visits, total_spend, last_visit_at, tags', { count: 'exact' })
    .eq('org_id', user.org_id)
    .order('last_visit_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (minVisits) query = query.gte('total_visits', parseInt(minVisits, 10))
  if (maxVisits) query = query.lte('total_visits', parseInt(maxVisits, 10))
  if (minSpend) query = query.gte('total_spend', minSpend)
  if (maxSpend) query = query.lte('total_spend', maxSpend)
  if (lastVisitDays) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - parseInt(lastVisitDays, 10))
    query = query.gte('last_visit_at', cutoff.toISOString())
  }
  if (tags) {
    const tagList = tags.split(',').map((t) => t.trim())
    query = query.overlaps('tags', tagList)
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch segment' }, { status: 500 })
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: { page, limit, total: count ?? 0 },
  })
}
