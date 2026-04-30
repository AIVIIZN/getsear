# V7 — Reliability & Scale

## Theme
By the end of V7, a single Sear tenant survives 200 orders/hour for an 8-hour service with zero Sentry alerts and p99 API < 200ms. The codebase has version-controlled migrations, a working backup-restore drill, and indexes that match query patterns.

## Exit criteria
- ✅ All schema changes go through committed migrations; CI blocks drift.
- ✅ Sentry capturing every unhandled error + structured logs; alerting tuned.
- ✅ k6 load test in CI: 200 orders/hr × 8 terminals × 4 KDS, 8h sustained, zero errors, p99<200ms.
- ✅ Backup-restore drill: restore Tuesday 2pm to staging, verify data integrity.
- ✅ Index audit: every query < 50ms p99 OR has explicit waiver.
- ✅ Error boundary coverage: every route group has one.
- ✅ Web vitals (LCP/CLS/INP) all green on POS pages.

## Batch 7.0 — Pre-flight (sequential, ~1 hour)

### 7.0.1 — Verify db:diff still works
**Files:** CI config
**Acceptance:** `npm run db:diff` from V5 still operational; latest migrations applied to staging.

## Batch 7.1 — Observability (parallel, ~6 hours)

### 7.1.1 — Sentry SDK integration
**Files:** `next.config.ts`, `src/lib/observability/sentry.ts`, `.env.example` (SENTRY_DSN)
**Acceptance:** All errors flow to Sentry with org_id + user_id breadcrumbs. Source maps uploaded on deploy. Release tagging works.
**Needs:** SENTRY_DSN.

### 7.1.2 — Structured logging
**Files:** `src/middleware.ts`, `src/lib/observability/logger.ts`, all API routes use logger
**Acceptance:** Every request logs req_id; logs land in chosen log platform (Better Stack or Logflare). Correlation IDs traceable across the request lifecycle.

### 7.1.3 — Real User Monitoring
**Files:** `src/lib/observability/web-vitals.ts`
**Acceptance:** LCP/CLS/INP/FID per route in dashboard.

### 7.1.4 — Alert rules
**Files:** Observability platform config (committed where possible)
**Acceptance:** Alerts fire on synthetic test (error rate >1%, p99>200ms, 5xx>5/min); quiet otherwise.

## Batch 7.2 — Performance (parallel, ~8 hours)

### 7.2.1 — Index audit
**Files:** `supabase/migrations/v7_indexes.sql`, `docs/INDEX_AUDIT.md`
**Acceptance:** Run `EXPLAIN ANALYZE` on top 50 queries (from logs); add missing indexes. Every top-50 query < 50ms p99 OR justified waiver.

### 7.2.2 — API response caching
**Files:** `src/lib/cache/`, route handler refactor
**Acceptance:** Orders/menu/staff GET endpoints use stale-while-revalidate. Mutations invalidate.

### 7.2.3 — Bundle size budget
**Files:** `next.config.ts`, dynamic imports across reports + charts
**Acceptance:** First-load JS < 200kb on POS index. Reports module lazy-loaded. Recharts tree-shaken.

### 7.2.4 — Image pipeline
**Files:** `src/components/menu/MenuItemCard.tsx`, `next.config.ts` images
**Acceptance:** Menu photos served via Next/Image with AVIF/WebP, proper sizes attribute, blur placeholder. LCP on POS < 1.5s on 3G iPad simulation.

## Batch 7.3 — Load testing (parallel, ~5 hours)

### 7.3.1 — k6 load suite
**Files:** `load-tests/full-shift.js`, `.github/workflows/load-test.yml`
**Acceptance:** Realistic order flow at 200/hr, 8 simulated terminals, 4 KDS subscribers. Test runs in CI weekly + on-demand. Pass criteria documented.

### 7.3.2 — Chaos test
**Files:** `load-tests/chaos.js`
**Acceptance:** Random 500ms latency injection + random 5% 5xx → app stays usable. Users see retry UX, no crashes.

## Batch 7.4 — Backup & DR (parallel, ~3 hours)

### 7.4.1 — Daily off-site backup
**Files:** `scripts/backup.sh`, cron entry, `docs/RUNBOOK_BACKUP.md`
**Acceptance:** Backup file in S3 daily; 30-day retention.

### 7.4.2 — Restore drill
**Files:** `docs/RESTORE_RUNBOOK.md`, `scripts/restore-staging.sh`
**Acceptance:** Quarterly drill scheduled. First one passes: rebuild staging from backup; verify orders/payments/audit-log integrity.

## Batch 7.5 — Error boundaries (parallel, ~2 hours)

### 7.5.1 — Per route-group error.tsx
**Files:** `src/app/(pos)/error.tsx`, `(backoffice)/error.tsx`, `(fullscreen)/error.tsx`, `(auth)/error.tsx`
**Acceptance:** Throwing inside any page → branded error UI shown; Sentry captures; reset button reloads.

## Batch 7.6 — Demo + ship (sequential, ~2 hours)

- Run k6 load test, capture report.
- Demo: kill DB for 30s, show graceful degradation.
- Tag `v7.0.0`.
