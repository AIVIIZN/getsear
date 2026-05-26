import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/**
 * POST /api/marketing/segments/count — count matching customers for segment criteria
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(400, 'Invalid JSON')
  }

  const criteria = body as Record<string, unknown>
  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('customers') as any)
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.org_id)

  if (criteria.min_visits) query = query.gte('total_visits', criteria.min_visits)
  if (criteria.max_visits) query = query.lte('total_visits', criteria.max_visits)
  if (criteria.min_spend) query = query.gte('total_spend', String(criteria.min_spend))
  if (criteria.max_spend) query = query.lte('total_spend', String(criteria.max_spend))
  if (criteria.last_visit_within_days) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - Number(criteria.last_visit_within_days))
    query = query.gte('last_visit_at', cutoff.toISOString())
  }
  if (criteria.tags && Array.isArray(criteria.tags)) {
    query = query.overlaps('tags', criteria.tags)
  }

  const { count, error } = await query

  if (error) {
    return apiError(500, 'Failed to count segment')
  }

  return NextResponse.json({ count: count ?? 0 })
}
