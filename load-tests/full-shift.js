/**
 * k6 load test — Sear POS full-shift scenario
 *
 * Models a realistic Friday-night shift:
 *   - 8 simulated terminals (server iPads) ringing in orders
 *   - 4 KDS subscribers (kitchen displays) polling the ticket queue
 *   - Target throughput: 200 orders/hour sustained for ≥10 minutes (~33+ orders total)
 *
 * Run locally:
 *   k6 run load-tests/full-shift.js -e BASE_URL=http://localhost:3000
 *
 * Run against prod (on-demand only):
 *   k6 run load-tests/full-shift.js \
 *     -e BASE_URL=https://getsear.com \
 *     -e DEMO_EMAIL=demo@getsear.com \
 *     -e DEMO_PASSWORD=demo1234
 *
 * See load-tests/README.md for full documentation.
 */

import http from 'k6/http'
import { check, group, sleep } from 'k6'
import exec from 'k6/execution'
import { Counter, Rate, Trend } from 'k6/metrics'
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'

// ---------------------------------------------------------------------------
// Configuration — all secrets come from env, never hardcoded.
// DEMO_PASSWORD is required (no default literal — see CLAUDE.md security rule).
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'https://getsear.com'
const DEMO_EMAIL = __ENV.DEMO_EMAIL || 'demo@getsear.com'
const DEMO_PASSWORD = __ENV.DEMO_PASSWORD
if (!DEMO_PASSWORD) {
  throw new Error('DEMO_PASSWORD env var is required (e.g. -e DEMO_PASSWORD=demo1234 for the demo tenant). Refusing to run without explicit credentials.')
}

// Demo tenant constants (verified 2026-05-03; matches e2e/helpers.ts)
const PRIMARY_LOCATION_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'

// ---------------------------------------------------------------------------
// Custom metrics — lets us break out latency per operation type
// ---------------------------------------------------------------------------
const orderCreateTrend = new Trend('order_create_duration', true)
const addItemTrend = new Trend('add_item_duration', true)
const paymentTrend = new Trend('payment_duration', true)
const kdsPollTrend = new Trend('kds_poll_duration', true)

const ordersCompleted = new Counter('orders_completed')
const orderErrors = new Counter('order_errors')
const kdsPolls = new Counter('kds_polls')

// ---------------------------------------------------------------------------
// Thresholds — pass criteria for the load run.
// See README.md for explanation of each.
// ---------------------------------------------------------------------------
export const options = {
  scenarios: {
    /**
     * Terminal scenario: 8 VUs, each pacing at ~25 orders/hr = 1 order per 144s.
     * Total: 8 × 25 = 200 orders/hr target.
     * Duration: 12 minutes to log 40+ full orders (> 33 required by spec).
     */
    terminal: {
      executor: 'constant-vus',
      vus: 8,
      duration: '12m',
      gracefulStop: '30s',
      tags: { scenario: 'terminal' },
    },
    /**
     * KDS scenario: 4 VUs polling /api/kds/tickets every 2s, simulating
     * kitchen displays refreshing in real time.
     */
    kds: {
      executor: 'constant-vus',
      vus: 4,
      duration: '12m',
      gracefulStop: '30s',
      tags: { scenario: 'kds' },
      exec: 'kdsScenario',
    },
  },

  thresholds: {
    // p95 order-create latency < 800ms
    'order_create_duration{scenario:terminal}': [{ threshold: 'p(95)<800', abortOnFail: false }],
    // p99 across all HTTP requests < 2000ms
    'http_req_duration': [{ threshold: 'p(99)<2000', abortOnFail: false }],
    // < 1% HTTP failures (4xx/5xx)
    'http_req_failed': [{ threshold: 'rate<0.01', abortOnFail: false }],
    // > 99% of inline checks pass
    'checks': [{ threshold: 'rate>0.99', abortOnFail: false }],
  },
}

// ---------------------------------------------------------------------------
// Global setup: ONE login total for the entire test (across all VUs).
//
// Why: /api/auth/login is rate-limited to 5/IP/15min AND 5/email/15min
// (src/lib/api/rate-limit.ts:32 — auth tier). A naive "login per VU" pattern
// with 12 VUs from a single CI runner IP would trip the limit, all subsequent
// VU logins would 429, and every downstream request would 401. We take the
// cookie header from one global login and pass it to every VU via setup data.
// ---------------------------------------------------------------------------
export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  )

  check(loginRes, {
    'setup: login status 200': (r) => r.status === 200,
    'setup: user in body': (r) => {
      try { return r.json('user') !== null } catch { return false }
    },
  })

  if (loginRes.status !== 200) {
    throw new Error(`setup login failed (status ${loginRes.status}). Check DEMO_EMAIL/DEMO_PASSWORD and that ${BASE_URL} is reachable. Aborting test rather than producing meaningless 401-noise.`)
  }

  // Build a Cookie header string from the login response's Set-Cookie headers.
  // VUs cannot share a CookieJar (each VU has its own), so we serialize cookies
  // into a string and have every request attach it explicitly via headers.
  const cookieHeader = Object.entries(loginRes.cookies || {})
    .map(([name, arr]) => `${name}=${arr[0].value}`)
    .join('; ')

  if (!cookieHeader) {
    throw new Error('setup: login returned 200 but no cookies were set. Auth flow may have changed.')
  }

  // Use the session cookie to fetch menu items.
  const menuRes = http.get(
    `${BASE_URL}/api/menu/items?location_id=${PRIMARY_LOCATION_ID}`,
    { headers: { 'Content-Type': 'application/json', Cookie: cookieHeader } }
  )

  check(menuRes, {
    'setup: menu fetch 200': (r) => r.status === 200,
  })

  let menuItems = []
  if (menuRes.status === 200) {
    try {
      const body = menuRes.json()
      menuItems = (body.data || []).filter((item) => item.is_active && !item.is_86d)
    } catch (_) {
      menuItems = []
    }
  }

  // Discover KDS stations once globally (avoids ~360 station lookups/VU/run).
  const stationsRes = http.get(
    `${BASE_URL}/api/kds/stations?location_id=${PRIMARY_LOCATION_ID}`,
    { headers: { Cookie: cookieHeader } }
  )

  let kdsStationIds = []
  if (stationsRes.status === 200) {
    try {
      kdsStationIds = (stationsRes.json('data') || []).map((s) => s.id)
    } catch (_) {
      kdsStationIds = []
    }
  }

  return { menuItems, cookieHeader, kdsStationIds }
}

// ---------------------------------------------------------------------------
// Auth header builder — every VU request attaches the cookie set in setup().
// ---------------------------------------------------------------------------
function authHeaders(cookieHeader, extra) {
  return Object.assign(
    { 'Content-Type': 'application/json', Cookie: cookieHeader },
    extra || {}
  )
}

// ---------------------------------------------------------------------------
// Helper: pick N random items from the menu pool, or use a hardcoded
// fallback approach if pool is empty.
// ---------------------------------------------------------------------------
function pickRandomItems(menuItems, count) {
  if (!menuItems || menuItems.length === 0) return []
  const picked = []
  const pool = [...menuItems]
  const n = Math.min(count, pool.length)
  for (let i = 0; i < n; i++) {
    const idx = randomIntBetween(0, pool.length - 1)
    picked.push(pool.splice(idx, 1)[0])
  }
  return picked
}

// ---------------------------------------------------------------------------
// Helper: generate a UUID-shaped idempotency key
// ---------------------------------------------------------------------------
function idempotencyKey(prefix) {
  // k6 doesn't have crypto.randomUUID — approximate with Date + Math.random
  const rand = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')
  return `${prefix}-${Date.now().toString(16)}-${rand()}-${rand()}-${rand()}-${rand()}${rand()}${rand()}`
}

// ---------------------------------------------------------------------------
// TERMINAL scenario — default export (runs for the "terminal" executor)
// ---------------------------------------------------------------------------
export default function terminalScenario(data) {
  const { menuItems, cookieHeader } = data

  // Auth via cookie set in setup() — see top-of-file comment on rate-limit
  // motivation. No per-VU login.

  // -------------------------------------------------------------------------
  // 1. Create order
  // -------------------------------------------------------------------------
  let orderId = null
  let locationId = PRIMARY_LOCATION_ID

  group('create_order', () => {
    const body = {
      order_type: 'dine_in',
      location_id: locationId,
      guest_count: randomIntBetween(1, 4),
      source: 'pos',
    }

    const res = http.post(
      `${BASE_URL}/api/orders`,
      JSON.stringify(body),
      {
        headers: authHeaders(cookieHeader, {
          'Idempotency-Key': idempotencyKey('order-create'),
        }),
        tags: { type: 'order_create' },
      }
    )

    orderCreateTrend.add(res.timings.duration)

    const ok = check(res, {
      'create_order: status 201': (r) => r.status === 201,
      'create_order: has id': (r) => {
        try { return Boolean(r.json('data.id')) } catch { return false }
      },
    })

    if (ok) {
      try { orderId = res.json('data.id') } catch (_) { orderId = null }
    } else {
      orderErrors.add(1)
    }
  })

  if (!orderId) {
    // Can't proceed without an order; sleep and retry next iteration.
    sleep(randomIntBetween(2, 5))
    return
  }

  // -------------------------------------------------------------------------
  // 2. Add 2–4 random items
  // -------------------------------------------------------------------------
  const itemCount = randomIntBetween(2, 4)
  const selectedItems = pickRandomItems(menuItems, itemCount)
  let orderTotal = 0

  // If menu pool is empty (setup couldn't fetch), we still exercise the
  // endpoint with a synthetic item — this validates auth/routing while
  // gracefully degrading (the call will 400 on validation for missing
  // menu_item_id uuid but that's logged as a check failure, not a crash).
  const itemsToAdd = selectedItems.length > 0
    ? selectedItems
    : [{ id: null, name: 'Burger', price: '12.99' }]

  for (const item of itemsToAdd) {
    group('add_item', () => {
      const unitPrice = item.price ? item.price : '10.00'
      const priceCents = Math.round(parseFloat(unitPrice) * 100)
      orderTotal += priceCents

      const body = {
        menu_item_id: item.id || '00000000-0000-0000-0000-000000000000',
        name: item.name || 'Item',
        unit_price: unitPrice,
        quantity: 1,
        course: 1,
        modifiers: [],
      }

      const res = http.post(
        `${BASE_URL}/api/orders/${orderId}/items`,
        JSON.stringify(body),
        {
          headers: authHeaders(cookieHeader, {
            'Idempotency-Key': idempotencyKey('add-item'),
          }),
          tags: { type: 'add_item' },
        }
      )

      addItemTrend.add(res.timings.duration)

      check(res, {
        'add_item: status 201': (r) => r.status === 201,
      })

      if (res.status !== 201) {
        orderErrors.add(1)
      }
    })

    // Brief inter-item pause — simulates server tapping items on iPad
    sleep(0.3)
  }

  // -------------------------------------------------------------------------
  // 3. Process cash payment
  //    amount_cents = computed from items above (or a fixed floor if zero)
  // -------------------------------------------------------------------------
  group('process_payment', () => {
    const amountCents = orderTotal > 0 ? orderTotal : 1500
    const tenderedCents = amountCents + 100 // round up $1 to simulate change

    const body = {
      order_id: orderId,
      location_id: locationId,
      payment_method: 'cash',
      amount_cents: amountCents,
      tip_cents: 0,
      cash_tendered_cents: tenderedCents,
      mode: 'sale',
    }

    const res = http.post(
      `${BASE_URL}/api/payments/process`,
      JSON.stringify(body),
      {
        headers: authHeaders(cookieHeader, {
          'Idempotency-Key': idempotencyKey('payment'),
        }),
        tags: { type: 'payment' },
      }
    )

    paymentTrend.add(res.timings.duration)

    const ok = check(res, {
      'payment: status 201': (r) => r.status === 201,
      'payment: captured': (r) => {
        try { return r.json('data.status') === 'captured' } catch { return false }
      },
    })

    if (ok) {
      ordersCompleted.add(1)
    } else {
      orderErrors.add(1)
    }
  })

  // -------------------------------------------------------------------------
  // Pacing: 25 orders/hr per terminal = 1 order per 144s.
  // We subtract the time already spent in the order flow (~1–2s).
  // randomIntBetween(130, 155) adds jitter to avoid thundering-herd.
  // -------------------------------------------------------------------------
  sleep(randomIntBetween(130, 155))
}

// ---------------------------------------------------------------------------
// KDS scenario — polls /api/kds/tickets every 2s
// Stations are discovered ONCE in setup() and shared via data.kdsStationIds.
// Each VU picks one by round-robin on its scenario-local index.
// ---------------------------------------------------------------------------
export function kdsScenario(data) {
  const { cookieHeader, kdsStationIds } = data

  if (!kdsStationIds || kdsStationIds.length === 0) {
    // No stations seeded — KDS VUs will idle without polling.
    sleep(2)
    return
  }

  // exec.vu.idInScenario is the 1-based VU index local to THIS scenario
  // (whereas __VU is global across scenarios — with 8 terminal VUs running
  // first, kds VUs would have __VU values 9-12, breaking the modulo math).
  const idx = (exec.vu.idInScenario - 1) % kdsStationIds.length
  const stationId = kdsStationIds[idx]

  // Poll loop: 2s interval for the duration of the scenario
  // k6 will keep calling this function; we do one poll per call + sleep.
  group('kds_poll', () => {
    const url = `${BASE_URL}/api/kds/tickets?station_id=${stationId}&location_id=${PRIMARY_LOCATION_ID}`

    const res = http.get(url, {
      headers: authHeaders(cookieHeader),
      tags: { type: 'kds_poll' },
    })

    kdsPollTrend.add(res.timings.duration)
    kdsPolls.add(1)

    check(res, {
      'kds_poll: status 200': (r) => r.status === 200,
    })
  })

  // 2s polling interval (matches real KDS refresh rate)
  sleep(2)
}
