import type { NextRequest } from 'next/server'
import type { AuthUser } from '@/lib/api/auth'
import { audit } from '@/lib/audit/log'
import { calculateGuestMenuPreferenceGraph, type GuestMenuPreferenceGraph, type MenuPreferenceOrderItem } from '@/lib/crm/menu-preferences'
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
  discount_total?: number | string | null
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
  discounted_order_ratio: number
  lifecycle_stage: GuestLifecycleStage
  lifecycle_explanation: string
}

export type GuestSmartTagSuggestion = {
  slug: string
  name: string
  tag_category: 'lifecycle' | 'preference' | 'marketing' | 'loyalty' | 'risk' | 'system'
  is_sensitive: boolean
  confidence: number
  reason: string
  source: 'closed_checks' | 'guest_profile' | 'crm_case'
}

const SMART_TAG_SLUGS = [
  'first-time',
  'second-visit',
  'regular',
  'lapsed-regular',
  'at-risk-vip',
  'high-ltv',
  'wine-lover',
  'brunch-regular',
  'delivery-only',
  'discount-sensitive',
  'birthday-this-month',
  'complaint-unresolved',
] as const

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

function hasBirthdayThisMonth(birthday: string | null | undefined, now: Date): boolean {
  if (!birthday) return false
  const [, month] = birthday.split('-')
  return month === String(now.getUTCMonth() + 1).padStart(2, '0')
}

function containsCategory(summary: GuestIntelligenceSummary, category: string): boolean {
  return summary.favorite_categories.some((entry) => entry.name.toLowerCase().includes(category))
}

function containsItem(summary: GuestIntelligenceSummary, pattern: RegExp): boolean {
  return summary.favorite_items.some((entry) => pattern.test(entry.name.toLowerCase()))
}

export function calculateGuestSmartTags(input: {
  summary: GuestIntelligenceSummary
  birthday?: string | null
  hasUnresolvedComplaint?: boolean
  now?: Date
}): GuestSmartTagSuggestion[] {
  const { summary } = input
  const suggestions: GuestSmartTagSuggestion[] = []
  const add = (tag: GuestSmartTagSuggestion) => suggestions.push(tag)

  const lifecycleTagByStage: Partial<Record<GuestLifecycleStage, GuestSmartTagSuggestion>> = {
    first_time: {
      slug: 'first-time',
      name: 'First-time guest',
      tag_category: 'lifecycle',
      is_sensitive: false,
      confidence: 1,
      reason: 'Guest has exactly 1 closed check.',
      source: 'closed_checks',
    },
    second_time: {
      slug: 'second-visit',
      name: 'Second visit',
      tag_category: 'lifecycle',
      is_sensitive: false,
      confidence: 1,
      reason: 'Guest has exactly 2 closed checks.',
      source: 'closed_checks',
    },
    regular: {
      slug: 'regular',
      name: 'Regular guest',
      tag_category: 'lifecycle',
      is_sensitive: false,
      confidence: 1,
      reason: 'Guest has at least 5 closed checks.',
      source: 'closed_checks',
    },
    lapsed: {
      slug: 'lapsed-regular',
      name: 'Lapsed regular',
      tag_category: 'risk',
      is_sensitive: true,
      confidence: 0.95,
      reason: summary.lifecycle_explanation,
      source: 'closed_checks',
    },
    at_risk: {
      slug: 'at-risk-vip',
      name: 'At-risk VIP',
      tag_category: 'risk',
      is_sensitive: true,
      confidence: 0.95,
      reason: summary.lifecycle_explanation,
      source: 'closed_checks',
    },
    vip: {
      slug: 'high-ltv',
      name: 'High LTV',
      tag_category: 'loyalty',
      is_sensitive: false,
      confidence: 0.9,
      reason: 'Guest reached VIP threshold from deterministic visit or spend totals.',
      source: 'closed_checks',
    },
  }

  const lifecycleTag = lifecycleTagByStage[summary.lifecycle_stage]
  if (lifecycleTag) add(lifecycleTag)

  if (summary.total_spend >= 1000) {
    add({
      slug: 'high-ltv',
      name: 'High LTV',
      tag_category: 'loyalty',
      is_sensitive: false,
      confidence: 0.9,
      reason: `Guest lifetime spend is $${summary.total_spend}.`,
      source: 'closed_checks',
    })
  }
  if (containsCategory(summary, 'wine') || containsItem(summary, /\bwine\b|cabernet|merlot|pinot|chardonnay|sauvignon/)) {
    add({
      slug: 'wine-lover',
      name: 'Wine lover',
      tag_category: 'preference',
      is_sensitive: false,
      confidence: 0.8,
      reason: 'Wine appears in favorite items or categories from closed checks.',
      source: 'closed_checks',
    })
  }
  if (containsCategory(summary, 'brunch') || containsItem(summary, /brunch|mimosa|benedict|pancake|waffle/)) {
    add({
      slug: 'brunch-regular',
      name: 'Brunch regular',
      tag_category: 'preference',
      is_sensitive: false,
      confidence: 0.75,
      reason: 'Brunch items or categories appear in repeat order history.',
      source: 'closed_checks',
    })
  }
  if (summary.total_visits > 0 && summary.channel_preference === 'delivery') {
    add({
      slug: 'delivery-only',
      name: 'Delivery-only',
      tag_category: 'preference',
      is_sensitive: false,
      confidence: 0.85,
      reason: 'Delivery is the most common closed-check channel.',
      source: 'closed_checks',
    })
  }
  if (summary.total_visits >= 2 && summary.discounted_order_ratio >= 0.5) {
    add({
      slug: 'discount-sensitive',
      name: 'Discount-sensitive',
      tag_category: 'marketing',
      is_sensitive: true,
      confidence: 0.7,
      reason: `${Math.round(summary.discounted_order_ratio * 100)}% of closed checks include discounts.`,
      source: 'closed_checks',
    })
  }
  if (hasBirthdayThisMonth(input.birthday, input.now ?? new Date())) {
    add({
      slug: 'birthday-this-month',
      name: 'Birthday this month',
      tag_category: 'marketing',
      is_sensitive: false,
      confidence: 1,
      reason: 'Guest birthday falls in the current month.',
      source: 'guest_profile',
    })
  }
  if (input.hasUnresolvedComplaint) {
    add({
      slug: 'complaint-unresolved',
      name: 'Complaint unresolved',
      tag_category: 'risk',
      is_sensitive: true,
      confidence: 1,
      reason: 'Guest has an active service recovery note or unresolved complaint marker.',
      source: 'crm_case',
    })
  }

  const bySlug = new Map<string, GuestSmartTagSuggestion>()
  for (const suggestion of suggestions) {
    const existing = bySlug.get(suggestion.slug)
    if (!existing || suggestion.confidence > existing.confidence) bySlug.set(suggestion.slug, suggestion)
  }
  return Array.from(bySlug.values())
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
  const discountedOrders = orders.filter((order) => asNumber(order.discount_total) > 0).length
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
    discounted_order_ratio: totalVisits > 0 ? money(discountedOrders / totalVisits) : 0,
    lifecycle_stage: lifecycle.stage,
    lifecycle_explanation: lifecycle.explanation,
  }
}

function suppressedAutoTagSlugs(metadata: unknown): Set<string> {
  const autoTags = metadata && typeof metadata === 'object'
    ? (metadata as { crm_auto_tags?: { suppressed_slugs?: unknown } }).crm_auto_tags
    : null
  return new Set(Array.isArray(autoTags?.suppressed_slugs)
    ? autoTags.suppressed_slugs.filter((slug): slug is string => typeof slug === 'string')
    : [])
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
    .select('id, org_id, location_id, legacy_customer_id, lifecycle_stage, birthday, metadata')
    .eq('id', input.guestId)
    .eq('org_id', input.user.org_id)
    .is('deleted_at', null)
    .single()

  if (guestError || !guest) {
    return { error: 'Guest not found' as const }
  }

  const { data: crmOrders, error: crmOrdersError } = await db
    .from('orders')
    .select('id, location_id, order_type, total, discount_total, closed_at, created_at')
    .eq('org_id', input.user.org_id)
    .eq('status', 'closed')
    .contains('metadata', { crm_guest_id: input.guestId })

  if (crmOrdersError) return { error: 'Failed to fetch guest orders' as const }

  let closedOrders = (crmOrders ?? []) as ClosedOrder[]
  const legacyCustomerId = (guest as { legacy_customer_id?: string | null }).legacy_customer_id
  if (legacyCustomerId) {
    const { data: legacyOrders, error: legacyOrdersError } = await db
      .from('orders')
      .select('id, location_id, order_type, total, discount_total, closed_at, created_at')
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
      .select('id, order_id, menu_item_id, name, quantity, line_total, order_item_modifiers(name, quantity)')
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
  const { data: complaintNotes } = await db
    .from('guest_notes')
    .select('id, body')
    .eq('org_id', input.user.org_id)
    .eq('guest_id', input.guestId)
    .eq('note_category', 'service_recovery')
    .is('deleted_at', null)
    .limit(1)
  const summary = calculateGuestIntelligence({
    previousStage: (guest as { lifecycle_stage: GuestLifecycleStage }).lifecycle_stage,
    orders: closedOrders,
    items: (items ?? []) as OrderItem[],
    categoryByMenuItemId,
  })
  const menuPreferences = calculateGuestMenuPreferenceGraph({
    orders: closedOrders,
    items: (items ?? []) as MenuPreferenceOrderItem[],
    categoryByMenuItemId,
    complaintTexts: ((complaintNotes ?? []) as Array<{ body?: string | null }>).flatMap((note) => note.body ? [note.body] : []),
  })
  const previousStage = (guest as { lifecycle_stage: GuestLifecycleStage }).lifecycle_stage
  const now = new Date().toISOString()
  const smartTags = calculateGuestSmartTags({
    summary,
    birthday: (guest as { birthday?: string | null }).birthday,
    hasUnresolvedComplaint: (complaintNotes ?? []).length > 0,
  })
  const suppressedSlugs = suppressedAutoTagSlugs((guest as { metadata?: Record<string, unknown> | null }).metadata)
  const activeSmartTags = smartTags.filter((tag) => !suppressedSlugs.has(tag.slug))
  const metadata = {
    ...(((guest as { metadata?: Record<string, unknown> | null }).metadata) ?? {}),
    crm_intelligence: {
      calculated_at: now,
      visit_frequency_days: summary.visit_frequency_days,
      discounted_order_ratio: summary.discounted_order_ratio,
      favorite_items: summary.favorite_items,
      favorite_categories: summary.favorite_categories,
      channel_preference: summary.channel_preference,
      location_preference: summary.location_preference,
      lifecycle_explanation: summary.lifecycle_explanation,
      source: 'closed_checks',
      deterministic: true,
    },
    crm_menu_preferences: {
      calculated_at: now,
      ...menuPreferences,
    },
    crm_auto_tags: {
      ...(((guest as { metadata?: { crm_auto_tags?: Record<string, unknown> } | null }).metadata)?.crm_auto_tags ?? {}),
      calculated_at: now,
      source: 'closed_checks',
      applied_slugs: activeSmartTags.map((tag) => tag.slug),
      suppressed_slugs: Array.from(suppressedSlugs),
      explanations: Object.fromEntries(activeSmartTags.map((tag) => [tag.slug, tag.reason])),
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

  await applyGuestSmartTags({
    db,
    user: input.user,
    guestId: input.guestId,
    locationId: (guest as { location_id: string | null }).location_id,
    suggestions: activeSmartTags,
    now,
  })

  await upsertGuestMenuPreferences({
    db,
    user: input.user,
    guestId: input.guestId,
    locationId: (guest as { location_id: string | null }).location_id,
    graph: menuPreferences,
    now,
  })

  await audit.record({
    actor: input.user,
    action: 'crm_guest_intelligence_recalculated',
    entity_type: 'guest',
    entity_id: input.guestId,
    before_state: { lifecycle_stage: previousStage },
    after_state: { ...summary, auto_tags: activeSmartTags, menu_preferences: menuPreferences } as unknown as Record<string, unknown>,
    description: 'Recalculated CRM guest intelligence from closed checks',
    request: input.request,
    location_id: (guest as { location_id: string | null }).location_id,
  })

  return { data: { guest: updated, intelligence: summary, auto_tags: activeSmartTags, menu_preferences: menuPreferences, lifecycle_changed: previousStage !== summary.lifecycle_stage } }
}

async function upsertGuestMenuPreferences(input: {
  db: DbClient
  user: Pick<AuthUser, 'id' | 'email' | 'org_id' | 'role'>
  guestId: string
  locationId: string | null
  graph: GuestMenuPreferenceGraph
  now: string
}) {
  const rows = [
    ...input.graph.item_preferences.slice(0, 5).map((signal) => ({
      preference_key: `item:${signal.label}`,
      confidence: signal.confidence,
      last_observed_at: signal.last_observed_at,
      preference_value: {
        type: 'item',
        label: signal.label,
        menu_item_id: signal.menu_item_id,
        source_count: signal.source_count,
        quantity: signal.quantity,
        repeat_rate: signal.repeat_rate,
        reason: signal.reason,
        source_order_ids: signal.source_order_ids,
        model_inference: false,
      },
    })),
    ...input.graph.category_preferences.slice(0, 3).map((signal) => ({
      preference_key: `category:${signal.label}`,
      confidence: signal.confidence,
      last_observed_at: signal.last_observed_at,
      preference_value: {
        type: 'category',
        label: signal.label,
        source_count: signal.source_count,
        quantity: signal.quantity,
        repeat_rate: signal.repeat_rate,
        reason: signal.reason,
        source_order_ids: signal.source_order_ids,
        model_inference: false,
      },
    })),
    ...input.graph.modifier_preferences.slice(0, 3).map((signal) => ({
      preference_key: `modifier:${signal.label}`,
      confidence: signal.confidence,
      last_observed_at: signal.last_observed_at,
      preference_value: {
        type: 'modifier',
        label: signal.label,
        source_count: signal.source_count,
        quantity: signal.quantity,
        reason: signal.reason,
        source_order_ids: signal.source_order_ids,
        model_inference: false,
      },
    })),
    ...input.graph.daypart_preferences.slice(0, 2).map((signal) => ({
      preference_key: `daypart:${signal.label}`,
      confidence: signal.confidence,
      last_observed_at: signal.last_observed_at,
      preference_value: {
        type: 'daypart',
        label: signal.label,
        source_count: signal.source_count,
        visit_share: signal.visit_share,
        reason: signal.reason,
        source_order_ids: signal.source_order_ids,
        model_inference: false,
      },
    })),
  ]

  if (rows.length === 0) return

  const keys = rows.map((row) => row.preference_key)
  const { data: existingRows } = await input.db
    .from('guest_preferences')
    .select('id, preference_key')
    .eq('org_id', input.user.org_id)
    .eq('guest_id', input.guestId)
    .eq('preference_category', 'menu')
    .in('preference_key', keys)
    .is('deleted_at', null)

  const existingIdByKey = new Map(((existingRows ?? []) as Array<{ id: string; preference_key: string }>).map((row) => [row.preference_key, row.id]))
  const inserts = rows.flatMap((row) => existingIdByKey.has(row.preference_key) ? [] : [{
    org_id: input.user.org_id,
    location_id: input.locationId,
    guest_id: input.guestId,
    preference_category: 'menu',
    preference_key: row.preference_key,
    preference_value: row.preference_value,
    confidence: row.confidence,
    source: 'closed_checks',
    last_observed_at: row.last_observed_at,
    metadata: {
      source: 'crm_menu_preference_graph',
      calculated_at: input.now,
      source_backed: true,
      model_inference: false,
    },
  }])

  for (const row of rows) {
    const existingId = existingIdByKey.get(row.preference_key)
    if (!existingId) continue
    await input.db
      .from('guest_preferences')
      .update({
        preference_value: row.preference_value,
        confidence: row.confidence,
        source: 'closed_checks',
        last_observed_at: row.last_observed_at,
        updated_at: input.now,
        metadata: {
          source: 'crm_menu_preference_graph',
          calculated_at: input.now,
          source_backed: true,
          model_inference: false,
        },
      })
      .eq('org_id', input.user.org_id)
      .eq('id', existingId)
  }

  if (inserts.length > 0) {
    await input.db.from('guest_preferences').insert(inserts)
  }
}

async function applyGuestSmartTags(input: {
  db: DbClient
  user: Pick<AuthUser, 'id' | 'email' | 'org_id' | 'role'>
  guestId: string
  locationId: string | null
  suggestions: GuestSmartTagSuggestion[]
  now: string
}) {
  const slugs = input.suggestions.map((tag) => tag.slug)
  const desiredSlugs = new Set(slugs)

  const { data: existingTags } = await input.db
    .from('crm_tags')
    .select('id, slug')
    .eq('org_id', input.user.org_id)
    .in('slug', [...SMART_TAG_SLUGS])
    .is('deleted_at', null)

  const tagIdBySlug = new Map(((existingTags ?? []) as Array<{ id: string; slug: string }>).map((tag) => [tag.slug, tag.id]))
  for (const suggestion of input.suggestions) {
    if (tagIdBySlug.has(suggestion.slug)) continue
    const { data: created } = await input.db
      .from('crm_tags')
      .insert({
        org_id: input.user.org_id,
        location_id: input.locationId,
        name: suggestion.name,
        slug: suggestion.slug,
        description: suggestion.reason,
        tag_category: suggestion.tag_category,
        is_system: true,
        is_sensitive: suggestion.is_sensitive,
        metadata: { auto_tag_rule: suggestion.slug, source: suggestion.source },
      })
      .select('id, slug')
      .single()
    if (created) tagIdBySlug.set((created as { slug: string }).slug, (created as { id: string }).id)
  }

  const tagIds = Array.from(tagIdBySlug.values())
  if (tagIds.length === 0) return
  const { data: existingAssignments } = await input.db
    .from('guest_tags')
    .select('id, tag_id, assignment_source, metadata')
    .eq('org_id', input.user.org_id)
    .eq('guest_id', input.guestId)
    .in('tag_id', tagIds)
    .is('deleted_at', null)

  const slugByTagId = new Map(Array.from(tagIdBySlug.entries()).map(([slug, id]) => [id, slug]))
  const typedAssignments = (existingAssignments ?? []) as Array<{ id: string; tag_id: string; assignment_source?: string | null }>
  const staleAutoAssignmentIds = typedAssignments.flatMap((assignment) => {
    const slug = slugByTagId.get(assignment.tag_id)
    if (!slug || desiredSlugs.has(slug) || assignment.assignment_source !== 'auto_rule') return []
    return [assignment.id]
  })
  if (staleAutoAssignmentIds.length > 0) {
    await input.db
      .from('guest_tags')
      .update({ deleted_at: input.now })
      .eq('org_id', input.user.org_id)
      .in('id', staleAutoAssignmentIds)
  }

  const activeAssignmentByTagId = new Map(typedAssignments.map((assignment) => [assignment.tag_id, assignment]))
  const assignments = input.suggestions.flatMap((suggestion) => {
    const tagId = tagIdBySlug.get(suggestion.slug)
    if (!tagId || activeAssignmentByTagId.has(tagId)) return []
    return [{
      org_id: input.user.org_id,
      location_id: input.locationId,
      guest_id: input.guestId,
      tag_id: tagId,
      assigned_by_user_id: input.user.id,
      assignment_source: 'auto_rule',
      assignment_reason: suggestion.reason,
      confidence: suggestion.confidence,
      metadata: {
        auto_tag_rule: suggestion.slug,
        auto_tag_source: suggestion.source,
        auto_tag_run_at: input.now,
        manual_override_supported: true,
      },
    }]
  })

  if (assignments.length > 0) {
    await input.db.from('guest_tags').insert(assignments)
  }
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
