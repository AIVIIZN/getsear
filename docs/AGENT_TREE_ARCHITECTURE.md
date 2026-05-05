# Sear POS — Agent-Tree Orchestration Architecture

**Version:** 2026-05-05  
**Status:** Canonical reference. Read this after SESSION_HANDOFF_2026_05_05.md in any new CLI.

---

## § 1 — Why we pivoted to the agent-tree model

During the 2026-05-05 session (V5.99 cross-cutting fixes + V6.3–V7.2), the orchestrator repeatedly slipped into inline edit mode. Each slip was rationalized at the time:

- **V7.3 cycle-2 single-login refactor** — "mechanical tweak, faster to do inline"
- **README writes** — "CLAUDE.md says not to, but this one is worth it"
- **Walkout merge conflict in `logger.ts`** — "trivial conflict, I'll just pick one side"
- **Auth-hook narrow apply via `execute_sql`** — "just a SELECT check, not real DDL"
- **SEC-1a P2 fixes** — "P2s are minor, not worth the dispatch overhead"

The cost: the cross-cutting audit (11 specialists, 2026-05-05) found **3 P0s in code the orchestrator had inline-reviewed as PASS**. Self-review fails for the same reason it fails in human engineering: the author's mental model screens out their own errors.

The **PreToolUse hook** (`.claude/hooks/no-inline-source-edit.sh`) is the reactive fix — it hard-blocks `Edit`/`Write`/`MultiEdit` on protected paths from the main checkout. This document is the **proactive workflow** — what the next CLI starts with instead of relearning from corrections.

**The rule is simple:** the orchestrator's job is navigation and integration. It never opens a source file to change it. It dispatches a specialist, waits for the result, then merges.

---

## § 2 — The agent-tree model

```
ORCHESTRATOR (main session)
│   Tools: Bash (git, status, merge), Read, Edit/Write on:
│     build-pipeline/STATE.yaml
│     docs/*.md
│     *.md at root
│     .claude/
│   FORBIDDEN: Edit/Write on src/, supabase/migrations/,
│     supabase/_rollbacks/, .github/workflows/, e2e/,
│     load-tests/, tests/, scripts/, build-pipeline/DEPLOY.sh,
│     build-pipeline/INTEGRATE.sh
│
├── Agent tool (isolation: "worktree") ─────┐
│                                           │
│   IMPLEMENTERS                            │
│   ├── pos-coder                           │ parallel batch
│   ├── migration-author                    │ (1 msg, N calls)
│   ├── security-reviewer                   │
│   ├── realtime-engineer                   │
│   ├── e2e-tester                          │
│   ├── devops-deploy                       │
│   ├── supabase                            │
│   ├── marketing-engineer                  │
│   └── hardware-integrator                 │
│                                           │
│   REVIEWERS (after each implementer)      │
│   ├── reviewer ────────────────────────── every worktree
│   └── design-reviewer ─────────────────── UI-touching worktrees only
│
└── ORCHESTRATORS (top-level dispatch)
    ├── sear-batch-implementer  (one full batch end-to-end)
    └── sear-cross-cutting-reviewer  (all 9 domains, AGGREGATE.md)
```

### Specialist registry

| `subagent_type` | Path ownership | When to use |
|---|---|---|
| `pos-coder` | `src/components/pos\|kds\|tables/**`, `src/app/(pos)/**`, `src/components/menu/**` | POS UI, KDS panel, dialogs, table layouts, order-flow screens |
| `migration-author` | `supabase/migrations/`, `supabase/_rollbacks/` | Schema DDL, RLS policies, indexes, paired rollbacks |
| `security-reviewer` | `src/app/api/auth\|payments\|orders/**`, `src/lib/audit\|auth/**` | RLS verification, manager-PIN, audit log, OWASP, secret hygiene |
| `realtime-engineer` | `src/hooks/use-*realtime*`, `src/hooks/use-kds-*`, `src/lib/offline/**` | 8 ref-init realtime hooks, IndexedDB offline queue, optimistic locking, XState |
| `e2e-tester` | `e2e/**`, `load-tests/**` | Playwright workflow specs, k6 load/chaos suites |
| `devops-deploy` | `build-pipeline/DEPLOY.sh`, `build-pipeline/INTEGRATE.sh`, `.github/workflows/**`, `scripts/**` | Pipeline scripts, GH Actions, pm2/nginx, Sentry, env vars |
| `supabase` | `supabase/functions/**`, `src/lib/supabase/**` | Edge functions, type regen, RPCs, storage, auth flows, pgvector |
| `marketing-engineer` | `src/app/api/marketing\|emails/**`, `src/lib/email/**` | Campaign send, BullMQ, Resend, react-email |
| `hardware-integrator` | `src/lib/hardware/**`, `src/app/api/hardware/**` | Star/Valor/Bematech drivers |
| `reviewer` | any worktree | Layer-1 correctness review on any completed worktree |
| `design-reviewer` | UI-touching worktrees | Premium UI quality (Toast/R Power tier, Apple iPadOS light sidebar) |

### Protected paths (orchestrator cannot touch)

```
src/
supabase/migrations/
supabase/_rollbacks/
.github/workflows/
e2e/
load-tests/
tests/
scripts/
build-pipeline/DEPLOY.sh
build-pipeline/INTEGRATE.sh
```

Worktree paths (`.claude/worktrees/agent-XXX/src/...`) are NOT blocked — subagents work in their own branch and the orchestrator merges the result.

---

## § 3 — Agent dispatch prompt template

When the orchestrator dispatches a specialist, the specialist's persona file (`~/.claude/agents/<name>.md`) already encodes project conventions. The prompt only needs these fields:

```
WORKTREE: /Users/ianrakow/Desktop/getsear/.claude/worktrees/v{{N}}-batch-{{BATCH_ID}}-{{slug}}/
TASK ID: {{TASK_ID}} — {{TASK_TITLE}}
SPEC: see build-pipeline/versions/V{{N}}_*.md  →  section "{{BATCH_ID}} — {{BATCH_NAME}}" → "{{TASK_ID}}"
FILES: {{files from version spec}}
ACCEPTANCE CRITERIA:
  - {{criterion 1}}
  - {{criterion 2}}
BRANCH NAME: v{{N}}-batch-{{BATCH_ID}}-{{slug}}

SYSTEM RULES (include verbatim in every dispatch):
- DO NOT ASK QUESTIONS. The user is not present. Resolve uncertainty via
  /Users/ianrakow/Desktop/getsear/build-pipeline/DEFAULTS.md or the safer default.
- LOG every non-trivial decision: append to
  /Users/ianrakow/Desktop/getsear/build-pipeline/logs/decisions.jsonl
  one JSON line: {ts, task_id, decision, rationale, alternatives}.
- TEST before marking complete: npm run build + npm run lint (0 errors) + npm test.
- COMMIT to your worktree branch: "{batch_id}/{task_id}: {short summary}".
- DO NOT TOUCH FILES OUTSIDE YOUR TASK SCOPE.
- ON COMPLETION: append to
  /Users/ianrakow/Desktop/getsear/build-pipeline/logs/agents.jsonl
  one JSON line: {ts, task_id, status:"ok"|"deferred"|"failed", reason?, files_touched:[]}.

Apply your standard protocol from .claude/agents/{{your-name}}.md.
Begin now.
```

### Project context (pre-filled, never omit)

```
Root:       /Users/ianrakow/Desktop/getsear
Prod:       https://getsear.com
Supabase:   lbekiyxqemxozmghgmtp  (account: rakowman@gmail.com)
Demo creds: demo@getsear.com / demo1234
Demo org:   a1b2c3d4-e5f6-7890-abcd-ef1234567890 (Marcus Rivera, Downtown Austin)
VM:         ianrakow@34.132.111.219  /opt/sear/app  pm2: sear-pos
SSH key:    ~/.ssh/google_compute_engine
Build:      npm run build (Next 16) + npm run lint (0 errors required) + npm test
```

### Hard constraints (include in every dispatch)

```
- 0 hardcoded secrets or hex colors in source files.
- No } catch {} — every catch must console.error('[<ctx>]', err).
- Tenant-scope every Supabase query with .eq('org_id', user.org_id).
- Worktree-isolated; commit on worktree branch.
- No toast('coming soon') — Rule 18: every button does its full job or doesn't appear.
- No documentation files (*.md, README) unless the spec task explicitly requests one.
```

For `general-purpose` (when no specialist fits), expand to the full long-form prompt: embed all project conventions, the SYSTEM RULES block, all constraints, and the ON COMPLETION protocol inline, because the persona file doesn't exist.

---

## § 4 — How build agents invoke specialists

The reviewer and specialist chain:

```
orchestrator
  └─ spawns implementer agent(s) in parallel worktrees (1 message, N Agent calls)
       └─ each implementer commits to its worktree branch
            └─ orchestrator spawns reviewer(s) in parallel (1 message)
                 ├─ reviewer → logs to logs/reviews.jsonl
                 └─ design-reviewer (if UI files changed) → logs to logs/design-reviews.jsonl
                      └─ FAIL → orchestrator re-spawns implementer with issues[] appended
                           (max 3 fix cycles per task; after 3 → BLOCKERS.md)
                      └─ PASS / CONCERNS → orchestrator proceeds to INTEGRATE.sh
```

**Harness limit (Step 8 #1 of SESSION_HANDOFF_2026_05_05.md):** a sub-agent spawned with `subagent_type: "sear-batch-implementer"` does not always have the Agent tool available in its own palette. When that happens, the orchestrator (main session) dispatches the specialists directly — this is the proven working pattern for all batches from 5.99 onward. Do not route through the orchestrator agents unless testing that specific path.

**Reviewer dispatch prompt:**

```
You are reviewing task {{task_id}}.
worktree_path: /Users/ianrakow/Desktop/getsear/.claude/worktrees/v{{N}}-batch-{{B}}-{{slug}}/
branch: v{{N}}-batch-{{B}}-{{slug}}
spec_excerpt: <copy relevant section from build-pipeline/versions/V{{N}}_*.md>
acceptance_criteria:
  - <criterion 1>
  - <criterion 2>
Apply your protocol from .claude/agents/reviewer.md.
Append your verdict JSON line to logs/reviews.jsonl.
```

---

## § 5 — Orchestrator workflow per batch

1. Read `build-pipeline/STATE.yaml` and `build-pipeline/RUNNER.md` (top of every session).
2. Check `build-pipeline/BLOCKERS.md` — if any active (non-template) entry exists, halt.
3. Identify `current_version` + `current_batch` → find first pending batch.
4. Read the relevant version spec file (`build-pipeline/versions/V{N}_*.md`).
5. For each task in the batch, create the worktree:
   ```bash
   cd /Users/ianrakow/Desktop/getsear
   git worktree add -b "v{N}-batch-{B}-{slug}" \
     ".claude/worktrees/v{N}-batch-{B}-{slug}" main
   ```
6. Dispatch all implementers in **one message** (parallel `Agent` calls, `run_in_background: true`).
7. Wait for all to complete (system notifies; do not poll). Read `logs/agents.jsonl` to tally status.
8. Dispatch reviewer(s) per worktree in **one message** (parallel). Include `design-reviewer` for UI-touching worktrees (detect via `git diff main...HEAD --name-only | grep -E '^src/components/|src/app/.*\.(page|layout)\.tsx?$|src/styles/|src/app/globals\.css$'`).
9. If any reviewer returns FAIL: re-spawn implementer with the issues[] block. Max 3 cycles per task.
10. All PASS or CONCERNS → run `BATCH_ID="<id>" bash build-pipeline/INTEGRATE.sh` (merges worktrees, runs build/lint/test:e2e).
11. Apply any new migrations via `apply_migration` MCP tool (serial, one at a time).
12. Run `BATCH_ID="<id>" bash build-pipeline/DEPLOY.sh` (push → VM pull/build/reload → smoke).
13. Verify smoke: `curl -sS -o /dev/null -w "%{http_code}\n" https://getsear.com` → expect `302`.
14. Update `build-pipeline/STATE.yaml`: mark tasks complete, advance `current_batch`, update `last_updated_at`.
15. Append to `build-pipeline/logs/integrations.jsonl` and `logs/deploys.jsonl`.

**Merge integration note:** INTEGRATE.sh greps for `v*` worktrees. Agent-harness-created worktrees are named `agent-*` and will not be auto-merged. Use `git merge --no-ff <branch>` manually for those.

---

## § 6 — Stage ordering and parallel dispatch rules

### What runs in parallel

- All implementer tasks in a batch with disjoint file paths run in parallel (proved stable with 4 simultaneous worktrees — SEC + DATA + LOAD + DEVOPS-8 batch).
- Reviewer agents run in parallel after their implementer completes (one message containing all reviewer calls).
- `design-reviewer` runs in parallel with `reviewer` — never serial.

### What must serialize

| Stage | Why |
|---|---|
| INTEGRATE.sh | Single `git checkout main` + `git merge`; concurrent merges corrupt the index |
| `apply_migration` | Single Supabase project; concurrent DDL causes lock contention |
| DEPLOY.sh | Single GCP VM; concurrent deploys corrupt the `.next/standalone` directory |
| STATE.yaml write | Single file; concurrent writes lose entries |

### Proven batch pattern (SEC/DATA/LOAD, 2026-05-05)

Four specialists dispatched in one message:
1. `security-reviewer` — RLS + auth gaps
2. `migration-author` — schema follow-ups
3. `supabase` — JWT hook function
4. `e2e-tester` — load/chaos k6 suite

All 4 completed in ~30 minutes with disjoint file sets. Zero merge conflicts. This is the target pattern for every parallel batch.

---

## § 7 — Known gaps and workarounds

### 1. Worktree naming mismatch

Agent-harness worktrees use `agent-<id>` branch names. INTEGRATE.sh's `v*` glob won't pick them up for auto-merge. **Workaround:** after the specialist completes, the orchestrator does:

```bash
git -C /Users/ianrakow/Desktop/getsear merge --no-ff agent-<id>
```

Always verify the branch name with `git -C <worktree-path> branch --show-current` before merging.

### 2. Proactive README / doc creation in implementer prompts

CLAUDE.md prohibits documentation files unless explicitly requested. Implementer prompts that include phrases like "document your changes" or "update the README" will cause the specialist to create files that should not exist. **Workaround:** never include doc-creation language in implementer prompts unless the version spec task explicitly lists it as a deliverable.

### 3. `apply_migration` timestamp vs file timestamp drift

`apply_migration` inserts a `schema_migrations` row with the current wall-clock timestamp, not the file's 14-digit filename prefix. This causes `npm run db:diff` to show drift. **Workaround:** after `apply_migration`, verify with:

```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY inserted_at DESC LIMIT 5;
```

If the version column doesn't match the file's prefix, update it:

```sql
UPDATE supabase_migrations.schema_migrations
SET version = '<file-timestamp>'
WHERE name = '<slug>';
```

### 4. Logger merge conflict

Multiple parallel worktrees creating `src/lib/observability/logger.ts` (e.g., V7.1.2 canonical + V7.1.3 stub) produce a merge conflict at INTEGRATE time. **Workaround:** resolve with `git checkout --ours src/lib/observability/logger.ts` when the `--ours` side is the richer API. Verify the kept file has `log.{debug,info,warn,error}` + `boundLogger` + `makeReqId` before committing the merge.

### 5. Cycle-2 reviewer stream watchdog stall

Occasionally a reviewer agent will appear to hang and never deliver a verdict (hit in DATA-2). The process appears active but produces no output. **Workaround:** after 10 minutes with no notification, re-spawn a fresh reviewer with the same prompt. Do not re-run the implementer — the worktree is intact.

### 6. Sub-agent Agent-tool unavailability

The `sear-batch-implementer` orchestrator persona, when spawned as a sub-agent, does not always receive the Agent tool in its palette. **Workaround:** dispatch implementer specialists directly from the main session. This is the proven path for all batches since 5.99.

### 7. Schema verification before migrations

`kds_ticket_events` does not have a `ticket_id` column (actual columns: `order_item_id`, `station_id`, `order_id`). Running `apply_migration` with phantom columns silently applies partial DDL and leaves the schema inconsistent. **Workaround:** always run a SELECT-based schema check via `execute_sql` before writing a migration for any table that hasn't been touched in the current session.

---

## § 8 — Cost and token tracking

Token costs are not budgeted per-batch; they are tracked via the JSONL logs:

- `build-pipeline/logs/agents.jsonl` — every agent run with task ID and completion status
- `build-pipeline/logs/reviews.jsonl` — every reviewer verdict
- `build-pipeline/logs/design-reviews.jsonl` — every design-reviewer verdict
- `build-pipeline/logs/deploys.jsonl` — every DEPLOY.sh run with smoke result
- `build-pipeline/logs/integrations.jsonl` — every INTEGRATE.sh run

Soft cap: $20/session (Anthropic gateway warns). Hard cap: $50 (gateway throws). If approaching soft cap, log to `STATE.yaml decisions[]` and continue — do not stop. The session that ran 17 batches (2026-05-05) stayed well under the hard cap.

---

## § 9 — Kickoff message (paste-ready for a fresh CLI)

Paste this verbatim into a new Claude Code window opened at `/Users/ianrakow/Desktop/getsear`:

---

You are picking up the Sear POS autonomous build pipeline. Do the following pre-flight before any other action.

**Pre-flight (run in order):**

1. Verify the Agent tool is available — if it is not listed in your tool palette, stop immediately and tell me. Every other step depends on it.

2. Verify prod is up:
   ```
   curl -sS -o /dev/null -w "%{http_code}\n" https://getsear.com
   ```
   Expected: `302`. If you get anything else, surface it immediately before touching code.

3. Read these files in order (parallel reads are fine):
   - `/Users/ianrakow/Desktop/getsear/SESSION_HANDOFF_2026_05_05.md`
   - `/Users/ianrakow/Desktop/getsear/build-pipeline/STATE.yaml`
   - `/Users/ianrakow/Desktop/getsear/docs/AGENT_TREE_ARCHITECTURE.md` (this file)
   - `/Users/ianrakow/Desktop/getsear/build-pipeline/logs/cross-cutting-reviews/2026-05-05/AGGREGATE.md`

4. Read `build-pipeline/RUNNER.md` and `build-pipeline/DEFAULTS.md`.

**Current state (as of 2026-05-05):**
- Prod commit: `e6b632c` — V6.3.1 menu photo AI shipped, v6.0.0 tagged
- V5 + V6 fully shipped. V7.0, V7.1, V7.2, V7.3 shipped.
- Remaining P0s closed: MARK-1 (Resend webhook), MARK-2 (unconstrained status columns), DEVOPS-1 (verify VM commit + commit ecosystem.config.js)
- The PreToolUse hook is live — it will hard-block any inline edit to protected paths

**Next batches (pick the first that applies):**
- **MARK-1** — Resend webhook handler for delivery/bounce/complaint events → dispatch `marketing-engineer`
- **MARK-2** — constrain `status` text columns (add DB CHECK constraint + TS enum exhaustion) → dispatch `migration-author` + `pos-coder`
- **DEVOPS-1** — verify VM is on `e6b632c` + commit `ecosystem.config.js` → dispatch `devops-deploy`
- **V7.4** — deploy automation (per V7_RELIABILITY.md) → dispatch `devops-deploy`
- **V7.5** — reliability hardening + lint debt → dispatch `realtime-engineer` + `pos-coder`
- **V8.1** — onboarding flow → dispatch `pos-coder` + `supabase`

**Hard rules (the hook blocks the slip; this is belt-and-suspenders):**
1. NEVER edit protected paths inline from the main checkout. Protected: `src/`, `supabase/migrations/`, `supabase/_rollbacks/`, `e2e/`, `load-tests/`, `tests/`, `scripts/`, `.github/workflows/`, `build-pipeline/DEPLOY.sh`, `build-pipeline/INTEGRATE.sh`. Dispatch a specialist agent instead.
2. NEVER use `execute_sql` for DDL — the hook blocks it. Use `migration-author` + `apply_migration`.
3. NEVER commit `.env*` files.
4. NEVER force-push to main.
5. NEVER skip pm2 health check after any deploy change.
6. NEVER ask the user a question — resolve uncertainty via `DEFAULTS.md` or the safer default.

**Dispatch procedure for a batch:**
1. Create worktrees for each task: `git worktree add -b "v{N}-batch-{B}-{slug}" ".claude/worktrees/v{N}-batch-{B}-{slug}" main`
2. Dispatch all implementers in ONE message (parallel Agent calls, `run_in_background: true`).
3. After all complete, dispatch `reviewer` per worktree (+ `design-reviewer` for UI-touching) in ONE message.
4. FAIL → cycle-2 (re-spawn implementer with issues[]). Max 3 cycles.
5. All PASS/CONCERNS → `BATCH_ID="<id>" bash build-pipeline/INTEGRATE.sh`
6. Apply migrations via `apply_migration` MCP.
7. `BATCH_ID="<id>" bash build-pipeline/DEPLOY.sh`
8. Verify: `curl https://getsear.com` → 302
9. Update `build-pipeline/STATE.yaml`, push.

**Begin with MARK-1 unless STATE.yaml or AGGREGATE.md shows a higher-priority item.**

---

## § 10 — Live state snapshot (as of 2026-05-05)

| Item | Value |
|---|---|
| Prod URL | https://getsear.com |
| Prod commit | `e6b632c` (V6.3.1 — menu photo AI) |
| Tag | `v6.0.0` |
| Smoke | 302 (verified post-SEC-2 deploy) |
| V5 | Complete |
| V6 | Complete (bonus batches 6.7/6.8 optional) |
| V7.0 | Complete (db:diff verified) |
| V7.1 | Partial — V7.1.2 (structured logging) + V7.1.3 (web-vitals) shipped; V7.1.1 (Sentry) + V7.1.4 (alerts) deferred pending `SENTRY_DSN` credential |
| V7.2 | Complete (4 tasks shipped) |
| V7.3 | Complete (k6 load + chaos suites) |
| V7.4+ | Pending |
| P0s remaining | MARK-1, MARK-2, DEVOPS-1 (see AGGREGATE.md) |
| JWT hook | Live — custom_access_token_hook enabled in Supabase dashboard by Ian |
| Cross-cutting audit | 11 agents, 13 P0s identified, AGGREGATE.md at `build-pipeline/logs/cross-cutting-reviews/2026-05-05/AGGREGATE.md` |
| P0s closed | 11 of 13 (via SEC/DATA/LOAD batch + SEC-2) |
| Hook live | `.claude/hooks/no-inline-source-edit.sh` registered in `.claude/settings.local.json` |
| DB drift | 3 extra indexes not in any migration file (see Session Handoff Step 3 — Tracked debt) |
| OpenAI key | Needs rotation (sk-proj-8uI... was visible in chat history 2026-05-05) |

---

## § 11 — Files this architecture uses

### Orchestrator reads every session

| File | Purpose |
|---|---|
| `SESSION_HANDOFF_2026_05_05.md` | Authoritative handoff; read first |
| `build-pipeline/STATE.yaml` | Live build state, decisions[], deferred_tasks, current pointer |
| `build-pipeline/RUNNER.md` | Loop protocol, spawn instructions, integration/deploy steps |
| `build-pipeline/STANDING_RULES.md` | Universal rules across V5–V10 |
| `build-pipeline/DEFAULTS.md` | Decision policy for every ambiguous choice |
| `build-pipeline/BLOCKERS.md` | Active stop conditions; halt if non-template entry exists |
| `docs/AGENT_TREE_ARCHITECTURE.md` | This file — workflow reference |

### Orchestrator reads per batch

| File | Purpose |
|---|---|
| `build-pipeline/versions/V5_OPERATIONAL.md` | V5 spec (done) |
| `build-pipeline/versions/V6_VISUAL.md` | V6 spec (done; bonus batches optional) |
| `build-pipeline/versions/V7_RELIABILITY.md` | V7 spec (in progress) |
| `build-pipeline/versions/V8_TRUST.md` | V8 spec |
| `build-pipeline/versions/V9_INTEGRATIONS.md` | V9 spec |
| `build-pipeline/versions/V10_AI.md` | V10 spec |
| `build-pipeline/logs/cross-cutting-reviews/2026-05-05/AGGREGATE.md` | P0/P1/P2 punch list from 11-agent audit |

### Orchestrator writes

| File | Purpose |
|---|---|
| `build-pipeline/STATE.yaml` | Updated after every batch |
| `build-pipeline/logs/integrations.jsonl` | One line per INTEGRATE.sh run |
| `build-pipeline/logs/deploys.jsonl` | One line per DEPLOY.sh run |
| `build-pipeline/logs/decisions.jsonl` | One line per non-trivial decision |
| `build-pipeline/logs/retros/V{N}.md` | One file per completed version |

### Specialists write

| File | Purpose |
|---|---|
| `build-pipeline/logs/agents.jsonl` | One line per agent completion (ok/deferred/failed) |
| `build-pipeline/logs/reviews.jsonl` | One line per reviewer verdict |
| `build-pipeline/logs/design-reviews.jsonl` | One line per design-reviewer verdict |

### Persona files (not modified during runs)

| Location | Contents |
|---|---|
| `~/.claude/agents/*.md` | Global scope — 13 persona files |
| `.claude/agents/*.md` | Project scope — same 13 personas, checked into repo |

### Hook and settings

| File | Purpose |
|---|---|
| `.claude/hooks/no-inline-source-edit.sh` | PreToolUse hook — blocks protected-path edits from main checkout |
| `.claude/settings.local.json` | Hook registration; NOT committed (local override) |
| `.claude/settings.json` | Project-scoped permissions (committed) |

### Design references

| File | Purpose |
|---|---|
| `src/styles/tokens.css` | V6 design tokens v2 — source of truth for colors/spacing/type |
| `docs/design/UI_V2_COMPONENT_SPEC.md` | V6 component contract |
| `docs/COMPETITIVE_RESEARCH.md` | Toast / R Power hex codes + layout specs |

---

## § 12 — Files this architecture explicitly does NOT use

The following patterns exist in other codebases but are not part of the Sear POS pipeline. Do not create or reference them:

- **Chain-driver lockfiles** (`.claude/chain-lock`, `coordinator.lock`) — not on this pattern.
- **`coordinator.sh` or `workflow-runner.sh`** — orchestration is the Claude main session + Agent tool, not a shell loop.
- **Inline shell-driven build orchestration** — `claude -p` subprocess spawning is banned (proven to hit Write-tool sandbox block; see RUNNER.md anti-pattern note).
- **`plans/` directory at project root** — RUNNER.md forbids touching `~/.claude/plans/`.
- **`MASTER_TEMPLATE.md`** — no such file in this project; RUNNER.md explicitly prohibits touching it.
- **`TODO.md` or `FINDINGS.md` at project root** — CLAUDE.md prohibits documentation files at root. All findings go to `build-pipeline/logs/` as JSONL or to `docs/` when explicitly a task deliverable.
- **`progress.json` or `status.json`** — `build-pipeline/STATE.yaml` is the single source of progress truth.
- **Per-agent config files** — specialists receive all configuration via the dispatch prompt + their persona file. No per-agent config on disk.
