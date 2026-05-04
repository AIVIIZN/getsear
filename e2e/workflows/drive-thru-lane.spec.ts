/**
 * V5.5.2 — Drive-thru lane scenario.
 *
 * Cross-module workflow: drive-thru orders + payments + speed metrics.
 *
 * Steps:
 *   1. Create an order with order_type='drive_thru' through the standard
 *      orders API (this is how the POS-side drive-thru terminal flows).
 *   2. Add an item, send to kitchen, pay cash.
 *   3. Verify the order closes with order_type === 'drive_thru'.
 *   4. Hit the speed-metrics + orders/metrics read endpoints to confirm
 *      the cross-module aggregation pipeline answers (200, valid shape).
 *   5. Confirm /api/drive-thru/lanes is reachable (V5.1.1 cleanup left
 *      the read path intact even when no lane rows exist).
 *
 * Why not exercise the lane/cars POST path? The demo seed has zero lane
 * rows configured, and there's no public endpoint to create one. The
 * workflow that genuinely matters operationally is the order itself —
 * lane tracking is auxiliary metadata.
 */

import { test, expect, type APIRequestContext } from '@playwright/test'
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

test.describe('Workflow — drive-thru lane', () => {
  let createdOrderId: string | undefined

  test.afterEach(async () => {
    await cleanupOrder(request, createdOrderId)
    createdOrderId = undefined
  })

  test('drive-thru order creates, pays, closes; metrics endpoints answer', async () => {
    test.setTimeout(80_000)

    const locationId = ctx.user.location_ids[0]

    // 1 + 2. Create drive-thru order with one item, send, pay.
    const { orderId } = await createOrderWithItem(ctx, {
      orderType: 'drive_thru',
    })
    createdOrderId = orderId

    const sendRes = await request.post(`/api/orders/${orderId}/send`)
    expect([200, 201]).toContain(sendRes.status())

    const beforePay = await getOrder(request, orderId)
    expect(beforePay.order_type).toBe('drive_thru')
    const balanceCents = Math.round(parseFloat(String(beforePay.balance_due ?? '0')) * 100)
    expect(balanceCents).toBeGreaterThan(0)

    await payCash(ctx, orderId, locationId, balanceCents)

    // 3. Confirm closed + still drive_thru.
    const afterPay = await getOrder(request, orderId)
    expect(afterPay.status).toBe('closed')
    expect(afterPay.order_type).toBe('drive_thru')

    // 4. Speed-metrics endpoint is the analytic counterpart that orders feed.
    const speedRes = await request.get(
      `/api/drive-thru/speed-metrics?location_id=${locationId}`
    )
    expect(speedRes.status()).toBe(200)
    const speed = (await speedRes.json()) as {
      data: { avg_total_time?: number; cars_per_hour?: number; target_total_time?: number }
    }
    expect(typeof speed.data.target_total_time).toBe('number')

    // Same for orders/metrics rollup.
    const metricsRes = await request.get(
      `/api/drive-thru/orders/metrics?location_id=${locationId}`
    )
    expect(metricsRes.status()).toBe(200)
    const metrics = (await metricsRes.json()) as {
      data: { total_orders: number; lanes: unknown[]; hourly: unknown[] }
    }
    expect(typeof metrics.data.total_orders).toBe('number')
    expect(Array.isArray(metrics.data.lanes)).toBe(true)

    // 5. Lanes endpoint should answer (empty data is fine post-V5.1.1 cleanup).
    const lanesRes = await request.get('/api/drive-thru/lanes')
    expect(lanesRes.status()).toBe(200)
    const lanes = (await lanesRes.json()) as { data: unknown[] }
    expect(Array.isArray(lanes.data)).toBe(true)
  })
})
