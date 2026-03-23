/**
 * k6 Load Test: Normal Dinner Rush
 *
 * Scenario: 10 concurrent POS terminals creating orders for 5 minutes.
 * Each terminal: create order -> add items -> send to kitchen -> process payment
 *
 * Run: k6 run --env BASE_URL=https://getsear.com src/scripts/load-tests/dinner-rush.ts
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { BASE_URL, authHeaders, STANDARD_THRESHOLDS } from './helpers.ts'

// Custom metrics
const orderCreateDuration = new Trend('order_create_duration')
const paymentDuration = new Trend('payment_duration')
const errorRate = new Rate('errors')

export const options = {
  scenarios: {
    dinner_service: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
    },
  },
  thresholds: {
    ...STANDARD_THRESHOLDS,
    order_create_duration: ['p(95)<400'],
    payment_duration: ['p(95)<600'],
  },
}

// Test user credentials (configured per environment)
const TEST_EMAIL = __ENV.TEST_EMAIL || 'loadtest@sear.test'
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'LoadTest123!'
const LOCATION_ID = __ENV.LOCATION_ID || ''

export function setup() {
  // Login to get session cookies
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  )

  check(loginRes, { 'login successful': (r) => r.status === 200 })

  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${loginRes.body}`)
  }

  const userData = loginRes.json('user') as Record<string, unknown>
  const locationId = LOCATION_ID || ((userData.location_ids as string[])?.[0] ?? '')

  // Fetch menu items for order creation
  const menuRes = http.get(`${BASE_URL}/api/menu/items?location_id=${locationId}`, {
    headers: authHeaders(),
  })

  let menuItemIds: string[] = []
  if (menuRes.status === 200) {
    const items = menuRes.json('data') as Array<Record<string, unknown>>
    menuItemIds = items.map((item) => item.id as string)
  }

  return {
    locationId,
    menuItemIds: menuItemIds.length > 0 ? menuItemIds : ['placeholder-item-id'],
  }
}

export default function (data: { locationId: string; menuItemIds: string[] }) {
  const { locationId, menuItemIds } = data
  const headers = authHeaders()

  // Step 1: Create a new order
  const orderStart = Date.now()
  const createRes = http.post(
    `${BASE_URL}/api/orders`,
    JSON.stringify({
      order_type: 'dine_in',
      location_id: locationId,
      guest_count: Math.floor(Math.random() * 4) + 1,
      source: 'pos',
    }),
    { headers }
  )
  orderCreateDuration.add(Date.now() - orderStart)

  const orderCreated = check(createRes, {
    'order created': (r) => r.status === 201,
  })

  if (!orderCreated) {
    errorRate.add(1)
    sleep(1)
    return
  }

  const order = createRes.json('data') as Record<string, unknown>
  const orderId = order.id as string

  // Brief pause (server thinking about the order)
  sleep(0.5 + Math.random() * 1)

  // Step 2: Add 3-5 items to the order
  const itemCount = Math.floor(Math.random() * 3) + 3
  for (let i = 0; i < itemCount; i++) {
    const menuItemId = menuItemIds[Math.floor(Math.random() * menuItemIds.length)]
    const addItemRes = http.post(
      `${BASE_URL}/api/orders/${orderId}/items`,
      JSON.stringify({
        menu_item_id: menuItemId,
        quantity: Math.floor(Math.random() * 2) + 1,
        price_cents: Math.floor(Math.random() * 2000) + 500,
      }),
      { headers }
    )

    check(addItemRes, { 'item added': (r) => r.status === 201 || r.status === 200 })
    sleep(0.2)
  }

  // Step 3: Send order to kitchen
  const sendRes = http.post(
    `${BASE_URL}/api/orders/${orderId}/send`,
    JSON.stringify({}),
    { headers }
  )
  check(sendRes, { 'order sent': (r) => r.status === 200 })

  // Wait for "cooking" time
  sleep(2 + Math.random() * 3)

  // Step 4: Process payment
  const paymentStart = Date.now()
  const payRes = http.post(
    `${BASE_URL}/api/payments/process`,
    JSON.stringify({
      order_id: orderId,
      payment_method: 'card',
      amount_cents: Math.floor(Math.random() * 5000) + 1500,
      location_id: locationId,
    }),
    { headers }
  )
  paymentDuration.add(Date.now() - paymentStart)

  const paymentProcessed = check(payRes, {
    'payment processed': (r) => r.status === 200 || r.status === 201,
  })

  if (!paymentProcessed) {
    errorRate.add(1)
  }

  // Brief pause between orders
  sleep(1 + Math.random() * 2)
}
