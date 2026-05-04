/**
 * V5.5.2 — Gift card balance lifecycle scenario.
 *
 * Cross-module workflow: gift cards + payments + orders.
 *
 * Steps:
 *   1. Activate a fresh gift card with $50 balance.
 *   2. Check the balance via /api/payments/gift-card/check-balance.
 *   3. Use the gift card to (partially) pay an order — verify deduction.
 *   4. Check balance again — should reflect the deduction.
 *   5. Try to pay an amount larger than remaining balance → 400 with
 *      "Insufficient gift card balance" and the current balance returned.
 */

import { test, expect, type APIRequestContext } from '@playwright/test'
import {
  cleanupOrder,
  createOrderWithItem,
  freshGiftCardNumber,
  getOrder,
  idemKey,
  newAuthedRequest,
  type AuthedContext,
} from './helpers'

let ctx: AuthedContext
let request: APIRequestContext

test.beforeAll(async ({ playwright }) => {
  ctx = await newAuthedRequest(playwright)
  request = ctx.request
})

test.afterAll(async () => {
  await ctx?.request.dispose()
})

test.describe('Workflow — gift card balance', () => {
  let createdOrderId: string | undefined

  test.afterEach(async () => {
    await cleanupOrder(request, createdOrderId)
    createdOrderId = undefined
  })

  test('activate, redeem, recheck balance, reject overdraw', async () => {
    test.setTimeout(90_000)

    const cardNumber = freshGiftCardNumber()
    const initialCents = 5000 // $50.00

    // 1. Activate the card.
    const activateRes = await request.post('/api/payments/gift-card/activate', {
      data: {
        card_number: cardNumber,
        initial_balance_cents: initialCents,
      },
    })
    expect(
      activateRes.status(),
      `activate failed: ${await activateRes.text()}`
    ).toBe(201)
    const activated = (await activateRes.json()) as {
      data: { id: string; balance_cents: number; is_active: boolean }
    }
    expect(activated.data.balance_cents).toBe(initialCents)
    expect(activated.data.is_active).toBe(true)

    // 2. Balance check.
    const balRes = await request.post('/api/payments/gift-card/check-balance', {
      data: { card_number: cardNumber },
    })
    expect(balRes.status()).toBe(200)
    const balBody = (await balRes.json()) as {
      data: { balance_cents: number; is_active: boolean }
    }
    expect(balBody.data.balance_cents).toBe(initialCents)

    // 3. Apply gift card as partial payment on an order.
    const { orderId, locationId } = await createOrderWithItem(ctx, {
      orderType: 'takeout',
    })
    createdOrderId = orderId
    const order = await getOrder(request, orderId)
    const balanceCents = Math.round(parseFloat(String(order.balance_due ?? '0')) * 100)
    expect(balanceCents).toBeGreaterThan(0)

    // Pay min(balance, $20) so we leave room on the card to test recheck +
    // overdraw paths cleanly.
    const partialCents = Math.min(balanceCents, 2000)
    const payRes = await request.post('/api/payments/process', {
      headers: { 'Idempotency-Key': idemKey('gift-card-pay') },
      data: {
        order_id: orderId,
        location_id: locationId,
        payment_method: 'gift_card',
        amount_cents: partialCents,
        gift_card_number: cardNumber,
      },
    })
    expect(payRes.status(), `gift card pay failed: ${await payRes.text()}`).toBe(201)

    // 4. Recheck balance — should be initial - partial.
    const balRes2 = await request.post('/api/payments/gift-card/check-balance', {
      data: { card_number: cardNumber },
    })
    expect(balRes2.status()).toBe(200)
    const bal2 = (await balRes2.json()) as { data: { balance_cents: number } }
    expect(bal2.data.balance_cents).toBe(initialCents - partialCents)

    // 5. Try to redeem more than remaining — should reject with 400.
    const overdrawCents = bal2.data.balance_cents + 100_00 // +$100 over balance
    const overRes = await request.post('/api/payments/process', {
      headers: { 'Idempotency-Key': idemKey('gift-card-overdraw') },
      data: {
        order_id: orderId,
        location_id: locationId,
        payment_method: 'gift_card',
        amount_cents: overdrawCents,
        gift_card_number: cardNumber,
      },
    })
    expect(overRes.status()).toBe(400)
    const overBody = (await overRes.json()) as {
      error: string
      balance_cents: number
    }
    expect(overBody.error.toLowerCase()).toContain('insufficient')
    expect(overBody.balance_cents).toBe(bal2.data.balance_cents)
  })

  test('check-balance on unknown card returns 404', async () => {
    const res = await request.post('/api/payments/gift-card/check-balance', {
      data: { card_number: `NOPE${Date.now()}` },
    })
    expect(res.status()).toBe(404)
  })
})
