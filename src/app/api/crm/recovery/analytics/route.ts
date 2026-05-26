import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { crmRecoveryReadRoles, summarizeRecoveryAnalytics } from '@/lib/crm/recovery'
import type { RecoveryAnalyticsCase } from '@/lib/crm/recovery'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmRecoveryReadRoles])
  if (roleErr) return roleErr

  const daysParam = request.nextUrl.searchParams.get('days')
  const days = Math.max(1, Math.min(365, Number(daysParam ?? 90) || 90))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const db = createAdminClient()
  const { data, error } = await db
    .from('crm_recovery_cases')
    .select('id, status, severity, topics, created_at, resolved_at, recovered_at, recovered_revenue')
    .eq('org_id', user.org_id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error) return apiError(500, 'Failed to fetch recovery analytics')

  return NextResponse.json({
    data: {
      window_days: days,
      ...summarizeRecoveryAnalytics((data ?? []) as RecoveryAnalyticsCase[]),
    },
  })
}
