# Sear POS — Load Tests

k6 load-test scripts for Sear POS. Targets either production (`https://getsear.com`) or a local dev server.

## Prerequisites

Install k6: https://k6.io/docs/getting-started/installation/

```bash
brew install k6          # macOS
# or
docker pull grafana/k6   # Docker
```

---

## Scripts

### `full-shift.js` — Sustained order flow (V7.3.1)

Simulates a full 8-hour service period at 200 orders/hour across 8 POS terminals and 4 KDS subscribers. Used as the CI baseline load test.

**Run:**

```bash
k6 run load-tests/full-shift.js -e BASE_URL=https://getsear.com
```

**Thresholds:**
- `http_req_failed < 0.001` (server stays healthy under sustained load)
- `http_req_duration p(99) < 200ms`

---

### `chaos.js` — Latency and fault-injection (V7.3.2)

#### What it does

Tests server-side stability when the client experiences realistic upstream flakiness: 5% of requests fail immediately and the remaining 95% see up to 500ms of random latency jitter.

Every HTTP call goes through `chaosRequest()`, which:
- **5% of the time**: skips the real HTTP call and returns a synthetic HTTP 500, incrementing `chaos_simulated_failures`. This models: client retries due to transient faults.
- **95% of the time**: injects 0-500ms of sleep (random uniform) before making the real request, recording the jitter in `chaos_simulated_latency_ms`. This models: variable network latency.

The server only sees the requests that pass the 95% gate. Under the lighter load of this test (1-2 POS VUs + 1 KDS VU), those requests should all succeed — confirming the server does not compound client-side faults with its own.

Scenarios:
- `pos_terminal` (1-2 ramping VUs): login, fetch menu, create order, add 3 items, send to kitchen, pay with cash.
- `kds_subscriber` (1 steady VU): polls GET `/api/kds/queue` every 2 seconds.

Custom metrics:
- `chaos_simulated_failures` (Counter): number of calls that were synthetically faulted.
- `chaos_simulated_latency_ms` (Trend): extra latency injected on non-faulted calls (ms).
- `order_flow_success` (Rate): fraction of order flows that completed end-to-end.

**Run:**

```bash
k6 run load-tests/chaos.js -e BASE_URL=https://getsear.com
# or against local dev:
k6 run load-tests/chaos.js -e BASE_URL=http://localhost:3000
```

**Pass criteria ("app stays usable"):**

| Threshold | Operationalization |
|---|---|
| `http_req_failed < 0.001` | Real server calls fail at < 0.1% — server is not broken |
| `order_flow_success > 0.99` | 99%+ of flows that reached the server completed successfully |
| `chaos_simulated_latency_ms p(95) < 1500` | End-to-end p95 including jitter stays under 1.5s |
| `http_req_duration p(95) < 2000` | Real HTTP call p95 < 2s |

**CI target:** completes in under 3 minutes.

#### What this test honestly cannot verify

This k6 chaos test verifies server-side resilience to a realistic mix of latency and fault-rate. It does NOT verify:

1. **The React offline queue (`src/lib/sync/sync-queue.ts`)** — that code runs in the browser. k6 is a JavaScript runtime without DOM or Service Worker APIs. Testing the offline-queue UX requires Playwright with Chrome DevTools network throttling (scheduled for V7.4).

2. **Infrastructure-level chaos** — killing the database process, partitioning the network, running out of file descriptors, or pod eviction. Full chaos engineering with Toxiproxy or similar is V7.4 territory.

3. **The "retry UX" that users see** — asserting that the app renders a "Retrying..." toast or spinner when a request fails requires a browser-level test. k6 proves the server can absorb the retry load; the UI feedback side is a Playwright concern.

If you see `order_flow_success` dip below 0.99 on passing test runs, the most likely cause is a chaos fault hitting a mandatory step (create order or pay) rather than a genuine server regression. Re-run once; if it persists, investigate `http_req_failed` to determine whether the server is returning real 5xx errors under the retry load.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `BASE_URL` | `https://getsear.com` | Target server base URL |

Credentials are the public demo tenant (`demo@getsear.com` / `demo1234`). Do not configure real credentials here.
