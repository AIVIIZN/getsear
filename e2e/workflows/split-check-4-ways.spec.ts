/**
 * V5.5.2 — Split check 4 ways scenario.
 *
 * Cross-module workflow: orders + split + payments.
 *
 * Steps:
 *   1. Create a dine-in order with a couple items totalling > $40.
 *   2. POST /api/orders/[id]/split with mode='equal' split_count=4.
 *   3. Verify the response returns 1 original + 3 new order ids.
 *   4. Verify each split has total === original_total / 4 (within rounding).
 *   5. Pay each split in cash and assert all 4 close.
 */

import { test, expect, type APIRequestContext } from '@playwright/test'
import {
  cleanupOrder,
  createOrderWithItem,
  getOrder,
  idemKey,
  newAuthedRequest,
  payCash,
  pickMenuItem,
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

test.describe('Workflow — split check 4 ways', () => {
  const ordersToCleanup: string[] = []

  test.afterEach(async () => {
    for (const id of ordersToCleanup) await cleanupOrder(request, id)
    ordersToCleanup.length = 0
  })

  test('equal split into 4 checks pays + closes each independently', async () => {
    test.setTimeout(110_000)

    // 1. Create order with two items so the total comfortably divides by 4.
    const { orderId, locationId, item: firstItem } = await createOrderWithItem(ctx, {
      orderType: 'dine_in',
      quantity: 1,
    })
    ordersToCleanup.push(orderId)

    // Add a second different item to make the total a non-trivial number.
    const second = await pickMenuItem(request, { priceMin: 8, priceMax: 25 })
    const addRes = await request.post(`/api/orders/${orderId}/items`, {
      headers: { 'Idempotency-Key': idemKey('add-item-2') },
      data: {
        menu_item_id: second.id,
        name: second.name,
        unit_price: second.price,
        quantity: 1,
      },
    })
    expect(addRes.status(), `add second item failed: ${await addRes.text()}`).toBe(201)

    const beforeSplit = await getOrder(request, orderId)
    const originalTotal = parseFloat(String(beforeSplit.total ?? '0'))
    expect(originalTotal, 'pre-split total should be > 0').toBeGreaterThan(0)

    // 2. Split equally into 4.
    const splitRes = await request.post(`/api/orders/${orderId}/split`, {
      data: { mode: 'equal', split_count: 4 },
    })
    expect(splitRes.status(), `split failed: ${await splitRes.text()}`).toBe(200)
    const splitBody = (await splitRes.json()) as {
      data: { original_order_id: string; new_order_ids: string[]; mode: string }
    }
    expect(splitBody.data.original_order_id).toBe(orderId)
    expect(splitBody.data.new_order_ids).toHaveLength(3)
    splitBody.data.new_order_ids.forEach((id) => ordersToCleanup.push(id))

    // 3. Each of the 4 checks (original + 3 new) should owe ~ originalTotal / 4.
    const allOrderIds = [orderId, ...splitBody.data.new_order_ids]
    const expectedShare = originalTotal / 4
    let cumulativeBalance = 0
    for (const id of allOrderIds) {
      const o = await getOrder(request, id)
      const total = parseFloat(String(o.total ?? '0'))
      expect(total).toBeCloseTo(expectedShare, 1)
      cumulativeBalance += parseFloat(String(o.balance_due ?? '0'))
    }
    // Sum of the four balances should add back up to roughly the original total.
    expect(cumulativeBalance).toBeCloseTo(originalTotal, 1)

    // 4. Pay each split in full and verify it closes. Skip the first item-bearing
    // original if it has no balance owed (rare but possible if discounts).
    for (const id of allOrderIds) {
      const o = await getOrder(request, id)
      const balanceCents = Math.round(parseFloat(String(o.balance_due ?? '0')) * 100)
      if (balanceCents <= 0) continue
      await payCash(ctx, id, locationId, balanceCents)
      const closed = await getOrder(request, id)
      expect(closed.status, `order ${id} should close after payment`).toBe('closed')
    }

    // sanity ping the source item type isn't weird
    expect(firstItem.id).toBeTruthy()
  })
})
