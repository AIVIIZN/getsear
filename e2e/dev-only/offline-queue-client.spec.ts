import { test, expect, type Route } from '@playwright/test'

/**
 * V5.5.3 — offline-queue client-contract test (dev-only).
 *
 * Originally `test.fixme`'d in `e2e/offline-queue.spec.ts` because it relies
 * on `window.{syncQueue, syncProcessor, useOfflineStore}` globals exposed by
 * `src/components/dev/TestHarness.tsx`, which only mounts when
 * `NODE_ENV === 'development'`. In a production build the harness is
 * dead-code-eliminated, so this spec runs against the local dev server only
 * (see `playwright.dev.config.ts`).
 *
 * Contract under test:
 *   - The offline mutation queue mints a UUIDv4 `Idempotency-Key` for every
 *     enqueued operation.
 *   - On reconnect, every replay carries that exact key on the wire.
 *   - If the first replay reached the server but the ack was lost, retrying
 *     with the same key does not create a second order or payment.
 *   - The queue's priority rules (payments before orders) are honored.
 *   - A 409 replay conflict is persisted as a readable conflict record.
 */

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

test.describe('V5.3.1 offline mutation queue — client contract (dev-only)', () => {
  test('replays order/payment mutations idempotently and surfaces conflicts', async ({ page, context }) => {
    // ── Server-side dedupe + lost-ack simulation ───────────────────
    const acknowledgedKeys = new Set<string>()
    const firstAttemptKeys = new Set<string>()
    const serverWriteCounts = new Map<string, number>()
    const callLog: { url: string; key: string; body: unknown; order: number; deduped: boolean }[] = []
    let callOrder = 0
    const mockHandler = async (route: Route) => {
      const req = route.request()
      const key = (await req.headerValue('idempotency-key')) ?? ''
      if (!UUID_V4.test(key)) {
        await route.fulfill({ status: 400, body: JSON.stringify({ error: 'missing or invalid Idempotency-Key' }) })
        return
      }

      if (req.method() === 'PATCH' && req.url().includes('/api/orders/')) {
        await route.fulfill({
          status: 409,
          body: JSON.stringify({
            error: 'order_version_mismatch',
            current_state: { status: 'paid', version: 7 },
          }),
        })
        return
      }

      // Server-side dedupe: replay of the same key returns cached payload and
      // does NOT increment the write count. This models withIdempotency.
      if (acknowledgedKeys.has(key)) {
        callLog.push({ url: req.url(), key, body: req.postDataJSON(), order: ++callOrder, deduped: true })
        await route.fulfill({ status: 200, body: JSON.stringify({ data: { id: key }, deduped: true }) })
        return
      }

      serverWriteCounts.set(key, (serverWriteCounts.get(key) ?? 0) + 1)
      firstAttemptKeys.add(key)
      acknowledgedKeys.add(key)
      // The write landed, but the terminal lost the response. The queue must
      // retry with the same key and receive the cached response next run.
      await route.abort('connectionaborted')
    }
    await page.route('**/api/orders**', mockHandler)
    await page.route('**/api/payments/process', mockHandler)

    // ── Land on the app and wait for the offline-store + queue modules to load ──
    await page.goto('/')
    await page.waitForLoadState('domcontentloaded')

    // ── Wait for the test-harness globals to be set (lazy-imported) ──
    await page.waitForFunction(() => {
      const w = window as unknown as Record<string, unknown>
      return !!w.syncQueue && !!w.syncProcessor && !!w.useOfflineStore
    }, { timeout: 10_000 })

    // ── Go offline ──────────────────────────────────────────────────
    await context.setOffline(true)

    // ── Enqueue 5 orders + 2 payments via the existing enqueueSync API ──
    const enqueuedKeys = await page.evaluate(async () => {
      const w = window as unknown as {
        syncQueue: typeof import('../../src/lib/offline/sync-queue')
      }
      const keys: string[] = []
      const locId = '00000000-0000-0000-0000-000000000001'
      for (let i = 1; i <= 5; i++) {
        const id = await w.syncQueue.enqueueSync({
          operation: 'create_order',
          entity_type: 'order',
          entity_id: `order-test-${i}`,
          payload: { seq: i, kind: 'order' },
          location_id: locId,
        })
        const key = await w.syncQueue.getIdempotencyKey(id)
        if (key) keys.push(key)
      }
      for (let i = 1; i <= 2; i++) {
        const id = await w.syncQueue.enqueueSync({
          operation: 'create_payment',
          entity_type: 'payment',
          entity_id: `payment-test-${i}`,
          payload: {
            seq: i,
            kind: 'payment',
            order_id: '00000000-0000-0000-0000-000000000002',
            location_id: locId,
            payment_method: 'cash',
            amount_cents: 100,
            valor_transaction_ref: 'test',
          },
          location_id: locId,
        })
        const key = await w.syncQueue.getIdempotencyKey(id)
        if (key) keys.push(key)
      }
      return keys
    })

    expect(enqueuedKeys).toHaveLength(7)
    enqueuedKeys.forEach((k) => expect(k).toMatch(UUID_V4))
    expect(new Set(enqueuedKeys).size).toBe(7)
    expect(callLog).toHaveLength(0) // nothing reached the server while offline

    // ── Reconnect and process the queue. The first attempt for each entry
    // lands server-side but aborts; the processor retries with the same keys.
    await context.setOffline(false)
    const replayRun = await page.evaluate(async () => {
      const w = window as unknown as {
        syncProcessor: typeof import('../../src/lib/offline/sync-processor')
      }
      return w.syncProcessor.processSyncQueue()
    })

    expect(replayRun.processed).toBe(7)
    expect(replayRun.failed).toBe(0)
    expect(replayRun.conflicts).toBe(0)
    expect(firstAttemptKeys.size).toBe(7)
    for (const key of enqueuedKeys) {
      expect(serverWriteCounts.get(key)).toBe(1)
    }

    const orderCalls = callLog.filter((c) => c.url.includes('/api/orders'))
    const paymentCalls = callLog.filter((c) => c.url.includes('/api/payments/process'))
    expect(orderCalls).toHaveLength(5)
    expect(paymentCalls).toHaveLength(2)
    expect(callLog.every((c) => c.deduped)).toBe(true)

    // Every key on the wire is one of the keys we enqueued (no key drift).
    const enqueuedSet = new Set(enqueuedKeys)
    callLog.forEach((c) => {
      expect(c.key).toMatch(UUID_V4)
      expect(enqueuedSet.has(c.key)).toBe(true)
    })

    // No duplicate server writes happened across the retry.
    for (const key of enqueuedKeys) {
      expect(serverWriteCounts.get(key)).toBe(1)
    }

    // Clean drain: a later processSyncQueue is a no-op.
    const beforeSecondRun = callLog.length
    await page.evaluate(async () => {
      const w = window as unknown as {
        syncProcessor: typeof import('../../src/lib/offline/sync-processor')
      }
      await w.syncProcessor.processSyncQueue()
    })
    expect(callLog.length).toBe(beforeSecondRun)

    // Conflict proof: a stale offline order update becomes a conflict row
    // and drives the user-visible conflict banner state.
    const conflictProbe = await page.evaluate(async () => {
      const w = window as unknown as {
        syncQueue: typeof import('../../src/lib/offline/sync-queue')
        syncProcessor: typeof import('../../src/lib/offline/sync-processor')
        offlineDB: typeof import('../../src/lib/offline/db').offlineDB
        useOfflineStore: typeof import('../../src/stores/offline-store').useOfflineStore
      }
      const locId = '00000000-0000-0000-0000-000000000001'
      await w.syncQueue.enqueueSync({
        operation: 'update_order',
        entity_type: 'order',
        entity_id: '00000000-0000-0000-0000-000000000099',
        payload: { notes: 'offline stale edit', expected_version: 1 },
        location_id: locId,
      })
      const result = await w.syncProcessor.processSyncQueue()
      const conflicts = await w.offlineDB.conflicts.toArray()
      const queue = await w.offlineDB.sync_queue.toArray()
      return {
        result,
        bannerState: w.useOfflineStore.getState().bannerState,
        conflict: conflicts.at(-1),
        conflictedEntry: queue.find((entry) => entry.status === 'conflict'),
      }
    })

    expect(conflictProbe.result.conflicts).toBe(1)
    expect(conflictProbe.bannerState).toBe('conflict')
    expect(conflictProbe.conflictedEntry?.error).toContain('order_version_mismatch')
    expect(conflictProbe.conflict?.description).toContain('order sync conflict')
    expect(conflictProbe.conflict?.local_data).toMatchObject({ notes: 'offline stale edit' })
  })
})
