import type { NextRequest } from 'next/server'
import type { AuthUser } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { createAdminClient } from '@/lib/supabase/admin'

type DbClient = ReturnType<typeof createAdminClient>

export type GuestLifecycleStage =
  | 'unknown'
  | 'prospect'
  | 'first_time'
  | 'second_time'
  | 'emerging_regular'
  | 'regular'
  | 'vip'
  | 'lapsed'
  | 'at_risk'
  | 'recovered'
  | 'dormant'
  | 'do_not_contact'

type ClosedOrder = {
  id: string
  location_id: string | null
  order_type: string | null
  total: number | string | null
  closed_at: string | null
  created_at: string
}

type OrderItem = {
  order_id: string
  menu_item_id: string | null
  name: string
  quantity: number | null
  line_total: number | string | null
}

type MenuItemCategory = {
  id: string
  menu_categories: { id: string; name: string } | { id: string; name: string }[] | null
}

export type GuestIntelligenceSummary = {
  total_visits: number
  total_spend: number
  average_check: number
  visit_frequency_days: number | null
  first_visit_at: string | null
  last_visit_at: string | null
  last_order_id: string | null
  favorite_items: Array<{ name: string; quantity: number; revenue: number; order_count: number }>
  favorite_categories: Array<{ name: string; quantity: number; revenue: number; order_count: number }>
  channel_preference: string | null
  location_preference: string | null
  lifecycle_stage: GuestLifecycleStage
  lifecycle_explanation: string
}

function money(value: number): number {
  return Math.round(value * 100) / 100
}

function asNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return 0
}

function daysBetween(left: Date, right: Date): number {
  return Math.max(0, Math.round((right.getTime() - left.getTime()) / 86_400_000))
}

function topByCount<T extends { count: number }>(counts: Map<string, T>): T | null {
  return Array.from(counts.values()).sort((a, b) => b.count - a.count)[0] ?? null
}

function mostCommonValue(values: Array<string | null | undefined>): string | null {
  const counts = new Map<string, { value: string; count: number }>()
  for (const value of values) {
    if (!value) continue
    counts.set(value, { value, count: (counts.get(value)?.count ?? 0) + 1 })
  }
  return topByCount(counts)?.value ?? null
}

function calculateLifecycle(input: {
  previousStage: GuestLifecycleStage
  totalVisits: number
  totalSpend: number
  lastVisitAt: string | null
  now: Date
}): { stage: GuestLifecycleStage; explanation: string } {
  const { previousStage, totalVisits, totalSpend, lastVisitAt, now } = input

  if (previousStage === 'do_not_contact') {
    return { stage: 'do_not_contact', explanation: 'Preserved do_not_contact because compliance state is not changed by purchase history.' }
  }
  if (totalVisits <= 0 || !lastVisitAt) {
    return { stage: previousStage === 'prospect' ? 'prospect' : 'unknown', explanation: 'No closed checks are linked to this guest yet.' }
  }

  const daysSinceLastVisit = daysBetween(new Date(lastVisitAt), now)
  if (daysSinceLastVisit >= 180) return { stage: 'dormant', explanation: `Last closed check was ${daysSinceLastVisit} days ago.` }
  if (previousStage === 'vip' && daysSinceLastVisit >= 45) return { stage: 'at_risk', explanation: `VIP has not visited in ${daysSinceLastVisit} days.` }
  if (totalVisits >= 5 && daysSinceLastVisit >= 75) return { stage: 'lapsed', explanation: `Regular guest has not visited in ${daysSinceLastVisit} days.` }
  if (['lapsed', 'at_risk', 'dormant'].includes(previousStage) && daysSinceLastVisit <= 14) {
    return { stage: 'recovered', explanation: `Guest returned after previously being ${previousStage}.` }
  }
  if (totalVisits >= 10 || totalSpend >= 1000) return { stage: 'vip', explanation: 'Guest reached VIP threshold from deterministic visit or spend totals.' }
  if (totalVisits >= 5) return { stage: 'regular', explanation: 'Guest has at least 5 closed checks.' }
  if (totalVisits >= 3) return { stage: 'emerging_regular', explanation: 'Guest has 3-4 closed checks.' }
  if (totalVisits === 2) return { stage: 'second_time', explanation: 'Guest has exactly 2 closed checks.' }
  return { stage: 'first_time', explanation: 'Guest has exactly 1 closed check.' }
}

export function calculateGuestIntelligence(input: {
  previousStage: GuestLifecycleStage
  orders: ClosedOrder[]
  items: OrderItem[]
  categoryByMenuItemId?: Map<string, string>
  now?: Date
}): GuestIntelligenceSummary {
  const orders = [...input.orders].sort((a, b) => {
    const left = new Date(a.closed_at ?? a.created_at).getTime()
    const right = new Date(b.closed_at ?? b.created_at).getTime()
    return left - right
  })
  const totalVisits = orders.length
  const totalSpend = money(orders.reduce((sum, order) => sum + asNumber(order.total), 0))
  const firstOrder = orders[0] ?? null
  const lastOrder = orders[orders.length - 1] ?? null
  const firstVisitAt = firstOrder ? firstOrder.closed_at ?? firstOrder.created_at : null
  const lastVisitAt = lastOrder ? lastOrder.closed_at ?? lastOrder.created_at : null
  const visitFrequencyDays =
    totalVisits > 1 && firstVisitAt && lastVisitAt
      ? money(daysBetween(new Date(firstVisitAt), new Date(lastVisitAt)) / (totalVisits - 1))
      : null

  const itemCounts = new Map<string, { name: string; quantity: number; revenue: number; orderIds: Set<string> }>()
  const categoryCounts = new Map<string, { name: string; quantity: number; revenue: number; orderIds: Set<string> }>()
  for (const item of input.items) {
    const quantity = item.quantity ?? 0
    const revenue = asNumber(item.line_total)
    const existingItem = itemCounts.get(item.name) ?? { name: item.name, quantity: 0, revenue: 0, orderIds: new Set<string>() }
    existingItem.quantity += quantity
    existingItem.revenue += revenue
    existingItem.orderIds.add(item.order_id)
    itemCounts.set(item.name, existingItem)

    const category = item.menu_item_id ? input.categoryByMenuItemId?.get(item.menu_item_id) : null
    if (category) {
      const existingCategory = categoryCounts.get(category) ?? { name: category, quantity: 0, revenue: 0, orderIds: new Set<string>() }
      existingCategory.quantity += quantity
      existingCategory.revenue += revenue
      existingCategory.orderIds.add(item.order_id)
      categoryCounts.set(category, existingCategory)
    }
  }

  const channelPreference = mostCommonValue(orders.map((order) => order.order_type ?? 'unknown'))
  const locationPreference = mostCommonValue(orders.map((order) => order.location_id))
  const lifecycle = calculateLifecycle({
    previousStage: input.previousStage,
    totalVisits,
    totalSpend,
    lastVisitAt,
    now: input.now ?? new Date(),
  })

  return {
    total_visits: totalVisits,
    total_spend: totalSpend,
    average_check: totalVisits > 0 ? money(totalSpend / totalVisits) : 0,
    visit_frequency_days: visitFrequencyDays,
    first_visit_at: firstVisitAt,
    last_visit_at: lastVisitAt,
    last_order_id: lastOrder?.id ?? null,
    favorite_items: Array.from(itemCounts.values())
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 5)
      .map((item) => ({ name: item.name, quantity: item.quantity, revenue: money(item.revenue), order_count: item.orderIds.size })),
    favorite_categories: Array.from(categoryCounts.values())
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 5)
      .map((category) => ({ name: category.name, quantity: category.quantity, revenue: money(category.revenue), order_count: category.orderIds.size })),
    channel_preference: channelPreference,
    location_preference: locationPreference,
    lifecycle_stage: lifecycle.stage,
    lifecycle_explanation: lifecycle.explanation,
  }
}

async function loadCategoryMap(db: DbClient, orgId: string, menuItemIds: string[]): Promise<Map<string, string>> {
  if (menuItemIds.length === 0) return new Map()
  const { data } = await db
    .from('menu_items')
    .select('id, menu_categories(id, name)')
    .eq('org_id', orgId)
    .in('id', menuItemIds)

  return new Map((data ?? []).flatMap((row) => {
    const typed = row as unknown as MenuItemCategory
    const category = Array.isArray(typed.menu_categories) ? typed.menu_categories[0] : typed.menu_categories
    return category?.name ? [[typed.id, category.name] as const] : []
  }))
}

export async function recalculateGuestIntelligence(input: {
  db?: DbClient
  user: Pick<AuthUser, 'id' | 'email' | 'org_id' | 'role'>
  guestId: string
  request?: NextRequest
}) {
  const db = input.db ?? createAdminClient()
  const { data: guest, error: guestError } = await db
    .from('guests')
    .select('id, org_id, location_id, legacy_customer_id, lifecycle_stage, metadata')
    .eq('id', input.guestId)
    .eq('org_id', input.user.org_id)
    .is('deleted_at', null)
    .single()

  if (guestError || !guest) {
    return { error: 'Guest not found' as const }
  }

  const { data: crmOrders, error: crmOrdersError } = await db
    .from('orders')
    .select('id, location_id, order_type, total, closed_at, created_at')
    .eq('org_id', input.user.org_id)
    .eq('status', 'closed')
    .contains('metadata', { crm_guest_id: input.guestId })

  if (crmOrdersError) return { error: 'Failed to fetch guest orders' as const }

  let closedOrders = (crmOrders ?? []) as ClosedOrder[]
  const legacyCustomerId = (guest as { legacy_customer_id?: string | null }).legacy_customer_id
  if (legacyCustomerId) {
    const { data: legacyOrders, error: legacyOrdersError } = await db
      .from('orders')
      .select('id, location_id, order_type, total, closed_at, created_at')
      .eq('org_id', input.user.org_id)
      .eq('status', 'closed')
      .eq('customer_id', legacyCustomerId)

    if (legacyOrdersError) return { error: 'Failed to fetch guest orders' as const }

    const byId = new Map(closedOrders.map((order) => [order.id, order]))
    for (const order of (legacyOrders ?? []) as ClosedOrder[]) byId.set(order.id, order)
    closedOrders = Array.from(byId.values())
  }

  const orderIds = closedOrders.map((order) => order.id)
  const { data: items, error: itemsError } = orderIds.length
    ? await db
      .from('order_items')
      .select('order_id, menu_item_id, name, quantity, line_total')
      .eq('org_id', input.user.org_id)
      .in('order_id', orderIds)
      .eq('is_voided', false)
    : { data: [], error: null }

  if (itemsError) return { error: 'Failed to fetch guest order items' as const }

  const menuItemIds = Array.from(new Set((items ?? []).flatMap((item) => {
    const menuItemId = (item as OrderItem).menu_item_id
    return menuItemId ? [menuItemId] : []
  })))
  const categoryByMenuItemId = await loadCategoryMap(db, input.user.org_id, menuItemIds)
  const summary = calculateGuestIntelligence({
    previousStage: (guest as { lifecycle_stage: GuestLifecycleStage }).lifecycle_stage,
    orders: closedOrders,
    items: (items ?? []) as OrderItem[],
    categoryByMenuItemId,
  })
  const previousStage = (guest as { lifecycle_stage: GuestLifecycleStage }).lifecycle_stage
  const now = new Date().toISOString()
  const metadata = {
    ...(((guest as { metadata?: Record<string, unknown> | null }).metadata) ?? {}),
    crm_intelligence: {
      calculated_at: now,
      visit_frequency_days: summary.visit_frequency_days,
      favorite_items: summary.favorite_items,
      favorite_categories: summary.favorite_categories,
      channel_preference: summary.channel_preference,
      location_preference: summary.location_preference,
      lifecycle_explanation: summary.lifecycle_explanation,
      source: 'closed_checks',
      deterministic: true,
    },
  }

  const { data: updated, error: updateError } = await db
    .from('guests')
    .update({
      total_visits: summary.total_visits,
      total_spend: summary.total_spend,
      average_check: summary.average_check,
      first_visit_at: summary.first_visit_at,
      last_visit_at: summary.last_visit_at,
      last_order_id: summary.last_order_id,
      lifecycle_stage: summary.lifecycle_stage,
      is_vip: summary.lifecycle_stage === 'vip',
      metadata,
      updated_at: now,
    })
    .eq('id', input.guestId)
    .eq('org_id', input.user.org_id)
    .select('id, lifecycle_stage, total_visits, total_spend, average_check, first_visit_at, last_visit_at, last_order_id, metadata')
    .single()

  if (updateError || !updated) {
    return { error: 'Failed to update guest intelligence' as const }
  }

  if (previousStage !== summary.lifecycle_stage) {
    await db.from('guest_timeline_events').insert({
      org_id: input.user.org_id,
      location_id: (guest as { location_id: string | null }).location_id,
      guest_id: input.guestId,
      actor_user_id: input.user.id,
      event_type: 'crm.lifecycle.changed',
      event_source: 'crm_intelligence',
      order_id: summary.last_order_id,
      title: `Lifecycle changed to ${summary.lifecycle_stage.replace(/_/g, ' ')}`,
      body: summary.lifecycle_explanation,
      visibility: 'manager',
      metadata: {
        previous_stage: previousStage,
        next_stage: summary.lifecycle_stage,
        explanation: summary.lifecycle_explanation,
        source_order_ids: orderIds,
      },
    })
  }

  await audit.record({
    actor: input.user,
    action: 'crm_guest_intelligence_recalculated',
    entity_type: 'guest',
    entity_id: input.guestId,
    before_state: { lifecycle_stage: previousStage },
    after_state: summary as unknown as Record<string, unknown>,
    description: 'Recalculated CRM guest intelligence from closed checks',
    request: input.request,
    location_id: (guest as { location_id: string | null }).location_id,
  })

  return { data: { guest: updated, intelligence: summary, lifecycle_changed: previousStage !== summary.lifecycle_stage } }
}

export async function recalculateGuestIntelligenceForOrder(input: {
  db?: DbClient
  user: Pick<AuthUser, 'id' | 'email' | 'org_id' | 'role'>
  orderId: string
  request?: NextRequest
}) {
  const db = input.db ?? createAdminClient()
  const { data: order } = await db
    .from('orders')
    .select('id, metadata')
    .eq('id', input.orderId)
    .eq('org_id', input.user.org_id)
    .single()
  const guestId = typeof (order as { metadata?: Record<string, unknown> | null } | null)?.metadata?.crm_guest_id === 'string'
    ? (order as { metadata: { crm_guest_id: string } }).metadata.crm_guest_id
    : null

  if (!guestId) return { data: null }
  return recalculateGuestIntelligence({ db, user: input.user, guestId, request: input.request })
}
