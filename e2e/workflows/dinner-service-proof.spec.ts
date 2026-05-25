/**
 * CORE-1 — Dinner-service proof.
 *
 * Proves the demo tenant's service loop with one realistic table check:
 * table order with a modifier → KDS ticket → expo bump → split tender →
 * receipt route → daily report delta.
 */

import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test'
import {
  cleanupOrder,
  getOrder,
  idemKey,
  newAuthedRequest,
  pickMenuItem,
  type AuthedContext,
} from './helpers'

type DiningTable = {
  id: string
  name: string
  status: string
  location_id: string
}

type Modifier = {
  id: string
  name: string
  price?: string | number
  price_adjustment?: string | number
  is_active?: boolean
}

type ModifierGroup = {
  id: string
  name: string
  modifiers?: Modifier[]
}

type KdsStation = {
  id: string
  name: string
  station_type: string
  location_id: string
}

type KdsTicket = {
  id: string
  order_id: string
  table_name: string | null
  items: Array<{
    id: string
    name: string
    modifiers: string[]
    is_bumped: boolean
  }>
}

type DailyReport = {
  is_mock: boolean
  data: {
    date: string
    total_revenue: number
    order_count: number
    by_payment_method: Array<{ method: string; amount: number }>
  }
}

const today = new Date().toISOString().split('T')[0]

function uniqueProofSuffix(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

let ctx: AuthedContext
let request: APIRequestContext

async function expectOkJson<T>(res: APIResponse, label: string): Promise<T> {
  expect(res.ok(), `${label} failed: ${res.status()} ${await res.text()}`).toBe(true)
  return (await res.json()) as T
}

async function chooseTable(): Promise<DiningTable> {
  const res = await request.get(`/api/tables?location_id=${ctx.user.location_ids[0]}`)
  const body = await expectOkJson<{ data: DiningTable[] }>(res, 'GET /api/tables')
  expect(body.data.length, 'demo tenant should have dining tables').toBeGreaterThan(0)
  return body.data.find((table) => table.status === 'available') ?? body.data[0]
}

async function chooseModifier(): Promise<{ group: ModifierGroup; modifier: Modifier }> {
  const res = await request.get('/api/menu/modifier-groups')
  const body = await expectOkJson<{ data: ModifierGroup[] }>(res, 'GET /api/menu/modifier-groups')
  for (const group of body.data) {
    const modifier = group.modifiers?.find((mod) => mod.is_active !== false)
    if (modifier) return { group, modifier }
  }
  throw new Error('demo tenant should have at least one active modifier')
}

async function getDailyReport(): Promise<DailyReport> {
  const res = await request.get(
    `/api/reports/daily?date=${today}&location_id=${ctx.user.location_ids[0]}`
  )
  return expectOkJson<DailyReport>(res, 'GET /api/reports/daily')
}

test.beforeAll(async ({ playwright }) => {
  ctx = await newAuthedRequest(playwright)
  request = ctx.request
})

test.afterAll(async () => {
  await ctx?.request.dispose()
})

test.describe('Dinner-service table order proof', () => {
  let orderId: string | undefined
  let tableId: string | undefined
  let modifierGroupId: string | undefined

  test.afterEach(async () => {
    const order = orderId ? await getOrder(request, orderId).catch(() => null) : null
    if (order && order.status !== 'closed' && order.status !== 'voided') {
      await cleanupOrder(request, orderId)
    }
    if (tableId) {
      await request.post(`/api/tables/${tableId}/clear`, { data: { mark_available: true } }).catch(() => null)
    }
    if (modifierGroupId) {
      await request.delete(`/api/menu/modifier-groups/${modifierGroupId}`).catch(() => null)
    }
    orderId = undefined
    tableId = undefined
    modifierGroupId = undefined
  })

  test('table order with modifiers flows through KDS, split tender, receipt, and report delta', async () => {
    test.setTimeout(120_000)

    const baseline = await getDailyReport()
    const baselineOrderCount = baseline.is_mock ? 0 : baseline.data.order_count
    const baselineRevenue = baseline.is_mock ? 0 : baseline.data.total_revenue

    const table = await chooseTable()
    tableId = table.id
    let { group, modifier } = await chooseModifier().catch(() => ({ group: null, modifier: null }))
    if (!group || !modifier) {
      const modifierRes = await request.post('/api/menu/modifier-groups', {
        data: {
          name: `CORE-1 Proof Mods ${uniqueProofSuffix()}`,
          is_required: false,
          min_selections: 0,
          max_selections: 1,
          modifiers: [{ name: 'Extra sauce', price: '1.25', is_active: true }],
        },
      })
      const createdModifierGroup = await expectOkJson<{ data: ModifierGroup }>(
        modifierRes,
        'create temporary modifier group'
      )
      modifierGroupId = createdModifierGroup.data.id
      group = createdModifierGroup.data
      modifier = createdModifierGroup.data.modifiers?.[0] ?? null
      if (!modifier) throw new Error('temporary modifier group should return its modifier')
    }
    const entree = await pickMenuItem(request, { priceMin: 8, priceMax: 40 })
    const dessert = await pickMenuItem(request, { priceMin: 5, priceMax: 20 })

    const createRes = await request.post('/api/orders', {
      headers: { 'Idempotency-Key': idemKey('core-1-create-table-order') },
      data: {
        order_type: 'dine_in',
        location_id: ctx.user.location_ids[0],
        table_id: table.id,
        guest_count: 2,
        source: 'pos',
        notes: `CORE-1 dinner proof ${uniqueProofSuffix()}`,
      },
    })
    const created = await expectOkJson<{ data: { id: string } }>(createRes, 'POST /api/orders')
    orderId = created.data.id

    const modifierPrice = Number(modifier.price_adjustment ?? modifier.price ?? 0).toFixed(2)
    const addEntreeRes = await request.post(`/api/orders/${orderId}/items`, {
      headers: { 'Idempotency-Key': idemKey('core-1-add-entree') },
      data: {
        menu_item_id: entree.id,
        name: entree.name,
        unit_price: entree.price,
        quantity: 1,
        seat_number: 1,
        course: 1,
        prep_station: 'kitchen',
        notes: 'allergy check: no onions',
        modifiers: [{
          modifier_id: modifier.id,
          modifier_group_id: group.id,
          name: modifier.name,
          price_adjustment: modifierPrice,
          quantity: 1,
        }],
      },
    })
    const entreeItem = await expectOkJson<{ data: { id: string } }>(addEntreeRes, 'add entree')

    const addDessertRes = await request.post(`/api/orders/${orderId}/items`, {
      headers: { 'Idempotency-Key': idemKey('core-1-add-dessert') },
      data: {
        menu_item_id: dessert.id,
        name: dessert.name,
        unit_price: dessert.price,
        quantity: 1,
        seat_number: 2,
        course: 2,
        prep_station: 'kitchen',
      },
    })
    const dessertItem = await expectOkJson<{ data: { id: string } }>(addDessertRes, 'add dessert')

    const sendRes = await request.post(`/api/orders/${orderId}/send`, {
      headers: { 'Idempotency-Key': idemKey('core-1-send') },
      data: {},
    })
    expect([200, 201]).toContain(sendRes.status())

    const stationsRes = await request.get('/api/kds/stations')
    const stations = await expectOkJson<{ data: KdsStation[] }>(stationsRes, 'GET /api/kds/stations')
    const expo = stations.data.find(
      (station) => station.location_id === ctx.user.location_ids[0] && station.station_type === 'expo'
    )
    expect(expo, 'primary location should have an expo KDS station').toBeTruthy()

    const ticketsRes = await request.get(
      `/api/kds/tickets?station_id=${expo!.id}&location_id=${ctx.user.location_ids[0]}`
    )
    const tickets = await expectOkJson<{ data: KdsTicket[] }>(ticketsRes, 'GET /api/kds/tickets')
    const ticket = tickets.data.find((candidate) => candidate.order_id === orderId)
    expect(ticket, 'sent table order should appear on expo KDS').toBeTruthy()
    expect(ticket!.table_name).toBe(table.name)
    expect(ticket!.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([entreeItem.data.id, dessertItem.data.id])
    )
    expect(ticket!.items.find((item) => item.id === entreeItem.data.id)?.modifiers).toContain(modifier.name)

    const bumpRes = await request.post(`/api/kds/tickets/${ticket!.id}/bump`, {
      data: {
        station_id: expo!.id,
        item_ids: [entreeItem.data.id, dessertItem.data.id],
      },
    })
    const bumped = await expectOkJson<{ data: { bumped_items: number } }>(bumpRes, 'KDS bump')
    expect(bumped.data.bumped_items).toBe(2)

    const readyOrder = await getOrder(request, orderId)
    expect(readyOrder.status).toBe('ready')
    const totalCents = Math.round(Number(readyOrder.total) * 100)
    expect(totalCents).toBeGreaterThan(0)

    const cashPart = Math.floor(totalCents / 2)
    const cardPart = totalCents - cashPart
    const cashRes = await request.post('/api/payments/process', {
      headers: { 'Idempotency-Key': idemKey('core-1-cash-pay') },
      data: {
        order_id: orderId,
        location_id: ctx.user.location_ids[0],
        payment_method: 'cash',
        amount_cents: cashPart,
        tip_cents: 0,
        cash_tendered_cents: Math.ceil(cashPart / 500) * 500,
      },
    })
    await expectOkJson(cashRes, 'cash split tender')

    const cardRes = await request.post('/api/payments/process', {
      headers: { 'Idempotency-Key': idemKey('core-1-card-pay') },
      data: {
        order_id: orderId,
        location_id: ctx.user.location_ids[0],
        payment_method: 'credit_card',
        amount_cents: cardPart,
        tip_cents: Math.round(cardPart * 0.18),
      },
    })
    await expectOkJson(cardRes, 'card split tender')

    const closedOrder = await getOrder(request, orderId)
    expect(closedOrder.status).toBe('closed')
    expect(Number(closedOrder.balance_due)).toBe(0)

    const receiptRes = await request.post('/api/integrations/email/receipt', {
      data: {
        location_id: ctx.user.location_ids[0],
        order_id: orderId,
        email: `core-1-receipt-${uniqueProofSuffix()}@example.com`,
      },
    })
    const receipt = await expectOkJson<{ data: { sent: boolean; error?: string } }>(receiptRes, 'receipt route')
    expect(typeof receipt.data.sent).toBe('boolean')
    if (!receipt.data.sent) {
      expect(receipt.data.error ?? '').toMatch(/sendgrid|configured|disabled|limit|duplicate/i)
    }

    const final = await getDailyReport()
    expect(final.is_mock).toBe(false)
    expect(final.data.order_count - baselineOrderCount).toBeGreaterThanOrEqual(1)
    expect(final.data.total_revenue - baselineRevenue).toBeGreaterThanOrEqual(
      totalCents / 100 - 0.01
    )
    const methods = final.data.by_payment_method.map((method) => method.method.toLowerCase())
    expect(methods).toEqual(expect.arrayContaining(['cash', 'credit card']))
  })
})
