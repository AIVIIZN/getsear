import { z } from 'zod'

export type StripePlan = 'starter' | 'pro' | 'enterprise'

const STRIPE_API = 'https://api.stripe.com/v1'

export const billingPlans = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 6900,
    interval: 'month',
    description: 'Core POS, KDS, staff, menu, and reporting for one restaurant.',
    priceEnv: 'STRIPE_PRICE_STARTER',
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 19900,
    interval: 'month',
    description: 'Adds AI, advanced reports, multi-location readiness, and automation.',
    priceEnv: 'STRIPE_PRICE_PRO',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    interval: 'custom',
    description: 'Custom rollout, controls, support, and pricing.',
    priceEnv: null,
  },
} as const

export const checkoutPlanSchema = z.object({
  plan: z.enum(['starter', 'pro']),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
})

function stripeSecret(): string {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured')
  return key
}

async function stripeRequest<T>(path: string, body: URLSearchParams): Promise<T> {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecret()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json?.error?.message ?? 'Stripe request failed')
  }
  return json as T
}

export async function createCheckoutSession(params: {
  plan: 'starter' | 'pro'
  orgId: string
  customerEmail?: string | null
  successUrl: string
  cancelUrl: string
}) {
  const priceId = process.env[billingPlans[params.plan].priceEnv]
  if (!priceId) throw new Error(`${billingPlans[params.plan].priceEnv} is not configured`)

  const body = new URLSearchParams()
  body.set('mode', 'subscription')
  body.set('success_url', params.successUrl)
  body.set('cancel_url', params.cancelUrl)
  body.set('client_reference_id', params.orgId)
  body.set('metadata[org_id]', params.orgId)
  body.set('metadata[plan]', params.plan)
  body.set('subscription_data[metadata][org_id]', params.orgId)
  body.set('subscription_data[metadata][plan]', params.plan)
  body.set('line_items[0][price]', priceId)
  body.set('line_items[0][quantity]', '1')
  if (params.customerEmail) body.set('customer_email', params.customerEmail)

  return stripeRequest<{ id: string; url: string }>('/checkout/sessions', body)
}

export async function verifyStripeSignature(payload: string, signature: string, secret: string) {
  const parts = Object.fromEntries(
    signature.split(',').map((part) => {
      const [key, value] = part.split('=')
      return [key, value]
    }),
  )
  const timestamp = parts.t
  const expected = parts.v1
  if (!timestamp || !expected) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`))
  const actual = Buffer.from(digest).toString('hex')
  return timingSafeEqualHex(actual, expected)
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
