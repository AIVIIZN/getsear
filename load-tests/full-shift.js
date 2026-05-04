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
import { Counter, Rate, Trend } from 'k6/metrics'
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'

// ---------------------------------------------------------------------------
// Configuration — all secrets come from env, never hardcoded.
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'https://getsear.com'
const DEMO_EMAIL = __ENV.DEMO_EMAIL || 'demo@getsear.com'
const DEMO_PASSWORD = __ENV.DEMO_PASSWORD || 'demo1234'

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
// Per-VU setup: login once, fetch menu items to populate the item pool.
// ---------------------------------------------------------------------------
export function setup() {
  // Each scenario will login inside its own VU init section, but we use
  // setup() here to validate reachability and return the menu item pool.
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
    // Return minimal fallback — tests will hit auth errors and fail their checks
    return { menuItems: [] }
  }

  // Use the session cookie established by login to fetch menu items.
  const menuRes = http.get(
    `${BASE_URL}/api/menu/items?location_id=${PRIMARY_LOCATION_ID}`,
    { headers: { 'Content-Type': 'application/json' } }
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

  // Return menu pool for use in per-VU scenarios.
  // If the menu fetch failed (e.g., no active session in setup context)
  // fall back to an empty list — tests will use the fallback item path.
  return { menuItems }
}

// ---------------------------------------------------------------------------
// Helper: login a single VU and return the session cookie jar.
// k6 persists cookies per VU automatically when using http.cookieJar().
// ---------------------------------------------------------------------------
function loginVU() {
  const jar = http.cookieJar()

  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { type: 'auth' },
    }
  )

  const ok = check(loginRes, {
    'login: status 200': (r) => r.status === 200,
    'login: has user': (r) => {
      try { return Boolean(r.json('user.id')) } catch { return false }
    },
  })

  if (!ok) {
    // Non-fatal: subsequent API calls will return 401 and be counted in checks.
    return jar
  }

  return jar
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
  const { menuItems } = data

  // Login once per VU (k6 calls this function in a loop per VU iteration,
  // but cookies persist on the VU's jar across iterations, so subsequent
  // login calls will be fast no-ops if the session is still valid).
  loginVU()

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
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey('order-create'),
        },
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
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey('add-item'),
          },
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
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey('payment'),
        },
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
// Requires a real kds_station id. We use /api/kds/stations to discover one,
// then poll tickets for it.
// ---------------------------------------------------------------------------
export function kdsScenario(data) {
  // Login the KDS VU
  loginVU()

  // Discover a KDS station for this location
  let stationId = null

  const stationsRes = http.get(
    `${BASE_URL}/api/kds/stations?location_id=${PRIMARY_LOCATION_ID}`,
    { tags: { type: 'kds_setup' } }
  )

  check(stationsRes, {
    'kds: stations fetch ok': (r) => r.status === 200,
  })

  if (stationsRes.status === 200) {
    try {
      const stations = stationsRes.json('data') || []
      if (stations.length > 0) {
        // Each KDS VU picks a different station by VU index (round-robin)
        // __VU is the 1-based VU index within this executor
        const idx = (__VU - 1) % stations.length
        stationId = stations[idx].id
      }
    } catch (_) { /* fall through */ }
  }

  if (!stationId) {
    // No stations seeded — KDS VUs will spin without polling
    sleep(2)
    return
  }

  // Poll loop: 2s interval for the duration of the scenario
  // k6 will keep calling this function; we do one poll per call + sleep.
  group('kds_poll', () => {
    const url = `${BASE_URL}/api/kds/tickets?station_id=${stationId}&location_id=${PRIMARY_LOCATION_ID}`

    const res = http.get(url, {
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
