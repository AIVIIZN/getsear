import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyRestaurantMemoryToText, defaultRestaurantMemoryRules } from '@/lib/crm/restaurant-memory'
import { restaurantMemoryRuleSchema, upsertRestaurantMemoryRulesSchema } from '@/lib/schemas/crm'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('CRM-V11.4 Restaurant Memory', () => {
  it('ships a tenant-scoped restaurant_memory_rules table with RLS and rollback coverage', () => {
    const migration = read('supabase/migrations/20260525215000_add_restaurant_memory_rules.sql')
    const rollback = read('supabase/_rollbacks/20260525215000_add_restaurant_memory_rules.rollback.sql')

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.restaurant_memory_rules')
    expect(migration).toContain('org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE')
    expect(migration).toContain("category text NOT NULL CHECK")
    expect(migration).toContain("applies_to text[] NOT NULL")
    expect(migration).toContain('ALTER TABLE public.restaurant_memory_rules ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('tenant_select_restaurant_memory_rules')
    expect(migration).toContain('service_role_bypass_restaurant_memory_rules')
    expect(rollback).toContain('DROP TABLE IF EXISTS public.restaurant_memory_rules')
  })

  it('validates editable memory rules and includes the required hospitality defaults', () => {
    const parsed = restaurantMemoryRuleSchema.parse(defaultRestaurantMemoryRules[0])
    const payload = upsertRestaurantMemoryRulesSchema.parse({ rules: defaultRestaurantMemoryRules })

    expect(parsed.rule_key).toBe('no-aggressive-discounts')
    expect(payload.rules).toHaveLength(4)
    expect(payload.rules.map((rule) => rule.rule_key)).toEqual([
      'no-aggressive-discounts',
      'vip-invites-not-coupons',
      'birthday-dessert',
      'wine-guests-event-invites',
    ])
    expect(() => restaurantMemoryRuleSchema.parse({ ...defaultRestaurantMemoryRules[0], rule_text: 'short' })).toThrow()
  })

  it('registers owner-editable settings APIs with audit history', () => {
    const route = read('src/app/api/crm/restaurant-memory/route.ts')
    const audit = read('src/lib/audit/log.ts')
    const settingsPage = read('src/app/(backoffice)/settings/ai/page.tsx')

    expect(route).toContain('upsertRestaurantMemoryRulesSchema.safeParse')
    expect(route).toContain('seedDefaultRestaurantMemoryRules')
    expect(route).toContain("eq('entity_type', 'restaurant_memory_rule')")
    expect(route).toContain("'crm_restaurant_memory_updated'")
    expect(audit).toContain("'crm_restaurant_memory_updated'")
    expect(audit).toContain("'restaurant_memory_rule'")
    expect(settingsPage).toContain('Restaurant Memory')
    expect(settingsPage).toContain('/api/crm/restaurant-memory')
    expect(settingsPage).toContain('Audit History')
  })

  it('feeds active memory into GuestBrain and campaign previews', () => {
    const guestBrain = read('src/lib/crm/guest-brain.ts')
    const aiGateway = read('src/lib/crm/ai-gateway.ts')
    const campaignPreviewRoute = read('src/app/api/crm/campaigns/preview/route.ts')
    const campaignRoute = read('src/app/api/crm/campaigns/route.ts')

    expect(guestBrain).toContain('fetchActiveRestaurantMemoryRules')
    expect(guestBrain).toContain('restaurantMemoryRulesToSource')
    expect(aiGateway).toContain('Restaurant Memory Rules')
    expect(aiGateway).toContain('birthday dessert')
    expect(aiGateway).toContain('wine preference evidence matches Restaurant Memory event-invite guidance')
    expect(campaignPreviewRoute).toContain("appliesTo: 'campaign'")
    expect(campaignRoute).toContain('buildCrmCampaignPreview(parsed.data, segmentPreview.reachability, memoryRules)')

    expect(applyRestaurantMemoryToText('Birthday reward: send a 20% off coupon.', defaultRestaurantMemoryRules).toLowerCase())
      .toContain('birthday dessert')
  })
})
