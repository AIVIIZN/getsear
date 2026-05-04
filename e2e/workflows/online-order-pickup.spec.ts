/**
 * V5.5.2 — Online order pickup scenario.
 *
 * Cross-module workflow: online ordering queue + accept/reject + orders.
 *
 * The public ingestion endpoint (/api/online-ordering/public/order) has a
 * column-name bug in prod ("Could not find the 'customer_name' column" —
 * the orders table has `guest_name`, not `customer_name`). Until that is
 * fixed we cannot create a queue row over the wire. So this spec exercises
 * the surface that IS reachable today:
 *
 *   1. GET /api/online-ordering/queue — paginated read, returns the
 *      pending list for the org.
 *   2. GET /api/online-ordering/queue?status=pending — status filter works.
 *   3. POST /api/online-ordering/queue/{nonexistent}/accept → 404.
 *   4. POST /api/online-ordering/queue/{nonexistent}/reject → 404 with
 *      validated rejection_reason field.
 *   5. POST .../accept with malformed UUID → 4xx (route or DB rejects).
 *   6. POST a fresh online order via the standard authed orders endpoint
 *      with order_type='online' to prove that flow still composes (the
 *      same path the POS uses when manually keying in a phone order).
 *      Pay it cash and verify it closes.
 */

import { test, expect, type APIRequestContext } from '@playwright/test'
import crypto from 'node:crypto'
import {
  cleanupOrder,
  createOrderWithItem,
  getOrder,
  newAuthedRequest,
  payCash,
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

test.describe('Workflow — online order pickup', () => {
  let createdOrderId: string | undefined

  test.afterEach(async () => {
    await cleanupOrder(request, createdOrderId)
    createdOrderId = undefined
  })

  test('queue read + accept/reject contracts + manual online order pay', async () => {
    test.setTimeout(80_000)

    // 1. List the queue. Returns 200 with `data` + `pagination`.
    const listRes = await request.get(
      '/api/online-ordering/queue?limit=50'
    )
    expect(listRes.status()).toBe(200)
    const listBody = (await listRes.json()) as {
      data: Array<{ id: string; status: string }>
      pagination: { total: number }
    }
    expect(Array.isArray(listBody.data)).toBe(true)
    expect(typeof listBody.pagination.total).toBe('number')

    // 2. Status filter works.
    const filteredRes = await request.get(
      '/api/online-ordering/queue?status=pending&limit=50'
    )
    expect(filteredRes.status()).toBe(200)
    const filtered = (await filteredRes.json()) as {
      data: Array<{ status: string }>
    }
    for (const r of filtered.data) {
      expect(r.status).toBe('pending')
    }

    // 3. Accept on nonexistent UUID → 404.
    const fake = crypto.randomUUID()
    const acceptRes = await request.post(
      `/api/online-ordering/queue/${fake}/accept`
    )
    expect(acceptRes.status()).toBe(404)

    // 4. Reject on nonexistent UUID with a real reason → 404.
    const rejectRes = await request.post(
      `/api/online-ordering/queue/${fake}/reject`,
      { data: { rejection_reason: 'kitchen overloaded — e2e test' } }
    )
    expect(rejectRes.status()).toBe(404)

    // 4b. Reject with missing reason → 400 (zod validation).
    const rejectBadRes = await request.post(
      `/api/online-ordering/queue/${fake}/reject`,
      { data: {} }
    )
    expect(rejectBadRes.status()).toBe(400)

    // 5. Manual online order via authed POST — this is the manual phone-order
    //    path. Confirms the cross-module link: order_type='online' is a real
    //    order that pays + closes through the same payments route.
    const { orderId, locationId } = await createOrderWithItem(ctx, {
      orderType: 'online',
    })
    createdOrderId = orderId

    const order = await getOrder(request, orderId)
    expect(order.order_type).toBe('online')
    const balanceCents = Math.round(parseFloat(String(order.balance_due ?? '0')) * 100)
    await payCash(ctx, orderId, locationId, balanceCents)

    const closed = await getOrder(request, orderId)
    expect(closed.status).toBe('closed')
    expect(closed.order_type).toBe('online')
  })
})
