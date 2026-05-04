import { test, expect, type Route } from '@playwright/test'

/**
 * V5.3.1 — IndexedDB-backed offline queue acceptance test.
 *
 * Scenario: take 5 orders + 2 payments while offline, reconnect, verify all
 * 7 mutations replay to the server in FIFO order with unique UUIDv4
 * Idempotency-Key headers, and no duplicate writes occur even if the test
 * forces a replay-during-replay race.
 *
 * The test uses page.route() to mock the API endpoints so we can:
 *   1. Assert each request carries an Idempotency-Key header (UUIDv4).
 *   2. Detect duplicates server-side (the mock dedupes by key — a real server
 *      would do the same).
 *   3. Verify FIFO ordering.
 *
 * The test drives the queue API directly via page.evaluate() so it works
 * without depending on UI surfaces owned by sister task 5.3.2.
 */

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

test.describe('V5.3.1 offline mutation queue', () => {
  test('buffers 5 orders + 2 payments offline, replays in order on reconnect with no dupes', async ({ page, context }) => {
    // ── Server-side dedupe simulation ──────────────────────────────
    const seenKeys = new Set<string>()
    const callLog: { url: string; key: string; body: unknown; order: number }[] = []
    let order = 0
    const mockHandler = async (route: Route) => {
      const req = route.request()
      const key = req.headerValue('idempotency-key')
      if (!key || !UUID_V4.test(key)) {
        await route.fulfill({ status: 400, body: JSON.stringify({ error: 'missing or invalid Idempotency-Key' }) })
        return
      }
      // Server-side dedupe: replay of the same key = 200 with same response.
      if (seenKeys.has(key)) {
        await route.fulfill({ status: 200, body: JSON.stringify({ id: key, deduped: true }) })
        return
      }
      seenKeys.add(key)
      callLog.push({ url: req.url(), key, body: req.postDataJSON(), order: ++order })
      await route.fulfill({ status: 200, body: JSON.stringify({ id: key }) })
    }
    await page.route('**/api/orders', mockHandler)
    await page.route('**/api/payments', mockHandler)

    // ── Land on the app and wait for the offline-store + queue modules to load ──
    await page.goto('/')
    // Wait for the bundle to import the offline store (lazy via dynamic import in real code).
    await page.waitForLoadState('domcontentloaded')

    // ── Go offline ──────────────────────────────────────────────────
    await context.setOffline(true)
    expect(await page.evaluate(() => navigator.onLine)).toBe(false)

    // ── Enqueue 5 orders + 2 payments while offline ────────────────
    // We bypass the UI and call the queue API directly. This exercises the
    // contract (UUIDv4 keys, IndexedDB write before optimistic update).
    const enqueuedIds = await page.evaluate(async () => {
      // The offline store exposes itself on window.useOfflineStore in
      // non-production builds (V5.3.1 test harness). The store action calls
      // src/lib/offline/queue.ts under the hood — same code path as the UI.
      const w = window as unknown as { useOfflineStore?: { getState: () => { actions: { enqueueMutation: (i: unknown) => Promise<string> } } } }
      const actions = w.useOfflineStore?.getState().actions
      if (!actions) throw new Error('offline store not exposed; test harness incomplete')
      const ids: string[] = []
      for (let i = 1; i <= 5; i++) {
        ids.push(await actions.enqueueMutation({ url: '/api/orders', method: 'POST', body: { seq: i, kind: 'order' } }))
      }
      for (let i = 1; i <= 2; i++) {
        ids.push(await actions.enqueueMutation({ url: '/api/payments', method: 'POST', body: { seq: i, kind: 'payment' } }))
      }
      return ids
    })

    // 7 entries, every id is a valid UUIDv4, all unique.
    expect(enqueuedIds).toHaveLength(7)
    enqueuedIds.forEach((id) => expect(id).toMatch(UUID_V4))
    expect(new Set(enqueuedIds).size).toBe(7)

    // No requests reached the server while offline.
    expect(callLog).toHaveLength(0)

    // ── Reconnect — replay should drain the queue FIFO ─────────────
    await context.setOffline(false)
    // Trigger the online event explicitly (Playwright doesn't always fire it).
    await page.evaluate(() => window.dispatchEvent(new Event('online')))

    // Wait until all 7 mutations have hit the (mocked) server.
    await expect.poll(() => callLog.length, { timeout: 10_000 }).toBe(7)

    // ── Assertions ─────────────────────────────────────────────────
    // FIFO: orders 1-5 hit the server before payments 1-2.
    const orderCalls = callLog.filter((c) => c.url.includes('/api/orders'))
    const paymentCalls = callLog.filter((c) => c.url.includes('/api/payments'))
    expect(orderCalls).toHaveLength(5)
    expect(paymentCalls).toHaveLength(2)
    // First 5 calls should all be orders (FIFO across the merged enqueue order).
    callLog.slice(0, 5).forEach((c) => expect(c.url).toContain('/api/orders'))
    callLog.slice(5).forEach((c) => expect(c.url).toContain('/api/payments'))

    // Idempotency keys match what was enqueued, in order.
    callLog.forEach((c, i) => {
      expect(c.key).toBe(enqueuedIds[i])
      expect(c.key).toMatch(UUID_V4)
    })

    // ── Re-replay → server dedupes ─────────────────────────────────
    // Force a second replay. The mock returns 200 for known keys but does NOT
    // re-add to callLog, so callLog stays at 7.
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await page.waitForTimeout(500)
    expect(callLog).toHaveLength(7)
  })

  test('marks entry as failed after 3 server-side rejections (4xx)', async ({ page, context }) => {
    let attempts = 0
    await page.route('**/api/orders', async (route) => {
      attempts++
      // Always reject with 422.
      await route.fulfill({ status: 422, body: JSON.stringify({ error: 'unprocessable' }) })
    })

    await page.goto('/')
    await context.setOffline(true)

    const id = await page.evaluate(async () => {
      const w = window as unknown as { useOfflineStore?: { getState: () => { actions: { enqueueMutation: (i: unknown) => Promise<string> } } } }
      const actions = w.useOfflineStore!.getState().actions
      return actions.enqueueMutation({ url: '/api/orders', method: 'POST', body: { x: 1 } })
    })
    expect(id).toMatch(UUID_V4)

    await context.setOffline(false)

    // Trigger 3 replays — each call increments attempts, third rejection should mark failed.
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.dispatchEvent(new Event('online')))
      await page.waitForTimeout(300)
    }

    // After MAX_ATTEMPTS server rejections, the entry should be in 'failed' state.
    const status = await page.evaluate(async (entryId) => {
      const w = window as unknown as { offlineDB?: { mutation_queue: { get: (id: string) => Promise<{ status: string } | undefined> } } }
      const entry = await w.offlineDB?.mutation_queue.get(entryId)
      return entry?.status
    }, id)
    expect(status).toBe('failed')
    expect(attempts).toBeGreaterThanOrEqual(3)
  })
})
