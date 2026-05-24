# Cross-Cutting Review — Aggregate (2026-05-05)

11 agents in parallel. Main @ `77aa1e1`. V5+V6+V7 shipped.

Per-domain reports in this directory; this file is the synthesized P0/P1 punch list.

## P0 — must fix before next deploy (13)

### Security (4)

**P0-SEC-1 — Manager-PIN bypass on 6 privileged routes** (security-reviewer S-P0-1)
The V5.99.7 fix landed at `src/lib/auth/manager-pin.ts` (correct, filters `is_active=true`). But these routes still use their own stale local `validateManagerPin` helper:
- `src/app/api/payments/void/route.ts`
- `src/app/api/payments/refund/route.ts:208-211`
- `src/app/api/orders/[id]/comp/route.ts:401-421`
- `src/app/api/orders/[id]/void/route.ts:294-314`
- `src/app/api/orders/[id]/walkout/route.ts:68-71`
- `src/app/api/payments/terminals/route.ts` + `terminals/discover/route.ts`

**Impact:** A terminated manager's PIN still authorizes voids, comps, refunds, walkouts until the hash is manually rotated. Compliance risk.
**Fix:** one-line per route — replace local helper with `import { validateManagerPin } from '@/lib/auth/manager-pin'`.

**P0-SEC-2 — 9-10 user-data tables with RLS enabled but ZERO policies** (security S-P0-2 + migration-author P1-1 + supabase P1-5)
`drive_thru_cars`, `drive_thru_lanes`, `inventory_waste_log`, `order_throttle_config`, `print_queue`, `print_routing`, `printers`, `receipt_config`, `shift_marketplace` (security-reviewer adds 10th).
**Impact:** effective service-role-only lockout = features may not work for any non-service-role caller. Migration-author flagged the same set.
**Fix:** add `tenant_*` SELECT/INSERT/UPDATE/DELETE policies, or document service-role-only via `COMMENT ON TABLE`.

**P0-SEC-3 — `/api/auth/pin-login` brute-force protection is in-memory `Map`** (security S-P0-3)
V5.99.7 left a TODO saying "replace with Redis" — never replaced. `pm2 reload` flushes the map; multi-worker bypass; no IP rate limit at all on PIN attempts.
**Impact:** 4-digit PIN keyspace (10,000) is brute-forceable. Privileged actor PIN compromise.
**Fix:** swap to the Redis sliding-window pattern already used by `/api/auth/login` (`src/lib/api/rate-limit.ts`).

**P0-SEC-4 — `auth_hook_read_users` policy unrestricted** (security S-P0-4)
`supabase_auth_admin` can SELECT every user row globally with `qual=true`.
**Impact:** broad access for the auth admin role beyond what the JWT hook needs.
**Fix:** narrow `qual` to the specific user being processed.

### V7.3 load suite is fundamentally broken (3)

**P0-LOAD-1 — `idempotencyKey()` doesn't match UUIDv4 — every mutating request 400s** (e2e-tester P1-2)
`load-tests/full-shift.js:202-207` builds `prefix-hex-hex-…` which the `withIdempotency` middleware rejects (it enforces `^[0-9a-f]{8}-…-4[0-9a-f]{3}-[89ab]…$`).
**Impact:** load test cannot create a single order. The 200 orders/hr claim from the script is fictional.
**Fix:** import `uuidv4` from `k6/crypto` and use it.

**P0-LOAD-2 — `chaos.js` payment success check is `!== 200`, API returns 201** (e2e-tester P1-1)
`load-tests/chaos.js:407` — every successful payment classified as flow failure.
**Impact:** trips `order_flow_success > 0.99` threshold on a HEALTHY server. Test is unmeetable.
**Fix:** `!== 201`.

**P0-LOAD-3 — `full-shift.js` pays pre-tax `orderTotal`, not `order.total` from server** (e2e-tester P0-1)
`load-tests/full-shift.js:269-325` sums raw item prices for `amount_cents`. Server-computed tax-inclusive total is ignored.
**Impact:** either every payment 422s on `amount_cents < balance_due`, or every order closes with unpaid balance — neither produces a load signal.
**Fix:** GET `/api/orders/{id}` after items added; use `order.total`.

### Data + types (3)

**P0-DATA-1 — Phantom V7.2.1 migration** (migration-author P0 + devops-deploy P2-5)
4 indexes (`idx_kds_ticket_events_*`, `idx_house_account_transactions_*`, `idx_order_modifications_*`, `idx_campaign_recipients_*`) tracked in `supabase_migrations.schema_migrations` as version `20260504194320` name `v7_indexes_align`, but no file at `supabase/migrations/20260504194320_v7_indexes_align.sql`.
**Impact:** `npm run db:diff` will keep failing forever. Future devs can't reproduce live state from migrations.
**Fix:** write the missing file with `CREATE INDEX IF NOT EXISTS` for all 4 indexes (don't drop — they're useful for FK lookups).

**P0-DATA-2 — Hand-curated `src/types/database.ts` stale since V5.4.3** (supabase P0-2)
Missing: `menu_item_photos`, `terminal_session`, `online_order_queue`, `ai_usage`, `idempotency_records`, `online_ordering_processor_bindings`, all V7 tables. 5+ files use `as any` to compensate. `Functions: Record<string, never>`.
**Impact:** type safety bypassed in payments, ai, photos paths. Silent runtime errors possible.
**Fix:** `npx supabase gen types typescript --linked > src/types/database.ts`.

**P0-DATA-3 — Missing RPC `ai_sales_summary`** (supabase P0-1)
`src/lib/ai/query-builders.ts:38` calls `supabase.rpc('ai_sales_summary', ...)`. Function does not exist in `pg_proc`. Code falls back silently.
**Impact:** AI sales summary feature is dead code path; users get fallback, never the intended data. No error surface.
**Fix:** create the function as a migration or remove the dead call.

### Marketing (2)

**P0-MARK-1 — No Resend webhook handler exists** (marketing-engineer P0-1)
The only webhook handler is the legacy SendGrid path at `src/app/api/integrations/email/webhook/route.ts`, consumed by `src/lib/marketing/send-campaign.ts` (uses SendGrid + Twilio, not Resend). Two parallel pipelines coexist.
**Impact:** Resend bounces/complaints/delivery events silently dropped. Sender reputation degrades. Pick one pipeline (Resend per V5.1.x batch).
**Fix:** add `POST /api/integrations/resend/webhook` with HMAC verification + recipient status update.

**P0-MARK-2 — `campaigns.status` and `campaign_recipients.status` are unconstrained `text`** (marketing P0-2)
Code writes 8+ values across worker/routes/analytics; `'delivered'` is rolled up by analytics but never written by any code path; `'pending'` baseline default leaks.
**Impact:** analytics dashboard misleading; status drift bugs invisible to types.
**Fix:** convert to enum or add CHECK constraint with the canonical value set.

### DevOps (1)

**P0-DEVOPS-1 — Unresolved `smoke_failed_rollback_failed` from batch-6.3** (devops P0-1)
`build-pipeline/logs/deploys.jsonl:9` shows `rollback_exit_code: 255` (SSH connection died mid-rollback). VM recovered later (6.4 worked) but we never verified.
**Impact:** prod state diverges from intended commit until a later deploy realigns it.
**Fix:** SSH to VM, run `git -C /opt/sear/app log --oneline -1`. Confirm matches `77aa1e1`.

---

## P1 — fix this week (~25 across all domains, top 10)

1. **`KdsPageContent` re-runs full `fetchTickets()` on every order INSERT/UPDATE** (realtime P1-2). O(orders × terminals) fan-out.
2. **`useRealtimeKds` UPDATE/DELETE branches are dead code** (realtime P1-1). Watching INSERT-only journal.
3. **`#7C3AED` STILL unfixed** in `ServerComparisonChart.tsx:52`, `CategoryPanel.tsx:31`, `NavTree.tsx:53`, `PMIXScatter.tsx:37` (pos-coder P1, design-reviewer P1).
4. **880 hardcoded hex literals across `src/components/`** (design-reviewer P1) — KDS dark surface entirely inline; brand-breaking orange-hover-on-blue in `DaypartConfig.tsx`/`SeasonalManager.tsx`.
5. **Two competing EmptyState components** (design P1) — legacy `shared/EmptyState.tsx` still imported by drive-thru, franchise, settings/terminals.
6. **upsertOpen / upsertClick read-then-write race** (marketing P1-1) — lost-update under concurrent Gmail-proxy + native opens.
7. **`ecosystem.config.js` not in repo** (devops P1-1) — DEPLOY.sh F-08 fallback has no target on fresh VM clone.
8. **Hardware terminal taxonomy mismatch** (hardware P1-1) — `HardwareSubWizard.tsx` lists Valor terminals (VP800/VP550/VP300pro/RCKT) that don't exist in registry/matrix → lying buttons.
9. **`TerminalDiscoveryDialog` doesn't plumb manager_pin into POST body** (hardware P1-2) — discovery + register UI is broken.
10. **Receipt format gap** (hardware P1-4) — `ReceiptOrderData` lacks `card_brand`, `card_last_four`, `emv_aid`. Valor produces all three; receipt formatter discards them.
11. **`menu-photos` bucket allows public listing** (supabase P1-1) — cross-tenant menu enumeration possible. Missing `file_size_limit` + `allowed_mime_types`.
12. **`next_order_number` doesn't filter on `org_id` inside body** (supabase P1-3) — relies entirely on RLS. Hook break = POS down on unique constraint.
13. **3 functions with mutable `search_path`** (migration P2 / supabase P1-2) — `prevent_processor_binding_change`, `bump_order_version`, `next_order_number`.
14. **16 PostgREST policies with `WITH CHECK (true)`** (security P1) — cross-tenant DML on `order_discounts`, `user_permission_overrides`, `online_menu_items`, etc.
15. **Recipients POST validates campaign org but not customer org** (marketing P1-5) — orphan rows in analytics.
16. **Send-route enqueue failure mode** (marketing P1-3) — if Redis throws, recipients inserted as `queued` and campaign flips to `sending` regardless. No sweeper.
17. **`full-shift.js` `terminal` scenario lacks explicit `exec:` field** (V7.3 cycle-2 reviewer new finding).
18. **3 e2e specs with `expect([200, 404, 500])` assertions** (e2e P0-2/P0-3 — promoting to P1 since they're test-only).
19. **`cash-drawer/open` route doesn't write to `audit_log`** (hardware P1-3) — uses RBAC role gate, not `requireManagerPIN`.
20. **3 POS components over 500-line CLAUDE.md budget** — `MultiTenderPayment` 929, `SplitCheckView` 893, `OrderPanel` 796.

---

## P2 — fix this month (~30 across domains)

Sample (full lists in per-domain reports):
- 477 perf advisor lints in Supabase (221 RLS init-plan rewrites, 188 unindexed FKs, 60 unused indexes, 7 duplicate)
- KDS card spawn animation is CSS-only; ignores `prefers-reduced-motion`
- `chaosRequest` only handles GET/POST; PATCH/DELETE will silently throw
- `PhotosTab` sortable grid still raw `<img>` (cycle-2 only fixed the preview)
- `load-test.yml` secret check runs after k6 install (wastes 30s)
- Bare `} catch {}` in `reconnection-manager.ts:191` (same pattern as V5.3 P0)
- Two parallel email pipelines (legacy SendGrid + new Resend)
- 6 list-loading sites use spinner instead of skeleton
- Mock hardware mode has no "MOCK"/"TEST MODE" indicator on receipt

---

## What VERIFIED CLEAN

- ✅ V5.99 optimistic locking — `expectedVersion` correctly threaded through every primary-key route, gates UPDATEs on `.eq('version', ...)`, throws `StaleVersionError` → 409
- ✅ `payments/void` no longer accepts side-door DELETE (V5.99.3 confirmed on main)
- ✅ `idempotency_records` RLS denies INSERT/UPDATE/DELETE for non-service-role
- ✅ Custom Access Token Hook installed correctly: `STABLE SECURITY DEFINER`, `SET search_path=''`, EXECUTE granted only to `supabase_auth_admin`. Live-confirmed: `auth.users.raw_app_meta_data.org_id` populated.
- ✅ `@supabase/ssr` integration follows canonical pattern (server/client/middleware)
- ✅ Sidebar still light `#F2F2F7` (not regressed to dark)
- ✅ V6.4.1 framer-motion respects `useReducedMotion` on Modal/OrderPanel/PaymentComplete (KDS the exception — see P2)
- ✅ V6.5.1 haptics wired at all 5 sites; iOS Safari falls back silently
- ✅ EmptyState migration (32+ usages of canonical, 6 SVG illustrations present)
- ✅ V4 KDS Zustand bug not regressed (`KdsCapacityIndicator` no longer in selector)
- ✅ Audit_log RESTRICTIVE; org_processor_bindings deny non-service-role writes
- ✅ No hardcoded secrets in `src/` or `load-tests/` (after the cycle-2 DEMO_PASSWORD fix)
- ✅ Logger doesn't capture auth headers, password fields, or PII
- ✅ Filenames + timestamps + paired rollbacks all conform; no destructive DDL post-baseline
- ✅ Tap-to-Pay scanner correctly suppresses unsupported entries; matrix data-only

---

## Recommended next batch sequence

**Batch SEC-1 (security P0s, 1 cycle):**
- P0-SEC-1 manager-PIN imports (10-20min)
- P0-SEC-3 PIN brute-force → Redis (~1hr)
- P0-SEC-4 narrow auth_hook_read_users qual

**Batch DATA-1 (data + types P0s, 1 cycle):**
- P0-DATA-1 phantom migration file (20min)
- P0-DATA-2 regen database.ts + remove `as any` casts (1hr)
- P0-DATA-3 ai_sales_summary RPC or call removal

**Batch RLS-1 (P0-SEC-2 + 16 P1 USING(true)):**
- 9-10 RLS-no-policies tables → tenant policies or service-role-only docs
- 16 USING(true) tightening

**Batch LOAD-FIX (V7.3 retro, ~2hr):**
- P0-LOAD-1/2/3 — fix idempotency UUID, payment status check, server-side total
- Re-run k6 against staging; verify thresholds actually meet on healthy server

**Batch MARK-1 (marketing P0s):**
- Resend webhook handler + status enum constraints
- Single-pipeline cleanup (deprecate SendGrid path or vice-versa — Ian decision)

**Batch DEVOPS-1 (devops P0/P1):**
- Verify VM commit matches `77aa1e1`
- Commit `ecosystem.config.js`
- Type-fix `deploys.jsonl` http field

**V6.6 token-adoption sweep (design P1):**
- 880 hex literals → tokens
- Kill legacy EmptyState
- Fix orange-on-blue brand bug

---

## Confidence

**High** for findings — 11 specialists × 2-4 min each, file:line precision throughout. The V7.3 load-suite findings (P0-LOAD-1/2/3) are the most damning: e2e-tester caught 3 P0s in code I shipped today after my self-reviewed cycle-2 said PASS. **The load test does not work.**

**Medium** for completeness — pos-coder, design-reviewer, marketing-engineer covered the same surface from different angles and produced overlapping findings; this is reassuring. Hardware-integrator scope was inherently narrow (most domain deferred). One agent (general/Plan/Explore) wasn't dispatched but wasn't needed.

**Note for runner doctrine:** my inline cycle-2 review of V7.3 (commit `27aeaf0`/`0df8610`) was insufficient. The cycle-1 reviewer caught its findings; my fixes addressed them; but neither pass caught that the load suite was fundamentally broken at the API-contract level. **Going forward: spawn cycle-2 reviewer agent unconditionally on any non-1-line fix.**
