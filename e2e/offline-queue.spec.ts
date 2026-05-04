import { test, expect } from '@playwright/test'

/**
 * V5.3.1 — IndexedDB-backed offline queue acceptance test (prod-targeting).
 *
 * Real server-side dedup against https://getsear.com:
 *   - Hits the real Next.js API via `page.request.post()` with the same
 *     `Idempotency-Key` twice and asserts the server returns the SAME
 *     response body + status both times — proof that
 *     `src/lib/api/idempotency.ts` + `idempotency_records` actually dedupe
 *     at the server layer, not just at the client mock.
 *   - Auto-skips if a test session cookie isn't available (CI without
 *     seeded auth).
 *
 * The two complementary tests that need a development build (test-harness
 * globals + Idempotency-Key validation behind authed middleware) live in
 * `e2e/dev-only/` and run via `playwright.dev.config.ts`. See V5.5.3.
 */

function genUuidV4(): string {
  // Browser/node-safe UUIDv4 for test fixtures.
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

test.describe('V5.3.1 offline mutation queue — server dedup (real API)', () => {
  /**
   * Hits the real Next.js API at the dev server's base URL — no `page.route`
   * mocks. Skips if the test environment doesn't have an auth session
   * available (CI without seed). Local dev with `npm run dev` + a logged-in
   * test user satisfies this.
   *
   * The assertion: two POSTs to `/api/orders` with the SAME `Idempotency-Key`
   * return identical bodies + statuses. The first is a real DB write; the
   * second is the cached row from `idempotency_records`.
   */
  test('server returns identical response for replayed Idempotency-Key', async ({ page }) => {
    await page.goto('/')

    // Get the auth cookie from the browser context; if we're not authenticated,
    // the API will 401 and we skip the dedup assertion (the unauth response is
    // still cached, but the test is uninformative about the dedup contract).
    const probe = await page.request.post('/api/orders', {
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': genUuidV4() },
      data: { order_type: 'takeout', location_id: '00000000-0000-0000-0000-000000000001' },
      failOnStatusCode: false,
    })

    if (probe.status() === 401) {
      test.skip(true, 'no auth session available — set up test user to enable the real-server dedup test')
      return
    }

    // Real test: same key, two POSTs, identical responses.
    const key = genUuidV4()
    const body = {
      order_type: 'takeout',
      location_id: '00000000-0000-0000-0000-000000000001',
      guest_count: 2,
      notes: 'idempotency dedup probe',
    }

    const first = await page.request.post('/api/orders', {
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      data: body,
      failOnStatusCode: false,
    })
    const firstStatus = first.status()
    const firstBody = await first.text()

    const second = await page.request.post('/api/orders', {
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      data: body,
      failOnStatusCode: false,
    })
    const secondStatus = second.status()
    const secondBody = await second.text()

    expect(secondStatus).toBe(firstStatus)
    expect(secondBody).toBe(firstBody)

    // If the first request actually created an order (201), the cached replay
    // returns the SAME server-assigned id — which means we did NOT create a
    // second order. That's the bug class this test exists to catch.
    if (firstStatus === 201) {
      const firstJson = JSON.parse(firstBody) as { data?: { id?: string } }
      const secondJson = JSON.parse(secondBody) as { data?: { id?: string } }
      expect(secondJson.data?.id).toBe(firstJson.data?.id)
    }
  })
})
