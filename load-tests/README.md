# Sear POS — k6 Load Test Suite

Two scripts:

- **`full-shift.js`** (V7.3.1) — Realistic Friday-night shift: 200 orders/hour sustained for 12 minutes across 8 terminal VUs + 4 KDS subscribers.
- **`chaos.js`** (V7.3.2) — Server resilience under client-side fault injection: 5% synthetic 500s + 0–500ms latency jitter.

---

## Prerequisites

Install k6: https://grafana.com/docs/k6/latest/set-up/install-k6/

```bash
brew install k6                # macOS
sudo apt-get install k6        # Debian / Ubuntu
docker pull grafana/k6         # Docker
```

---

## `full-shift.js` — sustained order flow

### What it does

- **8 terminal VUs** (simulated server iPads) each ring in ~25 orders/hr.
  - Each order: create → add 2–4 menu items → cash payment.
  - Combined throughput: **200 orders/hour** sustained for 12 minutes (≥40 full end-to-end orders).
- **4 KDS VUs** (kitchen display screens) poll `/api/kds/tickets` every 2 seconds throughout the run.

### Pass criteria (thresholds)

| Threshold | Limit | What it measures |
|-----------|-------|------------------|
| `order_create_duration p(95)` | `< 800ms` | p95 latency for `POST /api/orders` — the most latency-sensitive write in a terminal workflow. |
| `http_req_duration p(99)` | `< 2000ms` | Hard ceiling for any request below the 99th percentile. |
| `http_req_failed rate` | `< 0.01` (1%) | Fraction of HTTP requests returning 4xx/5xx. |
| `checks rate` | `> 0.99` (99%) | Fraction of in-script assertions passing. |

If any threshold is violated, k6 exits with code 99 and CI fails.

### Run

```bash
# Local
k6 run load-tests/full-shift.js \
  -e BASE_URL=http://localhost:3000 \
  -e DEMO_PASSWORD=demo1234

# Staging
k6 run load-tests/full-shift.js \
  -e BASE_URL=https://your-staging-url.example.com \
  -e DEMO_PASSWORD=$DEMO_PASSWORD

# Production (off-peak only — never on schedule)
k6 run load-tests/full-shift.js \
  -e BASE_URL=https://getsear.com \
  -e DEMO_PASSWORD=$DEMO_PASSWORD
```

### Architecture notes

- `setup()` runs ONCE for the whole test: logs in, captures the cookie header, fetches the menu, discovers KDS stations. The result is passed to every VU via the `data` argument.
- VUs reuse the cookie via `authHeaders(data.cookieHeader)` on every request. **No per-VU login** — that would trip the auth rate limit (5 attempts / 15 min per IP and per email at `src/lib/api/rate-limit.ts:32`).

---

## `chaos.js` — latency + fault-injection resilience

### What it does

Tests server-side stability when the client experiences realistic upstream flakiness. Every HTTP call goes through `chaosRequest()`:

- **5% of the time**: skips the real call, returns a synthetic HTTP 500, increments `chaos_simulated_failures`. Models: client retry due to transient fault.
- **95% of the time**: sleeps 0–500ms (random uniform), records jitter in `chaos_simulated_latency_ms`, then makes the real request. Models: variable network latency.

The server only sees the 95% that pass the gate. Under the lighter load (1–2 POS VUs + 1 KDS VU), those should all succeed.

Scenarios:
- `pos_terminal` (1–2 ramping VUs, ~1m45s): login → fetch menu → create order → add 3 items → send → pay.
- `kds_subscriber` (1 steady VU): polls `GET /api/kds/tickets?station_id=...` every 2s.

### Pass criteria

| Threshold | Operationalization |
|-----------|--------------------|
| `http_req_failed < 0.001` | Real server calls fail at < 0.1% — server is not broken under retry load. |
| `order_flow_success > 0.99` | 99%+ of CHAOS-FREE flows succeed end-to-end. |
| `chaos_simulated_latency_ms p(95) < 1500` | Injected jitter p95 stays under 1.5s. |
| `http_req_duration p(95) < 2000` | Real HTTP call p95 < 2s. |

**Critical:** `order_flow_success` excludes flows where chaos fired mid-stream — counted in `chaos_skipped_flows` instead. With 6 chaos-wrapped steps × 5% per-step fault rate, the natural compound rate would be ~0.70, which would unmeetably trip a 0.99 threshold every run with no actual signal about server health. The threshold now measures: when the chaos didn't intervene, did the server complete the flow?

CI target: completes in under 3 minutes.

### Run

```bash
k6 run load-tests/chaos.js \
  -e BASE_URL=http://localhost:3000 \
  -e DEMO_PASSWORD=demo1234
```

### What this test honestly cannot verify

1. **The React offline queue** (`src/lib/sync/sync-queue.ts`). That code runs in the browser; k6 has no DOM or Service Worker. Test that with Playwright + Chrome DevTools network throttling (V7.4).
2. **Infrastructure-level chaos** — killing the database process, network partitions, pod eviction. Full chaos engineering with Toxiproxy or similar is V7.4 territory.
3. **The "retry UX" the user sees** (toast, spinner, retry button). Asserting that requires a browser-level test. k6 proves the server can absorb retry load; the UI feedback is a Playwright concern.

---

## Environment variables

| Variable | Default | Required? | Description |
|----------|---------|-----------|-------------|
| `BASE_URL` | `https://getsear.com` | no | Target server. Override for local/staging runs. |
| `DEMO_EMAIL` | `demo@getsear.com` | no | Login email. |
| `DEMO_PASSWORD` | (none) | **yes** | Login password. Both scripts throw on startup if missing. |

Demo credentials are documented in the project README; the scripts intentionally require them via env var to satisfy the no-hardcoded-credentials rule.

---

## How to read the output

k6 prints a live summary table while running, plus a final summary:

```
✓ checks.........................: 99.87% ✓ 4812  ✗ 6
  http_req_duration..............: avg=231ms  p(95)=610ms  p(99)=1.1s
  order_create_duration..........: avg=290ms  p(95)=620ms  p(99)=700ms
  http_req_failed................: 0.12%  ✓ 0     ✗ 6
  orders_completed...............: 41 total
  kds_polls......................: 1440 total
  chaos_simulated_failures.......: 213 (chaos.js only)
  chaos_skipped_flows............: 12  (chaos.js only)
  order_flow_success.............: 100% ✓ 38   ✗ 0
```

Key fields:
- `order_create_duration p(95)` < 800ms (full-shift).
- `http_req_failed` < 1% (full-shift) / < 0.1% (chaos).
- `order_flow_success` > 99% (chaos — chaos-free flows only).
- `orders_completed` ≥ 33 for a 12-min run at 200/hr.

### Summary export

```bash
k6 run load-tests/full-shift.js \
  -e BASE_URL=http://localhost:3000 \
  -e DEMO_PASSWORD=$DEMO_PASSWORD \
  --summary-export=load-tests/summary.json
```

---

## CI workflow

`.github/workflows/load-test.yml` runs `full-shift.js`:

- **Schedule:** Monday 09:00 UTC against staging (or local fallback if `STAGING_URL` is unset).
- **On-demand:** Actions → Load Test → Run workflow → set `target` to `staging` or `prod`.
- **Never on schedule against production.**

### Required secrets

| Secret | Description |
|--------|-------------|
| `LOAD_TEST_DEMO_PASSWORD` | **Required.** Demo tenant password. Workflow fails fast if absent. |
| `STAGING_URL` | URL of the staging server. If absent, CI spins up a local Next.js server. |
| `NEXT_PUBLIC_SUPABASE_URL` | (Local fallback only.) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (Local fallback only.) |
| `SUPABASE_SERVICE_ROLE_KEY` | (Local fallback only.) |
| `LOAD_TEST_DEMO_EMAIL` | Optional override. Default `demo@getsear.com`. |

Artifacts: `k6-load-test-summary-<run_id>` retained for 30 days; download to inspect `summary.json`.

---

## Demo tenant

Both scripts target the seeded demo tenant:
- email `demo@getsear.com`, org `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- Downtown Austin location `b2c3d4e5-f6a7-8901-bcde-f12345678901`
- 30+ active menu items, 22+ staff (Marcus Rivera owner).
- KDS stations discovered dynamically via `/api/kds/stations`.
