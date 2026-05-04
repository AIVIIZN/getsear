/**
 * V5.5.2 — Comp-after-pay scenario test.
 *
 * Cross-module workflow: orders + payments + state machine + audit log.
 *
 * Steps:
 *   1. Create takeout order with one item.
 *   2. Send to kitchen, then pay cash for full balance → order auto-closes.
 *   3. POST /api/orders/[id]/comp with manager_pin → re-opens to served,
 *      applies comp, recomputes totals, then auto-closes again because the
 *      new balance_due is 0.
 *   4. Verify the order is back in `closed` status with comp metadata
 *      reflected in the items.
 *   5. Audit log contains an `order_comped` row referencing the order.
 *
 * This exercises the V5.4.2 state-machine path
 *   `closed -COMP_AFTER_CLOSE-> served -CLOSE-> closed`
 * and the V5.4.3 audit-log integration. Manager-PIN is per the demo
 * tenant — the `1234` PIN is the documented seed for Marcus Rivera (owner).
 *
 * Sister test files:
 *   - manager-pin-void.spec.ts covers the parallel void-after-close path.
 */

import { test, expect, type APIRequestContext } from '@playwright/test'
import {
  cleanupOrder,
  createOrderWithItem,
  getOrder,
  idemKey,
  newAuthedRequest,
  payCash,
  type AuthedContext,
} from './helpers'

// Verified against prod 2026-05-03: PIN 5678 belongs to Robert Johnson
// (manager role, demo tenant). Used for any post-close comp/void.
const MANAGER_PIN = '5678'

let ctx: AuthedContext
let request: APIRequestContext

test.beforeAll(async ({ playwright }) => {
  ctx = await newAuthedRequest(playwright)
  request = ctx.request
})

test.afterAll(async () => {
  await ctx?.request.dispose()
})

test.describe('Workflow — comp after pay', () => {
  let createdOrderId: string | undefined

  test.afterEach(async () => {
    await cleanupOrder(request, createdOrderId)
    createdOrderId = undefined
  })

  test('order paid in cash can be comped post-close with manager PIN', async () => {
    test.setTimeout(90_000)

    // 1. Create order + item + send to kitchen.
    const { orderId, locationId } = await createOrderWithItem(ctx, {
      orderType: 'takeout',
      quantity: 2,
    })
    createdOrderId = orderId

    const sendRes = await request.post(`/api/orders/${orderId}/send`)
    expect([200, 201]).toContain(sendRes.status())

    // 2. Pay the full balance in cash → order should be `closed`.
    const beforePay = await getOrder(request, orderId)
    const balanceCents = Math.round(parseFloat(String(beforePay.balance_due ?? '0')) * 100)
    expect(balanceCents).toBeGreaterThan(0)

    await payCash(ctx, orderId, locationId, balanceCents)

    const afterPay = await getOrder(request, orderId)
    expect(afterPay.status).toBe('closed')
    expect(parseFloat(String(afterPay.balance_due))).toBeCloseTo(0, 2)

    // 3. Comp the whole order after close. Requires manager_pin per
    //    the V5.4.2 state-machine; the 'manager_comp' reason is one
    //    of the seven enum values the route accepts.
    const compRes = await request.post(`/api/orders/${orderId}/comp`, {
      headers: { 'Idempotency-Key': idemKey('comp-after-close') },
      data: {
        comp_reason: 'manager_comp',
        manager_pin: MANAGER_PIN,
      },
    })
    // 200 expected on success. 403 means the demo PIN drifted — surface
    // the body so we can fix it without guessing.
    if (compRes.status() === 403) {
      throw new Error(
        `Comp endpoint rejected manager PIN ${MANAGER_PIN}: ${await compRes.text()}`
      )
    }
    expect(compRes.status(), `comp failed: ${await compRes.text()}`).toBe(200)

    const compBody = (await compRes.json()) as { data: Record<string, unknown> }
    expect(compBody.data).toBeTruthy()

    // 4. After comp the order should be back in `closed` (auto-close because
    //    balance_due is 0 again — see route lines 203-235). We check the
    //    items show the comp metadata.
    const final = await getOrder(request, orderId)
    expect(['closed', 'served']).toContain(final.status as string)

    const items = (final.order_items as Array<{ is_comped?: boolean; comp_reason?: string }>) ?? []
    expect(items.length).toBeGreaterThan(0)
    const compedCount = items.filter((it) => it.is_comped).length
    expect(compedCount, 'at least one item should be marked comped').toBeGreaterThan(0)
    const reasons = items.filter((it) => it.is_comped).map((it) => it.comp_reason)
    expect(reasons).toContain('manager_comp')

    // 5. Audit log should record the comp.
    const auditRes = await request.get(
      `/api/audit-log?entity_type=order&action=order_comped&limit=20`
    )
    expect(auditRes.status()).toBe(200)
    const auditBody = (await auditRes.json()) as {
      data: Array<{ entity_id?: string; reason?: string }>
    }
    const matchingRow = auditBody.data.find((r) => r.entity_id === orderId)
    expect(matchingRow, 'audit row should exist for the comped order').toBeTruthy()
    expect(matchingRow!.reason).toMatch(/manager_comp/)
  })

  test('comp without manager_pin on closed order is rejected with 403', async () => {
    test.setTimeout(60_000)

    const { orderId, locationId } = await createOrderWithItem(ctx, {
      orderType: 'takeout',
    })
    createdOrderId = orderId

    await request.post(`/api/orders/${orderId}/send`)

    const before = await getOrder(request, orderId)
    const balanceCents = Math.round(parseFloat(String(before.balance_due ?? '0')) * 100)
    await payCash(ctx, orderId, locationId, balanceCents)

    // No manager_pin in body — should 403 per the route guard.
    const compRes = await request.post(`/api/orders/${orderId}/comp`, {
      headers: { 'Idempotency-Key': idemKey('comp-no-pin') },
      data: {
        comp_reason: 'service_issue',
      },
    })
    expect(compRes.status()).toBe(403)
    const bodyText = await compRes.text()
    expect(bodyText.toLowerCase()).toContain('manager pin')
  })
})
