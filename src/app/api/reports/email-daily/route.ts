import { apiError } from '@/lib/api/error-response'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { aggregateAllLocations } from '@/lib/reports/aggregation'
import { sendDailyEmail } from '@/lib/reports/email-templates'

/**
 * POST /api/reports/email-daily — manually trigger daily email for a specific date
 * Body: { date?: string (YYYY-MM-DD) }
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'admin'])
  if (roleCheck) return roleCheck

  let body: { date?: string } = {}
  try {
    body = await request.json()
  } catch {
    // Use defaults
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const businessDate = body.date ?? yesterday.toISOString().split('T')[0]

  const supabase = createAdminClient()

  // Run aggregation first
  const results = await aggregateAllLocations(user.org_id, businessDate)

  if (results.length === 0) {
    return apiError(400, 'No locations found to aggregate')
  }

  // Get org details and recipient list
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: org } = await (supabase.from('organizations') as any)
    .select('name, owner_email, settings')
    .eq('id', user.org_id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: locations } = await (supabase.from('locations') as any)
    .select('id, name')
    .eq('org_id', user.org_id)
    .eq('is_active', true)

  // Get users who should receive daily reports
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: users } = await (supabase.from('users') as any)
    .select('email, role, settings')
    .eq('org_id', user.org_id)
    .in('role', ['owner', 'admin'])
    .eq('is_active', true)

  const recipients = (users ?? [])
    .filter((u: { email: string | null; settings: { receive_daily_report?: boolean } }) =>
      u.email && (u.settings?.receive_daily_report !== false)
    )
    .map((u: { email: string }) => u.email)

  if (org?.owner_email && !recipients.includes(org.owner_email)) {
    recipients.push(org.owner_email)
  }

  // Send email for each location
  const emailResults: Array<{ location: string; success: boolean; error?: string }> = []

  for (const result of results) {
    const location = (locations ?? []).find((l: { id: string }) => l.id === result.location_id)
    const metrics = result.metrics as Record<string, number>

    const emailResult = await sendDailyEmail(recipients, {
      locationName: location?.name ?? 'Unknown Location',
      businessDate,
      totalRevenue: metrics.total_revenue ?? 0,
      orderCount: metrics.order_count ?? 0,
      averageCheck: metrics.average_check ?? 0,
      laborPct: metrics.labor_percentage ?? 0,
      foodCostPct: metrics.food_cost_percentage ?? 0,
      prevWeekRevenue: 0, // Would need separate query
      revenueChangePct: 0,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://getsear.com',
    })

    emailResults.push({
      location: location?.name ?? result.location_id,
      ...emailResult,
    })
  }

  return NextResponse.json({
    data: {
      business_date: businessDate,
      locations_aggregated: results.length,
      emails_sent: emailResults.filter(r => r.success).length,
      recipients: recipients.length,
      details: emailResults,
    },
  })
}
