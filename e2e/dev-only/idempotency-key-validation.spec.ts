import { test, expect, type APIRequestContext } from '@playwright/test'

/**
 * V5.5.3 — Idempotency-Key validation test (dev-only).
 *
 * Originally `test.fixme`'d in `e2e/offline-queue.spec.ts` because the spec
 * had no `beforeAll` login flow, so the request was redirected to `/login`
 * by `src/middleware.ts` before reaching `withIdempotency` in
 * `src/lib/api/idempotency.ts`. Auth is added here via the
 * `playwright.request.newContext` + `/api/auth/login` pattern from
 * `e2e/api-endpoints.spec.ts`.
 *
 * Lives in `e2e/dev-only/` because:
 *   - We don't want malformed-key probes hitting prod (audit-log noise).
 *   - It's grouped with the other dev-only offline-queue tests.
 *
 * Contract under test:
 *   - `withIdempotency` returns HTTP 400 when the `Idempotency-Key` header
 *     is present but not a UUIDv4 (e.g., `"not-a-uuid"`).
 *   - This protects against accidental key collisions from callers passing
 *     short / arbitrary strings.
 */

let authedRequest: APIRequestContext

test.beforeAll(async ({ playwright }) => {
  // Mirror of the auth pattern in e2e/api-endpoints.spec.ts, but pointed at
  // the local dev server so we hit the dev-mode middleware + harness.
  authedRequest = await playwright.request.newContext({
    baseURL: 'http://localhost:3000',
    ignoreHTTPSErrors: true,
  })

  const loginRes = await authedRequest.post('/api/auth/login', {
    data: { email: 'demo@getsear.com', password: 'demo1234' },
  })
  expect(loginRes.status()).toBe(200)
  const loginData = await loginRes.json()
  expect(loginData.user.display_name).toBe('Marcus Rivera')
})

test.afterAll(async () => {
  await authedRequest?.dispose()
})

test.describe('V5.3.1 idempotency middleware — key validation (dev-only)', () => {
  test('server rejects malformed Idempotency-Key (not a UUIDv4)', async () => {
    const res = await authedRequest.post('/api/orders', {
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'not-a-uuid' },
      data: { order_type: 'takeout', location_id: '00000000-0000-0000-0000-000000000001' },
      failOnStatusCode: false,
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('UUIDv4')
  })

  test('server accepts well-formed Idempotency-Key (sanity check)', async () => {
    // Reach the handler — we don't care about the resulting status (could be
    // 201, 400 for body validation, etc.) as long as it isn't the 400 from
    // the middleware's UUID check. This guards against a false positive on
    // the rejection test (e.g., the route was 400ing for unrelated reasons).
    const validKey = crypto.randomUUID()
    const res = await authedRequest.post('/api/orders', {
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': validKey },
      data: { order_type: 'takeout', location_id: '00000000-0000-0000-0000-000000000001' },
      failOnStatusCode: false,
    })
    if (res.status() === 400) {
      const body = await res.json()
      // The body validation error is acceptable; the UUIDv4 error is not.
      expect(body.error).not.toContain('UUIDv4')
    } else {
      // Any non-400 status means the middleware passed the key through.
      expect(res.status()).toBeLessThan(500)
    }
  })
})
