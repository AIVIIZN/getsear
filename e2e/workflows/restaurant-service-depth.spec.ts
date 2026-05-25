/**
 * CORE-4 — Restaurant-service depth proof.
 *
 * Covers the remaining dinner-service depth surface beyond CORE-1:
 * coursing, bar-tab preauth, split checks, expo recall/refire, seat numbers,
 * allergy warnings, table-turn coaching, tip pooling, and server checkout.
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

type KdsStation = {
  id: string
  name: string
  station_type: string
  location_id: string
}

type KdsTicketItem = {
  id: string
  special_instructions: string
  seat_number: number | null
  course: number
  is_fired: boolean
  is_refire: boolean
  refire_count: number
}

type KdsTicket = {
  id: string
  order_id: string
  table_name: string | null
  priority: string
  items: KdsTicketItem[]
}

type StaffMember = {
  id: string
  first_name: string
  last_name: string
  role: string
  is_clocked_in: boolean
}

type ServerCheckout = {
  totalChecks: number
  netSalesCents: number
  cardTipsCents: number
  tipOutReceivedCents: number
  cashOwedToHouseCents: number
}

const today = new Date().toISOString().split('T')[0]
const proofRun = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

let ctx: AuthedContext
let request: APIRequestContext

async function expectOkJson<T>(res: APIResponse, label: string): Promise<T> {
  expect(res.ok(), `${label} failed: ${res.status()} ${await res.text()}`).toBe(true)
  return (await res.json()) as T
}

async function chooseAvailableTable(): Promise<DiningTable> {
  const res = await request.get(`/api/tables?location_id=${ctx.user.location_ids[0]}`)
  const body = await expectOkJson<{ data: DiningTable[] }>(res, 'GET /api/tables')
  expect(body.data.length, 'demo tenant should have dining tables').toBeGreaterThan(0)
  return body.data.find((table) => table.status === 'available') ?? body.data[0]
}

async function chooseExpoStation(): Promise<KdsStation> {
  const res = await request.get('/api/kds/stations')
  const body = await expectOkJson<{ data: KdsStation[] }>(res, 'GET /api/kds/stations')
  const station = body.data.find(
    (candidate) =>
      candidate.location_id === ctx.user.location_ids[0] && candidate.station_type === 'expo'
  )
  expect(station, 'primary location should have an expo station').toBeTruthy()
  return station!
}

async function createTempServer(): Promise<StaffMember> {
  const res = await request.post('/api/staff', {
    data: {
      first_name: 'CORE4',
      last_name: `Server ${proofRun}`,
      display_name: `CORE4 Server ${proofRun}`,
      role: 'server',
      hourly_rate: '18.00',
      location_ids: [ctx.user.location_ids[0]],
      hire_date: today,
    },
  })
  const body = await expectOkJson<{ data: StaffMember }>(res, 'create temporary server')
  return body.data
}

async function addItem(
  orderId: string,
  opts: {
    course: number
    seat: number
    notes?: string
    prepStation?: string
    priceMin?: number
    priceMax?: number
  }
): Promise<{ itemId: string; price: string }> {
  const item = await pickMenuItem(request, {
    priceMin: opts.priceMin ?? 8,
    priceMax: opts.priceMax ?? 40,
  })
  const res = await request.post(`/api/orders/${orderId}/items`, {
    headers: { 'Idempotency-Key': idemKey('core-4-add-item') },
    data: {
      menu_item_id: item.id,
      name: item.name,
      unit_price: item.price,
      quantity: 1,
      seat_number: opts.seat,
      course: opts.course,
      prep_station: opts.prepStation ?? 'kitchen',
      notes: opts.notes ?? '',
    },
  })
  const body = await expectOkJson<{ data: { id: string } }>(res, 'add course item')
  return { itemId: body.data.id, price: item.price }
}

async function fetchTicket(expo: KdsStation, orderId: string): Promise<KdsTicket> {
  const ticketsRes = await request.get(
    `/api/kds/tickets?station_id=${expo.id}&location_id=${ctx.user.location_ids[0]}`
  )
  const tickets = await expectOkJson<{ data: KdsTicket[] }>(ticketsRes, 'GET /api/kds/tickets')
  const ticket = tickets.data.find((candidate) => candidate.order_id === orderId)
  expect(ticket, `order ${orderId} should be visible on expo`).toBeTruthy()
  return ticket!
}

async function processPaymentWithRetry(
  data: Record<string, unknown>,
  label: string
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await request.post('/api/payments/process', {
      headers: { 'Idempotency-Key': idemKey(`${label}-${attempt}`) },
      data,
    })
    if (res.status() === 201) return
    const text = await res.text()
    if (res.status() !== 402 || attempt === 2) {
      throw new Error(`${label} failed: ${res.status()} ${text}`)
    }
  }
}

test.beforeAll(async ({ playwright }) => {
  ctx = await newAuthedRequest(playwright)
  request = ctx.request
})

test.afterAll(async () => {
  await ctx?.request.dispose()
})

test.describe('CORE-4 restaurant-service depth', () => {
  const ordersToCleanup: string[] = []
  let tempServerId: string | undefined
  let tableId: string | undefined

  test.afterEach(async () => {
    for (const orderId of ordersToCleanup) await cleanupOrder(request, orderId)
    ordersToCleanup.length = 0
    if (tableId) {
      await request.post(`/api/tables/${tableId}/clear`, { data: { mark_available: true } }).catch(() => null)
      tableId = undefined
    }
    if (tempServerId) {
      await request.post(`/api/staff/${tempServerId}/clock-out`, { data: { cash_tips: '0.00' } }).catch(() => null)
      await request.delete(`/api/staff/${tempServerId}`).catch(() => null)
      tempServerId = undefined
    }
  })

  test('coursing, tabs, split checks, expo/refire, turns, tips, and checkout work together', async () => {
    test.setTimeout(180_000)

    const locationId = ctx.user.location_ids[0]
    const tempServer = await createTempServer()
    tempServerId = tempServer.id

    const clockInRes = await request.post(`/api/staff/${tempServer.id}/clock-in`, {
      data: { location_id: locationId },
    })
    expect(clockInRes.status(), `clock-in failed: ${await clockInRes.text()}`).toBe(201)

    const table = await chooseAvailableTable()
    tableId = table.id
    const seatRes = await request.post(`/api/tables/${table.id}/seat`, {
      data: { guest_count: 4, server_id: tempServer.id },
    })
    await expectOkJson(seatRes, 'seat table')

    const createRes = await request.post('/api/orders', {
      headers: { 'Idempotency-Key': idemKey('core-4-create-table-order') },
      data: {
        order_type: 'dine_in',
        location_id: locationId,
        table_id: table.id,
        guest_count: 4,
        source: 'pos',
        notes: `CORE-4 service proof ${proofRun}`,
      },
    })
    const created = await expectOkJson<{ data: { id: string; version?: number } }>(
      createRes,
      'create dine-in order'
    )
    const tableOrderId = created.data.id
    ordersToCleanup.push(tableOrderId)

    const transferRes = await request.post(`/api/orders/${tableOrderId}/transfer`, {
      data: { server_id: tempServer.id },
    })
    await expectOkJson(transferRes, 'transfer order to temporary server')

    const firstCourse = await addItem(tableOrderId, {
      course: 1,
      seat: 1,
      notes: 'ALLERGY: shellfish. Use clean pan.',
      prepStation: 'kitchen',
    })
    const secondCourse = await addItem(tableOrderId, {
      course: 2,
      seat: 3,
      notes: 'Fire after appetizers',
      prepStation: 'kitchen',
      priceMin: 10,
      priceMax: 35,
    })

    const fireOne = await request.post(`/api/orders/${tableOrderId}/fire-course`, {
      data: { course: 1 },
    })
    const firedOne = await expectOkJson<{ data: { items_fired: number } }>(fireOne, 'fire course 1')
    expect(firedOne.data.items_fired).toBe(1)

    const fireTwo = await request.post(`/api/orders/${tableOrderId}/fire-course`, {
      data: { course: 2 },
    })
    const firedTwo = await expectOkJson<{ data: { items_fired: number } }>(fireTwo, 'fire course 2')
    expect(firedTwo.data.items_fired).toBe(1)

    const sendRes = await request.post(`/api/orders/${tableOrderId}/send`, {
      headers: { 'Idempotency-Key': idemKey('core-4-send-table') },
      data: {},
    })
    expect([200, 201]).toContain(sendRes.status())

    const expo = await chooseExpoStation()
    const initialTicket = await fetchTicket(expo, tableOrderId)
    expect(initialTicket.table_name).toBe(table.name)
    expect(initialTicket.items.map((item) => item.seat_number)).toEqual(expect.arrayContaining([1, 3]))
    expect(initialTicket.items.map((item) => item.course)).toEqual(expect.arrayContaining([1, 2]))
    expect(initialTicket.items.find((item) => item.id === firstCourse.itemId)?.special_instructions)
      .toMatch(/allergy: shellfish/i)
    expect(initialTicket.items.find((item) => item.id === firstCourse.itemId)?.is_fired).toBe(true)

    const bumpFirst = await request.post(
      `/api/kds/tickets/${initialTicket.id}/items/${firstCourse.itemId}/bump`,
      { data: { station_id: expo.id } }
    )
    await expectOkJson(bumpFirst, 'bump first course item')

    const refireRes = await request.post(
      `/api/kds/tickets/${initialTicket.id}/items/${firstCourse.itemId}/refire`,
      {
        data: {
          station_id: expo.id,
          reason_code: 'contamination',
        },
      }
    )
    const refired = await expectOkJson<{ data: { refire_count: number } }>(refireRes, 'refire item')
    expect(refired.data.refire_count).toBeGreaterThanOrEqual(1)

    const refireTicket = await fetchTicket(expo, tableOrderId)
    expect(refireTicket.priority).toBe('refire')
    const refireItem = refireTicket.items.find((item) => item.id === firstCourse.itemId)
    expect(refireItem?.is_refire).toBe(true)

    const bumpAll = await request.post(`/api/kds/tickets/${initialTicket.id}/bump`, {
      data: { station_id: expo.id, item_ids: [firstCourse.itemId, secondCourse.itemId] },
    })
    const bumpedAll = await expectOkJson<{ data: { bumped_items: number } }>(bumpAll, 'bump whole ticket')
    expect(bumpedAll.data.bumped_items).toBe(2)

    const splitRes = await request.post(`/api/orders/${tableOrderId}/split`, {
      data: { mode: 'equal', split_count: 2 },
    })
    const split = await expectOkJson<{ data: { new_order_ids: string[] } }>(splitRes, 'split check in two')
    expect(split.data.new_order_ids).toHaveLength(1)
    ordersToCleanup.push(...split.data.new_order_ids)

    const splitOrderIds = [tableOrderId, ...split.data.new_order_ids]
    for (const [index, orderId] of splitOrderIds.entries()) {
      const order = await getOrder(request, orderId)
      const balanceCents = Math.round(Number(order.balance_due) * 100)
      expect(balanceCents).toBeGreaterThan(0)
      await processPaymentWithRetry({
        order_id: orderId,
        location_id: locationId,
        payment_method: index === 0 ? 'cash' : 'credit_card',
        amount_cents: balanceCents,
        tip_cents: index === 0 ? 0 : Math.round(balanceCents * 0.2),
        ...(index === 0 ? { cash_tendered_cents: balanceCents } : {}),
      }, `pay split ${index + 1}`)
      const closed = await getOrder(request, orderId)
      expect(closed.status).toBe('closed')
    }

    const barCreate = await request.post('/api/orders', {
      headers: { 'Idempotency-Key': idemKey('core-4-create-bar-tab') },
      data: {
        order_type: 'bar',
        location_id: locationId,
        guest_name: `CORE-4 Bar ${proofRun}`,
        guest_phone: '+15125550104',
        source: 'pos',
      },
    })
    const barOrder = await expectOkJson<{ data: { id: string } }>(barCreate, 'create bar tab')
    ordersToCleanup.push(barOrder.data.id)
    await addItem(barOrder.data.id, { course: 1, seat: 1, prepStation: 'bar', priceMin: 5, priceMax: 18 })

    let preauth: { transaction_id: string; auth_amount_cents: number } | null = null
    for (let attempt = 0; attempt < 3 && !preauth; attempt++) {
      const preauthRes = await request.post('/api/payments/preauth', {
        data: {
          order_id: barOrder.data.id,
          terminal_id: '11111111-1111-4111-8111-111111111111',
          amount_cents: 5000 + attempt * 100,
        },
      })
      if (preauthRes.status() === 201) {
        const body = await preauthRes.json() as { data: { transaction_id: string; auth_amount_cents: number } }
        preauth = body.data
      } else {
        expect([402]).toContain(preauthRes.status())
      }
    }
    expect(preauth, 'bar tab preauth should approve within three mock attempts').toBeTruthy()

    const incrementRes = await request.post(`/api/payments/preauth/${preauth!.transaction_id}/increment`, {
      data: { additional_amount_cents: 1500 },
    })
    const increment = await expectOkJson<{ data: { new_auth_cents: number } }>(
      incrementRes,
      'increment bar preauth'
    )
    expect(increment.data.new_auth_cents).toBe(preauth!.auth_amount_cents + 1500)

    const captureRes = await request.post(`/api/payments/preauth/${preauth!.transaction_id}/capture`, {
      data: { final_amount_cents: 3200, tip_cents: 640 },
    })
    const capture = await expectOkJson<{ data: { captured_amount_cents: number } }>(
      captureRes,
      'capture bar tab with tip'
    )
    expect(capture.data.captured_amount_cents).toBe(3840)

    const clearRes = await request.post(`/api/tables/${table.id}/clear`, {
      data: { mark_available: true },
    })
    await expectOkJson(clearRes, 'clear table for turn history')
    tableId = undefined

    const turnTimes = await request.get(`/api/tables/turn-times?date_from=${today}&date_to=${today}&group_by=table`)
    const turns = await expectOkJson<{ data: { summary: { total_turns: number }; grouped: Array<{ label: string }> } }>(
      turnTimes,
      'turn-time coaching report'
    )
    expect(turns.data.summary.total_turns).toBeGreaterThanOrEqual(1)
    expect(turns.data.grouped.map((group) => group.label)).toContain(table.name)

    const tipPoolRes = await request.post('/api/staff/tips/distribute', {
      data: {
        date: today,
        location_id: locationId,
        total_pool_amount: '12.50',
        distributions: [{ user_id: tempServer.id, amount: '12.50' }],
      },
    })
    expect([200, 201]).toContain(tipPoolRes.status())

    const checkoutRes = await request.post('/api/staff/checkout', {
      data: {
        user_id: tempServer.id,
        date: today,
        location_id: locationId,
        cash_tips_declared_cents: 500,
        starting_cash_cents: 20000,
      },
    })
    const checkout = await expectOkJson<{ data: ServerCheckout }>(checkoutRes, 'server checkout')
    expect(checkout.data.totalChecks).toBeGreaterThanOrEqual(2)
    expect(checkout.data.netSalesCents).toBeGreaterThan(0)
    expect(checkout.data.cardTipsCents).toBeGreaterThan(0)
    expect(checkout.data.tipOutReceivedCents).toBe(1250)
    expect(Number.isFinite(checkout.data.cashOwedToHouseCents)).toBe(true)
  })
})
