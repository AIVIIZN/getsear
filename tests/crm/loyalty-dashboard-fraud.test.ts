import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8')
}

describe('CRM-V4.3 loyalty dashboard and fraud protection', () => {
  it('ships a CRM-native loyalty dashboard route backed by CRM tables', () => {
    const route = read('src/app/api/crm/loyalty/dashboard/route.ts')
    const dashboard = read('src/components/loyalty/LoyaltyDashboard.tsx')

    expect(route).toContain("from('crm_loyalty_accounts')")
    expect(route).toContain("from('crm_points_ledger')")
    expect(route).toContain("from('crm_reward_redemptions')")
    expect(route).toContain('check_comparison')
    expect(route).toContain('top_rewards')
    expect(route).toContain('requireRole(user, [...crmLoyaltyManageRoles,')
    expect(dashboard).toContain('/api/crm/loyalty/dashboard?days=30')
    expect(dashboard).toContain('CRM loyalty performance')
    expect(dashboard).toContain('Reward liability')
    expect(dashboard).toContain('Top rewards')
  })

  it('creates persistent review items for suspicious activity without automatic punishment', () => {
    const migration = read('supabase/migrations/20260525170500_add_crm_loyalty_review_items.sql')
    const rollback = read('supabase/_rollbacks/20260525170500_add_crm_loyalty_review_items.rollback.sql')
    const fraudLib = read('src/lib/crm/loyalty-fraud.ts')
    const fraudRoute = read('src/app/api/crm/loyalty/fraud/route.ts')
    const dashboard = read('src/components/loyalty/LoyaltyDashboard.tsx')

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.crm_loyalty_review_items')
    expect(migration).toContain("status text NOT NULL DEFAULT 'open'")
    expect(migration).toContain('crm_loyalty_review_items_source_unique')
    expect(migration).toContain('ALTER TABLE public.crm_loyalty_review_items ENABLE ROW LEVEL SECURITY')
    expect(rollback).toContain('DROP TABLE IF EXISTS public.crm_loyalty_review_items')
    expect(fraudLib).toContain('staff_redemption_velocity')
    expect(fraudLib).toContain('manual_adjustment')
    expect(fraudLib).toContain('shared_phone_cluster')
    expect(fraudLib).toContain('refund_reward_loop')
    expect(fraudLib).toContain('comp_reward_stacking')
    expect(fraudLib).toContain("status: 'open'")
    expect(fraudRoute).toContain("action: 'crm_loyalty_review_item_updated'")
    expect(dashboard).toContain('Review')
    expect(dashboard).toContain('Resolve')
    expect(dashboard).toContain('without automatic punishment')
    expect(fraudLib).not.toContain("status: 'paused'")
    expect(fraudLib).not.toContain("status: 'closed'")
  })
})
