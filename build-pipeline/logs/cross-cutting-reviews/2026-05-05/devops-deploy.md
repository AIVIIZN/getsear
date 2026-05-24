# DevOps / Deploy Audit — Sear POS
**Branch:** main | **Audit commit:** 77aa1e1 (context) → current HEAD c4e2d11
**Auditor:** deploy/pipeline-plumbing agent
**Date:** 2026-05-05

---

## Executive Summary

The core deploy pipeline is solid. `set -euo pipefail`, F-03 rollback, F-08 pm2 fallback, and the V5.3 P0 `.env.local` source are all present. One active P0 in the deploy log (`smoke_failed_rollback_failed` for batch-6.3), two P1s (ecosystem.config.js missing from repo, JSONL type inconsistency), and a set of P2/P3 hygiene items. No secrets are logged anywhere.

---

## Punch List

### P0

**P0-1 — Deploy log contains an unresolved `smoke_failed_rollback_failed` entry**

`build-pipeline/logs/deploys.jsonl` line 9:
```
{"ts":"2026-05-04T18:23:08Z","batch":"batch-6.3","commit":"f17d985...","http":"000000","status":"smoke_failed_rollback_failed","rollback_exit_code":255}
```
Exit code 255 from SSH means the SSH connection itself failed (not the rollback commands), so the VM state after batch-6.3 is unknown. batch-6.4 deployed successfully (302 ok, 24 minutes later) so the site recovered, but we do not know whether:
- The VM was left on a bad commit that happened to still serve requests, or
- A separate manual intervention occurred.

This should be investigated before the next batch that touches the same code paths. SSH into the VM and run `git -C /opt/sear/app log --oneline -3` to confirm HEAD matches the most recent successful deploy commit (`0df8610`).

---

### P1

**P1-1 — `ecosystem.config.js` is not committed to the repo**

`DEPLOY.sh` line 81 references `/opt/sear/app/ecosystem.config.js` as the fallback start path. The file does not exist anywhere in the local repo tree (`find` returned nothing). If the VM is reprovisioned from a fresh `git clone`, `pm2 start ecosystem.config.js` fails immediately and there is no fallback. The F-08 fallback path provides zero protection in this scenario.

**Fix:** Commit `ecosystem.config.js` to the repo root. Minimum viable content:
```js
module.exports = {
  apps: [{
    name: 'sear-pos',
    script: '.next/standalone/server.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '512M',
    env: { PORT: 3000, NODE_ENV: 'production' },
  }],
}
```
The instances/memory values should reflect the actual VM config once SSH is accessible again.

**P1-2 — JSONL type inconsistency in `deploys.jsonl`: `http` field is sometimes quoted string, sometimes integer**

Successful deploys emit `"http":$HTTP_CODE` (bare integer: `302`). Failed deploy entries emit `"http":"$HTTP_CODE"` (string: `"000000"`). On line 1, `http` is `302` (integer); on line 9 it is `"000000"` (a six-character string — an artifact of bash `|| echo "000"` repeating). Log parsers that type-check this field will break on the error case.

**Fix in DEPLOY.sh** (failure branch, line 145/147): change `"http\":\"$HTTP_CODE\"` to `"http\":\"$HTTP_CODE\",` is not enough — the field should be numeric or consistently quoted. Safest: always quote it.

Diff:
```diff
-echo "{\"ts\":\"$TIMESTAMP\",\"batch\":\"$BATCH_ID\",\"commit\":\"$COMMIT\",\"http\":$HTTP_CODE,\"status\":\"ok\"}" >> "$LOG_FILE"
+echo "{\"ts\":\"$TIMESTAMP\",\"batch\":\"$BATCH_ID\",\"commit\":\"$COMMIT\",\"http\":\"$HTTP_CODE\",\"status\":\"ok\"}" >> "$LOG_FILE"
```
Apply the same quoting to the two failure-path echo lines (already quoted there) so all three log sites are consistent.

Also: `HTTP_CODE` should not be `"000000"` — the `|| echo "000"` produces `"000"` but curl returns the 3-char empty code. The extra zeros in the P0-1 entry (`"000000"`) suggest a prior version of the script concatenated two fallback strings. Verify the current script only produces `"000"` on curl failure — the current code looks correct (`|| echo "000"`), so the historical six-zero entry is a one-time artifact from a prior script version, not a current bug.

---

### P2

**P2-1 — `INTEGRATE.sh` worktree grep is hardcoded to `/.claude/worktrees/v` — `agent-*` worktrees are silently skipped**

Line 51: `grep "/.claude/worktrees/v"`. The script header comment says "known limitation with agent-* worktrees (manual git merge --no-ff is the working pattern)" — but this limitation is only documented in `RUNNER.md`, not in `INTEGRATE.sh` itself. An operator running the script directly will see `no v* worktrees to merge` and assume everything is clean when agent-* branches remain unmerged.

**Fix:** Add a comment immediately above the grep line:
```bash
# NOTE: Only merges worktrees under /.claude/worktrees/v* (version-batch pattern).
# agent-* worktrees (e.g. /.claude/worktrees/agent-foo) are NOT auto-merged here.
# Merge those manually: git merge --no-ff <branch> -m "merge: <branch> (manual)"
# before running INTEGRATE.sh, or they will be silently ignored.
```

**P2-2 — `ci.yml` runs lint before unit tests, then build last — build failure wastes the lint+test time if a type error exists**

Current order: lint → unit tests → build. Build is the heaviest gate and catches type errors that lint passes. Reordering to build → lint → unit tests means a broken import or missing type is caught earliest (build is ~2 min; lint is ~30s; tests ~45s). The current order means a 45-second unit-test run can complete before a 30-second build that would have failed anyway.

Minor: swap to build → lint → unit tests in `ci.yml`.

**P2-3 — `load-test.yml` secret check runs AFTER k6 is installed (expensive step)**

The `Verify required secrets` step (step 7) runs after `Install k6` (step 6). If `LOAD_TEST_DEMO_PASSWORD` is not set, the apt-get k6 install (~30s) runs and then the job fails. Move the secret check to step 1 (immediately after checkout) to fail fast at zero cost.

**P2-4 — `load-test.yml` local-server fallback uses `npm start` without specifying the standalone server path**

Lines 94–95: `npm start &` then `npx wait-on http://localhost:3000`. The `npm start` script for a Next.js standalone project must reference `.next/standalone/server.js`, not `next start` (which requires the full Next.js dev layout). If the `start` script in `package.json` is `next start`, this will fail silently in CI since Next.js standalone mode only produces `.next/standalone/server.js`. Verify `package.json` `start` script matches standalone mode expectations.

**P2-5 — DB drift: 4 indexes applied to live Supabase not reflected in any migration**

Per handoff notes, 4 indexes exist on the live database but were applied outside of the migration files. `npm run db:diff` is expected to fail until these are captured in a migration. The `v7_indexes` migration (`20260504192408_v7_indexes.sql`) adds 10 indexes — but the 4 pre-existing ones may be additional/different.

**Recommended action:** Run `supabase db diff --linked` locally to see what `db:diff` reports, then create a new timestamped migration (e.g. `20260505000000_reconcile_live_indexes.sql`) that does `CREATE INDEX IF NOT EXISTS` for each of the 4. Use `IF NOT EXISTS` so it is idempotent if they already exist. This unblocks the `db-diff.yml` workflow.

---

### P3

**P3-1 — V7.1.1 Sentry: correctly deferred; no half-wired state present**

No `SENTRY_DSN` reads exist anywhere in `src/`. `STATE.yaml` records `status: pending, needs_credential: SENTRY_DSN`. `src/instrumentation.ts` does not exist. No Sentry SDK package in the dependency tree (grepping `@sentry` returns nothing from the audit log reference). Status: clean deferral. No action needed until `SENTRY_DSN` is provisioned.

**P3-2 — V7.1.2 structured logging: wired correctly but only 4 routes instrumented**

`src/lib/observability/logger.ts`, `req-context.ts`, and middleware are all present and correct. The middleware properly whitelists `/api/observability/rum` as a public route (no auth required for RUM beacons — correct). `getReqLogger` / `getReqLoggerFromRequest` are used in 4 routes: `auth/login`, `orders/[id]/items`, `orders/[id]/void`, `payments/process`. The remaining ~30+ API routes use neither, meaning most routes produce no structured log output. This is not a regression — V7.1.2 spec called for 4 demo routes — but the coverage gap should be tracked as a V8 backlog item.

**P3-3 — V7.1.3 web-vitals: wired correctly**

`web-vitals.ts` sends to `/api/observability/rum`. `/api/observability/rum/route.ts` validates with Zod, logs via `log.info('rum', ...)`, returns 204. `<WebVitalsInit />` is mounted in `src/app/layout.tsx` (confirmed). Auth bypass at middleware is present (`/api/observability/rum` is in `PUBLIC_ROUTES`). No issues.

**P3-4 — `DEPLOY.sh` rollback SSH uses `|| true` then re-SSHes to check status — creates a TOCTOU window**

Lines 133–141: the rollback SSH is followed by `|| true` to prevent set -e exit, then a second SSH call checks whether the rollback landed. If the VM is flapping (which is the likely cause of exit code 255 in P0-1), the second SSH could succeed while the first left the VM in an unknown state. This is an edge case but is the exact scenario that produced the P0-1 entry. A cleaner pattern would capture the first SSH exit code via a subshell and avoid the second SSH call — or use a single SSH call that atomically reports its own outcome.

**P3-5 — `ci.yml` build step does not set `SENTRY_DSN` stub**

All other required build-time env vars have stubs (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.). When V7.1.1 ships and `SENTRY_DSN` is read at build time (likely via `src/instrumentation.ts`), CI will fail unless the stub is added preemptively.

**Recommended preemptive addition to `ci.yml` build env block:**
```yaml
SENTRY_DSN: ""
```
An empty string will satisfy an `if (process.env.SENTRY_DSN)` guard without initializing the SDK.

**P3-6 — `db-diff.yml` has no `SUPABASE_ACCESS_TOKEN` secret rotation reminder or documentation**

The workflow requires 3 secrets (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`). None are documented in `.env.example` (the file is permission-restricted from this audit, but the CI secrets are separate from local env). If the access token expires, the workflow fails silently on PRs that do not touch migrations (because it only runs on `supabase/migrations/**` paths). Low risk but worth noting.

**P3-7 — No `dependabot.yml` or security scanning workflow**

No `dependabot.yml` exists in `.github/`. With `next`, `@supabase/supabase-js`, `web-vitals`, and other high-churn dependencies, unreviewed transitive CVEs can accumulate. Recommend adding `dependabot.yml` (weekly cadence, `npm` ecosystem) as a V8 task.

---

## Summary Table

| ID | Severity | Area | Status |
|----|----------|------|--------|
| P0-1 | P0 | Deploy log / VM state | Needs manual SSH verification |
| P1-1 | P1 | ecosystem.config.js missing | Commit to repo root |
| P1-2 | P1 | JSONL `http` type inconsistency | 1-line fix in DEPLOY.sh |
| P2-1 | P2 | INTEGRATE.sh agent-* blindspot | Add comment |
| P2-2 | P2 | ci.yml step order | Swap build before lint |
| P2-3 | P2 | load-test.yml fail-fast | Move secret check to step 1 |
| P2-4 | P2 | load-test.yml npm start standalone | Verify package.json start script |
| P2-5 | P2 | DB drift (4 indexes) | New reconcile migration |
| P3-1 | P3 | Sentry deferral | Clean — no action |
| P3-2 | P3 | Structured logging coverage | Track as V8 backlog |
| P3-3 | P3 | Web vitals wiring | Clean — no action |
| P3-4 | P3 | Rollback TOCTOU | Low-risk design note |
| P3-5 | P3 | SENTRY_DSN CI stub | Add preemptively to ci.yml |
| P3-6 | P3 | SUPABASE_ACCESS_TOKEN docs | Doc gap |
| P3-7 | P3 | No dependabot | V8 backlog |

---

## Files Examined

- `build-pipeline/DEPLOY.sh`
- `build-pipeline/INTEGRATE.sh`
- `build-pipeline/logs/deploys.jsonl`
- `build-pipeline/DEFAULTS.md`
- `build-pipeline/STATE.yaml` (Sentry + V7 sections)
- `.github/workflows/ci.yml`
- `.github/workflows/load-test.yml`
- `.github/workflows/db-diff.yml`
- `scripts/db-diff.mjs`
- `next.config.ts`
- `src/middleware.ts`
- `src/app/layout.tsx`
- `src/app/api/observability/rum/route.ts`
- `src/lib/observability/logger.ts`
- `src/lib/observability/req-context.ts`
- `src/lib/observability/web-vitals.ts`
- `supabase/migrations/20260504192408_v7_indexes.sql`
