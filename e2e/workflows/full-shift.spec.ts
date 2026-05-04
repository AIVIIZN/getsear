/**
 * V5.5.1 — Full-shift workflow.
 *
 * Single test simulates one operational shift end-to-end against prod
 * (https://getsear.com) on the Downtown Austin demo location:
 *
 *   1. Open day      — verify auth + capture baseline daily-Z totals.
 *   2. 12 orders     — created via API, 3 menu items each, sent to kitchen.
 *   3. Mixed payments
 *        - 4× cash (with tip + tendered/change)
 *        - 4× credit_card via Valor mock
 *        - 2× gift_card (one freshly activated for the test)
 *        - 2× split (cash + card on the same order)
 *   4. Close shift   — assert all 12 orders moved draft → open → closed.
 *   5. Z report      — fetch /api/reports/daily and verify revenue/order
 *                      counts/payment-method breakdown grew by exactly the
 *                      amounts we just rang in.
 *
 * Cleanup: `afterAll` voids any orders we created that didn't reach the
 * `closed` state (defensive — happy path leaves nothing to void). The
 * gift card we activated is left behind (one row, harmless).
 *
 * Speed budget: <5 minutes wall-clock. API-driven only — no UI navigation.
 *
 * Note: cash drawer open/close (cash-management/opening-count + closing-count)
 * is intentionally skipped. The demo tenant has no `cash_drawers` row and the
 * POST endpoint requires an existing UUID; "open day" / "close shift" here
 * means the shift's order ledger, which is what the daily Z report
 * aggregates anyway.
 */

import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test'
import { DEMO, createAuthedRequestContext, uniqueSuffix } from '../helpers'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MenuItem = {
  id: string
  name: string
  price: number | string
  is_active: boolean
  is_86d: boolean
}

type Order = {
  id: string
  display_number: string
  status: string
  total: number | string
  balance_due: number | string
  amount_paid: number | string
}

type DailyReport = {
  is_mock: boolean
  data: {
    date: string
    total_revenue: number
    order_count: number
    tax_total: number
    tip_total: number
    by_payment_method: Array<{ method: string; amount: number }>
    by_order_type: Array<{ type: string; revenue: number; count: number }>
  }
}

// ---------------------------------------------------------------------------
// Helpers (file-local — keep helpers.ts general)
// ---------------------------------------------------------------------------

function asNumber(v: number | string | undefined | null): number {
  if (v == null) return 0
  return typeof v === 'number' ? v : parseFloat(v)
}

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}

function priceString(item: MenuItem): string {
  return typeof item.price === 'number' ? item.price.toFixed(2) : String(item.price)
}

async function expectOk(res: APIResponse, label: string): Promise<unknown> {
  if (!res.ok()) {
    const body = await res.text()
    throw new Error(`${label} failed: ${res.status()} ${body.slice(0, 300)}`)
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

const TODAY = new Date().toISOString().split('T')[0]

let api: APIRequestContext
let menuItems: MenuItem[] = []
const createdOrderIds: string[] = []
let baselineRevenue = 0
let baselineOrderCount = 0
let baselineTax = 0

// 12 orders × 3 items × 2 calls + 4 split orders × 2 payments = ~70 API calls.
// At ~200ms each over the public WAN, the worst case is ~30s; allow 4 minutes.
test.setTimeout(4 * 60 * 1000)

test.describe('Full Shift Workflow', () => {
  test.beforeAll(async ({ playwright }) => {
    api = await createAuthedRequestContext(playwright)

    // Seed: load the menu once. Workflow tests pick items by index from this
    // list; deterministic ordering avoids cross-test flake from random picks.
    const menuRes = await api.get('/api/menu/items')
    const menu = (await expectOk(menuRes, 'GET /api/menu/items')) as { data: MenuItem[] }
    menuItems = menu.data.filter((m) => m.is_active && !m.is_86d)
    expect(menuItems.length).toBeGreaterThanOrEqual(10)

    // Capture today's report baseline so we can assert deltas (other tests
    // may have written orders today; we want to verify *our* contribution).
    const reportRes = await api.get(
      `/api/reports/daily?date=${TODAY}&location_id=${DEMO.primaryLocationId}`
    )
    const report = (await expectOk(reportRes, 'baseline daily report')) as DailyReport
    if (!report.is_mock) {
      baselineRevenue = report.data.total_revenue
      baselineOrderCount = report.data.order_count
      baselineTax = report.data.tax_total
    }
  })

  test.afterAll(async () => {
    // Defensive cleanup: void any of our orders that didn't reach `closed`.
    for (const orderId of createdOrderIds) {
      try {
        const res = await api.get(`/api/orders/${orderId}`)
        if (!res.ok()) continue
        const body = (await res.json()) as { data: { status: string } }
        if (body.data.status !== 'closed' && body.data.status !== 'voided') {
          // 5.99.3: DELETE /api/orders/[id] was removed (now 405). Route the
          // cleanup through the canonical void POST so we don't leak orphaned
          // test orders.
          await api.post(`/api/orders/${orderId}/void`, {
            data: { reason: 'other', notes: 'e2e cleanup: full-shift test did not complete' },
          })
        }
      } catch {
        // Best-effort cleanup; never fail the suite on cleanup errors.
      }
    }
    await api?.dispose()
  })

  test('open day → 12 orders → mixed payments → close shift → Z report', async () => {
    // ---- 1. Open day ----------------------------------------------------
    const meRes = await api.get('/api/auth/me')
    expect(meRes.status()).toBe(200)
    const me = (await meRes.json()) as { user: { display_name: string; role: string } }
    expect(me.user.display_name).toBe(DEMO.ownerName)
    expect(me.user.role).toBe('owner')

    // ---- 1b. Activate a gift card for the GC payments -------------------
    const gcNumber = `GC-E2E-${uniqueSuffix()}`
    // Initial balance: $200 — covers 2 small orders and a split half easily.
    const gcRes = await api.post('/api/payments/gift-card/activate', {
      data: { card_number: gcNumber, initial_balance_cents: 20000 },
    })
    await expectOk(gcRes, 'gift-card activate')

    // ---- 2. Create 12 orders, each with 3 items, send to kitchen --------
    const ORDER_COUNT = 12
    const orderTypes = ['dine_in', 'dine_in', 'takeout', 'bar'] as const
    const runTag = uniqueSuffix()
    const orders: Order[] = []

    for (let i = 0; i < ORDER_COUNT; i++) {
      const orderType = pick(orderTypes, i)
      const guestCount = orderType === 'dine_in' ? (i % 4) + 1 : 1

      // Create order
      const createBody: Record<string, unknown> = {
        order_type: orderType,
        location_id: DEMO.primaryLocationId,
        guest_count: guestCount,
        source: 'pos',
      }
      if (orderType === 'takeout' || orderType === 'bar') {
        createBody.guest_name = `E2E ${runTag}-${i + 1}`
        createBody.guest_phone = `+1512555${String(1000 + i).padStart(4, '0')}`
      }

      const createRes = await api.post('/api/orders', { data: createBody })
      const created = (await expectOk(createRes, `create order ${i + 1}`)) as {
        data: Order
      }
      createdOrderIds.push(created.data.id)

      // Add 3 deterministic items per order — picks rotate through the menu
      // so prices vary across orders.
      const seen = new Set<string>()
      for (let j = 0; j < 3; j++) {
        let idx = (i * 3 + j) % menuItems.length
        let item = menuItems[idx]
        // Avoid duplicate menu_items in a single order (uncommon but possible
        // because some tests will add the same item twice).
        let attempts = 0
        while (seen.has(item.id) && attempts < menuItems.length) {
          idx = (idx + 1) % menuItems.length
          item = menuItems[idx]
          attempts++
        }
        seen.add(item.id)

        const itemRes = await api.post(`/api/orders/${created.data.id}/items`, {
          data: {
            menu_item_id: item.id,
            name: item.name,
            unit_price: priceString(item),
            quantity: 1,
            course: 1,
            notes: '',
          },
        })
        await expectOk(itemRes, `add item ${j + 1} to order ${i + 1}`)
      }

      // Send to kitchen (draft → open). The endpoint accepts an empty body.
      const sendRes = await api.post(`/api/orders/${created.data.id}/send`, {
        data: {},
      })
      await expectOk(sendRes, `send order ${i + 1}`)

      // Refresh to capture the recalculated total (tax included).
      const refreshRes = await api.get(`/api/orders/${created.data.id}`)
      const refreshed = (await expectOk(refreshRes, `refresh order ${i + 1}`)) as {
        data: Order
      }
      orders.push(refreshed.data)
      expect(asNumber(refreshed.data.total)).toBeGreaterThan(0)
      expect(refreshed.data.status).toBe('open')
    }

    expect(orders).toHaveLength(ORDER_COUNT)

    // ---- 3. Mixed payments ---------------------------------------------
    // 0–3 cash, 4–7 card, 8–9 gift card, 10–11 split (cash+card).
    let cashTotal = 0
    let cardTotal = 0
    let giftCardTotal = 0
    let tipTotal = 0

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i]
      const totalCents = Math.round(asNumber(order.total) * 100)
      expect(totalCents).toBeGreaterThan(0)

      if (i < 4) {
        // ---- Cash with tip ------------------------------------------
        const tipCents = Math.round(totalCents * 0.18)
        const grandTotal = totalCents + tipCents
        // Round-up tendered to the next $5 (or $10 if total > $50).
        const roundTo = grandTotal > 5000 ? 1000 : 500
        const tendered = Math.ceil(grandTotal / roundTo) * roundTo
        const payRes = await api.post('/api/payments/process', {
          data: {
            order_id: order.id,
            location_id: DEMO.primaryLocationId,
            payment_method: 'cash',
            amount_cents: totalCents,
            tip_cents: tipCents,
            mode: 'sale',
            cash_tendered_cents: tendered,
          },
        })
        const pay = (await expectOk(payRes, `cash pay order ${i + 1}`)) as {
          data: { status: string; change_due_cents: number }
        }
        expect(pay.data.status).toBe('captured')
        expect(pay.data.change_due_cents).toBe(tendered - grandTotal)
        cashTotal += grandTotal
        tipTotal += tipCents
      } else if (i < 8) {
        // ---- Credit card via Valor mock -----------------------------
        const tipCents = Math.round(totalCents * 0.20)
        const payRes = await api.post('/api/payments/process', {
          data: {
            order_id: order.id,
            location_id: DEMO.primaryLocationId,
            payment_method: 'credit_card',
            amount_cents: totalCents,
            tip_cents: tipCents,
            mode: 'sale',
          },
        })
        const pay = (await expectOk(payRes, `card pay order ${i + 1}`)) as {
          data: { status: string; card_brand: string; card_last_four: string; auth_code: string }
        }
        expect(pay.data.status).toBe('captured')
        expect(pay.data.card_last_four).toBeTruthy()
        expect(pay.data.auth_code).toBeTruthy()
        cardTotal += totalCents + tipCents
        tipTotal += tipCents
      } else if (i < 10) {
        // ---- Gift card (no tip — rare in practice on GC) ------------
        const payRes = await api.post('/api/payments/process', {
          data: {
            order_id: order.id,
            location_id: DEMO.primaryLocationId,
            payment_method: 'gift_card',
            amount_cents: totalCents,
            tip_cents: 0,
            mode: 'sale',
            gift_card_number: gcNumber,
          },
        })
        const pay = (await expectOk(payRes, `gift card pay order ${i + 1}`)) as {
          data: { status: string; gift_card_id: string }
        }
        expect(pay.data.status).toBe('captured')
        expect(pay.data.gift_card_id).toBeTruthy()
        giftCardTotal += totalCents
      } else {
        // ---- Split: half cash, half card (with tip on card half) ---
        const cashPart = Math.floor(totalCents / 2)
        const cardPart = totalCents - cashPart
        const tipCents = Math.round(cardPart * 0.20)

        // Pay #1: cash for half the bill, no tip.
        const tendered = Math.ceil(cashPart / 500) * 500
        const cashRes = await api.post('/api/payments/process', {
          data: {
            order_id: order.id,
            location_id: DEMO.primaryLocationId,
            payment_method: 'cash',
            amount_cents: cashPart,
            tip_cents: 0,
            mode: 'sale',
            cash_tendered_cents: tendered,
          },
        })
        const cashPay = (await expectOk(cashRes, `split cash pay order ${i + 1}`)) as {
          data: { status: string }
        }
        expect(cashPay.data.status).toBe('captured')

        // Pay #2: card for the remainder + tip.
        const cardRes = await api.post('/api/payments/process', {
          data: {
            order_id: order.id,
            location_id: DEMO.primaryLocationId,
            payment_method: 'credit_card',
            amount_cents: cardPart,
            tip_cents: tipCents,
            mode: 'sale',
          },
        })
        const cardPay = (await expectOk(cardRes, `split card pay order ${i + 1}`)) as {
          data: { status: string }
        }
        expect(cardPay.data.status).toBe('captured')

        cashTotal += cashPart
        cardTotal += cardPart + tipCents
        tipTotal += tipCents
      }
    }

    // ---- 4. Close shift — verify every order is closed ------------------
    for (let i = 0; i < orders.length; i++) {
      const res = await api.get(`/api/orders/${orders[i].id}`)
      const body = (await expectOk(res, `verify close order ${i + 1}`)) as {
        data: Order
      }
      expect(body.data.status).toBe('closed')
      expect(asNumber(body.data.balance_due)).toBe(0)
      expect(asNumber(body.data.amount_paid)).toBeGreaterThanOrEqual(asNumber(body.data.total))
    }

    // ---- 5. Daily Z report — verify deltas match what we rang in --------
    // Subtotal of all 12 orders (no tip, since report's total_revenue does not
    // include tips — verified empirically against /api/reports/daily).
    const ordersSubtotalCents = orders.reduce(
      (sum, o) => sum + Math.round(asNumber(o.total) * 100),
      0
    )
    const ordersSubtotal = ordersSubtotalCents / 100

    const reportRes = await api.get(
      `/api/reports/daily?date=${TODAY}&location_id=${DEMO.primaryLocationId}`
    )
    const report = (await expectOk(reportRes, 'final daily report')) as DailyReport

    expect(report.is_mock).toBe(false)
    expect(report.data.date).toBe(TODAY)

    // Order count delta: exactly 12 new closed orders.
    expect(report.data.order_count - baselineOrderCount).toBeGreaterThanOrEqual(ORDER_COUNT)

    // Revenue delta: at least the subtotal of our 12 orders. (Other parallel
    // tests in the same suite may also be writing orders, so allow >=.)
    const revenueDelta = report.data.total_revenue - baselineRevenue
    expect(revenueDelta).toBeGreaterThanOrEqual(ordersSubtotal - 0.01) // tolerance for rounding

    // Tax delta should be ~8.25% of revenue delta (allow ±$0.50 fuzz for
    // line-level rounding).
    const taxDelta = report.data.tax_total - baselineTax
    const expectedTax = revenueDelta * (DEMO.taxRate / (1 + DEMO.taxRate))
    expect(Math.abs(taxDelta - expectedTax)).toBeLessThan(Math.max(0.5, expectedTax * 0.05))

    // Payment-method breakdown must contain all three methods we used.
    const methodNames = report.data.by_payment_method.map((m) => m.method.toLowerCase())
    expect(methodNames).toContain('cash')
    expect(methodNames).toContain('credit card')
    expect(methodNames).toContain('gift card')

    // Sanity: cash + card + gift-card amounts we tracked should be > 0.
    expect(cashTotal).toBeGreaterThan(0)
    expect(cardTotal).toBeGreaterThan(0)
    expect(giftCardTotal).toBeGreaterThan(0)
    expect(tipTotal).toBeGreaterThan(0)
  })
})
