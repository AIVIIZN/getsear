/**
 * CORE-5 — Owner-grade reporting proof.
 *
 * Creates real dinner-service data, then reconciles owner-facing reports from
 * the same persisted orders, payments, labor, cash drawer, product mix, void,
 * comp, and food-cost rows. This is intentionally API-level: the owner reports
 * must not depend on canned demo data or random report math.
 */

import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test'
import {
  getOrder,
  idemKey,
  MANAGER_PIN,
  newAuthedRequest,
  type AuthedContext,
} from './helpers'

const today = new Date().toISOString().split('T')[0]
const month = today.slice(0, 7)
const proofRun = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

type ApiBody<T> = { data: T; is_mock?: boolean }

type MenuCategory = { id: string }
type MenuItem = { id: string; name: string; price: string | number; cost: string | number }
type StaffMember = { id: string }
type CashDrawer = { id: string }
type DailyReport = {
  is_mock: boolean
  data: {
    total_revenue: number
    order_count: number
    food_revenue: number
    beverage_revenue: number
  }
}
type PaymentReport = { is_mock: boolean; data: Array<{ method: string; amount: number; tip_total: number }> }
type LaborReport = { is_mock: boolean; data: { total_labor_cost: number; total_hours: number; revenue: number } }
type CashReport = {
  is_mock: boolean
  data: { summary: { total_over_short: number; drawer_count: number } }
}
type ProductMixReport = { is_mock: boolean; data: Array<{ name: string; quantity_sold: number; revenue: number }> }
type FoodCostReport = {
  is_mock: boolean
  data: {
    total_theoretical: number
    food_cost_pct: number
    items: Array<{ name: string; qty_sold: number; theoretical_cost: number; actual_cost: number; variance: number }>
  }
}
type VoidCompReport = { is_mock: boolean; data: { total_void: number; total_comp: number } }
type PnLReport = {
  is_mock: boolean
  data: {
    food_revenue: number
    beverage_revenue: number
    cogs: number
    labor_cost: number
    gross_profit: number
  }
}

let ctx: AuthedContext
let request: APIRequestContext

async function expectOkJson<T>(res: APIResponse, label: string): Promise<T> {
  expect(res.ok(), `${label} failed: ${res.status()} ${await res.text()}`).toBe(true)
  return (await res.json()) as T
}

function cents(value: string | number): number {
  return Math.round(Number(value) * 100)
}

function dollars(value: number): number {
  return Math.round(value) / 100
}

function expectClose(actual: number, expected: number, label: string): void {
  expect(Math.round(actual * 100), label).toBeCloseTo(Math.round(expected * 100), 0)
}

async function createCategory(name: string): Promise<MenuCategory> {
  const res = await request.post('/api/menu/categories', {
    data: { name, color: '#007AFF', location_id: ctx.user.location_ids[0] },
  })
  const body = await expectOkJson<ApiBody<MenuCategory>>(res, `create ${name} category`)
  return body.data
}

async function createMenuItem(categoryId: string, opts: { name: string; price: string; cost: string }): Promise<MenuItem> {
  const res = await request.post('/api/menu/items', {
    data: {
      category_id: categoryId,
      location_id: ctx.user.location_ids[0],
      name: opts.name,
      price: opts.price,
      cost: opts.cost,
      prep_station: opts.name.includes('Soda') ? 'bar' : 'kitchen',
      course: opts.name.includes('Soda') ? 'beverage' : 'entree',
      is_active: true,
    },
  })
  const body = await expectOkJson<ApiBody<MenuItem>>(res, `create ${opts.name}`)
  return body.data
}

async function addOrderItem(orderId: string, item: MenuItem, quantity: number): Promise<string> {
  const res = await request.post(`/api/orders/${orderId}/items`, {
    headers: { 'Idempotency-Key': idemKey('core-5-add-item') },
    data: {
      menu_item_id: item.id,
      name: item.name,
      unit_price: Number(item.price).toFixed(2),
      quantity,
      prep_station: item.name.includes('Soda') ? 'bar' : 'kitchen',
    },
  })
  const body = await expectOkJson<ApiBody<{ id: string }>>(res, `add ${item.name}`)
  return body.data.id
}

async function getDailyReport(): Promise<DailyReport> {
  const res = await request.get(`/api/reports/daily?date=${today}&location_id=${ctx.user.location_ids[0]}`)
  return expectOkJson<DailyReport>(res, 'daily report')
}

test.beforeAll(async ({ playwright }) => {
  ctx = await newAuthedRequest(playwright)
  request = ctx.request
})

test.afterAll(async () => {
  await ctx?.request.dispose()
})

test('daily sales, labor, payments, cash, PMIX, void/comp, food cost, and prime cost reconcile to real rows', async () => {
  test.setTimeout(180_000)

  const locationId = ctx.user.location_ids[0]
  const baseline = await getDailyReport()
  const baselineRevenue = baseline.is_mock ? 0 : baseline.data.total_revenue
  const baselineOrders = baseline.is_mock ? 0 : baseline.data.order_count

  const foodCategory = await createCategory(`CORE-5 Food ${proofRun}`)
  const beverageCategory = await createCategory(`CORE-5 Beverages ${proofRun}`)
  const steak = await createMenuItem(foodCategory.id, {
    name: `CORE-5 Steak ${proofRun}`,
    price: '24.00',
    cost: '7.25',
  })
  const fries = await createMenuItem(foodCategory.id, {
    name: `CORE-5 Fries ${proofRun}`,
    price: '6.00',
    cost: '1.10',
  })
  const compDessert = await createMenuItem(foodCategory.id, {
    name: `CORE-5 Comp Dessert ${proofRun}`,
    price: '8.00',
    cost: '2.15',
  })
  const voidSoup = await createMenuItem(foodCategory.id, {
    name: `CORE-5 Void Soup ${proofRun}`,
    price: '5.00',
    cost: '1.45',
  })
  const soda = await createMenuItem(beverageCategory.id, {
    name: `CORE-5 Soda ${proofRun}`,
    price: '4.00',
    cost: '0.65',
  })

  const staffRes = await request.post('/api/staff', {
    data: {
      first_name: 'CORE5',
      last_name: `Reporter ${proofRun}`,
      display_name: `CORE5 Reporter ${proofRun}`,
      role: 'server',
      hourly_rate: '7200.00',
      location_ids: [locationId],
      hire_date: today,
    },
  })
  const staff = (await expectOkJson<ApiBody<StaffMember>>(staffRes, 'create report staff')).data
  const clockIn = await request.post(`/api/staff/${staff.id}/clock-in`, { data: { location_id: locationId } })
  expect(clockIn.status(), `clock in failed: ${await clockIn.text()}`).toBe(201)

  const drawerRes = await request.post('/api/staff/cash-drawers', {
    data: { name: `CORE-5 Drawer ${proofRun}`, location_id: locationId },
  })
  const drawer = (await expectOkJson<ApiBody<CashDrawer>>(drawerRes, 'create cash drawer')).data
  const openDrawer = await request.post(`/api/staff/cash-drawers/${drawer.id}/open`, {
    data: {
      assigned_to: staff.id,
      starting_cash: '200.00',
      denominations: { hundreds: 1, twenties: 5 },
    },
  })
  await expectOkJson(openDrawer, 'open cash drawer')
  const payOut = await request.post(`/api/staff/cash-drawers/${drawer.id}/events`, {
    data: { event_type: 'pay_out', amount: '7.00', notes: 'CORE-5 petty cash proof' },
  })
  await expectOkJson(payOut, 'cash payout')

  const orderRes = await request.post('/api/orders', {
    headers: { 'Idempotency-Key': idemKey('core-5-create-order') },
    data: {
      order_type: 'dine_in',
      location_id: locationId,
      guest_count: 2,
      source: 'pos',
      notes: `CORE-5 reporting proof ${proofRun}`,
    },
  })
  const orderId = (await expectOkJson<ApiBody<{ id: string }>>(orderRes, 'create report order')).data.id

  await addOrderItem(orderId, steak, 2)
  await addOrderItem(orderId, fries, 1)
  await addOrderItem(orderId, soda, 3)
  const compItemId = await addOrderItem(orderId, compDessert, 1)
  const voidItemId = await addOrderItem(orderId, voidSoup, 1)

  const voidRes = await request.delete(`/api/orders/${orderId}/items/${voidItemId}`, {
    data: { void_reason: 'wrong_item' },
  })
  await expectOkJson(voidRes, 'void soup')
  const compRes = await request.post(`/api/orders/${orderId}/comp`, {
    data: { order_item_id: compItemId, comp_reason: 'service_issue', comp_amount: '8.00', manager_pin: MANAGER_PIN },
  })
  await expectOkJson(compRes, 'comp dessert')

  const orderBeforePay = await getOrder(request, orderId)
  const orderTotalCents = cents(orderBeforePay.balance_due as string | number)
  expect(orderTotalCents).toBeGreaterThan(0)

  const cashCents = 2500
  const cashPay = await request.post('/api/payments/process', {
    headers: { 'Idempotency-Key': idemKey('core-5-cash-pay') },
    data: {
      order_id: orderId,
      location_id: locationId,
      payment_method: 'cash',
      amount_cents: cashCents,
      cash_tendered_cents: cashCents,
    },
  })
  await expectOkJson(cashPay, 'cash payment')

  const cardCents = orderTotalCents - cashCents
  const tipCents = 1200
  const cardPay = await request.post('/api/payments/process', {
    headers: { 'Idempotency-Key': idemKey('core-5-card-pay') },
    data: {
      order_id: orderId,
      location_id: locationId,
      payment_method: 'credit_card',
      amount_cents: cardCents,
      tip_cents: tipCents,
    },
  })
  await expectOkJson(cardPay, 'card payment')

  await new Promise((resolve) => setTimeout(resolve, 2_000))
  const clockOut = await request.post(`/api/staff/${staff.id}/clock-out`, { data: { cash_tips: '5.00' } })
  await expectOkJson(clockOut, 'clock out report staff')

  const closeDrawer = await request.post(`/api/staff/cash-drawers/${drawer.id}/close`, {
    data: {
      actual_cash: '192.50',
      denominations: { hundreds: 1, twenties: 4, tens: 1, ones: 2, quarters: 2 },
      manager_note: 'CORE-5 variance proof',
    },
  })
  await expectOkJson(closeDrawer, 'close cash drawer')

  const closedOrder = await getOrder(request, orderId)
  expect(closedOrder.status).toBe('closed')
  const expectedRevenue = Number(closedOrder.total)
  const expectedFoodRevenue = 2 * Number(steak.price) + Number(fries.price)
  const expectedBeverageRevenue = 3 * Number(soda.price)
  const expectedCogs = 2 * Number(steak.cost) + Number(fries.cost) + Number(compDessert.cost) + 3 * Number(soda.cost)

  const daily = await getDailyReport()
  expect(daily.is_mock).toBe(false)
  expect(daily.data.order_count).toBeGreaterThanOrEqual(baselineOrders + 1)
  expectClose(daily.data.total_revenue - baselineRevenue, expectedRevenue, 'daily sales delta')
  expect(daily.data.food_revenue).toBeGreaterThanOrEqual(expectedFoodRevenue)
  expect(daily.data.beverage_revenue).toBeGreaterThanOrEqual(expectedBeverageRevenue)

  const payments = await expectOkJson<PaymentReport>(
    await request.get(`/api/reports/payments?date_from=${today}&date_to=${today}&location_id=${locationId}`),
    'payments report'
  )
  expect(payments.is_mock).toBe(false)
  const paymentTotal = payments.data.reduce((sum, method) => sum + method.amount, 0)
  const tipTotal = payments.data.reduce((sum, method) => sum + method.tip_total, 0)
  expect(paymentTotal).toBeGreaterThanOrEqual(dollars(orderTotalCents))
  expect(tipTotal).toBeGreaterThanOrEqual(dollars(tipCents))

  const labor = await expectOkJson<LaborReport>(
    await request.get(`/api/reports/labor?date_from=${today}&date_to=${today}&location_id=${locationId}`),
    'labor report'
  )
  expect(labor.is_mock).toBe(false)
  expect(labor.data.total_labor_cost).toBeGreaterThan(0)
  expect(labor.data.revenue).toBeGreaterThanOrEqual(expectedRevenue)

  const cash = await expectOkJson<CashReport>(
    await request.get(`/api/reports/cash?date=${today}&location_id=${locationId}`),
    'cash report'
  )
  expect(cash.is_mock).toBe(false)
  expect(cash.data.summary.drawer_count).toBeGreaterThanOrEqual(1)
  expect(cash.data.summary.total_over_short).toBeLessThan(0)

  const productMix = await expectOkJson<ProductMixReport>(
    await request.get(`/api/reports/pmix?date_from=${today}&date_to=${today}&location_id=${locationId}`),
    'product mix report'
  )
  expect(productMix.is_mock).toBe(false)
  const steakMix = productMix.data.find((item) => item.name === steak.name)
  expect(steakMix?.quantity_sold).toBeGreaterThanOrEqual(2)
  expect(steakMix?.revenue).toBeGreaterThanOrEqual(48)

  const foodCost = await expectOkJson<FoodCostReport>(
    await request.get(`/api/reports/food-cost?date_from=${today}&date_to=${today}&location_id=${locationId}`),
    'food cost report'
  )
  expect(foodCost.is_mock).toBe(false)
  expect(foodCost.data.total_theoretical).toBeGreaterThanOrEqual(expectedCogs)
  const steakCost = foodCost.data.items.find((item) => item.name === steak.name)
  expect(steakCost?.qty_sold).toBeGreaterThanOrEqual(2)
  expect(steakCost?.theoretical_cost).toBe(14.5)
  expect(steakCost?.actual_cost).toBe(14.5)
  expect(steakCost?.variance).toBe(0)

  const voidComp = await expectOkJson<VoidCompReport>(
    await request.get(`/api/reports/voids-comps?date_from=${today}&date_to=${today}&location_id=${locationId}`),
    'void/comp report'
  )
  expect(voidComp.is_mock).toBe(false)
  expect(voidComp.data.total_void).toBeGreaterThanOrEqual(Number(voidSoup.price))
  expect(voidComp.data.total_comp).toBeGreaterThanOrEqual(Number(compDessert.price))

  const pnl = await expectOkJson<PnLReport>(
    await request.get(`/api/reports/pnl?month=${month}&location_id=${locationId}`),
    'prime cost report'
  )
  expect(pnl.is_mock).toBe(false)
  expect(pnl.data.food_revenue).toBeGreaterThanOrEqual(expectedFoodRevenue)
  expect(pnl.data.beverage_revenue).toBeGreaterThanOrEqual(expectedBeverageRevenue)
  expect(pnl.data.cogs).toBeGreaterThanOrEqual(expectedCogs)
  expect(pnl.data.labor_cost).toBeGreaterThan(0)
  expect(Number.isFinite(pnl.data.gross_profit)).toBe(true)
})
