import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { validateManagerPinForAction } from '@/lib/auth/manager-pin'
import { recalculateOrderTotals } from '@/lib/tax/recalculate-order'
import { audit } from '@/lib/audit/log'
import {
  crmLoyaltyReadRoles,
  crmLoyaltyServiceRoles,
  loadAccount,
  redeemReward,
} from '@/lib/crm/loyalty'
import {
  crmCheckoutLoyaltyActionSchema,
  crmCheckoutLoyaltyQuerySchema,
} from '@/lib/schemas/crm'

const MANAGER_ROLES = ['platform_admin', 'owner', 'admin', 'manager'] as const

type DbClient = ReturnType<typeof createAdminClient>

type CheckoutOrder = {
  id: string
  org_id: string
  location_id: string | null
  subtotal: string | number | null
  total: string | number | null
  discount_total: string | number | null
  tax_total: string | number | null
  balance_due: string | number | null
  metadata: Record<string, unknown> | null
}

type CheckoutReward = {
  id: string
  program_id: string
  name: string
  description: string | null
  reward_type: string
  points_cost: number
  value_cents: number
  percent_off: number | string | null
  requires_manager_override: boolean
}

function centsFromMoney(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Math.round(value * 100)
  if (typeof value === 'string') return Math.round(Number(value) * 100)
  return 0
}

function calculateRewardDiscount(reward: CheckoutReward, order: CheckoutOrder): number {
  const subtotalCents = centsFromMoney(order.subtotal)
  const totalCents = centsFromMoney(order.total)
  const capCents = Math.max(0, totalCents)
  if (reward.reward_type === 'discount_percent') {
    const percent = typeof reward.percent_off === 'string' ? Number(reward.percent_off) : reward.percent_off ?? 0
    return Math.min(capCents, Math.round(subtotalCents * (percent / 100)))
  }
  return Math.min(capCents, reward.value_cents)
}

async function loadOrder(db: DbClient, orgId: string, orderId: string) {
  const { data: order } = await db
    .from('orders')
    .select('id, org_id, location_id, subtotal, total, discount_total, tax_total, balance_due, metadata')
    .eq('id', orderId)
    .eq('org_id', orgId)
    .single()

  return (order as CheckoutOrder | null) ?? null
}

async function loadCheckoutState(db: DbClient, orgId: string, input: { guestId?: string | null; orderId?: string | null }) {
  const order = input.orderId ? await loadOrder(db, orgId, input.orderId) : null
  const guestId = input.guestId ?? (typeof order?.metadata?.crm_guest_id === 'string' ? order.metadata.crm_guest_id : null)

  if (!guestId) {
    return { guest_id: null, account: null, available_rewards: [], next_reward: null, receipt_cta: 'Attach a guest to enroll in rewards.' }
  }

  const { data: accountData } = await db
    .from('crm_loyalty_accounts')
    .select('*, crm_loyalty_programs(id, name, program_type, points_per_dollar, points_per_visit), crm_loyalty_tiers(id, name)')
    .eq('org_id', orgId)
    .eq('guest_id', guestId)
    .neq('status', 'closed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const account = accountData as Record<string, unknown> | null
  if (!account) {
    return { guest_id: guestId, account: null, available_rewards: [], next_reward: null, receipt_cta: 'Enroll this guest to start earning rewards today.' }
  }

  const pointsBalance = Number(account.points_balance ?? 0)
  const { data: rewardsData } = await db
    .from('crm_rewards')
    .select('id, program_id, name, description, reward_type, points_cost, value_cents, percent_off, requires_manager_override')
    .eq('org_id', orgId)
    .eq('program_id', String(account.program_id))
    .eq('status', 'active')
    .lte('points_cost', pointsBalance)
    .order('points_cost', { ascending: true })
    .limit(8)

  const { data: nextRewardData } = await db
    .from('crm_rewards')
    .select('id, name, points_cost')
    .eq('org_id', orgId)
    .eq('program_id', String(account.program_id))
    .eq('status', 'active')
    .gt('points_cost', pointsBalance)
    .order('points_cost', { ascending: true })
    .limit(1)
    .maybeSingle()

  const nextReward = nextRewardData as { id: string; name: string; points_cost: number } | null
  return {
    guest_id: guestId,
    account,
    available_rewards: (rewardsData ?? []) as CheckoutReward[],
    next_reward: nextReward
      ? { ...nextReward, points_needed: Math.max(0, nextReward.points_cost - pointsBalance) }
      : null,
    receipt_cta: nextReward
      ? `${Math.max(0, nextReward.points_cost - pointsBalance)} points until ${nextReward.name}.`
      : 'Rewards are ready on this account.',
  }
}

async function loadActiveProgram(db: DbClient, orgId: string, programId?: string | null) {
  let query = db
    .from('crm_loyalty_programs')
    .select('id, location_id, name')
    .eq('org_id', orgId)
    .eq('status', 'active')

  if (programId) query = query.eq('id', programId)

  const { data: program } = await query.order('created_at', { ascending: true }).limit(1).maybeSingle()
  return (program as { id: string; location_id: string | null; name: string } | null) ?? null
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmLoyaltyReadRoles])
  if (roleErr) return roleErr

  const parsed = crmCheckoutLoyaltyQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const db = createAdminClient()
  const data = await loadCheckoutState(db, user.org_id, {
    guestId: parsed.data.guest_id,
    orderId: parsed.data.order_id,
  })

  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleErr = requireRole(user, [...crmLoyaltyServiceRoles])
  if (roleErr) return roleErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = crmCheckoutLoyaltyActionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.issues }, { status: 400 })
  }

  const db = createAdminClient()

  if (parsed.data.action === 'enroll') {
    const program = await loadActiveProgram(db, user.org_id, parsed.data.program_id)
    if (!program) return NextResponse.json({ error: 'No active CRM loyalty program found' }, { status: 404 })

    const { data: existing } = await db
      .from('crm_loyalty_accounts')
      .select('id')
      .eq('org_id', user.org_id)
      .eq('guest_id', parsed.data.guest_id)
      .eq('program_id', program.id)
      .neq('status', 'closed')
      .maybeSingle()

    if (!existing) {
      const { error } = await db.from('crm_loyalty_accounts').insert({
        org_id: user.org_id,
        location_id: program.location_id,
        program_id: program.id,
        guest_id: parsed.data.guest_id,
        metadata: { source: 'pos_checkout', order_id: parsed.data.order_id ?? null },
      })
      if (error) return NextResponse.json({ error: 'Failed to enroll CRM loyalty account' }, { status: 500 })
    }

    const state = await loadCheckoutState(db, user.org_id, {
      guestId: parsed.data.guest_id,
      orderId: parsed.data.order_id,
    })
    if (parsed.data.order_id) {
      const order = await loadOrder(db, user.org_id, parsed.data.order_id)
      if (order) {
        await db
          .from('orders')
          .update({
            metadata: {
              ...(order.metadata ?? {}),
              crm_loyalty_receipt: {
                account_id: (state.account as { id?: string } | null)?.id ?? null,
                reward_progress_label: state.receipt_cta,
                captured_via: 'pos_checkout_loyalty',
              },
            },
          })
          .eq('id', order.id)
          .eq('org_id', user.org_id)
      }
    }
    return NextResponse.json({ data: state }, { status: existing ? 200 : 201 })
  }

  const order = await loadOrder(db, user.org_id, parsed.data.order_id)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const { data: rewardData } = await db
    .from('crm_rewards')
    .select('id, program_id, name, description, reward_type, points_cost, value_cents, percent_off, requires_manager_override')
    .eq('id', parsed.data.reward_id)
    .eq('org_id', user.org_id)
    .eq('status', 'active')
    .single()

  const reward = rewardData as CheckoutReward | null
  if (!reward) return NextResponse.json({ error: 'Reward not found' }, { status: 404 })

  const discountCents = calculateRewardDiscount(reward, order)
  if (discountCents <= 0) return NextResponse.json({ error: 'Reward has no checkout discount value' }, { status: 400 })

  const isManager = (MANAGER_ROLES as readonly string[]).includes(user.role)
  const requiresManagerPin =
    !isManager &&
    (reward.requires_manager_override || discountCents > 1000 || discountCents > Math.round(centsFromMoney(order.subtotal) * 0.1))

  let managerPinUserId: string | null = null
  if (requiresManagerPin) {
    if (!parsed.data.manager_pin) {
      return NextResponse.json({ error: 'Reward requires manager PIN', requires_manager_pin: true }, { status: 403 })
    }
    const pin = await validateManagerPinForAction({
      actor: user,
      pin: parsed.data.manager_pin,
      request,
      supabase: db,
    })
    if (pin.kind === 'rate_limited') return NextResponse.json({ error: 'Too many PIN attempts' }, { status: 429 })
    if (pin.kind === 'invalid') return NextResponse.json({ error: 'Invalid manager PIN' }, { status: 403 })
    managerPinUserId = pin.manager_user_id
  }

  const accountResult = await loadAccount(db, user, parsed.data.account_id)
  if (accountResult.error) return accountResult.error
  if (accountResult.account.program_id !== reward.program_id) {
    return NextResponse.json({ error: 'Reward does not belong to this loyalty account' }, { status: 400 })
  }
  if (accountResult.account.points_balance < reward.points_cost) {
    return NextResponse.json({ error: 'Insufficient points balance', available: accountResult.account.points_balance }, { status: 400 })
  }

  const { data: discount, error: discountError } = await db
    .from('order_discounts')
    .insert({
      order_id: order.id,
      order_item_id: null,
      name: `Loyalty: ${reward.name}`,
      discount_type: 'fixed_amount',
      value: (discountCents / 100).toFixed(2),
      applied_amount: (discountCents / 100).toFixed(2),
      applied_by: user.id,
    })
    .select('id')
    .single()

  if (discountError) return NextResponse.json({ error: 'Failed to apply reward discount' }, { status: 500 })

  await recalculateOrderTotals(db, order.id, user.org_id, null)

  await audit.record({
    actor: user,
    manager_pin_user_id: managerPinUserId,
    action: 'order_discount_applied',
    entity_type: 'order',
    entity_id: order.id,
    description: `Loyalty reward discount: ${reward.name}`,
    before_state: {
      subtotal: order.subtotal,
      discount_total: order.discount_total,
      total: order.total,
      balance_due: order.balance_due,
    },
    after_state: {
      discount_id: (discount as { id?: string } | null)?.id ?? null,
      reward_id: reward.id,
      reward_name: reward.name,
      applied_amount: (discountCents / 100).toFixed(2),
    },
    reason: 'CRM loyalty reward redeemed at checkout',
    location_id: order.location_id,
    request,
  })

  const result = await redeemReward({
    db,
    user,
    account: accountResult.account,
    rewardId: parsed.data.reward_id,
    orderId: order.id,
    discountCents,
    status: 'applied',
    explanation: `Reward ${reward.name} applied at checkout`,
    metadata: {
      source: 'pos_checkout',
      order_discount_id: (discount as { id?: string } | null)?.id ?? null,
      manager_pin_user_id: managerPinUserId,
    },
    request,
  })
  if (result.error) return result.error

  const { data: refreshedOrder } = await db
    .from('orders')
    .select('subtotal, discount_total, tax_total, total, balance_due')
    .eq('id', order.id)
    .eq('org_id', user.org_id)
    .single()

  const state = await loadCheckoutState(db, user.org_id, {
    guestId: accountResult.account.guest_id,
    orderId: order.id,
  })

  await db
    .from('orders')
    .update({
      metadata: {
        ...(order.metadata ?? {}),
        crm_loyalty_receipt: {
          account_id: accountResult.account.id,
          reward_id: reward.id,
          reward_name: reward.name,
          reward_discount_cents: discountCents,
          reward_progress_label: state.receipt_cta,
          captured_via: 'pos_checkout_loyalty',
        },
      },
    })
    .eq('id', order.id)
    .eq('org_id', user.org_id)

  return NextResponse.json({
    data: {
      ...state,
      redemption: result.data,
      order_totals: refreshedOrder,
      discount_cents: discountCents,
    },
  })
}
