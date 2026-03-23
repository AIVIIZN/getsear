/**
 * Load test helpers for k6.
 * These utilities are shared across all load test scenarios.
 *
 * Usage: Run with k6
 *   k6 run src/scripts/load-tests/dinner-rush.ts
 */

// k6 types for reference (k6 is a Go-based tool with its own runtime)
// These helpers are designed to be imported by k6 scripts.

export const BASE_URL = __ENV.BASE_URL || 'https://getsear.com'

export interface TestUser {
  email: string
  password: string
  token: string
  userId: string
  orgId: string
  locationId: string
}

/**
 * Authenticate a test user and return their session info.
 */
export function login(http: {
  post: (url: string, body: string, params: Record<string, unknown>) => { json: (sel?: string) => unknown; status: number }
}, email: string, password: string): TestUser | null {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  )

  if (res.status !== 200) {
    return null
  }

  const user = res.json('user') as Record<string, unknown>
  return {
    email,
    password,
    token: '', // Session-based auth via cookies
    userId: user.id as string,
    orgId: user.org_id as string,
    locationId: (user.location_ids as string[])[0] || '',
  }
}

/**
 * Common headers for authenticated requests.
 */
export function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
  }
}

/**
 * Generate a random menu item selection.
 */
export function randomItems(menuItemIds: string[], count: number): Array<{
  menu_item_id: string
  quantity: number
  price_cents: number
}> {
  const items = []
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * menuItemIds.length)
    items.push({
      menu_item_id: menuItemIds[idx],
      quantity: Math.floor(Math.random() * 3) + 1,
      price_cents: Math.floor(Math.random() * 2500) + 500, // $5 - $30
    })
  }
  return items
}

/**
 * Random sleep between min and max seconds.
 */
export function randomSleep(sleep: (seconds: number) => void, minSeconds: number, maxSeconds: number) {
  const duration = minSeconds + Math.random() * (maxSeconds - minSeconds)
  sleep(duration)
}

/**
 * Thresholds configuration shared across scenarios.
 */
export const STANDARD_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.001'], // <0.1% error rate
}

export const RUSH_THRESHOLDS = {
  http_req_duration: ['p(95)<1000', 'p(99)<2000'],
  http_req_failed: ['rate<0.005'], // <0.5% error rate
}

export const STRESS_THRESHOLDS = {
  http_req_duration: ['p(95)<2000'],
  http_req_failed: ['rate<0.01'], // <1% error rate
}
