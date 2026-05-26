import { describe, expect, it } from 'vitest'
import { MENU_SEED_TEMPLATES } from '@/lib/onboarding/menu-templates'
import {
  DEFAULT_ONBOARDING_PROGRESS,
  ONBOARDING_STEPS,
  buildOnboardingSummary,
  markStepComplete,
} from '@/lib/onboarding/state-machine'
import { FIRST_ORDER_TOUR_STEPS } from '@/lib/onboarding/tour'

describe('V8 onboarding contracts', () => {
  it('ships six editable cuisine templates with at least forty priced items and modifiers each', () => {
    expect(MENU_SEED_TEMPLATES).toHaveLength(6)

    for (const template of MENU_SEED_TEMPLATES) {
      expect(template.items.length).toBeGreaterThanOrEqual(40)
      expect(new Set(template.items.map((item) => item.category)).size).toBeGreaterThanOrEqual(5)
      expect(template.items.every((item) => item.price_cents > 0)).toBe(true)
      expect(template.items.every((item) => item.modifiers.length > 0)).toBe(true)
    }
  })

  it('tracks the six-step onboarding wizard and summarizes setup readiness', () => {
    const menu = MENU_SEED_TEMPLATES[0]
    const progress = markStepComplete(DEFAULT_ONBOARDING_PROGRESS, 2, {
      menu_template_id: menu.id,
      menu_items: menu.items,
    })

    expect(ONBOARDING_STEPS.map((step) => step.id)).toEqual([
      'org',
      'location',
      'menu',
      'terminals',
      'first-user',
      'tour',
    ])
    expect(progress.completed_steps).toContain(2)
    expect(buildOnboardingSummary(progress)).toMatchObject({
      menu_items: 40,
      menu_categories: 5,
      terminals: 2,
    })
  })

  it('defines the replayable eight-step first-order tour', () => {
    expect(FIRST_ORDER_TOUR_STEPS).toHaveLength(8)
    expect(FIRST_ORDER_TOUR_STEPS.map((step) => step.id)).toContain('replay-anytime')
  })
})
