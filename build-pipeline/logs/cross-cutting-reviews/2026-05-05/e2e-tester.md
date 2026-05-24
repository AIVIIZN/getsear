# E2E + Load Test Audit — Sear POS main@77aa1e1
**Reviewer:** e2e-tester specialist
**Date:** 2026-05-05
**Scope:** `e2e/`, `load-tests/`, `playwright.config.ts`, `playwright.dev.config.ts`, `.github/workflows/load-test.yml`

---

## Summary

The suite is architecturally sound. Auth, cleanup, and resilience patterns are applied correctly in the workflow specs. No `.fixme()` or `.skip()` calls survive in any prod-targeted file. The major issues are (a) several known prod schema bugs are enshrined as expected failures rather than failing tests, (b) the k6 full-shift test has a payment-amount math bug that means it never pays the real tax-inclusive total, (c) the CI workflow can silently no-op the load test with no signal when the STAGING_URL secret is absent, and (d) six common POS workflows have zero e2e coverage.

---

## P0 — Correctness bugs that will silently pass on broken code

### P0-1: `full-shift.js` payment amount never includes tax — load test always under-pays
**File:** `load-tests/full-shift.js:269-325`

`orderTotal` is built by summing `item.price * quantity` from the raw menu items (pre-tax unit prices). The payment step posts `amount_cents = orderTotal`, which is the pre-tax subtotal. The real balance on the closed order is the tax-inclusive total (8.25% higher). If the server validates `amount_cents >= balance_due`, every payment in the load test 201s only if the server accepts under-payment, masking a potential regression in balance validation. The Playwright full-shift spec (`e2e/workflows/full-shift.spec.ts`) correctly uses `order.total` fetched from a GET after item add; the k6 test should do the same (GET the order total after all items are added, then pay that amount).

### P0-2: `kds-recall-refire.spec.ts` accepts 500 on bump and refire — known schema bugs not filed
**File:** `e2e/workflows/kds-recall-refire.spec.ts:91,121`

```ts
expect([200, 404, 500]).toContain(bumpRes.status())
expect([200, 404, 500]).toContain(refireRes.status())
```

The file header documents two specific schema mismatches (`is_void` vs `is_voided`; `data`/`metadata` columns on `kds_ticket_events`). The assertions explicitly allow 500, which means the test passes even when the server crashes on bump/refire. This is a test that will never fail on a broken endpoint. The correct fix is to resolve the schema bugs and flip these to `toBe(200)`. Until then this test provides no coverage guarantee on those paths.

### P0-3: `catering-deposit.spec.ts` allows 200 on the known-broken `/deposit` POST
**File:** `e2e/workflows/catering-deposit.spec.ts:165`

```ts
expect([200, 404]).toContain(depRes.status())
```

The comment says the endpoint is "documented broken" (returns 404 due to column mismatch). If the column gets renamed to `total_amount` by accident (fixing the name in the wrong direction), this 200 would pass when it shouldn't. The assertion should be `toBe(404)` until the bug is intentionally fixed, at which point it flips to `toBe(201)`.

---

## P1 — Real behavioral gaps / false signals

### P1-1: `chaos.js` payment step expects status 200 from `/api/payments/process`, but `full-shift.spec.ts` expects 201
**File:** `load-tests/chaos.js:407`

```js
if (r5.status !== 200) return { success: false, hadChaos: false }
```

The Playwright suite and the k6 full-shift test both expect 201 from `POST /api/payments/process`. If the server ever correctly returns 201 (the REST-correct status for a newly created payment resource), the chaos test will classify every successful payment as a flow failure and spam `order_flow_success=0`, causing the `rate>0.99` threshold to trip on a healthy server. Fix: `r5.status !== 201`.

### P1-2: `api-endpoints.spec.ts` asserts exact count `toHaveLength(8)` on categories
**File:** `e2e/api-endpoints.spec.ts:56`

```ts
expect(data.data).toHaveLength(8)
```

Every other count assertion in the suite uses `toBeGreaterThanOrEqual` per the project's resilience rule. If a category is added to the demo tenant this test fails in CI with no bug — it's just seed drift. Should be `toBeGreaterThanOrEqual(8)`.

### P1-3: `api-endpoints.spec.ts` asserts `toHaveLength(1)` on floor plans and tax rates
**File:** `e2e/api-endpoints.spec.ts:99, 139`

```ts
expect(data.data).toHaveLength(1)  // floor-plans
expect(data.data).toHaveLength(1)  // tax-rates
```

Same resilience concern. These are seed-data counts that could change. For tax-rates `toBeGreaterThanOrEqual(1)` is correct. For floor-plans the `toHaveLength(1)` is effectively asserting demo-tenant state — flag for V8 stabilization pass.

### P1-4: `full-shift.js` idempotency keys are not UUIDv4
**File:** `load-tests/full-shift.js:202-207`

```js
function idempotencyKey(prefix) {
  const rand = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')
  return `${prefix}-${Date.now().toString(16)}-${rand()}-${rand()}-${rand()}-${rand()}${rand()}${rand()}`
}
```

The server's `withIdempotency` middleware (`src/lib/api/idempotency.ts`) validates the header as strict UUIDv4. These keys will fail that validation and return 400 on every mutating request — meaning the load test never successfully creates orders or payments; it just generates 400 noise at volume. The fix is `crypto.randomUUID()` in modern Node/k6 or the equivalent hex construction that passes the `4[0-9a-f]{3}-[89ab]` pattern. (k6 has no `crypto.randomUUID` but `k6/crypto` has `uuidv4()`.)

**This is effectively a P0 for the load test being functional at all**, but listed P1 here because the test may "pass" threshold checks by having enough 400s filtered by `http_req_failed` staying below 1% (the 400 is a client error not counted by k6's default failed metric) while `checks` rate fails.

### P1-5: `comp-after-pay.spec.ts` comment says Marcus PIN is `1234` but uses `5678`
**File:** `e2e/workflows/comp-after-pay.spec.ts:17-19`

```ts
// Manager-PIN is per the demo tenant — the `1234` PIN is the documented seed for Marcus Rivera (owner).
const MANAGER_PIN = '5678'
```

The comment says `1234` (owner PIN) but the value is `5678` (Robert Johnson, manager). The comment is wrong. Minor but can mislead when debugging a 403.

---

## P2 — Structural / runtime concerns

### P2-1: `full-shift.spec.ts` module-level mutable state across parallel workers
**File:** `e2e/workflows/full-shift.spec.ts:101-106`

```ts
let api: APIRequestContext
let menuItems: MenuItem[] = []
const createdOrderIds: string[] = []
let baselineRevenue = 0
```

These are module-level variables. With `fullyParallel: true` and `workers: 3`, if Playwright ever spawns the same spec file across multiple workers (e.g., due to a future shard config change), these would race. The safe pattern is to declare them inside `test.beforeAll` scope using a closure or test-scoped fixture. Not a current bug since one file = one worker, but fragile.

### P2-2: `offline-queue.spec.ts` will `test.skip` silently in prod CI
**File:** `e2e/offline-queue.spec.ts:53`

```ts
if (probe.status() === 401) {
  test.skip(true, 'no auth session available…')
  return
}
```

`test.skip()` called inside the test body works but the test shows as "skipped" rather than "passed" or "failed". In CI this means the entire prod dedup contract is never exercised — the test silently disappears from the report. The correct fix is to do a full `beforeAll` login (like all other workflow specs) so the cookie is available and the test always runs.

### P2-3: `playwright.dev.config.ts` has no CI integration and `retries: 0`
**File:** `playwright.dev.config.ts:28`

The dev-only config intentionally has no CI integration (comment says "No CI integration yet"). This means `e2e/dev-only/idempotency-key-validation.spec.ts` and `e2e/dev-only/offline-queue-client.spec.ts` are never run in CI. The idempotency-key validation test in particular is the only test that verifies the `withIdempotency` middleware rejects malformed keys. This coverage gap is documented but should be tracked for V8.

### P2-4: `load-test.yml` local-server fallback path queries live Supabase
**File:** `.github/workflows/load-test.yml:79-100`

When `STAGING_URL` is not set, the workflow spins up `npm start` on the GHA runner. That server connects to the live Supabase project (`secrets.NEXT_PUBLIC_SUPABASE_URL`). The demo tenant's data will be mutated by the load test's 40+ orders. This is intentional (load tests need real data), but the comment in the file doesn't acknowledge it. More importantly: if `NEXT_PUBLIC_SUPABASE_URL` is also unset, the build completes but the server can't authenticate — the load test will 401 on every request and pass thresholds trivially (no errors, just no useful load). This should have a pre-flight check similar to the `LOAD_TEST_DEMO_PASSWORD` guard.

### P2-5: `chaos.js` default export is a no-op but k6 still calls it
**File:** `load-tests/chaos.js:490-493`

```js
export default function () {
  // No-op: all logic is in named scenario functions above.
}
```

When k6 routes scenarios by `exec:`, the default is never called. However if k6 is invoked without `--env`-scoped scenario overrides (e.g., by a developer who doesn't read the README), the default no-op runs and produces a passing run with zero load. A guard `throw new Error(...)` or at minimum a `console.error` in the default export would make misuse visible.

---

## P3 — Coverage gaps (no spec exists)

The following POS workflows have zero e2e coverage. Flagged for V7.5 / V8 backlog per the audit scope:

| Workflow | Notes |
|---|---|
| Discount application (line-level + order-level) | No spec. Discount POST endpoint exists at `/api/orders/[id]/discount`. |
| Tip adjustment post-payment | No spec. `/api/payments/[id]/tip-adjust` endpoint referenced in architecture. |
| Payment refund | No spec. `/api/payments/[id]/refund` path. |
| Multi-station KDS bump propagation | `kds-recall-refire.spec.ts` tests route contracts but not cross-station propagation. |
| Inventory 86 toggle + propagation to menu | No spec. `/api/inventory/items/[id]/86` toggle. |
| Reservation hold + drop | No spec. `/api/reservations/[id]/hold` and `/drop`. |
| Manager override flows (clock-in override, drawer variance override) | `manager-pin-void.spec.ts` covers void. PIN gate on cash-drawer variance and clock-in override has no coverage. |

---

## "Implementer-verified" spot-check: `manager-pin-void.spec.ts`

This spec was claimed as "implementer-verified." Reading it end-to-end:

- Creates a real order, pays it cash to closed, then tests the 403 → 403 → 200 → 422 → audit path. Each step asserts the actual response shape (`void_summary.approved_by_manager_id`, `after_close: true`, `reason`). The audit log assertion finds the row by `entity_id === orderId` rather than top-of-list.
- This is genuine behavioral verification, not happy-path-only. The re-void 422 check is particularly good.
- One concern: `afterEach` calls `cleanupOrder(request, createdOrderId)` which routes through `POST /api/orders/[id]/void`. For the test that already voided the order, `createdOrderId` is set to `undefined` before `afterEach` runs (line 145), so cleanup is correctly skipped. For the pre-close void test (line 148), cleanup runs on an already-voided order — `cleanupOrder` swallows 4xx, so this is safe but produces a silent void-on-void attempt every run.

Overall: solid. The implementer-verified claim is justified for this spec.

---

## Files referenced

- `e2e/workflows/full-shift.spec.ts` — module-level mutable state (P2-1)
- `e2e/workflows/kds-recall-refire.spec.ts:91,121` — P0-2
- `e2e/workflows/catering-deposit.spec.ts:165` — P0-3
- `e2e/workflows/comp-after-pay.spec.ts:17-19` — P1-5
- `e2e/api-endpoints.spec.ts:56,99,139` — P1-2, P1-3
- `e2e/offline-queue.spec.ts:53` — P2-2
- `load-tests/full-shift.js:202-207,269-325` — P0-1, P1-4
- `load-tests/chaos.js:407,490-493` — P1-1, P2-5
- `playwright.dev.config.ts` — P2-3
- `.github/workflows/load-test.yml:79-100` — P2-4
