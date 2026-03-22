import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'

/**
 * GET /api/marketing/analytics — aggregate campaign performance analytics
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, ['owner', 'admin', 'manager'])
  if (roleErr) return roleErr

  const params = request.nextUrl.searchParams
  const dateFrom = params.get('date_from')
  const dateTo = params.get('date_to')

  const supabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from('campaigns') as any)
    .select('id, name, type, status, stats, sent_at, created_at')
    .eq('org_id', user.org_id)
    .in('status', ['sent', 'sending'])
    .order('sent_at', { ascending: false })

  if (dateFrom) query = query.gte('sent_at', dateFrom)
  if (dateTo) query = query.lte('sent_at', dateTo)

  const { data: campaigns, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }

  const campaignList = (campaigns ?? []) as Array<{
    id: string
    name: string
    type: string
    status: string
    stats: Record<string, number> | null
    sent_at: string | null
    created_at: string
  }>

  // Aggregate stats
  let totalSent = 0
  let totalDelivered = 0
  let totalOpened = 0
  let totalClicked = 0
  let totalBounced = 0

  for (const c of campaignList) {
    const s = c.stats ?? {}
    totalSent += s.sent ?? 0
    totalDelivered += s.delivered ?? 0
    totalOpened += s.opened ?? 0
    totalClicked += s.clicked ?? 0
    totalBounced += s.bounced ?? 0
  }

  return NextResponse.json({
    data: {
      total_campaigns: campaignList.length,
      total_sent: totalSent,
      total_delivered: totalDelivered,
      total_opened: totalOpened,
      total_clicked: totalClicked,
      total_bounced: totalBounced,
      open_rate: totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0,
      click_rate: totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0,
      bounce_rate: totalSent > 0 ? (totalBounced / totalSent) * 100 : 0,
      campaigns: campaignList,
    },
  })
}
