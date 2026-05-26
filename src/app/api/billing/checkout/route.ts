import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, requireRole } from '@/lib/api/auth'
import { apiError } from '@/lib/api/error-response'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkoutPlanSchema, createCheckoutSession } from '@/lib/billing/stripe'

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (user instanceof NextResponse) return user

  const roleCheck = requireRole(user, ['owner', 'admin'])
  if (roleCheck) return roleCheck

  const parsed = checkoutPlanSchema.safeParse(await request.json())
  if (!parsed.success) {
    return apiError(400, parsed.error.issues[0].message)
  }

  const origin = request.nextUrl.origin
  const db = createAdminClient()
  const { data: org } = await db
    .from('organizations')
    .select('owner_email')
    .eq('id', user.org_id)
    .maybeSingle()

  try {
    const session = await createCheckoutSession({
      plan: parsed.data.plan,
      orgId: user.org_id,
      customerEmail: org?.owner_email ?? user.email,
      successUrl: parsed.data.success_url ?? `${origin}/settings/billing?checkout=success`,
      cancelUrl: parsed.data.cancel_url ?? `${origin}/settings/billing?checkout=cancelled`,
    })

    return NextResponse.json({ data: { id: session.id, url: session.url } })
  } catch (error) {
    return apiError(500, error instanceof Error ? error.message : 'Unable to create checkout session')
  }
}
