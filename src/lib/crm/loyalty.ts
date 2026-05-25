import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { AuthUser } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { audit } from '@/lib/audit/log'

export const crmLoyaltyReadRoles = ['platform_admin', 'owner', 'admin', 'manager', 'server', 'bartender', 'cashier', 'host', 'marketing', 'analyst'] as const
export const crmLoyaltyManageRoles = ['platform_admin', 'owner', 'admin', 'manager', 'marketing'] as const
export const crmLoyaltyServiceRoles = ['platform_admin', 'owner', 'admin', 'manager', 'server', 'bartender', 'cashier'] as const

type DbClient = ReturnType<typeof createAdminClient>

type LoyaltyAccount = {
  id: string
  org_id: string
  location_id: string | null
  program_id: string
  guest_id: string
  points_balance: number
  lifetime_points_earned: number
  lifetime_points_redeemed: number
  visits_count: number
  current_punches: number
  crm_loyalty_programs: {
    id: string
    points_per_dollar: number | string | null
    points_per_visit: number | null
    status: string
  } | null
}

type LoyaltyReward = {
  id: string
  org_id: string
  program_id: string
  points_cost: number
  value_cents: number
  reward_type: string
  percent_off: number | string | null
  requires_manager_override: boolean
  status: string
}

function asNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return 0
}

export function pagination(page: number, limit: number): { offset: number; to: number } {
  const offset = (page - 1) * limit
  return { offset, to: offset + limit - 1 }
}

export async function assertCrmGuest(db: DbClient, user: AuthUser, guestId: string) {
  const { data: guest, error } = await db
    .from('guests')
    .select('id, legacy_customer_id')
    .eq('id', guestId)
    .eq('org_id', user.org_id)
    .is('deleted_at', null)
    .single()

  if (error || !guest) {
    return { error: NextResponse.json({ error: 'Guest not found' }, { status: 404 }) }
  }

  return { guest: guest as { id: string; legacy_customer_id: string | null } }
}

export async function assertProgram(db: DbClient, user: AuthUser, programId: string) {
  const { data: program, error } = await db
    .from('crm_loyalty_programs')
    .select('id, status, points_per_dollar, points_per_visit')
    .eq('id', programId)
    .eq('org_id', user.org_id)
    .single()

  if (error || !program) {
    return { error: NextResponse.json({ error: 'Loyalty program not found' }, { status: 404 }) }
  }
  if ((program as { status: string }).status !== 'active') {
    return { error: NextResponse.json({ error: 'Loyalty program is not active' }, { status: 400 }) }
  }

  return { program }
}

export async function loadAccount(db: DbClient, user: AuthUser, accountId: string) {
  const { data: account, error } = await db
    .from('crm_loyalty_accounts')
    .select('id, org_id, location_id, program_id, guest_id, points_balance, lifetime_points_earned, lifetime_points_redeemed, visits_count, current_punches, crm_loyalty_programs(id, points_per_dollar, points_per_visit, status)')
    .eq('id', accountId)
    .eq('org_id', user.org_id)
    .single()

  if (error || !account) {
    return { error: NextResponse.json({ error: 'Loyalty account not found' }, { status: 404 }) }
  }

  const typedAccount = account as unknown as LoyaltyAccount | (Omit<LoyaltyAccount, 'crm_loyalty_programs'> & {
    crm_loyalty_programs: LoyaltyAccount['crm_loyalty_programs'][]
  })
  let normalizedAccount: LoyaltyAccount
  if (Array.isArray(typedAccount.crm_loyalty_programs)) {
    normalizedAccount = {
      ...typedAccount,
      crm_loyalty_programs: typedAccount.crm_loyalty_programs[0] ?? null,
    }
  } else {
    normalizedAccount = typedAccount as LoyaltyAccount
  }

  return { account: normalizedAccount }
}

export async function earnPoints(input: {
  db: DbClient
  user: AuthUser
  account: LoyaltyAccount
  points?: number
  amount_cents?: number
  visits: number
  order_id?: string | null
  event_type: 'earn' | 'surprise_delight' | 'referral' | 'punch'
  explanation: string
  metadata: Record<string, unknown>
  request: NextRequest
}) {
  const { db, user, account } = input
  let amountCents = input.amount_cents ?? 0
  let locationId = account.location_id
  const metadata = { ...input.metadata }

  if (input.order_id) {
    const { data: order, error: orderError } = await db
      .from('orders')
      .select('id, location_id, status, total, metadata')
      .eq('id', input.order_id)
      .eq('org_id', user.org_id)
      .single()

    if (orderError || !order) {
      return { error: NextResponse.json({ error: 'Order not found' }, { status: 404 }) }
    }
    if ((order as { status: string }).status !== 'closed') {
      return { error: NextResponse.json({ error: 'Loyalty points can only be earned from closed checks' }, { status: 400 }) }
    }
    locationId = (order as { location_id: string | null }).location_id ?? locationId
    if (!amountCents) amountCents = Math.round(asNumber((order as { total: number | string }).total) * 100)
    metadata.order_metadata = (order as { metadata?: unknown }).metadata ?? {}
  }

  const rate = asNumber(account.crm_loyalty_programs?.points_per_dollar)
  const visitPoints = account.crm_loyalty_programs?.points_per_visit ?? 0
  const earnedPoints = input.points ?? Math.floor((amountCents / 100) * rate) + input.visits * visitPoints

  if (earnedPoints <= 0) {
    return { error: NextResponse.json({ error: 'No loyalty points were earned from this activity' }, { status: 400 }) }
  }

  const newBalance = account.points_balance + earnedPoints
  const now = new Date().toISOString()
  const { data: updated, error: updateError } = await db
    .from('crm_loyalty_accounts')
    .update({
      points_balance: newBalance,
      lifetime_points_earned: account.lifetime_points_earned + earnedPoints,
      visits_count: account.visits_count + input.visits,
      current_punches: account.current_punches + input.visits,
      last_activity_at: now,
      updated_at: now,
    })
    .eq('id', account.id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (updateError || !updated) {
    return { error: NextResponse.json({ error: 'Failed to update loyalty account' }, { status: 500 }) }
  }

  const { data: ledger, error: ledgerError } = await db
    .from('crm_points_ledger')
    .insert({
      org_id: user.org_id,
      location_id: locationId,
      account_id: account.id,
      guest_id: account.guest_id,
      program_id: account.program_id,
      order_id: input.order_id ?? null,
      event_type: input.event_type,
      points_delta: earnedPoints,
      balance_after: newBalance,
      source: input.order_id ? 'pos_closed_check' : 'crm',
      explanation: input.explanation,
      created_by: user.id,
      metadata,
    })
    .select()
    .single()

  if (ledgerError || !ledger) {
    return { error: NextResponse.json({ error: 'Failed to write loyalty ledger' }, { status: 500 }) }
  }

  await audit.record({
    actor: user,
    action: 'crm_loyalty_points_earned',
    entity_type: 'loyalty_ledger',
    entity_id: (ledger as { id: string }).id,
    after_state: ledger as Record<string, unknown>,
    description: `Earned ${earnedPoints} loyalty points`,
    request: input.request,
    location_id: locationId,
  })

  return { data: { account: updated, ledger } }
}

export async function redeemReward(input: {
  db: DbClient
  user: AuthUser
  account: LoyaltyAccount
  rewardId: string
  orderId?: string | null
  discountCents?: number
  status: 'reserved' | 'applied' | 'voided' | 'expired'
  explanation: string
  metadata: Record<string, unknown>
  request: NextRequest
}) {
  const { db, user, account } = input
  const { data: reward, error: rewardError } = await db
    .from('crm_rewards')
    .select('id, org_id, program_id, points_cost, value_cents, reward_type, percent_off, requires_manager_override, status')
    .eq('id', input.rewardId)
    .eq('org_id', user.org_id)
    .eq('program_id', account.program_id)
    .single()

  if (rewardError || !reward) {
    return { error: NextResponse.json({ error: 'Reward not found' }, { status: 404 }) }
  }

  const typedReward = reward as LoyaltyReward
  if (typedReward.status !== 'active') {
    return { error: NextResponse.json({ error: 'Reward is not active' }, { status: 400 }) }
  }
  if (account.points_balance < typedReward.points_cost) {
    return { error: NextResponse.json({ error: 'Insufficient points balance', available: account.points_balance }, { status: 400 }) }
  }

  let locationId = account.location_id
  if (input.orderId) {
    const { data: order } = await db
      .from('orders')
      .select('id, location_id')
      .eq('id', input.orderId)
      .eq('org_id', user.org_id)
      .single()

    if (!order) return { error: NextResponse.json({ error: 'Order not found' }, { status: 404 }) }
    locationId = (order as { location_id: string | null }).location_id ?? locationId
  }

  const { data: redemption, error: redemptionError } = await db
    .from('crm_reward_redemptions')
    .insert({
      org_id: user.org_id,
      location_id: locationId,
      account_id: account.id,
      reward_id: typedReward.id,
      guest_id: account.guest_id,
      order_id: input.orderId ?? null,
      status: input.status,
      points_spent: typedReward.points_cost,
      discount_cents: input.discountCents ?? typedReward.value_cents,
      applied_at: input.status === 'applied' ? new Date().toISOString() : null,
      created_by: user.id,
      metadata: input.metadata,
    })
    .select()
    .single()

  if (redemptionError || !redemption) {
    return { error: NextResponse.json({ error: 'Failed to redeem reward' }, { status: 500 }) }
  }

  const newBalance = account.points_balance - typedReward.points_cost
  const now = new Date().toISOString()
  const { data: updated, error: updateError } = await db
    .from('crm_loyalty_accounts')
    .update({
      points_balance: newBalance,
      lifetime_points_redeemed: account.lifetime_points_redeemed + typedReward.points_cost,
      last_activity_at: now,
      updated_at: now,
    })
    .eq('id', account.id)
    .eq('org_id', user.org_id)
    .select()
    .single()

  if (updateError || !updated) {
    return { error: NextResponse.json({ error: 'Failed to update loyalty account' }, { status: 500 }) }
  }

  const { data: ledger, error: ledgerError } = await db
    .from('crm_points_ledger')
    .insert({
      org_id: user.org_id,
      location_id: locationId,
      account_id: account.id,
      guest_id: account.guest_id,
      program_id: account.program_id,
      order_id: input.orderId ?? null,
      redemption_id: (redemption as { id: string }).id,
      event_type: 'redeem',
      points_delta: -typedReward.points_cost,
      balance_after: newBalance,
      source: input.orderId ? 'pos_checkout' : 'crm',
      explanation: input.explanation,
      created_by: user.id,
      metadata: { ...input.metadata, reward_id: typedReward.id },
    })
    .select()
    .single()

  if (ledgerError || !ledger) {
    return { error: NextResponse.json({ error: 'Failed to write loyalty ledger' }, { status: 500 }) }
  }

  await audit.record({
    actor: user,
    action: 'crm_loyalty_reward_redeemed',
    entity_type: 'loyalty_redemption',
    entity_id: (redemption as { id: string }).id,
    after_state: { redemption, ledger },
    description: `Redeemed reward for ${typedReward.points_cost} loyalty points`,
    request: input.request,
    location_id: locationId,
  })

  return { data: { account: updated, redemption, ledger } }
}
