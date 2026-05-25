import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { calculateCrmAdvancedIntelligence } from '@/lib/crm/advanced-intelligence'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('CRM-V12.4 advanced intelligence', () => {
  it('recommends who to contact, why, and the expected impact from source data', () => {
    const result = calculateCrmAdvancedIntelligence({
      now: new Date('2026-05-25T12:00:00.000Z'),
      guests: [{
        id: 'guest-1',
        display_name: 'Maya Jones',
        lifecycle_stage: 'at_risk',
        total_spend: 1400,
        total_visits: 12,
        average_check: 82,
        last_visit_at: '2026-03-01T12:00:00.000Z',
        is_vip: true,
        metadata: {
          no_show_count: 2,
          household_key: 'family-1',
          crm_menu_preferences: { item_preferences: [{ label: 'Ribeye' }] },
        },
      }, {
        id: 'guest-family',
        display_name: 'Sam Jones',
        lifecycle_stage: 'regular',
        total_spend: 800,
        total_visits: 8,
        average_check: 88,
        last_visit_at: '2026-05-01T12:00:00.000Z',
        metadata: { household_key: 'family-1' },
      }],
    })

    expect(result.model_inference).toBe(false)
    expect(result.recommendations[0]).toMatchObject({
      guest_id: 'guest-1',
      guest_name: 'Maya Jones',
      priority: 'critical',
      recommendation_type: 'save_the_guest',
    })
    expect(result.recommendations[0]?.why).toContain('at risk')
    expect(result.recommendations[0]?.expected_impact.expected_revenue).toBeGreaterThan(0)
    expect(result.recommendations[0]?.source_citations).toContain('guests.lifecycle_stage')
    expect(result.recommendations.map((item) => item.recommendation_type)).toEqual(expect.arrayContaining(['ltv_growth', 'no_show_risk']))
    expect(result.relationship_graph[0]).toMatchObject({ guest_id: 'guest-1', related_guest_ids: ['guest-family'] })
  })

  it('compares predicted versus actual campaign results with control group and A/B test context', () => {
    const result = calculateCrmAdvancedIntelligence({
      guests: [],
      campaigns: [{
        id: 'campaign-1',
        name: 'Spring VIP win-back',
        metadata: {
          control_group_percent: 12,
          advanced_intelligence_prediction: { revenue: 1000, profit: 360, orders: 20 },
          ab_test: { winner: 'Variant B' },
        },
      }],
      attributionEvents: [
        { campaign_id: 'campaign-1', event_type: 'order', revenue_amount: 700, profit_estimate_amount: 240, baseline_segment: 'high_risk' },
        { campaign_id: 'campaign-1', event_type: 'order', revenue_amount: 200, profit_estimate_amount: 80, baseline_segment: 'would_have_visited' },
      ],
    })

    expect(result.control_groups[0]).toMatchObject({ campaign_id: 'campaign-1', holdout_percent: 12 })
    expect(result.campaign_simulator[0]).toMatchObject({
      campaign_id: 'campaign-1',
      predicted: { revenue: 1000, profit: 360, orders: 20 },
      actual: { revenue: 900, profit: 320, orders: 2 },
      variance_percent: -10,
      ab_test_winner: 'Variant B',
    })
    expect(result.campaign_simulator[0]?.control_group_lift_percent).toBe(350)
  })

  it('warns before discounting non-discount-sensitive regulars to protect margin', () => {
    const result = calculateCrmAdvancedIntelligence({
      proposedDiscountPercent: 20,
      guests: [{
        id: 'guest-2',
        display_name: 'Noah Regular',
        lifecycle_stage: 'regular',
        total_spend: 900,
        total_visits: 9,
        average_check: 100,
        last_visit_at: '2026-05-10T12:00:00.000Z',
      }],
      orders: [
        { id: 'order-1', guest_id: 'guest-2', total: 100, discount_total: 0, closed_at: '2026-05-10T12:00:00.000Z', created_at: '2026-05-10T12:00:00.000Z' },
        { id: 'order-2', guest_id: 'guest-2', total: 120, discount_total: 0, closed_at: '2026-05-17T12:00:00.000Z', created_at: '2026-05-17T12:00:00.000Z' },
      ],
    })

    expect(result.discount_warnings[0]).toMatchObject({
      guest_id: 'guest-2',
      severity: 'block',
      protected_margin: 20,
    })
    expect(result.discount_warnings[0]?.warning).toContain('low discount sensitivity')
    expect(result.discount_warnings[0]?.recommended_offer).toContain('chef note')
  })

  it('registers an authenticated CRM advanced intelligence API with tenant scoping and validation', () => {
    const route = read('src/app/api/crm/advanced-intelligence/route.ts')
    const schemas = read('src/lib/schemas/crm.ts')

    expect(route).toContain('getAuthUser')
    expect(route).toContain('requireRole')
    expect(route).toContain('crmAdvancedIntelligenceQuerySchema.safeParse')
    expect(route).toContain("eq('org_id', user.org_id)")
    expect(route).toContain('calculateCrmAdvancedIntelligence')
    expect(schemas).toContain('proposed_discount_percent')
  })
})
