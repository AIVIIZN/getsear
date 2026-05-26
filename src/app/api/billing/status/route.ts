import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth'
import { apiError } from '@/lib/api/error-response'
import { createAdminClient } from '@/lib/supabase/admin'
import { billingPlans } from '@/lib/billing/stripe'
import { billingFeatures, canUseFeature, normalizeBillingTier } from '@/lib/billing/features'

export async function GET() {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const db = createAdminClient()
  const { data, error } = await db
    .from('organizations')
    .select('id, name, plan, subscription_status, trial_ends_at, owner_email, settings')
    .eq('id', user.org_id)
    .maybeSingle()

  if (error || !data) {
    return apiError(500, 'Unable to load billing status')
  }

  const tier = normalizeBillingTier(data.plan)
  return NextResponse.json({
    data: {
      organization: data,
      tier,
      plans: billingPlans,
      features: Object.values(billingFeatures).map((feature) => ({
        ...feature,
        enabled: canUseFeature(tier, feature),
      })),
    },
  })
}
