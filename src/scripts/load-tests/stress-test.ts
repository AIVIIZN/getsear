/**
 * k6 Load Test: Stress Test — 50 Concurrent Terminals
 *
 * Simulates a full dinner rush with:
 * - 30 terminals creating orders
 * - 10 terminals checking KDS tickets
 * - 5 terminals checking table status
 * - 5 terminals running reports
 *
 * Run: k6 run --env BASE_URL=https://getsear.com src/scripts/load-tests/stress-test.ts
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import { BASE_URL, authHeaders, STRESS_THRESHOLDS } from './helpers.ts'

// Custom metrics
const orderOps = new Counter('order_operations')
const kdsOps = new Counter('kds_operations')
const tableOps = new Counter('table_operations')
const reportOps = new Counter('report_operations')
const apiLatency = new Trend('api_latency')
const errorRate = new Rate('errors')

export const options = {
  scenarios: {
    // Main POS terminals creating orders
    pos_terminals: {
      executor: 'constant-vus',
      vus: 30,
      duration: '15m',
      exec: 'posTerminal',
    },
    // KDS stations checking tickets
    kds_stations: {
      executor: 'constant-vus',
      vus: 10,
      duration: '15m',
      exec: 'kdsStation',
    },
    // Host/manager checking table status
    table_checks: {
      executor: 'constant-vus',
      vus: 5,
      duration: '15m',
      exec: 'tableCheck',
    },
    // Manager pulling reports
    report_queries: {
      executor: 'constant-vus',
      vus: 5,
      duration: '15m',
      exec: 'reportQuery',
    },
  },
  thresholds: {
    ...STRESS_THRESHOLDS,
    errors: ['rate<0.01'],
  },
}

const TEST_EMAIL = __ENV.TEST_EMAIL || 'loadtest@sear.test'
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'LoadTest123!'
const LOCATION_ID = __ENV.LOCATION_ID || ''

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  )

  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${loginRes.body}`)
  }

  const userData = loginRes.json('user') as Record<string, unknown>
  const locationId = LOCATION_ID || ((userData.location_ids as string[])?.[0] ?? '')

  return { locationId }
}

// POS Terminal: Full order lifecycle
export function posTerminal(data: { locationId: string }) {
  const headers = authHeaders()
  const { locationId } = data

  // Create order
  const start = Date.now()
  const createRes = http.post(
    `${BASE_URL}/api/orders`,
    JSON.stringify({
      order_type: ['dine_in', 'takeout', 'bar'][Math.floor(Math.random() * 3)],
      location_id: locationId,
      guest_count: Math.floor(Math.random() * 6) + 1,
      source: 'pos',
    }),
    { headers }
  )
  apiLatency.add(Date.now() - start)
  orderOps.add(1)

  if (!check(createRes, { 'order created': (r) => r.status === 201 })) {
    errorRate.add(1)
    sleep(2)
    return
  }

  const orderId = (createRes.json('data') as Record<string, unknown>).id as string
  sleep(0.5 + Math.random())

  // Add items
  for (let i = 0; i < Math.floor(Math.random() * 5) + 2; i++) {
    const itemStart = Date.now()
    http.post(
      `${BASE_URL}/api/orders/${orderId}/items`,
      JSON.stringify({
        menu_item_id: crypto.randomUUID(),
        quantity: Math.floor(Math.random() * 3) + 1,
        price_cents: Math.floor(Math.random() * 2500) + 500,
      }),
      { headers }
    )
    apiLatency.add(Date.now() - itemStart)
    sleep(0.2)
  }

  // Send to kitchen
  const sendStart = Date.now()
  http.post(`${BASE_URL}/api/orders/${orderId}/send`, '{}', { headers })
  apiLatency.add(Date.now() - sendStart)

  sleep(2 + Math.random() * 5)

  // Process payment
  const payStart = Date.now()
  http.post(
    `${BASE_URL}/api/payments/process`,
    JSON.stringify({
      order_id: orderId,
      payment_method: 'card',
      amount_cents: Math.floor(Math.random() * 8000) + 1000,
      location_id: locationId,
    }),
    { headers }
  )
  apiLatency.add(Date.now() - payStart)

  sleep(1 + Math.random() * 3)
}

// KDS Station: Polling for tickets and bumping
export function kdsStation(data: { locationId: string }) {
  const headers = authHeaders()
  const { locationId } = data

  // Fetch active tickets
  const start = Date.now()
  const ticketsRes = http.get(
    `${BASE_URL}/api/kds/tickets?location_id=${locationId}&status=pending`,
    { headers }
  )
  apiLatency.add(Date.now() - start)
  kdsOps.add(1)

  check(ticketsRes, { 'tickets fetched': (r) => r.status === 200 })

  // Simulate bump (every few polls)
  if (Math.random() < 0.3 && ticketsRes.status === 200) {
    const tickets = ticketsRes.json('data') as Array<Record<string, unknown>>
    if (tickets.length > 0) {
      const ticketId = tickets[0].id as string
      const bumpStart = Date.now()
      http.post(`${BASE_URL}/api/kds/tickets/${ticketId}/bump`, '{}', { headers })
      apiLatency.add(Date.now() - bumpStart)
    }
  }

  // KDS polls every 2-5 seconds
  sleep(2 + Math.random() * 3)
}

// Table Status: Checking floor plan
export function tableCheck(data: { locationId: string }) {
  const headers = authHeaders()
  const { locationId } = data

  // Fetch tables
  const start = Date.now()
  const tablesRes = http.get(
    `${BASE_URL}/api/tables?location_id=${locationId}`,
    { headers }
  )
  apiLatency.add(Date.now() - start)
  tableOps.add(1)

  check(tablesRes, { 'tables fetched': (r) => r.status === 200 })

  // Also check active orders
  const ordersStart = Date.now()
  http.get(`${BASE_URL}/api/orders/active?location_id=${locationId}`, { headers })
  apiLatency.add(Date.now() - ordersStart)

  // Check reservations
  const today = new Date().toISOString().split('T')[0]
  const resStart = Date.now()
  http.get(
    `${BASE_URL}/api/reservations?date_from=${today}&date_to=${today}&location_id=${locationId}`,
    { headers }
  )
  apiLatency.add(Date.now() - resStart)

  // Host checks every 5-10 seconds
  sleep(5 + Math.random() * 5)
}

// Report Queries: Manager pulling reports
export function reportQuery(data: { locationId: string }) {
  const headers = authHeaders()
  const { locationId } = data

  const today = new Date().toISOString().split('T')[0]
  const reportEndpoints = [
    `/api/reports/dashboard?location_id=${locationId}&date=${today}`,
    `/api/reports/hourly?location_id=${locationId}&date=${today}`,
    `/api/reports/speed-of-service?location_id=${locationId}`,
    `/api/reports/server-performance?location_id=${locationId}&date_from=${today}&date_to=${today}`,
  ]

  const endpoint = reportEndpoints[Math.floor(Math.random() * reportEndpoints.length)]
  const start = Date.now()
  const res = http.get(`${BASE_URL}${endpoint}`, { headers })
  apiLatency.add(Date.now() - start)
  reportOps.add(1)

  check(res, { 'report fetched': (r) => r.status === 200 })

  // Reports are pulled every 30-60 seconds
  sleep(30 + Math.random() * 30)
}
