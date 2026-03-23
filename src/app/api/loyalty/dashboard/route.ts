import { NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user
  const roleCheck = requireRole(user, ['owner', 'manager'])
  if (roleCheck) return roleCheck

  const db = createAdminClient()
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()

  // Active members count
  const { count: activeMembers } = await db
    .from('loyalty_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', user.org_id)

  // Points issued today
  const { data: earnedToday } = await db
    .from('loyalty_transactions')
    .select('points')
    .eq('org_id', user.org_id)
    .eq('type', 'earn')
    .gte('created_at', todayStart)

  const pointsIssuedToday = (earnedToday ?? []).reduce(
    (sum: number, t: Record<string, unknown>) => sum + (t.points as number),
    0
  )

  // Rewards redeemed today
  const { data: redeemedToday } = await db
    .from('loyalty_transactions')
    .select('points')
    .eq('org_id', user.org_id)
    .eq('type', 'redeem')
    .gte('created_at', todayStart)

  const rewardsRedeemedToday = redeemedToday?.length ?? 0

  // Member growth (last 30 days)
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: recentAccounts } = await db
    .from('loyalty_accounts')
    .select('enrolled_at')
    .eq('org_id', user.org_id)
    .gte('enrolled_at', thirtyDaysAgo.toISOString())
    .order('enrolled_at', { ascending: true })

  // Group by date
  const growthMap = new Map<string, number>()
  for (const acc of recentAccounts ?? []) {
    const date = (acc.enrolled_at as string).split('T')[0]
    growthMap.set(date, (growthMap.get(date) ?? 0) + 1)
  }

  const memberGrowth = Array.from(growthMap.entries()).map(([date, count]) => ({
    date,
    count,
  }))

  // Top members by points
  const { data: topMembers } = await db
    .from('loyalty_accounts')
    .select('id, customer_id, points_balance, tier, total_earned, total_redeemed, enrolled_at, customers(first_name, last_name, phone)')
    .eq('org_id', user.org_id)
    .order('total_earned', { ascending: false })
    .limit(10)

  const topMembersList = (topMembers ?? []).map((m: Record<string, unknown>) => {
    const cust = m.customers as Record<string, unknown> | null
    return {
      id: m.id,
      customer_id: m.customer_id,
      customer_name: cust
        ? `${cust.first_name ?? ''} ${cust.last_name ?? ''}`.trim() || 'Guest'
        : 'Guest',
      phone: cust?.phone ?? '',
      points_balance: m.points_balance,
      tier: m.tier,
      total_earned: m.total_earned,
      total_redeemed: m.total_redeemed,
      enrolled_at: m.enrolled_at,
    }
  })

  // Simple ROI calculation: (revenue from loyalty members / total reward costs) * 100
  const { data: totalRedeemed } = await db
    .from('loyalty_transactions')
    .select('points')
    .eq('org_id', user.org_id)
    .eq('type', 'redeem')

  const totalRedeemedPoints = (totalRedeemed ?? []).reduce(
    (sum: number, t: Record<string, unknown>) => sum + Math.abs(t.points as number),
    0
  )

  const { data: totalEarned } = await db
    .from('loyalty_transactions')
    .select('points')
    .eq('org_id', user.org_id)
    .eq('type', 'earn')

  const totalEarnedPoints = (totalEarned ?? []).reduce(
    (sum: number, t: Record<string, unknown>) => sum + (t.points as number),
    0
  )

  // ROI as earned-to-redeemed ratio (higher = better retention)
  const roi = totalRedeemedPoints > 0 ? Math.round((totalEarnedPoints / totalRedeemedPoints) * 100) / 100 : 0

  return NextResponse.json({
    data: {
      active_members: activeMembers ?? 0,
      points_issued_today: pointsIssuedToday,
      rewards_redeemed_today: rewardsRedeemedToday,
      program_roi: roi,
      member_growth: memberGrowth,
      top_members: topMembersList,
    },
  })
}
