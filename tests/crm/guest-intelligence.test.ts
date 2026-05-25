import { describe, expect, it } from 'vitest'
import { calculateGuestIntelligence, calculateGuestSmartTags, type GuestLifecycleStage } from '@/lib/crm/intelligence'
import { calculateGuestMenuPreferenceGraph } from '@/lib/crm/menu-preferences'

function order(overrides: {
  id: string
  total: number
  closed_at: string
  order_type?: string
  location_id?: string
  discount_total?: number
}) {
  return {
    id: overrides.id,
    total: overrides.total,
    closed_at: overrides.closed_at,
    created_at: overrides.closed_at,
    order_type: overrides.order_type ?? 'dine_in',
    location_id: overrides.location_id ?? '00000000-0000-0000-0000-000000000001',
    discount_total: overrides.discount_total ?? 0,
  }
}

describe('CRM guest intelligence', () => {
  it('calculates deterministic visit and preference metrics from closed checks', () => {
    const categoryByMenuItemId = new Map([
      ['00000000-0000-0000-0000-000000000101', 'Entrees'],
      ['00000000-0000-0000-0000-000000000102', 'Wine'],
    ])
    const summary = calculateGuestIntelligence({
      previousStage: 'unknown',
      now: new Date('2026-05-25T12:00:00.000Z'),
      categoryByMenuItemId,
      orders: [
        order({ id: '00000000-0000-0000-0000-000000000201', total: 42, closed_at: '2026-05-01T12:00:00.000Z' }),
        order({ id: '00000000-0000-0000-0000-000000000202', total: 58, closed_at: '2026-05-11T12:00:00.000Z', order_type: 'takeout' }),
        order({ id: '00000000-0000-0000-0000-000000000203', total: 100, closed_at: '2026-05-21T12:00:00.000Z' }),
      ],
      items: [
        { order_id: '00000000-0000-0000-0000-000000000201', menu_item_id: '00000000-0000-0000-0000-000000000101', name: 'Ribeye', quantity: 1, line_total: 36 },
        { order_id: '00000000-0000-0000-0000-000000000202', menu_item_id: '00000000-0000-0000-0000-000000000102', name: 'Cabernet', quantity: 2, line_total: 24 },
        { order_id: '00000000-0000-0000-0000-000000000203', menu_item_id: '00000000-0000-0000-0000-000000000101', name: 'Ribeye', quantity: 2, line_total: 72 },
      ],
    })

    expect(summary.total_visits).toBe(3)
    expect(summary.total_spend).toBe(200)
    expect(summary.average_check).toBe(66.67)
    expect(summary.visit_frequency_days).toBe(10)
    expect(summary.favorite_items[0]).toMatchObject({ name: 'Ribeye', quantity: 3, revenue: 108, order_count: 2 })
    expect(summary.favorite_categories[0]).toMatchObject({ name: 'Entrees', quantity: 3, revenue: 108, order_count: 2 })
    expect(summary.channel_preference).toBe('dine_in')
    expect(summary.lifecycle_stage).toBe('emerging_regular')
    expect(summary.lifecycle_explanation).toContain('3-4 closed checks')
  })

  it.each([
    { previous: 'unknown' as GuestLifecycleStage, visits: 1, expected: 'first_time' },
    { previous: 'unknown' as GuestLifecycleStage, visits: 2, expected: 'second_time' },
    { previous: 'unknown' as GuestLifecycleStage, visits: 5, expected: 'regular' },
    { previous: 'unknown' as GuestLifecycleStage, visits: 10, expected: 'vip' },
    { previous: 'do_not_contact' as GuestLifecycleStage, visits: 10, expected: 'do_not_contact' },
  ])('explains lifecycle transition for $expected', ({ previous, visits, expected }) => {
    const orders = Array.from({ length: visits }, (_, index) => order({
      id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
      total: 25,
      closed_at: `2026-05-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
    }))

    const summary = calculateGuestIntelligence({
      previousStage: previous,
      now: new Date('2026-05-25T12:00:00.000Z'),
      orders,
      items: [],
    })

    expect(summary.lifecycle_stage).toBe(expected)
    expect(summary.lifecycle_explanation.length).toBeGreaterThan(10)
  })

  it('derives source-backed smart tags with explanations from intelligence', () => {
    const summary = calculateGuestIntelligence({
      previousStage: 'unknown',
      now: new Date('2026-05-25T12:00:00.000Z'),
      categoryByMenuItemId: new Map([
        ['00000000-0000-0000-0000-000000000102', 'Wine'],
      ]),
      orders: [
        order({ id: '00000000-0000-0000-0000-000000000301', total: 250, closed_at: '2026-05-01T12:00:00.000Z', order_type: 'delivery', discount_total: 10 }),
        order({ id: '00000000-0000-0000-0000-000000000302', total: 250, closed_at: '2026-05-02T12:00:00.000Z', order_type: 'delivery', discount_total: 5 }),
        order({ id: '00000000-0000-0000-0000-000000000303', total: 250, closed_at: '2026-05-03T12:00:00.000Z', order_type: 'delivery' }),
        order({ id: '00000000-0000-0000-0000-000000000304', total: 250, closed_at: '2026-05-04T12:00:00.000Z', order_type: 'delivery' }),
      ],
      items: [
        { order_id: '00000000-0000-0000-0000-000000000301', menu_item_id: '00000000-0000-0000-0000-000000000102', name: 'Cabernet', quantity: 2, line_total: 48 },
      ],
    })

    const tags = calculateGuestSmartTags({
      summary,
      birthday: '1990-05-10',
      now: new Date('2026-05-25T12:00:00.000Z'),
    })
    const slugs = tags.map((tag) => tag.slug)

    expect(slugs).toContain('high-ltv')
    expect(slugs).toContain('wine-lover')
    expect(slugs).toContain('delivery-only')
    expect(slugs).toContain('discount-sensitive')
    expect(slugs).toContain('birthday-this-month')
    expect(tags.every((tag) => tag.reason.length > 10)).toBe(true)
  })

  it('builds a source-backed menu preference graph for staff and owner insights', () => {
    const ribeyeId = '00000000-0000-0000-0000-000000000501'
    const categoryByMenuItemId = new Map([[ribeyeId, 'Steaks']])
    const orders = [
      order({ id: '00000000-0000-0000-0000-000000000601', total: 48, closed_at: '2026-05-01T18:00:00.000Z' }),
      order({ id: '00000000-0000-0000-0000-000000000602', total: 52, closed_at: '2026-05-08T18:30:00.000Z' }),
      order({ id: '00000000-0000-0000-0000-000000000603', total: 54, closed_at: '2026-05-15T19:00:00.000Z' }),
    ]

    const graph = calculateGuestMenuPreferenceGraph({
      orders,
      categoryByMenuItemId,
      complaintTexts: ['Guest said the Ribeye was overcooked last visit.'],
      items: [
        {
          id: '00000000-0000-0000-0000-000000000701',
          order_id: orders[0].id,
          menu_item_id: ribeyeId,
          name: 'Ribeye',
          quantity: 1,
          line_total: 42,
          order_item_modifiers: [{ name: 'Medium rare', quantity: 1 }],
        },
        {
          id: '00000000-0000-0000-0000-000000000702',
          order_id: orders[1].id,
          menu_item_id: ribeyeId,
          name: 'Ribeye',
          quantity: 1,
          line_total: 44,
          order_item_modifiers: [{ name: 'Medium rare', quantity: 1 }],
        },
        {
          id: '00000000-0000-0000-0000-000000000703',
          order_id: orders[2].id,
          menu_item_id: ribeyeId,
          name: 'Ribeye',
          quantity: 1,
          line_total: 46,
          order_item_modifiers: [{ name: 'Medium rare', quantity: 1 }],
        },
      ],
    })

    expect(graph.model_inference).toBe(false)
    expect(graph.item_preferences[0]).toMatchObject({ label: 'Ribeye', source_count: 3, repeat_rate: 1 })
    expect(graph.category_preferences[0]).toMatchObject({ label: 'Steaks', source_count: 3 })
    expect(graph.modifier_preferences[0]).toMatchObject({ label: 'Medium rare', source_count: 3 })
    expect(graph.daypart_preferences[0]).toMatchObject({ daypart: 'dinner', source_count: 3 })
    expect(graph.staff_suggestions[0].body).toContain('closed checks')
    expect(graph.owner_insights.item_to_repeat[0]).toMatchObject({ item: 'Ribeye', repeat_order_count: 3 })
    expect(graph.owner_insights.item_to_complaint[0]).toMatchObject({ item: 'Ribeye', complaint_count: 1 })
  })
})
