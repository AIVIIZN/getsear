import { describe, expect, it } from 'vitest'
import { billingFeatures, canUseFeature, normalizeBillingTier } from '@/lib/billing/features'

describe('billing feature gates', () => {
  it('normalizes unknown plans to trial', () => {
    expect(normalizeBillingTier(null)).toBe('trial')
    expect(normalizeBillingTier('legacy')).toBe('trial')
    expect(normalizeBillingTier('pro')).toBe('pro')
  })

  it('allows pro features only for pro and enterprise tiers', () => {
    expect(canUseFeature('starter', billingFeatures.ai)).toBe(false)
    expect(canUseFeature('pro', billingFeatures.ai)).toBe(true)
    expect(canUseFeature('enterprise', billingFeatures.ai)).toBe(true)
  })
})
