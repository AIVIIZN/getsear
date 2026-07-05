/**
 * Helpers shared across the V5.5.2 cross-module scenario specs.
 *
 * These build on the demo-tenant seed data verified 2026-05-03:
 *   - Login: demo@getsear.com / demo1234 (Marcus Rivera, owner)
 *   - org_id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
 *   - 3 locations; primary is "Downtown Austin"
 *   - 30+ menu items across 8 categories
 *   - tax rate 0.0825
 *
 * Each scenario test runs against live prod (https://getsear.com) and
 * creates / tears down its own state via the API.
 *
 * Sister batches:
 *   - 5.5.1 owns e2e/workflows/full-shift.spec.ts and e2e/helpers.ts.
 *   - 5.5.3 owns playwright.config.ts + the offline-queue spec.
 * Anything new shared by multiple 5.5.2 specs lives here.
 */

import { type APIRequestContext, expect } from '@playwright/test'
import crypto from 'node:crypto'
import { buildAuthedContext } from '../auth-state'

/**
 * The `playwright` fixture (not `browser`!) is what gives us a request
 * factory inside a beforeAll hook that doesn't need a browser instance.
 * We type it as `unknown` and re-narrow to avoid coupling these helpers
 * to Playwright's deep test types.
 */
type PlaywrightFixture = {
  request: {
    newContext: (options: {
      baseURL: string
      ignoreHTTPSErrors?: boolean
    }) => Promise<APIRequestContext>
  }
}

export const DEMO_EMAIL = 'demo@getsear.com'
export const DEMO_PASSWORD = 'demo1234'
export const PROD_BASE_URL = 'https://getsear.com'
export const E2E_BASE_URL = process.env.E2E_BASE_URL ?? PROD_BASE_URL

/**
 * Verified against prod 2026-05-03 via /api/auth/verify-manager-pin:
 *   "5678" → Robert Johnson, role=manager.
 * Used by any spec that needs a real post-close manager-PIN approval.
 */
export const MANAGER_PIN = '5678'

export interface AuthedContext {
  request: APIRequestContext
  user: AuthedUser
}

export interface AuthedUser {
  id: string
  org_id: string
  role: string
  email: string
  display_name: string
  location_ids: string[]
}

/**
 * Build an APIRequestContext that is logged in as the demo owner and ready
 * to talk to prod. Caller passes the `playwright` test fixture and is
 * responsible for `dispose()` in `afterAll`.
 */
export async function newAuthedRequest(
  playwright: PlaywrightFixture
): Promise<AuthedContext> {
  const { request, user } = await buildAuthedContext(playwright)
  return { request, user: user as AuthedUser }
}

/**
 * Generate a fresh Idempotency-Key for a mutating request. The Sear server
 * validates this header against UUIDv4 strictly, so the label parameter is
 * accepted but not embedded — kept on the API for future tracing if the
 * server relaxes the format. Returns a fresh randomUUID() each call.
 */
export function idemKey(_label?: string): string {
  return crypto.randomUUID()
}

/**
 * Pick a known menu item to use in tests. We don't pin to a specific UUID
 * because the seed drifts; instead we grab any active item and return its
 * essentials. `priceMin`/`priceMax` constrain the range so tests that need
 * a "small" or "expensive" item can find one.
 */
export interface MenuItem {
  id: string
  name: string
  /** Price always normalized to a 2-decimal string regardless of how prod
   *  serializes it (numeric vs string). */
  price: string
  category_id: string
}

interface RawMenuItem {
  id: string
  name: string
  price: string | number
  category_id: string
}

export async function pickMenuItem(
  request: APIRequestContext,
  opts: { priceMin?: number; priceMax?: number } = {}
): Promise<MenuItem> {
  const res = await request.get('/api/menu/items')
  expect(res.status()).toBe(200)
  const body = (await res.json()) as { data: RawMenuItem[] }
  const candidates = body.data.filter((it) => {
    const p = typeof it.price === 'number' ? it.price : parseFloat(it.price)
    if (Number.isNaN(p)) return false
    if (opts.priceMin !== undefined && p < opts.priceMin) return false
    if (opts.priceMax !== undefined && p > opts.priceMax) return false
    return true
  })
  expect(candidates.length, 'at least one menu item should match price range').toBeGreaterThan(0)
  const raw = candidates[0]
  const numericPrice = typeof raw.price === 'number' ? raw.price : parseFloat(raw.price)
  return {
    id: raw.id,
    name: raw.name,
    category_id: raw.category_id,
    // Server expects a /^\d+(\.\d{1,2})?$/ string for unit_price.
    price: numericPrice.toFixed(2),
  }
}

/**
 * Create a draft order with one menu item already on it. Returns
 * { orderId, locationId, item, version }. Caller is responsible for
 * deleting / voiding the order in afterEach.
 */
export async function createOrderWithItem(
  ctx: AuthedContext,
  opts: {
    orderType?: 'dine_in' | 'takeout' | 'delivery' | 'bar' | 'catering' | 'online' | 'kiosk' | 'drive_thru' | 'qr'
    quantity?: number
  } = {}
): Promise<{ orderId: string; locationId: string; item: MenuItem; itemId: string }> {
  const locationId = ctx.user.location_ids[0]
  const item = await pickMenuItem(ctx.request, { priceMin: 5, priceMax: 50 })

  const orderRes = await ctx.request.post('/api/orders', {
    headers: { 'Idempotency-Key': idemKey('create-order') },
    data: {
      order_type: opts.orderType ?? 'takeout',
      location_id: locationId,
      guest_count: 1,
    },
  })
  expect(orderRes.status(), `create order failed: ${await orderRes.text()}`).toBe(201)
  const orderBody = (await orderRes.json()) as { data: { id: string } }
  const orderId = orderBody.data.id

  const itemRes = await ctx.request.post(`/api/orders/${orderId}/items`, {
    headers: { 'Idempotency-Key': idemKey('add-item') },
    data: {
      menu_item_id: item.id,
      name: item.name,
      unit_price: item.price,
      quantity: opts.quantity ?? 1,
    },
  })
  expect(itemRes.status(), `add item failed: ${await itemRes.text()}`).toBe(201)
  const itemBody = (await itemRes.json()) as { data: { id: string } }

  return { orderId, locationId, item, itemId: itemBody.data.id }
}

/**
 * Best-effort cleanup of an order that the test created. Routes through the
 * canonical void endpoint (5.99.3 closed the DELETE side-door). If the void
 * 4xxs (e.g. order is already in a terminal state) we ignore — closed/voided
 * orders shouldn't be force-mutated from a cleanup hook anyway.
 */
export async function cleanupOrder(
  request: APIRequestContext,
  orderId: string | undefined
): Promise<void> {
  if (!orderId) return
  try {
    await request.post(`/api/orders/${orderId}/void`, {
      data: { reason: 'other', notes: 'e2e cleanup' },
    })
  } catch {
    // swallow — best-effort cleanup, tests should not fail because of it
  }
}

/**
 * Pay a balance in cash through the standard payment endpoint. Accepts the
 * order's current balance_due in cents; tip defaults to zero. Returns the
 * raw payment response so callers can inspect `change_due_cents` etc.
 */
export async function payCash(
  ctx: AuthedContext,
  orderId: string,
  locationId: string,
  amountCents: number,
  opts: { tipCents?: number; tenderedCents?: number } = {}
): Promise<Record<string, unknown>> {
  const res = await ctx.request.post('/api/payments/process', {
    headers: { 'Idempotency-Key': idemKey('pay-cash') },
    data: {
      order_id: orderId,
      location_id: locationId,
      payment_method: 'cash',
      amount_cents: amountCents,
      tip_cents: opts.tipCents ?? 0,
      cash_tendered_cents: opts.tenderedCents ?? amountCents + (opts.tipCents ?? 0),
    },
  })
  expect(res.status(), `cash pay failed: ${await res.text()}`).toBe(201)
  const body = (await res.json()) as { data: Record<string, unknown> }
  return body.data
}

/** Convenience: read fully-hydrated order (with items + version). */
export async function getOrder(
  request: APIRequestContext,
  orderId: string
): Promise<Record<string, unknown> & { version?: number }> {
  const res = await request.get(`/api/orders/${orderId}`)
  expect(res.status()).toBe(200)
  const body = (await res.json()) as { data: Record<string, unknown> }
  return body.data
}

/** Generate a 16-char alphanumeric gift card number unique to this test run. */
export function freshGiftCardNumber(): string {
  return `E2E${crypto.randomBytes(8).toString('hex').toUpperCase().slice(0, 13)}`
}
