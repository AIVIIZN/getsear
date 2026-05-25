type ClosedOrder = {
  id: string
  location_id: string | null
  order_type: string | null
  total: number | string | null
  discount_total?: number | string | null
  closed_at: string | null
  created_at: string
}

export type MenuPreferenceOrderItem = {
  id?: string
  order_id: string
  menu_item_id: string | null
  name: string
  quantity: number | null
  line_total: number | string | null
  order_item_modifiers?: Array<{ name: string; quantity: number | null }> | null
}

export type GuestMenuPreferenceSignal = {
  key: string
  label: string
  source_count: number
  confidence: number
  reason: string
  last_observed_at: string | null
  source_order_ids: string[]
}

export type GuestMenuPreferenceGraph = {
  item_preferences: Array<GuestMenuPreferenceSignal & { menu_item_id: string | null; quantity: number; revenue: number; repeat_rate: number }>
  category_preferences: Array<GuestMenuPreferenceSignal & { quantity: number; revenue: number; repeat_rate: number }>
  modifier_preferences: Array<GuestMenuPreferenceSignal & { quantity: number }>
  daypart_preferences: Array<GuestMenuPreferenceSignal & { daypart: string; visit_share: number }>
  staff_suggestions: Array<{ title: string; body: string; confidence: number; source_count: number; source: 'item' | 'category' | 'modifier' | 'daypart' }>
  owner_insights: {
    item_to_repeat: Array<{ item: string; repeat_order_count: number; repeat_rate: number; confidence: number; reason: string }>
    item_to_complaint: Array<{ item: string; complaint_count: number; confidence: number; reason: string }>
  }
  source: 'closed_checks'
  model_inference: false
}

function money(value: number): number {
  return Math.round(value * 100) / 100
}

function asNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return 0
}

function confidenceFromEvidence(sourceCount: number, denominator: number, ceiling = 0.92): number {
  if (sourceCount <= 0 || denominator <= 0) return 0
  const evidenceScore = Math.min(1, sourceCount / 5)
  const shareScore = Math.min(1, sourceCount / denominator)
  return money(Math.min(ceiling, 0.35 + evidenceScore * 0.35 + shareScore * 0.25))
}

function orderMoment(order: ClosedOrder): string {
  return order.closed_at ?? order.created_at
}

function daypartFor(value: string): string {
  const hour = new Date(value).getUTCHours()
  if (hour < 5) return 'late night'
  if (hour < 11) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 17) return 'afternoon'
  if (hour < 22) return 'dinner'
  return 'late night'
}

function compactSourceOrderIds(orderIds: Set<string>): string[] {
  return Array.from(orderIds).sort().slice(0, 12)
}

export function calculateGuestMenuPreferenceGraph(input: {
  orders: ClosedOrder[]
  items: MenuPreferenceOrderItem[]
  categoryByMenuItemId?: Map<string, string>
  complaintTexts?: string[]
}): GuestMenuPreferenceGraph {
  const orders = [...input.orders].sort((a, b) => new Date(orderMoment(a)).getTime() - new Date(orderMoment(b)).getTime())
  const orderById = new Map(orders.map((order) => [order.id, order]))
  const visitCount = Math.max(orders.length, 1)
  const itemCounts = new Map<string, { key: string; label: string; menuItemId: string | null; quantity: number; revenue: number; orderIds: Set<string>; lastObservedAt: string | null }>()
  const categoryCounts = new Map<string, { key: string; label: string; quantity: number; revenue: number; orderIds: Set<string>; lastObservedAt: string | null }>()
  const modifierCounts = new Map<string, { key: string; label: string; quantity: number; orderIds: Set<string>; lastObservedAt: string | null }>()
  const daypartCounts = new Map<string, { key: string; label: string; orderIds: Set<string>; lastObservedAt: string | null }>()

  for (const order of orders) {
    const daypart = daypartFor(orderMoment(order))
    const existing = daypartCounts.get(daypart) ?? { key: daypart, label: daypart, orderIds: new Set<string>(), lastObservedAt: null }
    existing.orderIds.add(order.id)
    existing.lastObservedAt = orderMoment(order)
    daypartCounts.set(daypart, existing)
  }

  for (const item of input.items) {
    const order = orderById.get(item.order_id)
    const observedAt = order ? orderMoment(order) : null
    const quantity = item.quantity ?? 0
    const revenue = asNumber(item.line_total)
    const itemKey = item.menu_item_id ?? item.name.toLowerCase()
    const existingItem = itemCounts.get(itemKey) ?? {
      key: itemKey,
      label: item.name,
      menuItemId: item.menu_item_id,
      quantity: 0,
      revenue: 0,
      orderIds: new Set<string>(),
      lastObservedAt: null,
    }
    existingItem.quantity += quantity
    existingItem.revenue += revenue
    existingItem.orderIds.add(item.order_id)
    existingItem.lastObservedAt = observedAt ?? existingItem.lastObservedAt
    itemCounts.set(itemKey, existingItem)

    const category = item.menu_item_id ? input.categoryByMenuItemId?.get(item.menu_item_id) : null
    if (category) {
      const existingCategory = categoryCounts.get(category) ?? { key: category, label: category, quantity: 0, revenue: 0, orderIds: new Set<string>(), lastObservedAt: null }
      existingCategory.quantity += quantity
      existingCategory.revenue += revenue
      existingCategory.orderIds.add(item.order_id)
      existingCategory.lastObservedAt = observedAt ?? existingCategory.lastObservedAt
      categoryCounts.set(category, existingCategory)
    }

    for (const modifier of item.order_item_modifiers ?? []) {
      const modifierQuantity = modifier.quantity ?? 1
      const existingModifier = modifierCounts.get(modifier.name) ?? { key: modifier.name, label: modifier.name, quantity: 0, orderIds: new Set<string>(), lastObservedAt: null }
      existingModifier.quantity += modifierQuantity
      existingModifier.orderIds.add(item.order_id)
      existingModifier.lastObservedAt = observedAt ?? existingModifier.lastObservedAt
      modifierCounts.set(modifier.name, existingModifier)
    }
  }

  const itemPreferences = Array.from(itemCounts.values())
    .filter((item) => item.orderIds.size >= 2 || item.quantity >= 3)
    .sort((a, b) => b.orderIds.size - a.orderIds.size || b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 8)
    .map((item) => {
      const repeatRate = money(item.orderIds.size / visitCount)
      return {
        key: item.key,
        label: item.label,
        menu_item_id: item.menuItemId,
        quantity: item.quantity,
        revenue: money(item.revenue),
        repeat_rate: repeatRate,
        source_count: item.orderIds.size,
        confidence: confidenceFromEvidence(item.orderIds.size, visitCount),
        reason: `${item.label} appears on ${item.orderIds.size} closed checks (${Math.round(repeatRate * 100)}% of visits).`,
        last_observed_at: item.lastObservedAt,
        source_order_ids: compactSourceOrderIds(item.orderIds),
      }
    })

  const categoryPreferences = Array.from(categoryCounts.values())
    .filter((category) => category.orderIds.size >= 2 || category.quantity >= 3)
    .sort((a, b) => b.orderIds.size - a.orderIds.size || b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 6)
    .map((category) => {
      const repeatRate = money(category.orderIds.size / visitCount)
      return {
        key: category.key,
        label: category.label,
        quantity: category.quantity,
        revenue: money(category.revenue),
        repeat_rate: repeatRate,
        source_count: category.orderIds.size,
        confidence: confidenceFromEvidence(category.orderIds.size, visitCount, 0.88),
        reason: `${category.label} is a repeated category across ${category.orderIds.size} closed checks.`,
        last_observed_at: category.lastObservedAt,
        source_order_ids: compactSourceOrderIds(category.orderIds),
      }
    })

  const modifierPreferences = Array.from(modifierCounts.values())
    .filter((modifier) => modifier.orderIds.size >= 2 || modifier.quantity >= 3)
    .sort((a, b) => b.orderIds.size - a.orderIds.size || b.quantity - a.quantity)
    .slice(0, 6)
    .map((modifier) => ({
      key: modifier.key,
      label: modifier.label,
      quantity: modifier.quantity,
      source_count: modifier.orderIds.size,
      confidence: confidenceFromEvidence(modifier.orderIds.size, visitCount, 0.84),
      reason: `${modifier.label} modifier repeats on ${modifier.orderIds.size} closed checks.`,
      last_observed_at: modifier.lastObservedAt,
      source_order_ids: compactSourceOrderIds(modifier.orderIds),
    }))

  const daypartPreferences = Array.from(daypartCounts.values())
    .filter((daypart) => daypart.orderIds.size >= 2)
    .sort((a, b) => b.orderIds.size - a.orderIds.size)
    .slice(0, 4)
    .map((daypart) => {
      const visitShare = money(daypart.orderIds.size / visitCount)
      return {
        key: daypart.key,
        label: daypart.label,
        daypart: daypart.key,
        visit_share: visitShare,
        source_count: daypart.orderIds.size,
        confidence: confidenceFromEvidence(daypart.orderIds.size, visitCount, 0.82),
        reason: `${Math.round(visitShare * 100)}% of linked visits happen during ${daypart.label}.`,
        last_observed_at: daypart.lastObservedAt,
        source_order_ids: compactSourceOrderIds(daypart.orderIds),
      }
    })

  const staffSuggestions = [
    ...itemPreferences.slice(0, 2).map((item) => ({
      title: `Offer ${item.label}`,
      body: item.reason,
      confidence: item.confidence,
      source_count: item.source_count,
      source: 'item' as const,
    })),
    ...categoryPreferences.slice(0, 1).map((category) => ({
      title: `Mention ${category.label}`,
      body: category.reason,
      confidence: category.confidence,
      source_count: category.source_count,
      source: 'category' as const,
    })),
    ...modifierPreferences.slice(0, 1).map((modifier) => ({
      title: `Remember ${modifier.label}`,
      body: modifier.reason,
      confidence: modifier.confidence,
      source_count: modifier.source_count,
      source: 'modifier' as const,
    })),
    ...daypartPreferences.slice(0, 1).map((daypart) => ({
      title: `${daypart.label} regular`,
      body: daypart.reason,
      confidence: daypart.confidence,
      source_count: daypart.source_count,
      source: 'daypart' as const,
    })),
  ].sort((a, b) => b.confidence - a.confidence).slice(0, 4)

  const complaintTexts = input.complaintTexts ?? []
  const itemToComplaint = itemPreferences.flatMap((item) => {
    const pattern = new RegExp(`\\b${item.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    const complaintCount = complaintTexts.filter((body) => pattern.test(body)).length
    if (complaintCount === 0) return []
    return [{
      item: item.label,
      complaint_count: complaintCount,
      confidence: money(Math.min(0.9, 0.45 + complaintCount * 0.2 + item.confidence * 0.2)),
      reason: `${item.label} is repeated by the guest and appears in ${complaintCount} recovery note${complaintCount === 1 ? '' : 's'}.`,
    }]
  })

  return {
    item_preferences: itemPreferences,
    category_preferences: categoryPreferences,
    modifier_preferences: modifierPreferences,
    daypart_preferences: daypartPreferences,
    staff_suggestions: staffSuggestions,
    owner_insights: {
      item_to_repeat: itemPreferences
        .filter((item) => item.source_count >= 2)
        .slice(0, 6)
        .map((item) => ({
          item: item.label,
          repeat_order_count: item.source_count,
          repeat_rate: item.repeat_rate,
          confidence: item.confidence,
          reason: item.reason,
        })),
      item_to_complaint: itemToComplaint,
    },
    source: 'closed_checks',
    model_inference: false,
  }
}
