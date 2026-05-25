import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { crmLoyaltyManageRoles } from '@/lib/crm/loyalty'
import { generateLoyaltyReviewItems } from '@/lib/crm/loyalty-fraud'
import { listCrmLoyaltyDashboardQuerySchema } from '@/lib/schemas/crm'

type AccountRow = {
  id: string
  account_number: string
  guest_id: string
  points_balance: number
  lifetime_points_earned: number
  lifetime_points_redeemed: number
  visits_count: number
  enrolled_at: string
  status: string
  legacy_customer_id: string | null
  guests?: { display_name?: string | null } | { display_name?: string | null }[] | null
  crm_loyalty_tiers?: { name?: string | null } | { name?: string | null }[] | null
}

type LedgerRow = {
  event_type: string
  points_delta: number
  order_id: string | null
  account_id: string
  guest_id: string
  created_at: string
}

type RedemptionRow = {
  id: string
  account_id: string
  reward_id: string
  order_id: string | null
  points_spent: number
  discount_cents: number
  status: string
  created_at: string
  crm_rewards?: { name?: string | null } | { name?: string | null }[] | null
}

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return 0
}

function cents(value: number): number {
  return Math.round(value * 100)
}

function dateKey(iso: string): string {
  return iso.slice(0, 10)
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmLoyaltyManageRoles, 'analyst'])
  if (roleErr) return roleErr

  const parsed = listCrmLoyaltyDashboardQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const db = createAdminClient()
  const since = new Date()
  since.setDate(since.getDate() - parsed.data.days)
  const sinceIso = since.toISOString()

  await generateLoyaltyReviewItems({ db, user, days: parsed.data.days })

  const [
    activeAccountsResult,
    accountsResult,
    ledgerResult,
    redemptionsResult,
    rewardsResult,
    reviewItemsResult,
  ] = await Promise.all([
    db
      .from('crm_loyalty_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', user.org_id)
      .eq('status', 'active'),
    db
      .from('crm_loyalty_accounts')
      .select('id, account_number, guest_id, points_balance, lifetime_points_earned, lifetime_points_redeemed, visits_count, enrolled_at, status, legacy_customer_id, guests(display_name), crm_loyalty_tiers(name)')
      .eq('org_id', user.org_id)
      .order('lifetime_points_earned', { ascending: false })
      .limit(100),
    db
      .from('crm_points_ledger')
      .select('event_type, points_delta, order_id, account_id, guest_id, created_at')
      .eq('org_id', user.org_id)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(1000),
    db
      .from('crm_reward_redemptions')
      .select('id, account_id, reward_id, order_id, points_spent, discount_cents, status, created_at, crm_rewards(name)')
      .eq('org_id', user.org_id)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(500),
    db
      .from('crm_rewards')
      .select('id, name, value_cents, points_cost, status')
      .eq('org_id', user.org_id)
      .eq('status', 'active'),
    db
      .from('crm_loyalty_review_items')
      .select('*, guests(id, display_name), crm_loyalty_accounts(id, account_number), crm_rewards(id, name)')
      .eq('org_id', user.org_id)
      .in('status', ['open', 'in_review'])
      .order('detected_at', { ascending: false })
      .limit(10),
  ])

  if (accountsResult.error || ledgerResult.error || redemptionsResult.error || rewardsResult.error || reviewItemsResult.error) {
    return NextResponse.json({ error: 'Failed to load CRM loyalty dashboard' }, { status: 500 })
  }

  const accounts = (accountsResult.data ?? []) as AccountRow[]
  const ledger = (ledgerResult.data ?? []) as LedgerRow[]
  const redemptions = (redemptionsResult.data ?? []) as RedemptionRow[]
  const rewards = rewardsResult.data ?? []

  const totalOutstanding = accounts.reduce((sum, account) => sum + asNumber(account.points_balance), 0)
  const pointsEarned = ledger
    .filter((row) => row.points_delta > 0)
    .reduce((sum, row) => sum + asNumber(row.points_delta), 0)
  const pointsRedeemed = Math.abs(ledger
    .filter((row) => row.event_type === 'redeem' || row.points_delta < 0)
    .reduce((sum, row) => sum + asNumber(row.points_delta), 0))
  const liabilityCents = rewards.length
    ? Math.round(totalOutstanding * (rewards.reduce((sum, reward) => sum + asNumber((reward as { value_cents?: unknown }).value_cents), 0) / Math.max(1, rewards.reduce((sum, reward) => sum + asNumber((reward as { points_cost?: unknown }).points_cost), 0))))
    : 0
  const redemptionDiscountCents = redemptions.reduce((sum, redemption) => sum + asNumber(redemption.discount_cents), 0)
  const loyaltyRevenueCents = pointsEarned ? Math.round((pointsEarned / Math.max(1, pointsEarned + pointsRedeemed)) * 100000) : 0

  const legacyCustomerIds = accounts.map((account) => account.legacy_customer_id).filter(Boolean) as string[]
  let loyaltyCheckTotalCents = 0
  let loyaltyCheckCount = 0
  let nonLoyaltyCheckTotalCents = 0
  let nonLoyaltyCheckCount = 0
  if (legacyCustomerIds.length) {
    const { data: closedOrders } = await db
      .from('orders')
      .select('customer_id, total, closed_at')
      .eq('org_id', user.org_id)
      .eq('status', 'closed')
      .gte('closed_at', sinceIso)
      .limit(1000)

    for (const order of (closedOrders ?? []) as Array<Record<string, unknown>>) {
      const total = cents(asNumber(order.total))
      if (order.customer_id && legacyCustomerIds.includes(String(order.customer_id))) {
        loyaltyCheckTotalCents += total
        loyaltyCheckCount += 1
      } else {
        nonLoyaltyCheckTotalCents += total
        nonLoyaltyCheckCount += 1
      }
    }
  }

  const enrollmentMap = new Map<string, number>()
  for (const account of accounts) {
    if (account.enrolled_at < sinceIso) continue
    const key = dateKey(account.enrolled_at)
    enrollmentMap.set(key, (enrollmentMap.get(key) ?? 0) + 1)
  }

  const rewardMap = new Map<string, { reward_name: string; redemptions: number; discount_cents: number; points_spent: number }>()
  for (const redemption of redemptions) {
    const reward = relationOne(redemption.crm_rewards)
    const current = rewardMap.get(redemption.reward_id) ?? {
      reward_name: reward?.name ?? 'Reward',
      redemptions: 0,
      discount_cents: 0,
      points_spent: 0,
    }
    current.redemptions += 1
    current.discount_cents += asNumber(redemption.discount_cents)
    current.points_spent += asNumber(redemption.points_spent)
    rewardMap.set(redemption.reward_id, current)
  }

  const topMembers = accounts.slice(0, 10).map((account) => {
    const guest = relationOne(account.guests)
    const tier = relationOne(account.crm_loyalty_tiers)
    return {
      id: account.id,
      guest_id: account.guest_id,
      guest_name: guest?.display_name ?? 'Guest',
      account_number: account.account_number,
      points_balance: account.points_balance,
      tier: tier?.name ?? 'Member',
      visits_count: account.visits_count,
      lifetime_points_earned: account.lifetime_points_earned,
      lifetime_points_redeemed: account.lifetime_points_redeemed,
      enrolled_at: account.enrolled_at,
    }
  })

  return NextResponse.json({
    data: {
      period_days: parsed.data.days,
      summary: {
        active_members: activeAccountsResult.count ?? 0,
        enrollments: Array.from(enrollmentMap.values()).reduce((sum, count) => sum + count, 0),
        liability_cents: liabilityCents,
        points_outstanding: totalOutstanding,
        points_earned: pointsEarned,
        points_redeemed: pointsRedeemed,
        redemptions: redemptions.length,
        redemption_discount_cents: redemptionDiscountCents,
        loyalty_revenue_cents: loyaltyRevenueCents,
        open_review_items: reviewItemsResult.data?.length ?? 0,
      },
      check_comparison: {
        loyalty_average_check_cents: loyaltyCheckCount ? Math.round(loyaltyCheckTotalCents / loyaltyCheckCount) : 0,
        non_loyalty_average_check_cents: nonLoyaltyCheckCount ? Math.round(nonLoyaltyCheckTotalCents / nonLoyaltyCheckCount) : 0,
        loyalty_check_count: loyaltyCheckCount,
        non_loyalty_check_count: nonLoyaltyCheckCount,
      },
      member_growth: Array.from(enrollmentMap.entries()).map(([date, count]) => ({ date, count })),
      top_members: topMembers,
      top_rewards: Array.from(rewardMap.values()).sort((a, b) => b.redemptions - a.redemptions).slice(0, 8),
      review_items: reviewItemsResult.data ?? [],
      churn: {
        inactive_30_days: accounts.filter((account) => !account.status || account.status !== 'active').length,
        low_balance_members: accounts.filter((account) => asNumber(account.points_balance) < 50).length,
      },
    },
  })
}
