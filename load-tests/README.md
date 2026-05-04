# Sear POS — k6 Load Test Suite

## Overview

`full-shift.js` models a realistic Friday-night shift at a Sear POS location:

- **8 terminal VUs** (simulated server iPads) each ring in ~25 orders/hr.
  - Each order: create → add 2–4 menu items → cash payment.
  - Combined throughput: **200 orders/hour** sustained for 12 minutes (≥40 full end-to-end orders).
- **4 KDS VUs** (kitchen display screens) poll `/api/kds/tickets` every 2 seconds throughout the run.

## Pass criteria (thresholds)

| Threshold | Limit | What it measures |
|-----------|-------|-----------------|
| `order_create_duration p(95)` | `< 800ms` | p95 latency for `POST /api/orders` — the single most latency-sensitive write in a terminal workflow. A busy kitchen should still get an order ID within 800ms 95% of the time. |
| `http_req_duration p(99)` | `< 2000ms` | p99 across ALL requests (create order, add item, payment, KDS poll). Hard ceiling: no request should take more than 2s at any percentile below 99. |
| `http_req_failed rate` | `< 0.01` (1%) | Fraction of HTTP requests returning a 4xx or 5xx. Under normal load the error rate must stay below 1%. |
| `checks rate` | `> 0.99` (99%) | Fraction of in-script assertions passing (status codes, response shapes). A failing check means the server returned an unexpected response even though HTTP succeeded. |

If any threshold is violated, k6 exits with code 99 and the CI workflow fails.

## How to run locally

### Prerequisites

Install k6: https://grafana.com/docs/k6/latest/set-up/install-k6/

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo apt-get install k6
```

### Against a local server

```bash
# Start the Next.js dev server first
npm run dev

# Run the load test
k6 run load-tests/full-shift.js -e BASE_URL=http://localhost:3000
```

### Against staging

```bash
k6 run load-tests/full-shift.js \
  -e BASE_URL=https://your-staging-url.example.com \
  -e DEMO_EMAIL=demo@getsear.com \
  -e DEMO_PASSWORD=demo1234
```

### Against production (use sparingly — on-demand only)

Production load testing from a single machine should only be done intentionally during off-peak hours. The CI workflow **never** targets production on a schedule.

```bash
k6 run load-tests/full-shift.js \
  -e BASE_URL=https://getsear.com \
  -e DEMO_EMAIL=demo@getsear.com \
  -e DEMO_PASSWORD=demo1234
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `https://getsear.com` | Target server. Override for local/staging runs. |
| `DEMO_EMAIL` | `demo@getsear.com` | Login email. |
| `DEMO_PASSWORD` | `demo1234` | Login password. |

## How to read the output

k6 prints a live summary table while the test runs and a final summary at the end:

```
✓ checks.........................: 99.87% ✓ 4812  ✗ 6
  http_req_duration..............: avg=231ms  min=45ms  med=198ms  max=1.8s  p(90)=420ms  p(95)=610ms  p(99)=1.1s
  order_create_duration..........: avg=290ms  min=80ms  med=250ms  max=750ms p(90)=530ms  p(95)=620ms  p(99)=700ms
  http_req_failed................: 0.12%  ✓ 0     ✗ 6
  orders_completed...............: 41 total
  kds_polls......................: 1440 total
```

Key fields to inspect:
- `order_create_duration p(95)` — must be `< 800ms`.
- `http_req_duration p(99)` — must be `< 2000ms`.
- `http_req_failed` — must be `< 0.01 (1%)`.
- `checks` — must be `> 0.99 (99%)`.
- `orders_completed` — should be ≥ 33 for a 12-minute run at 200/hr.
- `order_errors` — any non-zero value warrants investigation.

Custom trend metrics are tagged by `type`: `order_create`, `add_item`, `payment`, `kds_poll`. Use `--out json` to export per-metric time series for dashboards.

### With summary export

```bash
k6 run load-tests/full-shift.js \
  -e BASE_URL=http://localhost:3000 \
  --summary-export=load-tests/summary.json
```

`summary.json` contains all metric aggregations in a machine-readable format suitable for CI artifact inspection.

## CI workflow

The load test runs automatically every **Monday at 09:00 UTC** against the staging environment (controlled by the `STAGING_URL` secret). It also runs on-demand via **Actions → Load Test → Run workflow**.

To run against production from CI:
1. Go to Actions → Load Test — k6 Full Shift → Run workflow.
2. Set the `target` input to `prod`.
3. Click Run.

### Artifacts

After each CI run, a `k6-load-test-summary-<run_id>` artifact is uploaded and retained for 30 days. Download it to get `summary.json` for post-run analysis.

### Required secrets

| Secret | Description |
|--------|-------------|
| `STAGING_URL` | URL of the staging server. If absent, CI spins up a local Next.js server. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL (needed for local server fallback). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (needed for local server fallback). |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (needed for local server fallback). |
| `LOAD_TEST_DEMO_EMAIL` | Optional override for the demo login email. Defaults to `demo@getsear.com`. |
| `LOAD_TEST_DEMO_PASSWORD` | Optional override for the demo login password. Defaults to `demo1234`. |

## Notes on the demo tenant

The load test targets the demo tenant (`demo@getsear.com`, org `a1b2c3d4-e5f6-7890-abcd-ef1234567890`, Downtown Austin location `b2c3d4e5-f6a7-8901-bcde-f12345678901`). This tenant has:
- 30+ active menu items fetched dynamically at test start.
- 22+ staff members (Marcus Rivera is the owner).
- KDS stations are discovered dynamically via `/api/kds/stations`.

If the menu item fetch fails in `setup()`, terminal VUs continue exercising auth and order-create/payment routes with a synthetic fallback item (will result in 400 validation errors on `add_item`, which appear in `checks` failures but do not cause the test to abort).
