# Sear POS — Session Handoff (2026-05-04)

**Read this first when picking up in a new CLI.**

---

## TL;DR

- **V5 SHIPPED** (tag `v5.0.0`, retro at `build-pipeline/logs/retros/V5.md`).
- **V6.0 + V6.1 SHIPPED** (design tokens v2 + ~36 ui-v2 components live on getsear.com).
- **V6.2 MERGED but NOT DEPLOYED** (7 worktrees integrated to main; build/lint green; e2e green; held pending P0 fixes).
- **Cross-cutting review COMPLETE** (9 specialists audited their domains across V5+V6 — outputs at `build-pipeline/logs/cross-cutting-reviews/*.md`).
- **~26 P0 + ~85 P1 + ~61 P2 findings** — most concentrated in 4-5 fixable categories. **NOT going to start over.**
- **Recommended path:** spawn synthetic fix-batch `5.99-cross-cutting-fixes` via `sear-batch-implementer` → ship → deploy V6.2 → resume V6.3.

---

## Step 1 — Picking up in a new CLI

```bash
cd ~/Desktop/getsear
```

Then paste `build-pipeline/prompts/resume.md` into the CLI. The resume prompt now includes a check for in-flight reviews (none currently) and routes to the orchestrator pattern.

**OR** invoke directly:

```
spawn sear-batch-implementer for batch 5.99-cross-cutting-fixes
```

(The orchestrator's auto-invocation `<example>` patterns will route this correctly.)

---

## Step 2 — The agent team (now global at `~/.claude/agents/`)

13 personas, ALL available via `/agents` in any CLI:

**Implementers (9):**
| Name | Domain |
|---|---|
| `pos-coder` | POS/KDS/tables UI, ui-v2 components |
| `marketing-engineer` | Resend + BullMQ + react-email + tracking |
| `realtime-engineer` | Supabase Realtime hooks, offline queue, optimistic locking, XState, idempotency |
| `hardware-integrator` | Star printer, Valor reader, Bematech drawer + processor lock |
| `migration-author` | Supabase schema migrations + paired rollbacks |
| `supabase` | edge functions, type gen, auth flows, RPC, advisors |
| `e2e-tester` | Playwright specs, dev-only test infra |
| `security-reviewer` | privileged routes, RLS, manager-PIN, audit-log |
| `devops-deploy` | INTEGRATE.sh, DEPLOY.sh, env handling, CI |

**Reviewers (2):**
| Name | When |
|---|---|
| `reviewer` | After every implementer batch (correctness/criteria/scope/project rules) |
| `design-reviewer` | In parallel with `reviewer` for any UI-touching worktree |

**Orchestrators (2 — auto-invoked by description+examples):**
| Name | Triggers on |
|---|---|
| `sear-batch-implementer` | "spawn batch X", "ship the next batch", "keep going" |
| `sear-cross-cutting-reviewer` | "review everything", "audit", "find errors", pre-version-tag |

**Always dispatch via NATIVE `subagent_type: "<name>"`** — never `general-purpose` + prompt-inject persona. The framework auto-loads the persona file.

**Never use `claude -p` subprocess invocations** — proven 2026-05-04 to hit Write-tool sandbox blocks even with `--allow-dangerously-skip-permissions`. ALWAYS use the Agent tool with `run_in_background: true`.

---

## Step 3 — The cross-cutting findings (the immediate work)

All findings persisted at `build-pipeline/logs/cross-cutting-reviews/`. Per-specialist files are dense even when small (4-43KB each); together ~145KB total.

### TOP P0s by impact

#### 1. RLS layer is decorative (supabase agent)
- **Where:** every tenant-scoped table in `supabase/migrations/00000000000000_baseline.sql` (~207 policies)
- **Problem:** Tenant policies gate on `(current_setting('request.jwt.claims', true))::json->>'org_id'` but no `custom_access_token_hook` is configured anywhere → JWT `org_id` claim is always NULL → every authenticated query evaluates `org_id = NULL → false` → RLS blocks legitimate reads.
- **Compensation:** App routes use `createAdminClient()` (250+ files matched grep limit) which bypasses RLS entirely. Tenant isolation rests entirely on app-layer `eq('org_id', user.org_id)` filters.
- **Risk:** Any route that forgets the filter leaks across tenants.
- **Fix options:**
  - **A (right way, ~2h):** configure `custom_access_token_hook` in Supabase to inject `org_id` into JWT claims so RLS actually enforces. Then audit-log the migration.
  - **B (faster, ~4h):** accept app-layer enforcement; add an ESLint rule that flags `createAdminClient().from(...).select(...)` without an explicit `.eq('org_id', ...)`.
- **Owner:** `supabase` specialist

#### 2. `recalculateOrderTotals` TOCTOU window (realtime-engineer)
- **Where:** `src/lib/orders/recalculate-order.ts:175-184`
- **Problem:** UPDATE filters by `id` only; no `.eq('version', expectedVersion)`. Every route that calls it (POST /items, PATCH /, /comp, /discount, /merge, /items/[itemId]) gates its primary write on version but leaks the totals write. T1+T2 both pass `assertVersion` at v=5, both INSERT items, both call recalc — second writer's stale-snapshot UPDATE clobbers.
- **Was flagged in V5.4.1 review as P1; STILL OPEN.**
- **Fix:** thread `expectedVersion` through `recalculateOrderTotals(supabase, orderId, orgId, expectedVersion)`, chain `.eq('version', expectedVersion)`, check affected rows.
- **Owner:** `realtime-engineer` (~1h)

#### 3. `DELETE /api/orders/[id]` is a side-door void (realtime-engineer)
- **Where:** `src/app/api/orders/[id]/route.ts:208-270`
- **Problem:** No `assertVersion`, no `assertTransition`, no `withIdempotency`, no `audit.record`. The `/void/` subroute does this correctly; this one bypasses everything.
- **Risk:** Two terminals can both void; already-voided order can be re-voided; network-blip retry double-fires.
- **Fix:** delete this route OR delegate to `/void/` subroute.
- **Owner:** `realtime-engineer` (~30 min)

#### 4. `comp` route re-open / auto-close UPDATEs are unlocked (realtime-engineer)
- **Where:** `src/app/api/orders/[id]/comp/route.ts:136-142, 223-230`
- **Problem:** `assertVersion` at line 98 is decorative — the actual writes don't gate on version. Refund + comp race can both "win" with inconsistent ledger.
- **Fix:** add `.eq('version', expectedVersion)` to all UPDATEs in the route flow.
- **Owner:** `realtime-engineer` (~30 min)

#### 5. Migration follow-ups (migration-author — 6 issues)
- **C1:** `campaign_recipients.org_id` has no FK to `organizations` (orphan possibility on org delete). Sister migrations 043344 and 061225 do this correctly. **Fix:** follow-up `ADD CONSTRAINT ... NOT VALID` then `VALIDATE`. ~30min.
- **C2:** `campaign_recipients` RLS still permissive — baseline policies `allow_select`/`allow_insert`/`allow_update USING (true)` (lines 4566/4610/4658) remain. New `org_id` is stored but doesn't gate access — any authenticated request reads any tenant's recipient list including PII. **Fix:** replace with 4 tenant-scoped policies. ~30min.
- **M1:** `org_processor_bindings` (043344) and `idempotency_records` (061225) only define `tenant_select`. Persona rule: every new table needs all four policies. **Fix:** explicit `USING (false)` policies for INSERT/UPDATE/DELETE. ~30min × 2 tables.
- **Md3:** `audit_log_no_update`/`audit_log_no_delete` are permissive `USING (false)` — Postgres ORs permissive, so a future `USING (true)` policy bypasses the deny. **Fix:** convert to `AS RESTRICTIVE`. ~30min.
- **Md2:** `orders_id_version_org_idx (id, version, org_id)` is redundant against PK on `id`. **Fix:** drop. ~30min.
- **Owner:** `migration-author` (~3h total)

#### 6. Marketing pipeline gaps (marketing-engineer — 5 P0s, see file for detail)
- Idempotency, tenant-isolation, Resend response handling. Specifics in `build-pipeline/logs/cross-cutting-reviews/marketing-engineer.md`.
- **Owner:** `marketing-engineer` (~3h)

#### 7. Security gaps (security-reviewer — 5 P0s, see file)
- Manager-PIN bypass paths, audit-log gaps, missing tenant scoping on specific routes. Details in file.
- **Owner:** `security-reviewer` (~3h)

#### 8. Devops gaps (devops-deploy — 4 P0s, see file)
- INTEGRATE.sh failure modes, DEPLOY.sh races, npm test broken (vitest picks up Playwright specs), missing CI workflows.
- **Owner:** `devops-deploy` (~2h)

### TOTAL realistic fix time: ~16-20 working hours

---

## Step 4 — Recommended next-CLI execution plan

Put this into the new CLI:

```
Read build-pipeline/STATE.yaml and SESSION_HANDOFF_2026_05_04.md.
Read every file in build-pipeline/logs/cross-cutting-reviews/.
Then dispatch sear-batch-implementer for a synthetic batch 5.99-cross-cutting-fixes that bundles the top P0s:

5.99.1 supabase: configure custom_access_token_hook OR add eslint rule for missing org_id filters (pick A; if Supabase config not accessible, fall back to B)
5.99.2 realtime-engineer: thread expectedVersion through recalculateOrderTotals; gate UPDATE on .eq('version', v); update all 7 routes that call it
5.99.3 realtime-engineer: delete /api/orders/[id] DELETE OR delegate to /void/
5.99.4 realtime-engineer: gate comp route UPDATEs on .eq('version', expectedVersion)
5.99.5 migration-author: 6 follow-up migrations (FK on campaign_recipients.org_id, replace permissive RLS, INSERT/UPDATE/DELETE policies on 2 tables, RESTRICTIVE audit_log policies, drop redundant index)
5.99.6 marketing-engineer: address 5 P0s from cross-cutting-reviews/marketing-engineer.md
5.99.7 security-reviewer: address 5 P0s from cross-cutting-reviews/security-reviewer.md
5.99.8 devops-deploy: address 4 P0s from cross-cutting-reviews/devops-deploy.md (priority: fix vitest config so npm test works)

Spawn all 8 in parallel worktrees. After all complete + reviewer pass: INTEGRATE + apply migrations + DEPLOY. Then deploy the held V6.2.
```

The orchestrator handles parallelism, reviewer pass, FAIL→cycle, INTEGRATE, migrations, DEPLOY automatically.

---

## Step 5 — After P0 fixes ship

1. **Deploy V6.2** (already merged, just needs the post-P0 deploy):
   ```
   BATCH_ID=batch-6.2 ./build-pipeline/DEPLOY.sh
   ```

2. **Resume V6.3+:**
   ```
   spawn sear-batch-implementer for batch 6.3
   ```

   V6.3 is 2 tasks (one needs OPENAI_API_KEY → defers; one is design polish).

3. **Continue V6.4 → V6.5 → V6.6 (demo+ship V6 → tag v6.0.0).**

---

## Step 6 — What's already verified working

- getsear.com is LIVE and serving traffic
- Login works (verified via curl post-deploy)
- Auth + Marketing pipeline + KDS + Audit-log + Optimistic locking + Processor lock all functional
- Build green (`npm run build` ✓), lint green (0 errors, 317 warnings — debt parceled to bucketBLintDebt)
- 98/98 e2e tests passing (1 flaky on full-shift, recovered on retry)

---

## Step 7 — What's deferred / known debt (NOT blocking)

- **Hardware tasks (5.2.1/2/3):** Star printer, Valor reader, Bematech drawer drivers — defer until physical hardware is on Ian's desk. Framework (5.2.0) ready to receive them via single matrix-flip.
- **bucketBLintDebt:** 25 files with React 19 compiler bugs, parceled across V5/V6/V7 cleanup tasks (5.4.4, 6.7.4, 7.5.2, 7.5.3).
- **Bonus batches 5.7 (recipe auto-deduction) and 5.8 (cash variance):** not shipped; pick up between versions.
- **Alt-mfg drivers (Verifone P400, Ingenico Lane 3000, Clover Flex):** ship as `pending_cert` stubs; V9.10 lights them up after Valor EMV cert.
- **iOS/Android Tap-to-Pay:** marked `unsupported_until_psp_listed`; flips when Valor reaches Apple/Google PSP allowlist (V9.10.6/7).
- **vitest broken:** picks up Playwright spec files; `npm test` fails. Fix in V7 reliability batch (or as part of devops-deploy P0).

---

## Step 8 — Critical operational details (don't break these)

- **DEPLOY.sh sources `.env.local` before pm2 reload --update-env then pm2 save.** Next 16 standalone mode does NOT auto-load .env.local at runtime; OS env is the only source of server-side secrets. V5.3 P0 outage was caused by this.
- **Migration rollback files live at `supabase/_rollbacks/`** (NOT `supabase/migrations/`). Supabase CLI would otherwise apply them as forward migrations.
- **Login route now logs errors via `console.error('[auth/login]', err)`.** Bare `} catch {}` is banned project-wide — it swallowed the V5.3 P0 for hours.
- **Resend API key live** in `.env.local` (local) and `/opt/sear/app/.env.local` (prod). DNS records in Google Cloud DNS zone `getsear-zone` (project `getsear-pos`).
- **Processor binding for Sear Demo org:** 1 row, processor='valor', enforced by 3-layer defense (TS const literal type + DB BEFORE UPDATE trigger + zero UI surface).
- **Supabase project:** `lbekiyxqemxozmghgmtp`, account `rakowman@gmail.com`.
- **VM:** `ianrakow@34.132.111.219`, app at `/opt/sear/app`, pm2 process name `sear-pos`.

---

## Step 9 — Files to read in order

1. `SESSION_HANDOFF_2026_05_04.md` (this file)
2. `build-pipeline/STATE.yaml` (current pointer + in_flight section + decisions[])
3. `build-pipeline/logs/cross-cutting-reviews/*.md` (9 files; ~145KB total)
4. `build-pipeline/RUNNER.md` (operating manual)
5. `build-pipeline/DEFAULTS.md` (decision policies)
6. `build-pipeline/STANDING_RULES.md` (universal rules)
7. `build-pipeline/logs/retros/V5.md` (V5 retro)
8. `build-pipeline/versions/V6_VISUAL.md` (V6 spec, especially 6.3+)
9. `docs/design/UI_V2_COMPONENT_SPEC.md` (design contract for ui-v2)
10. `src/styles/tokens.css` (V6 design tokens v2)

---

## Step 10 — User profile reminders

- Ian Rakow, non-technical founder, wants fully autonomous AI builds.
- **Opus for all work. No Sonnet/Haiku.** (overrides any persona file's `model: sonnet` frontmatter)
- Premium design — never default Tailwind.
- Apple iPadOS LIGHT sidebar (#F2F2F7) — never regress to dark.
- Build fully or don't build — no `toast('coming soon')` (Rule 18).
- Commit + push + deploy after every successful batch.
- Don't ask questions repeatedly — runner doctrine is "don't stop, don't ask" except for hard blockers.
- Keep going without stopping all the time.
