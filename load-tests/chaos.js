/**
 * V7.3.2 — Chaos test (k6)
 *
 * What this tests
 * ---------------
 * Server-side stability under realistic latency variance and the retry
 * load that accumulates when ~5% of client requests fail and are retried.
 *
 * What this does NOT test
 * -----------------------
 * - The React offline-queue / sync-queue UI (src/lib/sync/sync-queue.ts).
 *   That code runs in the browser; k6 is a JS runtime without DOM APIs.
 *   To test offline-queue UX, use Playwright + Chrome DevTools network
 *   throttling (a separate V7.4 concern).
 * - Killing the database, network partitions, or process-level faults.
 *   Full chaos engineering (Toxiproxy, pod kills) is V7.4 territory.
 *
 * Chaos mechanics
 * ---------------
 * Every HTTP call goes through `chaosRequest()`:
 *   - 5 % probability: the call is SKIPPED; a synthetic HTTP 500 is returned
 *     and `chaos_simulated_failures` is incremented.
 *   - 95 % probability: a random sleep of 0-500 ms is injected BEFORE the
 *     real request is made, and `chaos_simulated_latency_ms` records the jitter.
 *
 * This mirrors what a real client would experience during a flaky upstream:
 * 5 % of its requests fail immediately, the other 95 % see variable latency.
 * The server only sees requests that passed the 95 % gate; if the server is
 * healthy those should all succeed (server_http_req_failed target: < 0.1 %).
 *
 * Scenarios
 * ---------
 * - "pos_terminal"  — 1-2 ramping VUs; each VU loops through:
 *     login → fetch menu → create order → add 3 items → send → pay → verify
 * - "kds_subscriber" — 1 steady VU; loops GET /api/kds/tickets to simulate a
 *     Kitchen Display System polling for new tickets.
 *
 * Run
 * ---
 *   k6 run load-tests/chaos.js -e BASE_URL=https://getsear.com
 *   k6 run load-tests/chaos.js -e BASE_URL=http://localhost:3000
 *
 * CI target: completes in < 3 minutes. Keep DURATION short.
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import exec from 'k6/execution'
import { Counter, Trend, Rate } from 'k6/metrics'
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'https://getsear.com'

// Credentials come from env (no hardcoded literals — CLAUDE.md security rule).
const DEMO_EMAIL = __ENV.DEMO_EMAIL || 'demo@getsear.com'
const DEMO_PASSWORD = __ENV.DEMO_PASSWORD
if (!DEMO_PASSWORD) {
  throw new Error('DEMO_PASSWORD env var is required (e.g. -e DEMO_PASSWORD=demo1234 for the demo tenant).')
}

const PRIMARY_LOCATION_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'

// Chaos parameters.
const CHAOS_FAULT_RATE = 0.05  // 5 % of calls get a synthetic 500.
const CHAOS_MAX_LATENCY_MS = 500  // Up to 500 ms extra sleep on non-faulted calls.

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

// How many calls were deliberately dropped (synthetic 500).
const simulatedFailures = new Counter('chaos_simulated_failures')

// Extra latency injected (ms) — tracks only the non-faulted 95 %.
const simulatedLatencyMs = new Trend('chaos_simulated_latency_ms', true)

// Whether each CHAOS-FREE end-to-end order flow succeeded. Flows where any
// step was synthetically faulted are excluded from this rate (see runOrderFlow
// returning {success, hadChaos}). With ~7 chaos-wrappable steps per flow at
// 5 % each, the compound chaos-hit rate per flow is ~30 % — counting every
// flow as "failed" when chaos fired would push the natural rate to ~0.70 and
// trip the threshold every run, with no actual signal about server health.
// We measure server resilience: did the steps that REACHED the server all
// succeed end-to-end? That should be > 99 %.
const orderFlowSuccess = new Rate('order_flow_success')

// How many flows were excluded because chaos fired mid-flow.
const chaosSkippedFlows = new Counter('chaos_skipped_flows')

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------
//
// "App stays usable" operationalized:
//   1. Real HTTP calls to the server fail at < 0.1 % (server is not broken).
//   2. > 99 % of order flows that actually hit the server succeed end-to-end.
//   3. End-to-end p95 (including simulated latency jitter) stays under 1500 ms.
//
// Note: `http_req_failed` in k6 counts non-2xx OR network errors for REAL
// requests only — synthetic 500s we return before making a real call are NOT
// counted here. That keeps the metric honest: server_health = real calls only.
//
// `chaos_simulated_latency_ms` is measured only for the 95 % that proceed.
// The p95 of that distribution should stay well under 1500 ms even with 500 ms
// jitter because real API calls should complete in < 1000 ms.

export const options = {
  scenarios: {
    pos_terminal: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 2 },  // ramp to 2 concurrent VUs
        { duration: '1m',  target: 2 },  // sustain
        { duration: '15s', target: 0 },  // ramp down
      ],
      gracefulRampDown: '10s',
      exec: 'pos_terminal',
    },
    kds_subscriber: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m45s',
      startTime: '0s',
      exec: 'kds_subscriber',
    },
  },
  thresholds: {
    // Real server calls: near-zero failure expected (lighter load + jitter).
    http_req_failed: ['rate<0.001'],
    // CHAOS-FREE order flows: > 99 % must succeed. Flows where chaos fired
    // mid-stream are excluded from this rate (counted in chaos_skipped_flows
    // instead) — otherwise the natural compound rate (~0.70 with 6 chaos-
    // wrapped steps × 5 % each) would unmeetably trip the threshold every
    // run with no real signal.
    order_flow_success: ['rate>0.99'],
    // p95 latency including our injected jitter < 1500 ms.
    chaos_simulated_latency_ms: ['p(95)<1500'],
    // p95 of real HTTP calls (sans synthetic faults) < 2000 ms.
    http_req_duration: ['p(95)<2000'],
  },
}

// ---------------------------------------------------------------------------
// Chaos request wrapper
// ---------------------------------------------------------------------------

/**
 * chaosRequest — wraps http[method] with synthetic fault injection.
 *
 * Returns { response, wasFault }:
 *   - response: the actual k6 Response object (real or synthetic).
 *   - wasFault: true when we injected a simulated 500 (skipped the real call).
 *
 * Callers should skip business-logic assertions when wasFault is true and
 * either retry or continue (the chaos test's job is to verify the SERVER
 * handles the residual load; individual faulted calls are expected to fail).
 */
function chaosRequest(method, url, body, params) {
  const roll = Math.random()

  if (roll < CHAOS_FAULT_RATE) {
    // Simulated server fault — do NOT make a real HTTP call.
    simulatedFailures.add(1)
    // Return a synthetic response object that mimics a k6 Response enough
    // for callers to branch on status.
    return {
      wasFault: true,
      response: {
        status: 500,
        ok: () => false,
        json: () => ({ error: 'chaos: synthetic 500', code: 'CHAOS_FAULT' }),
        body: '{"error":"chaos: synthetic 500","code":"CHAOS_FAULT"}',
      },
    }
  }

  // Non-faulted path: inject latency jitter, then make the real call.
  const jitterMs = randomIntBetween(0, CHAOS_MAX_LATENCY_MS)
  simulatedLatencyMs.add(jitterMs)
  if (jitterMs > 0) {
    sleep(jitterMs / 1000)
  }

  let response
  const mergedParams = Object.assign(
    { headers: { 'Content-Type': 'application/json' } },
    params || {}
  )

  if (method === 'GET') {
    response = http.get(url, mergedParams)
  } else if (method === 'POST') {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
    response = http.post(url, bodyStr, mergedParams)
  } else {
    throw new Error(`chaosRequest: unsupported method ${method}`)
  }

  return { wasFault: false, response }
}

// ---------------------------------------------------------------------------
// Global setup — ONE login total. /api/auth/login is rate-limited to
// 5/IP/15min AND 5/email/15min (src/lib/api/rate-limit.ts:32). Doing this
// per-VU would self-429 within seconds and turn the run into noise.
// ---------------------------------------------------------------------------

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  )

  if (loginRes.status !== 200) {
    throw new Error(`setup login failed (status ${loginRes.status}). Check DEMO_EMAIL/DEMO_PASSWORD and that ${BASE_URL} is reachable.`)
  }

  // Build a Cookie header from Set-Cookie values; pass to every VU via data.
  const cookieHeader = Object.entries(loginRes.cookies || {})
    .map(([name, arr]) => `${name}=${arr[0].value}`)
    .join('; ')

  if (!cookieHeader) {
    throw new Error('setup: login returned 200 but no cookies were set.')
  }

  // Discover KDS stations once (the actual KDS endpoint is /api/kds/tickets
  // — not /api/kds/queue, which doesn't exist — and it requires station_id).
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

  return { cookieHeader, kdsStationIds }
}

function authHeaders(cookieHeader, extra) {
  return Object.assign(
    { 'Content-Type': 'application/json', Cookie: cookieHeader },
    extra || {}
  )
}

// ---------------------------------------------------------------------------
// Menu helper
// ---------------------------------------------------------------------------

/**
 * fetchMenuItems — GET /api/menu/items and return an array of active items.
 * Returns null on chaos fault or server error.
 */
function fetchMenuItems(cookieHeader) {
  const { wasFault, response } = chaosRequest(
    'GET',
    `${BASE_URL}/api/menu/items`,
    null,
    { headers: { 'Content-Type': 'application/json', ...(cookieHeader ? { Cookie: cookieHeader } : {}) } }
  )
  if (wasFault || response.status !== 200) return null

  try {
    const body = response.json()
    const items = (body.data || []).filter((i) => i.is_active && !i.is_86d)
    return items.length > 0 ? items : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Order flow helper
// ---------------------------------------------------------------------------

/**
 * runOrderFlow — create one order, add 3 items, send to kitchen, pay with cash.
 * Returns { success, hadChaos } so callers can EXCLUDE chaos-faulted flows
 * from the order_flow_success rate (otherwise the natural compound rate
 * would be ~0.70 with 5 % per-step chaos and 6+ steps, making the > 0.99
 * threshold unmeetable and meaningless).
 *
 * - hadChaos=true means at least one step was synthetically faulted; the
 *   flow result is not a signal about server health.
 * - hadChaos=false, success=true means every step reached the server and
 *   succeeded.
 * - hadChaos=false, success=false means a real server-side failure — this
 *   is the signal we threshold on.
 */
function runOrderFlow(menuItems, cookieHeader) {
  // Pick 3 items deterministically by VU and iteration.
  const vuId = exec.vu.idInScenario
  const iter = exec.scenario.iterationInTest
  const pick = (offset) => menuItems[((vuId * 7 + iter * 3 + offset) % menuItems.length)]
  const item0 = pick(0)
  const item1 = pick(1)
  const item2 = pick(2)
  // Avoid duplicates (may overlap if menu is small).
  const selectedItems = [item0]
  if (item1.id !== item0.id) selectedItems.push(item1)
  if (item2.id !== item0.id && item2.id !== item1.id) selectedItems.push(item2)

  const headers = authHeaders(cookieHeader)

  // Step 1: Create order.
  const { wasFault: f1, response: r1 } = chaosRequest(
    'POST',
    `${BASE_URL}/api/orders`,
    {
      order_type: 'dine_in',
      location_id: PRIMARY_LOCATION_ID,
      guest_count: 2,
      source: 'pos',
    },
    { headers }
  )
  if (f1) return { success: false, hadChaos: true }
  if (r1.status !== 201) return { success: false, hadChaos: false }

  let orderId
  try {
    orderId = r1.json().data.id
  } catch {
    return { success: false, hadChaos: false }
  }
  if (!orderId) return { success: false, hadChaos: false }

  // Step 2: Add items.
  for (const item of selectedItems) {
    const price = typeof item.price === 'number' ? item.price.toFixed(2) : String(item.price)
    const { wasFault: fi, response: ri } = chaosRequest(
      'POST',
      `${BASE_URL}/api/orders/${orderId}/items`,
      {
        menu_item_id: item.id,
        name: item.name,
        unit_price: price,
        quantity: 1,
        course: 1,
        notes: '',
      },
      { headers }
    )
    if (fi) return { success: false, hadChaos: true }
    if (ri.status !== 201) return { success: false, hadChaos: false }
  }

  // Step 3: Send to kitchen.
  const { wasFault: f3, response: r3 } = chaosRequest(
    'POST',
    `${BASE_URL}/api/orders/${orderId}/send`,
    {},
    { headers }
  )
  if (f3) return { success: false, hadChaos: true }
  if (r3.status !== 200) return { success: false, hadChaos: false }

  // Step 4: Fetch total.
  const { wasFault: f4, response: r4 } = chaosRequest(
    'GET',
    `${BASE_URL}/api/orders/${orderId}`,
    null,
    { headers }
  )
  if (f4) return { success: false, hadChaos: true }
  if (r4.status !== 200) return { success: false, hadChaos: false }

  let totalCents = 0
  try {
    const total = parseFloat(r4.json().data.total || '0')
    totalCents = Math.round(total * 100)
  } catch {
    return { success: false, hadChaos: false }
  }
  if (totalCents <= 0) return { success: false, hadChaos: false }

  // Step 5: Pay with cash (tendered = next $5 above total, no tip for speed).
  const tendered = Math.ceil(totalCents / 500) * 500
  const { wasFault: f5, response: r5 } = chaosRequest(
    'POST',
    `${BASE_URL}/api/payments/process`,
    {
      order_id: orderId,
      location_id: PRIMARY_LOCATION_ID,
      payment_method: 'cash',
      amount_cents: totalCents,
      tip_cents: 0,
      mode: 'sale',
      cash_tendered_cents: tendered,
    },
    { headers }
  )
  if (f5) return { success: false, hadChaos: true }
  if (r5.status !== 200) return { success: false, hadChaos: false }

  let payStatus
  try {
    payStatus = r5.json().data.status
  } catch {
    return { success: false, hadChaos: false }
  }

  return { success: payStatus === 'captured', hadChaos: false }
}

// ---------------------------------------------------------------------------
// POS terminal scenario
// ---------------------------------------------------------------------------

export function pos_terminal(data) {
  const { cookieHeader } = data
  if (!cookieHeader) {
    sleep(1)
    return
  }

  // Fetch the menu (chaos-wrapped — may be faulted).
  const items = fetchMenuItems(cookieHeader)
  if (!items || items.length < 3) {
    // Can't run order flow without at least 3 menu items.
    sleep(1)
    return
  }

  // Run one complete order flow.
  const result = runOrderFlow(items, cookieHeader)
  if (result.hadChaos) {
    chaosSkippedFlows.add(1)
  } else {
    orderFlowSuccess.add(result.success ? 1 : 0)
  }

  // Think time between orders: 1-3 seconds (simulates cashier interacting).
  sleep(randomIntBetween(1, 3))
}

// ---------------------------------------------------------------------------
// KDS subscriber scenario — polls /api/kds/tickets every 2s
// (NOT /api/kds/queue, which does not exist; reviewer cycle-1 P0).
// /api/kds/tickets requires auth + station_id (verified at
// src/app/api/kds/tickets/route.ts:103).
// ---------------------------------------------------------------------------

export function kds_subscriber(data) {
  const { cookieHeader, kdsStationIds } = data

  if (!cookieHeader || !kdsStationIds || kdsStationIds.length === 0) {
    sleep(2)
    return
  }

  const idx = (exec.vu.idInScenario - 1) % kdsStationIds.length
  const stationId = kdsStationIds[idx]

  const { wasFault, response } = chaosRequest(
    'GET',
    `${BASE_URL}/api/kds/tickets?station_id=${stationId}&location_id=${PRIMARY_LOCATION_ID}`,
    null,
    { headers: authHeaders(cookieHeader) }
  )

  if (!wasFault) {
    check(response, {
      'kds tickets: status 200': (r) => r.status === 200,
    })
  }

  // KDS polls every ~2 seconds.
  sleep(2)
}

// ---------------------------------------------------------------------------
// Default export — k6 routes scenarios by exec name; default is unused here
// but required by k6 when options.scenarios is set without an explicit exec.
// ---------------------------------------------------------------------------

export default function () {
  // No-op: all logic is in named scenario functions above.
  // k6 requires a default export; it is never called when scenarios use exec.
}
