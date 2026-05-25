type GuestStage = 'unknown' | 'prospect' | 'first_time' | 'second_time' | 'emerging_regular' | 'regular' | 'vip' | 'lapsed' | 'at_risk' | 'recovered' | 'dormant' | 'do_not_contact'

export type AdvancedIntelligenceGuest = {
  id: string
  display_name: string | null
  lifecycle_stage: GuestStage | string | null
  total_spend: number | string | null
  total_visits: number | string | null
  average_check: number | string | null
  last_visit_at: string | null
  birthday?: string | null
  is_vip?: boolean | null
  metadata?: Record<string, unknown> | null
}

export type AdvancedIntelligenceOrder = {
  id: string
  guest_id: string | null
  total: number | string | null
  discount_total?: number | string | null
  closed_at: string | null
  created_at: string
  metadata?: Record<string, unknown> | null
}

export type AdvancedIntelligenceCampaign = {
  id: string
  name: string
  status?: string | null
  campaign_type?: string | null
  metadata?: Record<string, unknown> | null
}

export type AdvancedIntelligenceAttributionEvent = {
  campaign_id: string
  guest_id?: string | null
  event_type: string
  revenue_amount?: number | string | null
  profit_estimate_amount?: number | string | null
  cost_amount?: number | string | null
  baseline_segment?: string | null
  excluded_from_roi?: boolean | null
  metadata?: Record<string, unknown> | null
}

export type ContactRecommendation = {
  guest_id: string
  guest_name: string
  priority: 'critical' | 'high' | 'medium'
  recommendation_type: 'save_the_guest' | 'vip_risk_alert' | 'churn_prediction' | 'ltv_growth' | 'no_show_risk' | 'offer_recommendation'
  recommended_action: string
  why: string
  expected_impact: {
    revenue_at_risk: number
    expected_revenue: number
    margin_protection: number
  }
  confidence: number
  source_citations: string[]
}

export type CampaignPredictionComparison = {
  campaign_id: string
  campaign_name: string
  predicted: {
    revenue: number
    profit: number
    orders: number
  }
  actual: {
    revenue: number
    profit: number
    orders: number
  }
  variance_percent: number
  control_group_lift_percent: number | null
  ab_test_winner: string | null
  source_citations: string[]
}

export type DiscountWarning = {
  guest_id: string
  guest_name: string
  severity: 'block' | 'warn'
  warning: string
  protected_margin: number
  recommended_offer: string
  source_citations: string[]
}

export type AdvancedIntelligenceResult = {
  generated_at: string
  model_inference: false
  recommendations: ContactRecommendation[]
  campaign_simulator: CampaignPredictionComparison[]
  discount_warnings: DiscountWarning[]
  control_groups: Array<{ campaign_id: string; holdout_percent: number; reason: string }>
  relationship_graph: Array<{ guest_id: string; related_guest_ids: string[]; reason: string; confidence: number }>
}

function asNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function money(value: number): number {
  return Math.round(value * 100) / 100
}

function daysSince(value: string | null | undefined, now: Date): number | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.round((now.getTime() - date.getTime()) / 86_400_000))
}

function guestName(guest: AdvancedIntelligenceGuest): string {
  return guest.display_name?.trim() || 'Guest'
}

function metadataRecord(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const nested = (value as Record<string, unknown>)[key]
  return nested && typeof nested === 'object' && !Array.isArray(nested) ? nested as Record<string, unknown> : null
}

function metadataString(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = (value as Record<string, unknown>)[key]
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

function metadataNumber(value: unknown, key: string): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = (value as Record<string, unknown>)[key]
  const parsed = asNumber(raw as number | string | null | undefined)
  return parsed > 0 ? parsed : null
}

function metadataArray(value: unknown, key: string): Array<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  const raw = (value as Record<string, unknown>)[key]
  return Array.isArray(raw) ? raw.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : []
}

function stageRisk(stage: string | null | undefined): number {
  if (stage === 'at_risk') return 0.92
  if (stage === 'lapsed') return 0.78
  if (stage === 'dormant') return 0.66
  if (stage === 'vip') return 0.48
  if (stage === 'regular') return 0.34
  return 0.2
}

function discountRatio(guestId: string, orders: AdvancedIntelligenceOrder[]): number {
  const guestOrders = orders.filter((order) => order.guest_id === guestId)
  if (!guestOrders.length) return 0
  const discounted = guestOrders.filter((order) => asNumber(order.discount_total) > 0).length
  return money(discounted / guestOrders.length)
}

function birthdayThisMonth(birthday: string | null | undefined, now: Date): boolean {
  return Boolean(birthday && birthday.slice(5, 7) === String(now.getUTCMonth() + 1).padStart(2, '0'))
}

function topMenuAffinity(guest: AdvancedIntelligenceGuest): string | null {
  const preferences = metadataRecord(guest.metadata, 'crm_menu_preferences')
  const items = metadataArray(preferences, 'item_preferences')
  const item = items.find((entry) => typeof entry.label === 'string')
  return typeof item?.label === 'string' ? item.label : null
}

function addRecommendation(
  output: ContactRecommendation[],
  guest: AdvancedIntelligenceGuest,
  recommendation: Omit<ContactRecommendation, 'guest_id' | 'guest_name'>,
) {
  output.push({
    guest_id: guest.id,
    guest_name: guestName(guest),
    ...recommendation,
  })
}

function buildRecommendations(input: {
  guests: AdvancedIntelligenceGuest[]
  orders: AdvancedIntelligenceOrder[]
  now: Date
}): ContactRecommendation[] {
  const recommendations: ContactRecommendation[] = []

  for (const guest of input.guests) {
    const visits = asNumber(guest.total_visits)
    const spend = asNumber(guest.total_spend)
    const averageCheck = asNumber(guest.average_check) || (visits ? spend / visits : 0)
    const days = daysSince(guest.last_visit_at, input.now)
    const risk = stageRisk(guest.lifecycle_stage)
    const revenueAtRisk = money(Math.max(averageCheck, spend * 0.12))
    const citations = ['guests.lifecycle_stage', 'guests.total_spend', 'orders.closed_at']

    if ((guest.lifecycle_stage === 'at_risk' || guest.lifecycle_stage === 'lapsed') && spend >= 150) {
      addRecommendation(recommendations, guest, {
        priority: spend >= 1000 ? 'critical' : 'high',
        recommendation_type: 'save_the_guest',
        recommended_action: 'Manager should contact the guest with a hospitality-first recovery invite before any discount.',
        why: `${guestName(guest)} is ${String(guest.lifecycle_stage).replaceAll('_', ' ')} with $${money(spend)} lifetime spend${days === null ? '' : ` and ${days} days since last visit`}.`,
        expected_impact: { revenue_at_risk: revenueAtRisk, expected_revenue: money(revenueAtRisk * risk), margin_protection: money(averageCheck * 0.15) },
        confidence: money(Math.min(0.94, 0.55 + visits * 0.03 + risk * 0.25)),
        source_citations: citations,
      })
    }

    if (guest.lifecycle_stage === 'lapsed' && spend < 150 && visits >= 2) {
      addRecommendation(recommendations, guest, {
        priority: 'medium',
        recommendation_type: 'churn_prediction',
        recommended_action: 'Place in a low-cost win-back audience before paid acquisition spend.',
        why: `${guestName(guest)} has churn signals from lapsed lifecycle status and ${visits} prior visits.`,
        expected_impact: { revenue_at_risk: revenueAtRisk, expected_revenue: money(Math.max(averageCheck, 30) * 0.6), margin_protection: money(Math.max(averageCheck, 30) * 0.1) },
        confidence: money(Math.min(0.82, 0.45 + visits * 0.04)),
        source_citations: ['guests.lifecycle_stage', 'guests.total_visits'],
      })
    }

    if ((guest.is_vip || guest.lifecycle_stage === 'vip') && days !== null && days >= 30) {
      addRecommendation(recommendations, guest, {
        priority: days >= 60 ? 'critical' : 'high',
        recommendation_type: 'vip_risk_alert',
        recommended_action: 'Queue a VIP host check-in with recognition language and preferred-menu context.',
        why: `${guestName(guest)} is a VIP with no linked visit in ${days} days.`,
        expected_impact: { revenue_at_risk: revenueAtRisk, expected_revenue: money(averageCheck * 1.4), margin_protection: money(averageCheck * 0.2) },
        confidence: money(Math.min(0.9, 0.52 + days / 180 + visits * 0.01)),
        source_citations: ['guests.is_vip', 'guests.last_visit_at', 'guests.average_check'],
      })
    }

    if (['regular', 'vip'].includes(String(guest.lifecycle_stage)) && averageCheck >= 75 && days !== null && days <= 45) {
      const affinity = topMenuAffinity(guest)
      addRecommendation(recommendations, guest, {
        priority: 'medium',
        recommendation_type: 'ltv_growth',
        recommended_action: affinity ? `Invite the guest back around ${affinity} instead of a generic offer.` : 'Invite the guest back with a premium experience offer instead of a generic discount.',
        why: `${guestName(guest)} has LTV growth potential from ${visits} visits and a $${money(averageCheck)} average check.`,
        expected_impact: { revenue_at_risk: 0, expected_revenue: money(averageCheck * 1.15), margin_protection: money(averageCheck * 0.18) },
        confidence: money(Math.min(0.86, 0.5 + visits * 0.025)),
        source_citations: affinity ? ['guests.average_check', 'guests.metadata.crm_menu_preferences'] : ['guests.average_check', 'guests.total_visits'],
      })
    }

    const noShowCount = metadataNumber(guest.metadata, 'no_show_count') ?? metadataNumber(guest.metadata, 'reservation_no_show_count') ?? 0
    if (noShowCount > 0 && ['vip', 'regular', 'at_risk'].includes(String(guest.lifecycle_stage))) {
      addRecommendation(recommendations, guest, {
        priority: noShowCount >= 2 ? 'high' : 'medium',
        recommendation_type: 'no_show_risk',
        recommended_action: 'Use confirmation-first reservation outreach and avoid pre-visit discounts.',
        why: `${guestName(guest)} has ${noShowCount} no-show signal${noShowCount === 1 ? '' : 's'} and enough relationship value to warrant direct confirmation.`,
        expected_impact: { revenue_at_risk: money(averageCheck * noShowCount), expected_revenue: money(averageCheck * 0.8), margin_protection: money(averageCheck * 0.15) },
        confidence: money(Math.min(0.86, 0.52 + noShowCount * 0.12)),
        source_citations: ['guests.metadata.no_show_count', 'guests.average_check'],
      })
    }

    if (birthdayThisMonth(guest.birthday, input.now)) {
      addRecommendation(recommendations, guest, {
        priority: 'medium',
        recommendation_type: 'offer_recommendation',
        recommended_action: 'Send a birthday hospitality invite with dessert or chef note, not a percent discount.',
        why: `${guestName(guest)} has a birthday this month and can be contacted with margin-safe recognition.`,
        expected_impact: { revenue_at_risk: 0, expected_revenue: money(Math.max(averageCheck, 35)), margin_protection: money(Math.max(averageCheck, 35) * 0.15) },
        confidence: 0.72,
        source_citations: ['guests.birthday', 'restaurant_memory.discount_policy'],
      })
    }
  }

  return recommendations
    .sort((a, b) => b.expected_impact.expected_revenue - a.expected_impact.expected_revenue || b.confidence - a.confidence)
    .slice(0, 25)
}

function buildCampaignComparisons(input: {
  campaigns: AdvancedIntelligenceCampaign[]
  attributionEvents: AdvancedIntelligenceAttributionEvent[]
}): CampaignPredictionComparison[] {
  return input.campaigns.map((campaign) => {
    const metadata = campaign.metadata ?? {}
    const prediction = metadataRecord(metadata, 'advanced_intelligence_prediction')
    const events = input.attributionEvents.filter((event) => event.campaign_id === campaign.id)
    const actualRevenue = events.reduce((sum, event) => sum + (event.excluded_from_roi ? 0 : asNumber(event.revenue_amount)), 0)
    const actualProfit = events.reduce((sum, event) => sum + (event.excluded_from_roi ? 0 : asNumber(event.profit_estimate_amount)), 0)
    const actualOrders = events.filter((event) => ['order', 'revenue', 'redeemed'].includes(event.event_type)).length
    const predictedRevenue = metadataNumber(prediction, 'revenue') ?? Math.max(actualRevenue * 1.08, actualOrders * 42)
    const predictedProfit = metadataNumber(prediction, 'profit') ?? money(predictedRevenue * 0.32)
    const predictedOrders = metadataNumber(prediction, 'orders') ?? Math.max(actualOrders, Math.ceil(predictedRevenue / 55))
    const controlRevenue = events
      .filter((event) => event.baseline_segment === 'would_have_visited' || metadataString(event.metadata, 'group') === 'control')
      .reduce((sum, event) => sum + asNumber(event.revenue_amount), 0)
    const treatmentRevenue = Math.max(0, actualRevenue - controlRevenue)
    const abWinner = metadataString(metadataRecord(metadata, 'ab_test'), 'winner')

    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      predicted: { revenue: money(predictedRevenue), profit: money(predictedProfit), orders: Math.round(predictedOrders) },
      actual: { revenue: money(actualRevenue), profit: money(actualProfit), orders: actualOrders },
      variance_percent: money(predictedRevenue ? ((actualRevenue - predictedRevenue) / predictedRevenue) * 100 : 0),
      control_group_lift_percent: controlRevenue > 0 ? money((treatmentRevenue / controlRevenue) * 100) : null,
      ab_test_winner: abWinner,
      source_citations: ['crm_campaigns.metadata.advanced_intelligence_prediction', 'crm_attribution_events.revenue_amount', 'crm_attribution_events.baseline_segment'],
    }
  }).filter((comparison) => comparison.actual.revenue > 0 || comparison.predicted.revenue > 0)
}

function buildDiscountWarnings(input: {
  guests: AdvancedIntelligenceGuest[]
  orders: AdvancedIntelligenceOrder[]
  proposedDiscountPercent: number
}): DiscountWarning[] {
  return input.guests.flatMap((guest) => {
    const visits = asNumber(guest.total_visits)
    const averageCheck = asNumber(guest.average_check)
    const ratio = discountRatio(guest.id, input.orders)
    const isRegular = ['regular', 'vip'].includes(String(guest.lifecycle_stage)) || visits >= 5
    if (!isRegular || ratio > 0.2 || input.proposedDiscountPercent <= 0) return []

    const protectedMargin = money(averageCheck * (input.proposedDiscountPercent / 100))
    return [{
      guest_id: guest.id,
      guest_name: guestName(guest),
      severity: input.proposedDiscountPercent >= 20 ? 'block' as const : 'warn' as const,
      warning: `${guestName(guest)} is a ${String(guest.lifecycle_stage).replaceAll('_', ' ')} with low discount sensitivity; protect margin before offering ${input.proposedDiscountPercent}%.`,
      protected_margin: protectedMargin,
      recommended_offer: 'Use recognition, priority reservation, chef note, dessert, or menu-affinity invite before a percent discount.',
      source_citations: ['guests.lifecycle_stage', 'guests.average_check', 'orders.discount_total'],
    }]
  }).sort((a, b) => b.protected_margin - a.protected_margin)
}

function buildRelationshipGraph(guests: AdvancedIntelligenceGuest[]): AdvancedIntelligenceResult['relationship_graph'] {
  const household = new Map<string, string[]>()
  for (const guest of guests) {
    const key = metadataString(guest.metadata, 'household_key')
    if (!key) continue
    household.set(key, [...(household.get(key) ?? []), guest.id])
  }
  return Array.from(household.values()).flatMap((ids) => {
    if (ids.length < 2) return []
    return ids.map((guest_id) => ({
      guest_id,
      related_guest_ids: ids.filter((id) => id !== guest_id),
      reason: 'Shared household key from CRM identity metadata.',
      confidence: 0.82,
    }))
  })
}

export function calculateCrmAdvancedIntelligence(input: {
  guests: AdvancedIntelligenceGuest[]
  orders?: AdvancedIntelligenceOrder[]
  campaigns?: AdvancedIntelligenceCampaign[]
  attributionEvents?: AdvancedIntelligenceAttributionEvent[]
  proposedDiscountPercent?: number
  now?: Date
}): AdvancedIntelligenceResult {
  const now = input.now ?? new Date()
  const campaigns = input.campaigns ?? []
  return {
    generated_at: now.toISOString(),
    model_inference: false,
    recommendations: buildRecommendations({ guests: input.guests, orders: input.orders ?? [], now }),
    campaign_simulator: buildCampaignComparisons({ campaigns, attributionEvents: input.attributionEvents ?? [] }),
    discount_warnings: buildDiscountWarnings({
      guests: input.guests,
      orders: input.orders ?? [],
      proposedDiscountPercent: input.proposedDiscountPercent ?? 15,
    }),
    control_groups: campaigns.map((campaign) => ({
      campaign_id: campaign.id,
      holdout_percent: metadataNumber(campaign.metadata, 'control_group_percent') ?? 10,
      reason: 'Hold out a measurable audience before send so predicted lift can be compared with actual campaign results.',
    })),
    relationship_graph: buildRelationshipGraph(input.guests),
  }
}
