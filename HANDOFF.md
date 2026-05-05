# Sear POS — Canonical Handoff

**Operating manual:** `/Users/ianrakow/Desktop/AI Critical Tools/agent-build-framework/MASTER_TEMPLATE.md`

The master template is V3, battle-tested, 21 absolute rules, 11 phases. **Read it first** in any new CLI before reading anything else here.

---

## Live state

- **Production:** https://getsear.com @ commit `2150f83` (smoke 302)
- **Tag:** `v6.0.0` (V6 visual layer complete)
- **Repo:** `~/Desktop/getsear` (main branch in sync with origin)
- **Supabase project:** `lbekiyxqemxozmghgmtp` (account `rakowman@gmail.com`)
- **VM:** `ianrakow@34.132.111.219`, app at `/opt/sear/app`, pm2 process `sear-pos`
- **Demo login:** `demo@getsear.com` / `demo1234` (org_id `a1b2c3d4-e5f6-7890-abcd-ef1234567890`, location `b2c3d4e5-f6a7-8901-bcde-f12345678901`)
- **PreToolUse hook live** at `.claude/hooks/no-inline-source-edit.sh` — orchestrator inline edits to protected paths are hard-blocked. Subagent worktree paths exempt. `apply_migration` always allowed; `execute_sql` DDL blocked.

---

## What this project IS (Master Template Part 1, condensed)

### 1.1 What
Restaurant POS replacing Toast / R Power for full-service restaurants. iPad-first, Apple iPadOS visual standard, premium feel.

### 1.2 Tech stack (decided)
- **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui
- **DB:** Supabase (Postgres + Auth + Realtime + Storage)
- **Hosting:** GCP VM via PM2 (production) — VM details above
- **Auth:** Supabase email + PIN login + custom_access_token_hook stamping `org_id`/`role`/`is_active` into JWT

### 1.3 Roles
- **Owner / Admin** — full system access
- **Manager** — privileged actions (void, comp, refund) require manager-PIN
- **Server / Staff** — order entry, payment, table management
- **Customer** — public ordering (online order flow)

### 1.4 Modules + features
See `build-pipeline/versions/V{5..10}_*.md`. 21 modules total per `docs/MODULE_DEPTH_AUDIT.md` (19 of 21 workflow-complete as of 2026-04-30).

### 1.5 Look + feel (locked)
- **Mode:** Light-first. KDS dark override.
- **Vibe:** Premium, minimal, fast, confident. Apple iPadOS feel.
- **Sidebar:** Light `#F2F2F7` (NOT dark — V5.x retro fix).
- **Animation:** Framer-motion spring physics on all transitions. `useReducedMotion` everywhere.
- **Quality bar:** Toast / R Power tier. References at `docs/COMPETITIVE_RESEARCH.md` + `docs/GEMINI_VIDEO_ANALYSIS.md`.
- **Tokens:** `src/styles/tokens.css` (V6 design tokens v2 — color/space/type/shadow/radius/z/animation/blur).
- **Component contract:** `docs/design/UI_V2_COMPONENT_SPEC.md`.

### 1.6 Business rules (locked)
- Tenant scoping mandatory: every query filters by `org_id`. RLS is second line.
- Privileged actions (void, comp, refund, manager override) require manager-PIN + audit log.
- Bare `} catch {}` BANNED — every catch must `console.error('[ctx]', err)`.
- Optimistic locking via `expectedVersion` on all primary-key UPDATEs.
- `apply_migration` is canonical migration path; `execute_sql` DDL is hook-blocked.

### 1.7 Integrations
Resend (email — CURRENTLY HALF-WIRED, P0 open), legacy SendGrid (deprecating), Twilio (SMS, future), Stripe (deferred — Sear is hardware-permissive / processor-locked to Valor per `STATE.yaml` decisions[]).

### 1.8 Future (NOT for current scope)
V8 = Trust (multi-tenant signup, auth flows, privileges audit). V9 = Integrations (delivery providers, accounting). V10 = AI (Insights, recommendations, pgvector).

---

## Version status (against master template phases)

| Version | Theme | Phases 1-11 status |
|---------|-------|--------------------|
| V5 | Operational Depth | ✅ Phases 1-11 complete (`v5.0.0` retro at `build-pipeline/logs/retros/V5.md`) |
| V6 | Visual & Feel | ✅ Phases 1-11 complete (`v6.0.0` tagged, retro at `build-pipeline/logs/retros/V6.md`) |
| V7 | Reliability | ⚠️ Phases 1-9 complete (V7.0-V7.3 shipped); Phase 10 has 3 open P0s + tracked debt |
| V8 | Trust | ❌ Phase 1 (Discovery) not started |
| V9 | Integrations | ❌ Phase 1 not started |
| V10 | AI | ❌ Phase 1 not started |
| Bonus | 5.7, 5.8, 6.7, 6.8 | ❌ Phase 1 not started (between-version polish batches) |

---

## Open P0s (master-template Phase 8 adversarial-review findings, 2026-05-05)

11 of 13 P0s from a cross-cutting audit closed; 2 remain. Punch list at `build-pipeline/logs/cross-cutting-reviews/2026-05-05/AGGREGATE.md`. Per-domain reports in same directory.

1. **MARK-1** — No Resend webhook handler. Bounces/complaints silently dropped → sender reputation degrades. Need: `POST /api/integrations/resend/webhook` with HMAC verification + recipient status update + tenant scope.
2. **MARK-2** — `campaigns.status` and `campaign_recipients.status` are unconstrained `text`. Code writes 8+ values; analytics rolls up `'delivered'` that's never written. Convert to enum or CHECK constraint.
3. **DEVOPS-1** — Verify VM commit matches local HEAD (batch-6.3 had `smoke_failed_rollback_failed` from SSH connection death; never verified). Plus: commit `ecosystem.config.js` to repo (DEPLOY.sh F-08 fallback has no target on fresh clone).

These are master-template Phase 10 (Fix and Re-review) work for V7. Run a fix-cycle then advance to V8 Phase 1.

---

## Tracked debt (P1/P2, opportunistic)

From the same cross-cutting audit:
- 880 hardcoded hex literals across `src/components/` (V6.6 token-adoption sweep)
- POS index gzip 384KB > 200KB target (V7.5 reliability batch)
- `#7C3AED` still unfixed in 4 files
- Two competing `EmptyState` components (legacy in drive-thru/franchise/settings)
- `upsertOpen`/`upsertClick` lost-update race (marketing analytics)
- 3 functions need `SET search_path = ''`
- 16 `WITH CHECK (true)` policies on tenant tables
- POS components over 500-line CLAUDE.md budget: `MultiTenderPayment` 929, `SplitCheckView` 893, `OrderPanel` 796
- bucketBLintDebt — 25 files with React 19 compiler warnings (parceled across V5.4.4, V6.7.4, V7.5.2/3)

---

## How to use this in a new CLI

1. **Read in this order:**
   - `/Users/ianrakow/Desktop/AI Critical Tools/agent-build-framework/MASTER_TEMPLATE.md` (operating manual)
   - This file (`HANDOFF.md`)
   - `build-pipeline/STATE.yaml` (live build state)
   - `build-pipeline/logs/cross-cutting-reviews/2026-05-05/AGGREGATE.md` (open P0s)
   - For V8+ work: `build-pipeline/versions/V8_TRUST.md` (then V9, V10 as you progress)

2. **For the 3 remaining V7 P0s (MARK-1/2 + DEVOPS-1):** Apply master template Phase 10 (Fix). Each is a focused fix cycle: dispatch the right specialist in a worktree, reviewer pass, integrate, deploy, re-verify.

3. **For V8+ (new scope):** Apply master template phases 1-11 in order. SEAR_POS_ARCHITECTURE.md is 17,935 lines — per master template's Architecture Rules, split into focused docs before implementation: SCHEMA.md, API_SPEC.md, DESIGN_SYSTEM.md, BUSINESS_RULES.md, MODULES.md.

4. **Specialists are pre-registered** at `~/.claude/agents/` and `.claude/agents/`:
   - `pos-coder`, `migration-author`, `security-reviewer`, `realtime-engineer`, `e2e-tester`, `devops-deploy`, `supabase`, `marketing-engineer`, `hardware-integrator`, `reviewer`, `design-reviewer`
   - Dispatch via Agent tool with `isolation: 'worktree'`. The PreToolUse hook hard-blocks orchestrator inline source edits.

5. **Migration discipline:** Use `apply_migration` MCP (canonical). After apply, align `schema_migrations.version` to file timestamp via `UPDATE supabase_migrations.schema_migrations SET version = '<file-ts>' WHERE name = '<slug>'` (DML, allowed by hook).

6. **Deploy discipline:** `BATCH_ID="<id>" bash build-pipeline/DEPLOY.sh`. Smoke 302 from `https://getsear.com` is canonical health. DEPLOY.sh sources `.env.local` before pm2 reload (V5.3 P0 fix — never remove).

---

## Mem0 lookup

```python
mcp__mem0__memory_retrieve(namespace="getsear-build", key="getsear-master-template-state")
mcp__mem0__memory_retrieve(namespace="getsear-build", key="getsear-standing-policies-and-rules")
mcp__mem0__memory_retrieve(namespace="getsear-build", key="getsear-operational-gotchas")
```

Or semantic: `mcp__mem0__memory_search(query="<topic>", namespace="getsear-build")`

---

## Paste this into a fresh CLI

```
You are picking up the Sear POS build under the agent-build-framework v3 master template.

Pre-flight (do this FIRST, in order):
1. Read /Users/ianrakow/Desktop/AI Critical Tools/agent-build-framework/MASTER_TEMPLATE.md (operating manual — 21 rules, 11 phases)
2. cd ~/Desktop/getsear
3. Read HANDOFF.md (canonical state pointer)
4. Read build-pipeline/STATE.yaml | head -10
5. Read build-pipeline/logs/cross-cutting-reviews/2026-05-05/AGGREGATE.md (open P0s)
6. curl -sS -o /dev/null -w "%{http_code}\n" https://getsear.com  # expect 302

You are the orchestrator. The PreToolUse hook hard-blocks inline edits to src/, supabase/migrations/, e2e/, load-tests/, .github/workflows/, scripts/, tests/, build-pipeline/{DEPLOY,INTEGRATE}.sh — dispatch specialists via Agent tool with isolation: 'worktree'. apply_migration is canonical; execute_sql DDL is blocked.

Apply the master template's 21 absolute rules and 11-phase orchestration to all subsequent work.

Two parallel tracks:

Track A — Close the V7 Phase 10 (Fix) work, in priority order:
  1. MARK-1: Resend webhook handler. Specialist: marketing-engineer.
  2. MARK-2: status enum/CHECK on campaigns + campaign_recipients. Specialist: migration-author + marketing-engineer.
  3. DEVOPS-1: SSH to VM, verify `git -C /opt/sear/app log --oneline -1` matches local HEAD; commit ecosystem.config.js to repo. Specialist: devops-deploy.
  These are independent and can run as parallel worktrees.

Track B — Begin V8 (Trust) Phase 1 (Discovery):
  1. Read build-pipeline/versions/V8_TRUST.md
  2. Per master template Architecture Rules, the SEAR_POS_ARCHITECTURE.md (17,935 lines) is too large to reason over. Split into SCHEMA.md, API_SPEC.md, DESIGN_SYSTEM.md, BUSINESS_RULES.md, MODULES.md (V8-relevant sections) before Phase 2.
  3. Master template Phase 1 = Discovery. Read V8 spec, identify ambiguities, ask clarifying questions OR confirm interpretation. Wait for user approval before Phase 2.

Default starting move: dispatch all three Track A items in parallel worktrees, while reading V8_TRUST.md to prep Track B Phase 1 questions.

Begin.
```
