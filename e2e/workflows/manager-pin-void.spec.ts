/**
 * V5.5.2 — Manager-PIN void scenario.
 *
 * Cross-module workflow: orders + payments + state-machine void path
 * (V5.4.2) + audit log (V5.4.3).
 *
 * Steps:
 *   1. POST /api/auth/verify-manager-pin with the demo PIN ('5678' →
 *      Robert Johnson, manager) — this is the gate the UI hits before
 *      enabling privileged buttons.
 *   2. Create an open takeout order, send to kitchen, pay → closed.
 *   3. POST /api/orders/[id]/void without manager_pin → 403.
 *   4. POST /api/orders/[id]/void with WRONG manager_pin → 403.
 *   5. POST /api/orders/[id]/void with the right manager_pin → 200,
 *      status flips to 'voided', `void_summary.approved_by_manager_id`
 *      matches the manager's id from step 1.
 *   6. Re-void the same order → 422 (terminal state).
 *   7. Audit log records an `order_voided` row carrying the
 *      manager_pin_user_id.
 */

import { test, expect, type APIRequestContext } from '@playwright/test'
import {
  cleanupOrder,
  createOrderWithItem,
  getOrder,
  MANAGER_PIN,
  newAuthedRequest,
  payCash,
  type AuthedContext,
} from './helpers'

let ctx: AuthedContext
let request: APIRequestContext

let managerUserId: string

test.beforeAll(async ({ playwright }) => {
  ctx = await newAuthedRequest(playwright)
  request = ctx.request

  const verify = await request.post('/api/auth/verify-manager-pin', {
    data: { pin: MANAGER_PIN },
  })
  expect(
    verify.status(),
    `manager pin ${MANAGER_PIN} should verify; got ${verify.status()}`
  ).toBe(200)
  const verifyBody = (await verify.json()) as {
    data: { user_id: string; display_name: string; role: string }
  }
  expect(['manager', 'admin', 'owner']).toContain(verifyBody.data.role)
  managerUserId = verifyBody.data.user_id
})

test.afterAll(async () => {
  await ctx?.request.dispose()
})

test.describe('Workflow — manager-PIN void after close', () => {
  let createdOrderId: string | undefined

  test.afterEach(async () => {
    await cleanupOrder(request, createdOrderId)
    createdOrderId = undefined
  })

  test('void closed order requires + records manager PIN', async () => {
    test.setTimeout(110_000)

    // 1. Setup: create + close an order via cash payment.
    const { orderId, locationId } = await createOrderWithItem(ctx, {
      orderType: 'takeout',
    })
    createdOrderId = orderId
    await request.post(`/api/orders/${orderId}/send`)
    const before = await getOrder(request, orderId)
    const balanceCents = Math.round(parseFloat(String(before.balance_due ?? '0')) * 100)
    await payCash(ctx, orderId, locationId, balanceCents)

    const paid = await getOrder(request, orderId)
    expect(paid.status).toBe('closed')

    // 2. No manager_pin → 403.
    const noPinRes = await request.post(`/api/orders/${orderId}/void`, {
      data: { reason: 'customer_request' },
    })
    expect(noPinRes.status()).toBe(403)
    expect((await noPinRes.text()).toLowerCase()).toContain('manager pin')

    // 3. Wrong manager_pin → 403.
    const wrongPin = MANAGER_PIN === '0000' ? '9999' : '0000'
    const wrongRes = await request.post(`/api/orders/${orderId}/void`, {
      data: { reason: 'customer_request', manager_pin: wrongPin },
    })
    expect(wrongRes.status()).toBe(403)

    // 4. Right manager_pin → 200, voided.
    const goodRes = await request.post(`/api/orders/${orderId}/void`, {
      data: {
        reason: 'customer_request',
        notes: 'V5.5.2 e2e — customer changed mind post-payment',
        manager_pin: MANAGER_PIN,
      },
    })
    expect(
      goodRes.status(),
      `void failed: ${await goodRes.text()}`
    ).toBe(200)
    const goodBody = (await goodRes.json()) as {
      data: {
        status: string
        void_summary: {
          reason: string
          after_close: boolean
          approved_by_manager_id: string
          voided_at: string
        }
      }
    }
    expect(goodBody.data.status).toBe('voided')
    expect(goodBody.data.void_summary.after_close).toBe(true)
    expect(goodBody.data.void_summary.approved_by_manager_id).toBe(managerUserId)
    expect(goodBody.data.void_summary.reason).toBe('customer_request')

    // 5. Re-void on terminal state → 422.
    const reVoidRes = await request.post(`/api/orders/${orderId}/void`, {
      data: { reason: 'duplicate', manager_pin: MANAGER_PIN },
    })
    expect(reVoidRes.status()).toBe(422)

    // 6. Audit log carries the manager_pin_user_id for this row.
    const auditRes = await request.get(
      `/api/audit-log?action=order_voided&entity_type=order&limit=20`
    )
    expect(auditRes.status()).toBe(200)
    const audit = (await auditRes.json()) as {
      data: Array<{ entity_id?: string; manager_pin_user_id?: string; reason?: string }>
    }
    const ourRow = audit.data.find((r) => r.entity_id === orderId)
    expect(ourRow, 'audit row should exist for the voided order').toBeTruthy()
    expect(ourRow!.manager_pin_user_id).toBe(managerUserId)
    expect(ourRow!.reason).toMatch(/customer_request/)

    createdOrderId = undefined // already voided — afterEach can skip
  })

  test('void of pre-close order does not require manager_pin', async () => {
    test.setTimeout(60_000)

    const { orderId } = await createOrderWithItem(ctx, {
      orderType: 'takeout',
    })
    createdOrderId = orderId

    // Before sending, the order is in 'draft'. The /void route still requires
    // manager+ role (which Marcus is, as owner) but no PIN.
    const res = await request.post(`/api/orders/${orderId}/void`, {
      data: {
        reason: 'duplicate',
        notes: 'V5.5.2 — pre-close void path',
      },
    })
    expect(
      res.status(),
      `pre-close void failed: ${await res.text()}`
    ).toBe(200)
    const body = (await res.json()) as {
      data: { status: string; void_summary: { after_close: boolean } }
    }
    expect(body.data.status).toBe('voided')
    expect(body.data.void_summary.after_close).toBe(false)

    createdOrderId = undefined
  })
})
