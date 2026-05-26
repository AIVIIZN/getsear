import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyStripeSignature } from '@/lib/billing/stripe'

interface StripeEvent {
  type: string
  data: { object: Record<string, unknown> }
}

function metadataPlan(object: Record<string, unknown>) {
  const metadata = object.metadata as Record<string, string> | undefined
  return metadata?.plan
}

function metadataOrgId(object: Record<string, unknown>) {
  const metadata = object.metadata as Record<string, string> | undefined
  return metadata?.org_id ?? (object.client_reference_id as string | undefined)
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET is not configured' }, { status: 500 })
  }

  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature || !(await verifyStripeSignature(payload, signature, secret))) {
    return NextResponse.json({ error: 'Invalid Stripe signature' }, { status: 400 })
  }

  const event = JSON.parse(payload) as StripeEvent
  const object = event.data.object
  const orgId = metadataOrgId(object)
  const plan = metadataPlan(object)
  if (!orgId) return NextResponse.json({ data: { ignored: true } })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (plan === 'starter' || plan === 'pro' || plan === 'enterprise') patch.plan = plan

  if (event.type === 'checkout.session.completed') patch.subscription_status = 'active'
  if (event.type === 'customer.subscription.updated') {
    patch.subscription_status = object.status ?? 'active'
  }
  if (event.type === 'customer.subscription.deleted') {
    patch.subscription_status = 'canceled'
    patch.plan = 'starter'
  }

  const db = createAdminClient()
  const { error } = await db.from('organizations').update(patch).eq('id', orgId)
  if (error) {
    return NextResponse.json({ error: 'Unable to update billing status' }, { status: 500 })
  }

  return NextResponse.json({ data: { processed: true } })
}
