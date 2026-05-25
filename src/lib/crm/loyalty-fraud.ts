import type { AuthUser } from '@/lib/api/auth'
import { createAdminClient } from '@/lib/supabase/admin'

type DbClient = ReturnType<typeof createAdminClient>

type ReviewItemInput = {
  location_id?: string | null
  account_id?: string | null
  guest_id?: string | null
  reward_id?: string | null
  redemption_id?: string | null
  ledger_id?: string | null
  signal_type: 'staff_redemption_velocity' | 'manual_adjustment' | 'shared_phone_cluster' | 'refund_reward_loop' | 'comp_reward_stacking'
  severity: 'low' | 'medium' | 'high'
  source_key: string
  title: string
  description: string
  evidence: Record<string, unknown>
}

type LedgerRow = {
  id: string
  location_id: string | null
  account_id: string
  guest_id: string
  event_type: string
  points_delta: number
  source: string
  explanation: string
  created_by: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}

type RedemptionRow = {
  id: string
  location_id: string | null
  account_id: string
  guest_id: string
  reward_id: string
  order_id: string | null
  status: string
  points_spent: number
  discount_cents: number
  created_by: string | null
  created_at: string
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return 0
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

async function upsertReviewItems(db: DbClient, user: AuthUser, items: ReviewItemInput[]) {
  if (!items.length) return []

  const rows = items.map((item) => ({
    ...item,
    org_id: user.org_id,
    status: 'open',
    detected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await db
    .from('crm_loyalty_review_items')
    .upsert(rows, {
      onConflict: 'org_id,source_key',
      ignoreDuplicates: false,
    })
    .select()

  if (error) throw error
  return data ?? []
}

export async function generateLoyaltyReviewItems(input: {
  db: DbClient
  user: AuthUser
  days: number
}) {
  const { db, user, days } = input
  const since = new Date()
  since.setDate(since.getDate() - days)

  const { data: redemptions } = await db
    .from('crm_reward_redemptions')
    .select('id, location_id, account_id, guest_id, reward_id, order_id, status, points_spent, discount_cents, created_by, created_at')
    .eq('org_id', user.org_id)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(500)

  const { data: ledgerRows } = await db
    .from('crm_points_ledger')
    .select('id, location_id, account_id, guest_id, event_type, points_delta, source, explanation, created_by, created_at, metadata')
    .eq('org_id', user.org_id)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(500)

  const reviewItems: ReviewItemInput[] = []
  const redemptionsList = (redemptions ?? []) as RedemptionRow[]
  const ledgerList = (ledgerRows ?? []) as LedgerRow[]

  const redemptionsByStaffDay = new Map<string, RedemptionRow[]>()
  for (const redemption of redemptionsList) {
    if (!redemption.created_by) continue
    const key = `${redemption.created_by}:${dayKey(redemption.created_at)}`
    redemptionsByStaffDay.set(key, [...(redemptionsByStaffDay.get(key) ?? []), redemption])
  }

  for (const [key, rows] of redemptionsByStaffDay) {
    const discountCents = rows.reduce((sum, row) => sum + asNumber(row.discount_cents), 0)
    if (rows.length < 5 && discountCents < 10000) continue
    const [staffId, date] = key.split(':')
    const first = rows[0]
    reviewItems.push({
      location_id: first.location_id,
      account_id: first.account_id,
      guest_id: first.guest_id,
      reward_id: first.reward_id,
      redemption_id: first.id,
      signal_type: 'staff_redemption_velocity',
      severity: rows.length >= 8 || discountCents >= 20000 ? 'high' : 'medium',
      source_key: `staff-redemption-velocity:${staffId}:${date}`,
      title: 'High reward redemption velocity',
      description: `${rows.length} rewards were redeemed by the same staff user on ${date}. Review before taking action.`,
      evidence: {
        staff_id: staffId,
        date,
        redemption_count: rows.length,
        discount_cents: discountCents,
        redemption_ids: rows.map((row) => row.id),
      },
    })
  }

  const adjustmentsByStaffDay = new Map<string, LedgerRow[]>()
  for (const row of ledgerList.filter((entry) => entry.event_type === 'adjust')) {
    const staffId = row.created_by ?? 'unknown'
    const key = `${staffId}:${dayKey(row.created_at)}`
    adjustmentsByStaffDay.set(key, [...(adjustmentsByStaffDay.get(key) ?? []), row])
    if (Math.abs(asNumber(row.points_delta)) >= 500) {
      reviewItems.push({
        location_id: row.location_id,
        account_id: row.account_id,
        guest_id: row.guest_id,
        ledger_id: row.id,
        signal_type: 'manual_adjustment',
        severity: Math.abs(asNumber(row.points_delta)) >= 1000 ? 'high' : 'medium',
        source_key: `large-manual-adjustment:${row.id}`,
        title: 'Large manual points adjustment',
        description: `${Math.abs(asNumber(row.points_delta)).toLocaleString()} points were manually adjusted. Review the reason and evidence.`,
        evidence: {
          ledger_id: row.id,
          points_delta: row.points_delta,
          explanation: row.explanation,
          staff_id: row.created_by,
          metadata: row.metadata ?? {},
        },
      })
    }
  }

  for (const [key, rows] of adjustmentsByStaffDay) {
    if (rows.length < 3) continue
    const [staffId, date] = key.split(':')
    const first = rows[0]
    reviewItems.push({
      location_id: first.location_id,
      account_id: first.account_id,
      guest_id: first.guest_id,
      ledger_id: first.id,
      signal_type: 'manual_adjustment',
      severity: rows.length >= 5 ? 'high' : 'medium',
      source_key: `manual-adjustment-velocity:${staffId}:${date}`,
      title: 'Repeated manual loyalty adjustments',
      description: `${rows.length} manual adjustments were made by the same staff user on ${date}. Review for training or abuse.`,
      evidence: {
        staff_id: staffId,
        date,
        adjustment_count: rows.length,
        ledger_ids: rows.map((row) => row.id),
        points_delta_total: rows.reduce((sum, row) => sum + asNumber(row.points_delta), 0),
      },
    })
  }

  const { data: phoneRows } = await db
    .from('guest_contact_points')
    .select('guest_id, normalized_value, value, guests(id, display_name)')
    .eq('org_id', user.org_id)
    .eq('contact_type', 'phone')
    .limit(1000)

  const phoneClusters = new Map<string, { guestId: string; displayName: string }[]>()
  for (const row of (phoneRows ?? []) as Array<Record<string, unknown>>) {
    const key = String(row.normalized_value || row.value || '').replace(/\D/g, '')
    if (key.length < 7) continue
    const guests = row.guests as { display_name?: string } | { display_name?: string }[] | null
    const guest = Array.isArray(guests) ? guests[0] : guests
    phoneClusters.set(key, [
      ...(phoneClusters.get(key) ?? []),
      { guestId: String(row.guest_id), displayName: guest?.display_name ?? 'Guest' },
    ])
  }

  for (const [phoneKey, guests] of phoneClusters) {
    const uniqueGuests = Array.from(new Map(guests.map((guest) => [guest.guestId, guest])).values())
    const uniqueNames = new Set(uniqueGuests.map((guest) => guest.displayName.toLowerCase()))
    if (uniqueGuests.length < 4 || uniqueNames.size < 3) continue
    reviewItems.push({
      guest_id: uniqueGuests[0].guestId,
      signal_type: 'shared_phone_cluster',
      severity: uniqueGuests.length >= 6 ? 'high' : 'medium',
      source_key: `shared-phone-cluster:${phoneKey}`,
      title: 'Same phone appears on many guest profiles',
      description: `${uniqueGuests.length} guest profiles share one phone number. Review for duplicate profiles before changing balances.`,
      evidence: {
        phone_fingerprint: phoneKey.slice(-4).padStart(phoneKey.length, '*'),
        guest_count: uniqueGuests.length,
        guests: uniqueGuests,
      },
    })
  }

  const orderIds = Array.from(new Set(redemptionsList.map((row) => row.order_id).filter(Boolean))) as string[]
  if (orderIds.length) {
    const { data: refundedPayments } = await db
      .from('payments')
      .select('order_id, refund_amount, status, refunded_at')
      .eq('org_id', user.org_id)
      .in('order_id', orderIds)
      .or('refund_amount.gt.0,status.eq.refunded')

    const refundedOrderIds = new Set((refundedPayments ?? []).map((row: Record<string, unknown>) => String(row.order_id)))
    for (const redemption of redemptionsList.filter((row) => row.order_id && refundedOrderIds.has(row.order_id))) {
      reviewItems.push({
        location_id: redemption.location_id,
        account_id: redemption.account_id,
        guest_id: redemption.guest_id,
        reward_id: redemption.reward_id,
        redemption_id: redemption.id,
        signal_type: 'refund_reward_loop',
        severity: 'high',
        source_key: `refund-reward-loop:${redemption.id}`,
        title: 'Reward redemption tied to refunded check',
        description: 'A redeemed reward is attached to an order with refund activity. Review before changing guest balance.',
        evidence: {
          redemption_id: redemption.id,
          order_id: redemption.order_id,
          points_spent: redemption.points_spent,
          discount_cents: redemption.discount_cents,
        },
      })
    }

    const { data: compedItems } = await db
      .from('order_items')
      .select('order_id, comp_amount, comped_by')
      .eq('org_id', user.org_id)
      .in('order_id', orderIds)
      .eq('is_comped', true)

    const { data: orderDiscounts } = await db
      .from('order_discounts')
      .select('order_id, applied_amount, applied_by')
      .in('order_id', orderIds)

    const compedOrderIds = new Set([
      ...(compedItems ?? []).map((row: Record<string, unknown>) => String(row.order_id)),
      ...(orderDiscounts ?? []).map((row: Record<string, unknown>) => String(row.order_id)),
    ])

    for (const redemption of redemptionsList.filter((row) => row.order_id && compedOrderIds.has(row.order_id))) {
      reviewItems.push({
        location_id: redemption.location_id,
        account_id: redemption.account_id,
        guest_id: redemption.guest_id,
        reward_id: redemption.reward_id,
        redemption_id: redemption.id,
        signal_type: 'comp_reward_stacking',
        severity: redemption.discount_cents >= 5000 ? 'high' : 'medium',
        source_key: `comp-reward-stacking:${redemption.id}`,
        title: 'Reward stacked with comp or discount',
        description: 'A loyalty reward was used on a check that also has comp or discount activity. Review for policy compliance.',
        evidence: {
          redemption_id: redemption.id,
          order_id: redemption.order_id,
          points_spent: redemption.points_spent,
          discount_cents: redemption.discount_cents,
        },
      })
    }
  }

  return upsertReviewItems(db, user, reviewItems)
}
