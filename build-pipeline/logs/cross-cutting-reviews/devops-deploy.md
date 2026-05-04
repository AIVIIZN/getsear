Write tool keeps requesting permission. Let me deliver the review as the final response since I can't write the file in this session.

# Cross-Cutting Review — Pipeline Plumbing & Deploy Mechanics (devops-deploy)

**Note:** Write to `build-pipeline/logs/cross-cutting-reviews/devops-deploy.md` was blocked by permissions (3 attempts). Delivering inline; copy this output into that file.

**Verdict:** Pipeline works but is brittle. V5 shipped, V6 mid-flight (6.2 merged on disk; STATE.yaml still says `awaiting_user_advance`). 22 findings catalogued; **4 are P0** that will silently corrupt pipeline state or prod the next time the wrong condition trips.

---

## P0 (will silently corrupt pipeline state or prod)

- **F-01 INTEGRATE.sh swallows build/lint failures with no log entry.** `npm run build` and `npm run lint` (lines 43–47) run under `set -euo pipefail`. On failure they exit before the JSONL log lines at 53/58 fire. **Evidence:** `logs/integrations.jsonl` has only 5 entries spanning 5.0×2, 5.2.0, 5.3×2 — but git log shows merges for 5.4, 5.5, 6.1, 6.2 too. **4 of the last 5 batches have no log entry.** Fix: trap on EXIT, wrap each step in `||` with per-step JSONL.
- **F-02 INTEGRATE.sh uses `git add -A`** (line 35) — directly violates STANDING_RULES line 39 and CLAUDE.md memory. Sweeps untracked agent scratch into merge commits. Evidence: `auto-commit: ... pre-merge` commits 5ad2b47, 0b16d2d, 2fa3309, d359dc0 prove this fired ≥4× in V6.2 alone. Fix: agents commit their own work; INTEGRATE aborts on dirty worktree.
- **F-03 DEPLOY.sh has no rollback on smoke failure.** Lines 56–68 exit 1 on smoke fail; new code is already live on VM via `pm2 reload --update-env`. Prod is left dark until next deploy. Fix: capture `PREV_COMMIT` on VM before `git pull`; on smoke fail, checkout+rebuild+reload.
- **F-04 `npm test` is broken — vitest auto-discovers `e2e/**/*.spec.ts`.** No `vitest.config.*` exists. Default include glob picks up the 19 Playwright spec files; vitest worker fails on `import '@playwright/test'`. CLAUDE.md says `npm test` must pass before commit — it always fails today. Mitigant: INTEGRATE.sh doesn't call `npm test`, so the unit suite (`tests/audit/csv.test.ts`) gets ZERO CI runs. Fix: add `vitest.config.ts` with `test: { include: ['tests/**/*.test.ts'] }`; wire `npm test` into INTEGRATE.sh.

## P1 (will hit in next 1–3 batches)

- **F-05 Migration application gap.** Migrations committed but never auto-applied. V5 worked because Ian was running MCP `apply_migration` manually. First migration that lands hands-off in V6+ will break prod. Fix: gate DEPLOY.sh on `npm run db:diff` returning empty against prod; separate `MIGRATE.sh` that runs `supabase db push --linked`.
- **F-06 `agents.jsonl` merge conflicts every parallel batch.** Single 43KB file, N agents in N worktrees all appending. Recurring "— resolved" merge commits in git log prove it. **Fix:** add `.gitattributes` line `build-pipeline/logs/*.jsonl merge=union` (1 line, durable).
- **F-07 `npm run test:e2e` runs against PROD pre-deploy.** `playwright.config.ts` baseURL is `https://getsear.com`. Pre-deploy integration tests test the OLD prod, not the new build. Fix: spin up `npm run start` locally for integration tests; move prod e2e to post-deploy regression sweep.
- **F-08 DEPLOY.sh has no fallback when `pm2 reload sear-pos` fails.** If pm2 process is missing (VM reboot, crash beyond restart budget), `set -e` kills the script. No `pm2 start ecosystem.config.js` fallback. Also: no `ecosystem.config.js` in repo — load-bearing infra unversioned.
- **F-09 STATE.yaml desynchronized from git.** `current_batch: "6.2"` + `status: awaiting_user_advance` but git log shows 8 `v6-batch-6.2-*` merge commits already on main. `awaiting_user_advance` isn't documented in RUNNER.md as a valid status. Resume.md will misroute.
- **F-10 STATE.yaml duplicate `deployed_url` keys** (lines 24 & 27). Last-wins clobbers `https://getsear.com` with `null`. Same shape risk for `demo_video`.
- **F-11 `.env.example` does not exist.** Devops protocol references it as the manifest of required vars. V7.1 (Sentry), V8.4.2 (Stripe), V9.x, V10.x will all need it.

## P2 (drift, robustness gaps, observability)

- **F-12** INTEGRATE.sh worktree regex includes dead `build-pipeline\|` alternative (line 26) — should be `/.claude/worktrees/v`.
- **F-13** Merge loop runs in `echo | while` subshell pipe (lines 31–39). Use `<<< "$WORKTREES"` here-string so `set -e` propagates cleanly.
- **F-14** `cp -r .next/static .next/standalone/.next/` and `cp -r public .next/standalone/` (lines 44–45) nest directories on second run (`public/public/`). `npm run build` cleans `.next/` but not `public/` symlinks. Use `rm -rf` first or `rsync -a --delete`.
- **F-15** `source .env.local` (lines 46–48) interprets `$`, backticks, and unescaped quotes in values. Use dotenv-cli or pm2 ecosystem env block.
- **F-16** No Sentry release tracking step. V7.1 prep gap.
- **F-17** STATE.yaml `agent:` names drift from `.claude/agents/` registry. 14+ synonyms (`coder`, `backend-dev`, `tester`, `devops`, `perf-analyzer`, `security-auditor`, `system-architect`, `ml-developer`, `ian-manual`, etc.) silently fall through to `general-purpose`, bypassing specialist personas (Apple iPadOS sidebar, lying-button rule).
- **F-18** STATE.yaml task `9.9.2` misplaced inside batch `9.10` (line 400).
- **F-19** Only `db-diff.yml` CI workflow. PRs without migrations get zero CI (no build/lint/test). Add `ci.yml`.
- **F-20** Misleading comment on `bucketBLintDebt` `[slug]` glob (eslint.config.mjs lines 17–18).
- **F-21** No programmatic guardrail against `AskUserQuestion` use or 4h+ STATE.yaml stall. Cron monitor on `last_updated_at`.
- **F-22** STATE.yaml `awaiting_user_advance` is undocumented soft-blocker bypassing BLOCKERS.md machinery.

## Stale-state inventory

- Worktrees on disk: only `.gitkeep`. **Clean.**
- `git worktree list`: only main checkout. **Clean.**
- BLOCKERS.md: template only. **Clean.**
- `agents.jsonl`: 43KB; will be merge-conflict tax until F-06 lands.

## Order of operations to harden

| Priority | Fix | Effort |
|---|---|---|
| **NOW** | F-04, F-09, F-10 | 30 min |
| **Before next batch** | F-06, F-01, F-02 | 2 hr |
| **Before V6 ships** | F-03, F-05, F-08, F-11, F-19 | 1 day |
| **Before V7 (Sentry)** | F-16, F-15, F-14, F-07 | 1 day |
| **Hygiene** | F-12, F-13, F-17, F-18, F-20, F-21, F-22 | 2 hr |

## Findings as JSONL

```jsonl
{"id":"F-01","severity":"P0","area":"INTEGRATE.sh","title":"build/lint failures emit no JSONL log","file":"build-pipeline/INTEGRATE.sh","lines":"43-58","fix":"trap on EXIT to always log; wrap each step in || with per-step JSONL"}
{"id":"F-02","severity":"P0","area":"INTEGRATE.sh","title":"git add -A in pre-merge auto-commit violates STANDING_RULES line 39","file":"build-pipeline/INTEGRATE.sh","lines":"35","fix":"agents commit their own work; INTEGRATE aborts on dirty worktree"}
{"id":"F-03","severity":"P0","area":"DEPLOY.sh","title":"no rollback on smoke failure; prod left broken","file":"build-pipeline/DEPLOY.sh","lines":"56-68","fix":"capture pre-deploy commit on VM; on smoke fail, checkout+rebuild+reload"}
{"id":"F-04","severity":"P0","area":"package.json","title":"vitest auto-discovers e2e/**/*.spec.ts; npm test fails","file":"package.json","lines":"12","fix":"add vitest.config.ts with include: ['tests/**/*.test.ts']"}
{"id":"F-05","severity":"P1","area":"DEPLOY.sh","title":"migrations are committed but never auto-applied","file":"build-pipeline/DEPLOY.sh","lines":"none","fix":"add db:diff gate before push; separate MIGRATE.sh that runs supabase db push --linked"}
{"id":"F-06","severity":"P1","area":"logs","title":"agents.jsonl merge conflicts on every parallel batch","file":"build-pipeline/logs/agents.jsonl","lines":"all","fix":".gitattributes: build-pipeline/logs/*.jsonl merge=union"}
{"id":"F-07","severity":"P1","area":"INTEGRATE.sh","title":"npm run test:e2e hits prod URL pre-deploy; tests OLD code","file":"build-pipeline/INTEGRATE.sh","lines":"50","fix":"local next start + baseURL localhost:3000 for integration; prod e2e moves post-deploy"}
{"id":"F-08","severity":"P1","area":"DEPLOY.sh","title":"no fallback when pm2 reload fails (process missing)","file":"build-pipeline/DEPLOY.sh","lines":"49","fix":"pm2 describe sear-pos check; commit ecosystem.config.js to repo"}
{"id":"F-09","severity":"P1","area":"STATE.yaml","title":"current_batch=6.2 awaiting_user_advance but batch is merged in git","file":"build-pipeline/STATE.yaml","lines":"4-6","fix":"reconcile to current state; advance pointer or restart"}
{"id":"F-10","severity":"P1","area":"STATE.yaml","title":"duplicate deployed_url keys; YAML last-wins clobbers real values","file":"build-pipeline/STATE.yaml","lines":"24,27","fix":"delete the null occurrences"}
{"id":"F-11","severity":"P1","area":"env","title":".env.example does not exist","file":".env.example","lines":"none","fix":"create with all current required vars before V7.1"}
{"id":"F-12","severity":"P2","area":"INTEGRATE.sh","title":"worktree-discovery regex includes dead 'build-pipeline' alternative","file":"build-pipeline/INTEGRATE.sh","lines":"26","fix":"grep '/.claude/worktrees/v'"}
{"id":"F-13","severity":"P2","area":"INTEGRATE.sh","title":"merge loop runs in pipe subshell; set -e doesn't propagate cleanly","file":"build-pipeline/INTEGRATE.sh","lines":"31-39","fix":"use here-string <<< \"$WORKTREES\""}
{"id":"F-14","severity":"P2","area":"DEPLOY.sh","title":"cp -r nests directories on subsequent runs (esp. public/)","file":"build-pipeline/DEPLOY.sh","lines":"44-45","fix":"rsync -a --delete or cp -rT after rm"}
{"id":"F-15","severity":"P2","area":"DEPLOY.sh","title":"source .env.local is unsafe with quotes/$/backticks in values","file":"build-pipeline/DEPLOY.sh","lines":"46-48","fix":"dotenv-aware loader or pm2 ecosystem env block"}
{"id":"F-16","severity":"P2","area":"DEPLOY.sh","title":"no Sentry release tracking (V7.1 prep)","file":"build-pipeline/DEPLOY.sh","lines":"none","fix":"sentry-cli releases new + finalize, gated on SENTRY_AUTH_TOKEN"}
{"id":"F-17","severity":"P2","area":"RUNNER.md+STATE.yaml","title":"STATE.yaml agent: names drift from .claude/agents/ registry","file":"build-pipeline/RUNNER.md,STATE.yaml","lines":"various","fix":"map synonyms to specialists or document fallthrough to general-purpose"}
{"id":"F-18","severity":"P2","area":"STATE.yaml","title":"task 9.9.2 misplaced inside batch 9.10","file":"build-pipeline/STATE.yaml","lines":"400","fix":"move under batch 9.9"}
{"id":"F-19","severity":"P2","area":"CI","title":"db-diff fires only on migration changes; no PR-level build/lint/test","file":".github/workflows/db-diff.yml","lines":"5-13","fix":"add ci.yml on every PR running build+lint+test"}
{"id":"F-20","severity":"P2","area":"eslint.config.mjs","title":"misleading comment about [slug] glob char-class","file":"eslint.config.mjs","lines":"17-18","fix":"correct comment"}
{"id":"F-21","severity":"P2","area":"observability","title":"no programmatic guardrail against AskUserQuestion / pipeline stalls","file":"build-pipeline/STANDING_RULES.md","lines":"35","fix":"cron monitor on STATE.yaml mtime > 4h"}
{"id":"F-22","severity":"P2","area":"STATE.yaml","title":"awaiting_user_advance is undocumented soft-blocker bypassing BLOCKERS.md","file":"build-pipeline/STATE.yaml","lines":"6","fix":"either escalate to BLOCKERS.md or remove the status"}
```
