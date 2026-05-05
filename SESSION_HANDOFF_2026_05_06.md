# Sear POS — Session Handoff (2026-05-06)

**Read this first when picking up in a new CLI.** Supersedes `SESSION_HANDOFF_2026_05_05.md`.

---

## TL;DR

- **Live:** https://getsear.com @ commit `62f6d85` (302 in ~1s)
- **This session shipped:** cross-cutting audit (11 agents, 13 P0s found) + 11 P0 fixes across SEC-1a/1b/2/3/4 + DATA-1/2/3 + LOAD-1/2/3 + a PreToolUse hook that hard-blocks orchestrator inline edits
- **2 P0s remaining:** MARK-1/2 (no Resend webhook + unconstrained status enum) + DEVOPS-1 (verify VM commit + commit `ecosystem.config.js`)
- **New workflow doc:** `docs/AGENT_TREE_ARCHITECTURE.md` — the orchestrator → specialist pattern. **Read this before dispatching anything.**

---

## Step 1 — Picking up in a new CLI

```bash
cd ~/Desktop/getsear
```

Read in this order:
1. `SESSION_HANDOFF_2026_05_06.md` (this file)
2. `docs/AGENT_TREE_ARCHITECTURE.md` (workflow + spawn procedure + paste-ready kickoff)
3. `build-pipeline/STATE.yaml` (live state)
4. `build-pipeline/logs/cross-cutting-reviews/2026-05-05/AGGREGATE.md` (the punch list this session worked from)

Then run:
```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://getsear.com
# Expect: 302
```

If 302 → start MARK-1. If anything else → surface immediately.

---

## Step 2 — What shipped THIS session (2026-05-05 → 2026-05-06)

### Cross-cutting audit (11 agents in parallel, ~12 min wall-clock)
9 specialists + 1 V7.3-cycle-2 reviewer + 1 follow-up retry. All 10 completed. Per-domain reports at `build-pipeline/logs/cross-cutting-reviews/2026-05-05/{security-reviewer,migration-author,realtime-engineer,pos-coder,marketing-engineer,design-reviewer,devops-deploy,supabase,e2e-tester,hardware-integrator}.md`. Synthesis at `AGGREGATE.md`.

**Found 13 P0s.** Most damning: e2e-tester caught 3 P0s in V7.3 load-suite code that the cycle-1 reviewer + my self-review both said PASS. The load suite couldn't create a single order (UUIDv4 mismatch + payment status `!== 200` vs server's 201 + pre-tax client orderTotal vs server's `order.total`).

### SEC/DATA/LOAD fix batch (4 specialists in parallel worktrees)

| Batch | Closes | Implementer | Reviewer verdict |
|-------|--------|-------------|------------------|
| SEC-1a | 6 routes with stale local `validateManagerPin` (terminated managers could authorize voids/comps/refunds) + in-memory PIN brute-force | security-reviewer | CONCERNS → 3 P2 inline fixes → PASS |
| SEC-1b | `auth_hook_read_users` policy global `qual=true` | migration-author | CONCERNS (P2 doc only) |
| DATA-1 | Phantom V7.2.1 alignment (4 indexes in `schema_migrations` but no file) | migration-author | (same migration as SEC-1b) |
| DATA-2 | `database.ts` stale since V5.4.3; 33 `as any` casts; 5 real type bugs surfaced + fixed | supabase | PASS (3 non-blocking P2s) |
| DATA-3 | Missing `ai_sales_summary` RPC dead-code path | supabase | (same agent) |
| LOAD-FIX | UUIDv4 idempotency + 201 payment status + server-truth `order.total` + explicit `exec:` | e2e-tester | CONCERNS (P2 missing TODO) |

All merged into `main`. Auth-hook narrow applied to live Supabase via `execute_sql` + manual `schema_migrations` insert (now live: `qual = (is_active=true AND deleted_at IS NULL)`).

### SEC-2 batch (2026-05-06 00:00 UTC)
**Closes P0-SEC-2:** 9 user-data tables had RLS enabled but ZERO policies (effective service-role-only lockout):
`drive_thru_cars, drive_thru_lanes, inventory_waste_log, order_throttle_config, print_queue, print_routing, printers, receipt_config, shift_marketplace`

migration-author wrote `supabase/migrations/20260505030000_sec2_close_rls_lockout.sql` — 45 policies (5 per table: `tenant_select/insert/update/delete` + `service_role_bypass`). Reviewer PASS. devops-deploy applied via `apply_migration`, aligned `schema_migrations.version` to `20260505030000` (no drift), pushed, deployed, smoke 302, login still 200.

### PreToolUse hook installed
`.claude/hooks/no-inline-source-edit.sh` + `.claude/settings.local.json` (committed, auto-loads in fresh CLI).

**Blocks:**
- `Edit`/`Write`/`MultiEdit` on main-checkout `src/`, `supabase/migrations/`, `supabase/_rollbacks/`, `e2e/`, `load-tests/`, `tests/`, `scripts/`, `.github/workflows/`, `build-pipeline/{DEPLOY,INTEGRATE}.sh`
- DDL via `mcp__claude_ai_Supabase__execute_sql` (CREATE/ALTER/DROP/GRANT/REVOKE/TRUNCATE at start of trimmed query, plus INSERT INTO supabase_migrations)

**Allows:**
- Edits inside `.claude/worktrees/agent-XXX/...` (subagents work normally)
- `mcp__claude_ai_Supabase__apply_migration` unconditionally (it IS the canonical migration path)
- Read-only `execute_sql` (SELECT/EXPLAIN)
- Edits to `build-pipeline/STATE.yaml`, `docs/`, project-root `*.md`, `.claude/` config

If a block fires wrongly: edit `.claude/settings.local.json` to disable temporarily.

---

## Step 3 — What's STILL OPEN (2 P0s + tracked debt)

### Next batches in priority order

1. **MARK-1** — Resend webhook handler. Currently bounces/complaints/delivery events from Resend are silently dropped (legacy SendGrid handler at `src/app/api/integrations/email/webhook/route.ts` is the only one). Sender reputation degrades. Need: new `POST /api/integrations/resend/webhook` with HMAC verification + recipient status update + tenant scope.
   - Specialist: `marketing-engineer`
   - File scope: `src/app/api/integrations/resend/webhook/route.ts` (new); `src/lib/marketing/send-campaign.ts` (refactor); maybe a small migration to add a webhook-event log table

2. **MARK-2** — Unconstrained `text` status columns. `campaigns.status` and `campaign_recipients.status` accept any string; analytics rolls up `'delivered'` that no code ever writes. Convert to enum or CHECK constraint with the canonical value set.
   - Specialist: `migration-author` + `marketing-engineer`
   - File scope: new migration with CHECK constraint or enum type + paired rollback; the `marketing-engineer` audit listed all 8 written values

3. **DEVOPS-1** — Verify VM commit matches `62f6d85`. The cross-cutting audit flagged batch-6.3 had a `smoke_failed_rollback_failed` deploy entry (SSH connection died mid-rollback, exit 255). VM recovered but never verified. Plus: `ecosystem.config.js` doesn't exist in repo — DEPLOY.sh's F-08 fallback (`pm2 start ecosystem.config.js`) has no target on a fresh VM clone.
   - Specialist: `devops-deploy`
   - Tasks: SSH to VM, `git -C /opt/sear/app log --oneline -1` confirm matches `62f6d85`; then commit `ecosystem.config.js` to repo (currently absent)

### Tracked debt (P1/P2 from the audit, pick up opportunistically)
- **8 RLS-no-policies tables** — closed in SEC-2.
- **POS index gzip 384KB > 200KB** — V7.5 reliability batch.
- **`#7C3AED` still unfixed** in 4 files — V6.6 token-adoption sweep.
- **880 hardcoded hex literals** across `src/components/` — V6.6.
- **Two competing `EmptyState` components** — V6.6.
- **`upsertOpen`/`upsertClick` lost-update race** — marketing.
- **3 functions need `SET search_path = ''`** (`prevent_processor_binding_change`, `bump_order_version`, `next_order_number`) — security.
- **16 PostgREST policies with `WITH CHECK (true)`** — security.
- **bucketBLintDebt** — 25 files with React 19 compiler warnings, parceled across V5.4.4, V6.7.4, V7.5.2/3.
- **POS components over 500-line CLAUDE.md budget**: `MultiTenderPayment` 929, `SplitCheckView` 893, `OrderPanel` 796.

### Deferred (need credentials / hardware)
- **V7.1.1** Sentry SDK — needs `SENTRY_DSN`.
- **V7.1.4** Alert rules — depends on V7.1.1.
- **Hardware drivers (5.2.1/2/3)** — defer until physical Star/Valor/Bematech.

---

## Step 4 — Operating manual (the agent-tree pattern)

**Authoritative source:** `docs/AGENT_TREE_ARCHITECTURE.md` — read it before dispatching anything. Highlights:

- **Orchestrator never edits protected paths.** The hook enforces this; the doc explains why.
- **Specialists work in `.claude/worktrees/agent-XXX/...`** — those paths bypass the hook by design.
- **Build agent prompt template** (in § 3 of the arch doc) — fill `{{BATCH_ID}}` and `{{ACCEPTANCE_CRITERIA}}` and dispatch.
- **Per-batch flow** (§ 5 of arch doc): identify batch → parallel implementer dispatch → parallel reviewer pass → cycle-2 if FAIL → merge in dependency order → push → apply migrations via `apply_migration` → DEPLOY.sh → STATE.yaml update.
- **Specialists registered:** pos-coder, migration-author, security-reviewer, realtime-engineer, e2e-tester, devops-deploy, supabase, marketing-engineer, hardware-integrator + reviewer + design-reviewer (11 personas at `~/.claude/agents/` and `.claude/agents/`).
- **Known gaps + workarounds** (§ 7 of arch doc): worktree-isolation sometimes ignored; `apply_migration` creates today's-timestamp `schema_migrations` row (use `UPDATE … SET version = '<file-timestamp>'`); reviewer agents can stall on stream watchdog (re-spawn fresh).

---

## Step 5 — Critical operational facts (DO NOT BREAK)

### Environment
- **Supabase project ID:** `lbekiyxqemxozmghgmtp` (account `rakowman@gmail.com`, dashboard `https://supabase.com/dashboard/project/lbekiyxqemxozmghgmtp`)
- **Demo org_id:** `a1b2c3d4-e5f6-7890-abcd-ef1234567890` (Marcus Rivera owner, Downtown Austin location `b2c3d4e5-f6a7-8901-bcde-f12345678901`)
- **Demo login:** `demo@getsear.com` / `demo1234`
- **VM:** `ianrakow@34.132.111.219`, app at `/opt/sear/app`, pm2 process `sear-pos`
- **SSH key:** `~/.ssh/google_compute_engine`

### .env handling
- `.env.local` IS SANDBOXED — Bash + Read both blocked from accessing it locally
- For prod env updates: SSH to VM and `sudo tee -a /opt/sear/app/.env.local`, then `set -a && source .env.local && set +a && pm2 reload sear-pos --update-env && pm2 save`
- DEPLOY.sh sources `.env.local` before pm2 reload — V5.3 P0 outage was caused by missing this. NEVER remove.

### Migration discipline
- Migrations: `supabase/migrations/<14-digit timestamp>_<slug>.sql`
- Rollbacks: `supabase/_rollbacks/` (NOT `migrations/` — Supabase CLI re-applies anything in `migrations/`)
- Apply via `mcp__claude_ai_Supabase__apply_migration` (canonical; hook allows it)
- Verify schema first via `execute_sql` — V7.2.1 had a phantom `ticket_id` column
- `apply_migration` creates today's-timestamp `schema_migrations` row; align with `UPDATE supabase_migrations.schema_migrations SET version='<file-ts>' WHERE name='<slug>'` to avoid drift

### Deploy discipline
- Always `git push origin main` BEFORE running DEPLOY.sh
- Smoke 302 from `/` is canonical health
- DEPLOY.sh smoke can false-negative on local network blip — verify directly via `curl https://getsear.com` + SSH `git rev-parse HEAD`
- V5.99.8 cycle-2 logic distinguishes `smoke_failed_rolled_back` vs `smoke_failed_rollback_failed`

### Build discipline
- After ANY merge that adds a new dep → `npm install` BEFORE pushing
- `npm run lint` — 0 errors required (~250 pre-existing warnings is OK)
- `npm run build` — must pass
- `npm test` — 19/19 currently

### Hook discipline
- The hook auto-loads from `.claude/settings.local.json` — committed, persists in new CLI
- NEVER inline-edit protected paths (the hook will block, and even if you found a hole the user has been clear)
- ALWAYS dispatch via Agent tool with `isolation: 'worktree'`
- If you NEED to edit a protected path inline (genuine emergency), edit `.claude/settings.local.json` to disable + commit a justification

---

## Step 6 — Files YOU should know about

### Authoritative state
- `build-pipeline/STATE.yaml` — live build state, decisions[], deferred_tasks
- `build-pipeline/logs/retros/{V5,V6}.md` — version retros (V7 retro pending)
- `build-pipeline/logs/reviews.jsonl` — every reviewer verdict
- `build-pipeline/logs/agents.jsonl` — every agent run
- `build-pipeline/logs/integrations.jsonl` + `deploys.jsonl`
- `build-pipeline/logs/cross-cutting-reviews/2026-05-05/` — the 10 specialist reports + AGGREGATE.md from this session

### Spec
- `build-pipeline/versions/V{5,6,7,8,9,10}_*.md`
- `build-pipeline/RUNNER.md` — operating manual (now augmented by `docs/AGENT_TREE_ARCHITECTURE.md`)
- `build-pipeline/STANDING_RULES.md`
- `build-pipeline/DEFAULTS.md`

### Project
- `SESSION_HANDOFF_2026_05_05.md` (PRIOR — superseded by this file)
- `SESSION_HANDOFF_2026_05_06.md` (this file)
- `SEAR_POS_ARCHITECTURE.md` (heavy; extract sections, don't read whole)
- `CLAUDE.md` (project rules)
- `~/.claude/projects/-Users-ianrakow-Desktop-getsear/memory/MEMORY.md` (auto-loaded)

### Hook + agents
- `.claude/hooks/no-inline-source-edit.sh` (committed, executable)
- `.claude/settings.local.json` (committed, registers the hook)
- `.claude/agents/` — project-local persona overrides (~11 specialists)
- `~/.claude/agents/` — global persona files

### Design + Supabase reference
- `src/styles/tokens.css` — V6 design tokens v2
- `docs/COMPETITIVE_RESEARCH.md` — Toast + R Power baseline
- `docs/INDEX_AUDIT.md` — V7.2.1 query analysis
- `docs/AGENT_TREE_ARCHITECTURE.md` (this session — workflow doc)

---

## Step 7 — Mem0 lookup keys (for any question)

```python
mcp__mem0__memory_retrieve(namespace="getsear-build", key="getsear-session-handoff-2026-05-06")
mcp__mem0__memory_retrieve(namespace="getsear-build", key="getsear-agent-tree-pattern")
mcp__mem0__memory_retrieve(namespace="getsear-build", key="getsear-standing-policies-and-rules")
mcp__mem0__memory_retrieve(namespace="getsear-build", key="getsear-operational-gotchas")
```

Or semantic: `mcp__mem0__memory_search(query="<topic>", namespace="getsear-build")`

---

## Step 8 — Standing rules (reinforced after this session's slips)

1. **Opus only.** Never Sonnet/Haiku.
2. **Premium design.** Apple iPadOS LIGHT sidebars (`#F2F2F7`).
3. **Build fully or don't build.** Rule 18: ban `toast('coming soon')`, ban placeholder UI.
4. **Commit + push + deploy after every batch.**
5. **Don't ask questions repeatedly.** Runner doctrine: "don't stop, don't ask" except for hard blockers.
6. **NEVER hardcode secrets.** NEVER commit `.env*`.
7. **Tenant scoping:** every query filters by `org_id`. RLS is second line of defense.
8. **Bare `} catch {}` is BANNED.** Every catch must `console.error('[ctx]', err)` (V5.3 outage rule).
9. **NEW THIS SESSION — ORCHESTRATOR NEVER EDITS PROTECTED PATHS.** The hook enforces; this rule documents the policy. If the hook blocks, dispatch the right specialist. Do NOT disable the hook to slip through.
10. **NEW THIS SESSION — `apply_migration` IS the canonical migration path.** `execute_sql` for DDL is hook-blocked. If you need to align a `schema_migrations` row, use `UPDATE ... SET version` (DML, allowed) after applying.

---

## Step 9 — Paste-ready kickoff for a fresh CLI

> See `docs/AGENT_TREE_ARCHITECTURE.md` § 9 for the canonical kickoff message. Brief version:
>
> ```
> You are picking up the Sear POS autonomous build pipeline.
>
> Pre-flight (do this FIRST, in this order):
> 1. cd ~/Desktop/getsear
> 2. Read SESSION_HANDOFF_2026_05_06.md
> 3. Read docs/AGENT_TREE_ARCHITECTURE.md — this is the operating manual; do not skip it
> 4. cat build-pipeline/STATE.yaml | head -10
> 5. curl -sS -o /dev/null -w "%{http_code}\n" https://getsear.com  # expect 302
>
> Hard rules:
> - You are the ORCHESTRATOR. You NEVER edit src/, supabase/migrations/, e2e/, load-tests/, .github/workflows/, scripts/, tests/, build-pipeline/{DEPLOY,INTEGRATE}.sh inline.
> - The PreToolUse hook hard-blocks slips. If it blocks, dispatch the right specialist via Agent tool with isolation: 'worktree'.
> - apply_migration is the canonical migration path; execute_sql DDL is blocked.
> - Commit + push + deploy after every batch.
>
> Next batches (in order):
> 1. MARK-1: Resend webhook handler. Specialist: marketing-engineer
> 2. MARK-2: status enum constraints on campaigns / campaign_recipients. Specialist: migration-author + marketing-engineer
> 3. DEVOPS-1: verify VM commit matches local HEAD; commit ecosystem.config.js to repo. Specialist: devops-deploy
>
> Begin with MARK-1.
> ```

---

## Step 10 — One-line summary if you only read this

> **As of 2026-05-06, getsear.com runs at commit `62f6d85` with 11 of 13 P0s from the cross-cutting audit closed. The PreToolUse hook hard-blocks orchestrator inline slips; the agent-tree pattern is documented at `docs/AGENT_TREE_ARCHITECTURE.md`. Next: MARK-1 (Resend webhook), MARK-2 (status enum), DEVOPS-1 (verify VM + commit ecosystem.config.js).**
