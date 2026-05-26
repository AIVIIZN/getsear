import { apiError } from '@/lib/api/error-response'
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
    .select('id, name, campaign_type, status, recipients_count, opened_count, clicked_count, redeemed_count, sent_at, created_at')
    .eq('org_id', user.org_id)
    .in('status', ['sent', 'sending'])
    .order('sent_at', { ascending: false })

  if (dateFrom) query = query.gte('sent_at', dateFrom)
  if (dateTo) query = query.lte('sent_at', dateTo)

  const { data: campaigns, error } = await query

  if (error) {
    return apiError(500, 'Failed to fetch analytics')
  }

  const campaignList = (campaigns ?? []) as Array<{
    id: string
    name: string
    campaign_type: string
    status: string
    recipients_count: number | null
    opened_count: number | null
    clicked_count: number | null
    redeemed_count: number | null
    sent_at: string | null
    created_at: string
  }>

  // Aggregate stats
  let totalSent = 0
  let totalOpened = 0
  let totalClicked = 0
  let totalRedeemed = 0

  for (const c of campaignList) {
    totalSent += c.recipients_count ?? 0
    totalOpened += c.opened_count ?? 0
    totalClicked += c.clicked_count ?? 0
    totalRedeemed += c.redeemed_count ?? 0
  }

  return NextResponse.json({
    data: {
      total_campaigns: campaignList.length,
      total_sent: totalSent,
      total_opened: totalOpened,
      total_clicked: totalClicked,
      total_redeemed: totalRedeemed,
      open_rate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
      click_rate: totalSent > 0 ? (totalClicked / totalSent) * 100 : 0,
      campaigns: campaignList,
    },
  })
}
