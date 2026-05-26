import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type BillingTier = 'trial' | 'starter' | 'pro' | 'enterprise'

export interface BillingFeature {
  key: string
  label: string
  minimumTier: BillingTier
}

const tierRank: Record<BillingTier, number> = {
  trial: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
}

export const billingFeatures = {
  ai: { key: 'ai', label: 'AI Intelligence', minimumTier: 'pro' },
  multiLocation: { key: 'multi_location', label: 'Multi-location controls', minimumTier: 'pro' },
  advancedReports: { key: 'advanced_reports', label: 'Advanced reports', minimumTier: 'pro' },
  enterpriseSso: { key: 'enterprise_sso', label: 'Enterprise SSO', minimumTier: 'enterprise' },
} satisfies Record<string, BillingFeature>

export function normalizeBillingTier(plan: string | null | undefined): BillingTier {
  if (plan === 'pro' || plan === 'enterprise' || plan === 'starter') return plan
  return 'trial'
}

export function canUseFeature(plan: string | null | undefined, feature: BillingFeature): boolean {
  return tierRank[normalizeBillingTier(plan)] >= tierRank[feature.minimumTier]
}

export async function getOrgBillingTier(orgId: string): Promise<BillingTier> {
  const db = createAdminClient()
  const { data } = await db.from('organizations').select('plan').eq('id', orgId).maybeSingle()
  return normalizeBillingTier(data?.plan)
}

export async function requireFeatureTier(orgId: string, feature: BillingFeature) {
  const tier = await getOrgBillingTier(orgId)
  if (canUseFeature(tier, feature)) return null

  return NextResponse.json(
    {
      error: 'upgrade_required',
      message: `${feature.label} requires the ${feature.minimumTier} plan.`,
      action: 'Upgrade from Settings > Billing.',
      required_tier: feature.minimumTier,
      current_tier: tier,
    },
    { status: 402 },
  )
}
