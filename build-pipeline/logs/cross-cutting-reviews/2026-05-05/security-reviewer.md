# Security Cross-Cutting Audit — 2026-05-05

Branch `main` @ `77aa1e1`. Live DB project `lbekiyxqemxozmghgmtp`. 338 API routes scanned, 96 RLS-enabled tables verified against `pg_policies`, JWT hook + audit_log + key middleware reviewed.

## Summary
- P0: 4
- P1: 6
- P2: 5
- P3: 3

---

## P0 (must fix before next deploy)

### S-P0-1 — Manager-PIN gates accept terminated managers' PINs in 4 routes
**Files:**
- `src/app/api/orders/[id]/comp/route.ts:401-421` (local `validateManagerPin` helper)
- `src/app/api/orders/[id]/void/route.ts:294-314` (local helper)
- `src/app/api/orders/[id]/walkout/route.ts:68-71`
- `src/app/api/payments/refund/route.ts:208-211`
- `src/app/api/payments/terminals/route.ts:85-94` and `.../terminals/discover/route.ts:49-65` (also affected)

**Severity:** P0
**Finding:** These routes each define a local PIN-walker that filters `org_id` + `role IN (owner, admin, manager)` but does NOT filter `is_active = true`. Compare to the canonical `src/lib/auth/manager-pin.ts:80-86` which correctly filters `is_active=true`. Any deactivated manager whose `pin_hash` was not rotated can still authorize voids/comps/walkouts/refunds. The V5.99.7 retro explicitly listed `is_active=true` as a required filter "so terminated managers cannot authorise actions until pin_hash is rotated" — that fix landed in `lib/auth/manager-pin.ts` but the existing in-route helpers in 4 routes were never migrated to it. Discount route is fine — it imports from the canonical module.
**Exploit:** Restaurant fires a manager. Their session is invalidated, but their PIN hash is still on the user row (rotation is manual). A hostile cashier still in possession of the ex-manager's PIN can void/comp/refund freely until ops rotates the hash — undetectable as the deactivated user signs the audit row.
**Recommended fix:** Delete the four local helpers and call `validateManagerPin` from `@/lib/auth/manager-pin` (already used by `discount`). One-line import + replace per route. Add a Playwright spec that creates a manager, deactivates them, then asserts their PIN is rejected by void/comp/walkout/refund.

### S-P0-2 — 9 tables have RLS enabled but ZERO policies
**Files:** Supabase advisor + `pg_policies` confirm:
`drive_thru_cars`, `drive_thru_lanes`, `inventory_waste_log`, `order_throttle_config`, `print_queue`, `print_routing`, `printers`, `receipt_config`, `shift_marketplace`.
**Severity:** P0
**Finding:** With RLS enabled and no policies, the tables are inaccessible to authenticated callers (good — fail closed) **but reachable via service_role**. The only ways a feature touches them are (a) admin client (RLS bypass) or (b) direct SQL — neither is auditable per-tenant. If a route ever does a non-admin client read of `printers` or `print_queue`, the read silently returns 0 rows (denial-of-feature). More importantly, drive-thru / waste / shift-marketplace are user-data tables that **must** have tenant policies — operating today purely on application-layer `eq('org_id', user.org_id)` with no RLS second line.
**Exploit:** Any route that uses an authenticated (non-admin) Supabase client and forgets `eq('org_id', ...)` exposes cross-tenant data. RLS is meant to be the safety net; here the net has holes.
**Recommended fix:** Apply the standard 4-policy block (select/insert/update/delete with `org_id = auth.jwt()->>'org_id'`) for each. For `printers`/`print_queue`/`print_routing`/`receipt_config`, scope by `location_id`'s `org_id` (join on `locations`).

### S-P0-3 — `auth/pin-login` has NO request rate limit (only an in-memory per-user map)
**File:** `src/app/api/auth/pin-login/route.ts:14-184`
**Severity:** P0
**Finding:** The only brute-force protection is `pinAttempts: Map<userId, count>` declared at module scope (line 14). Comment on line 16: "In production, replace with Redis for persistence across instances." It was never replaced. Three problems compound:
1. **Per-instance state** — `pm2 reload` and pm2 cluster mode (multiple workers) reset the map, so an attacker simply waits for a deploy or rotates across workers.
2. **No IP rate limit at all** — unlike `/api/auth/login` which has both per-IP and per-email Redis tiers via `checkRateLimit('auth', ...)`, pin-login does not import `checkRateLimit`.
3. **PIN keyspace is 4 digits = 10,000** — even with the 5-attempt lockout, an attacker who can spawn N workers (or wait through restarts) can exhaust the keyspace in <2,000 round-trips per worker.
**Exploit:** `for pin in 0000..9999: POST /api/auth/pin-login {user_id: <leaked>, pin}` — pin attempts only count if you stay on the same backend worker AND don't trigger a deploy. From distributed bots this defeats the lockout entirely.
**Recommended fix:** Replace the in-memory map with the same Redis-backed `checkRateLimit('auth', \`pin-login:user:${user_id}\`)` + `checkRateLimit('auth', \`pin-login:ip:${ip}\`)` pattern used by `/api/auth/login`. Audit on every failure and lockout via `audit.recordSystem`.

### S-P0-4 — `users.auth_hook_read_users` policy reads ALL rows for `supabase_auth_admin`, but `service_role_bypass` already covers it (defense in depth gap)
**File:** policy `auth_hook_read_users` on `public.users` — `qual: true`, role: `{supabase_auth_admin}`
**Severity:** P0 (privilege-boundary)
**Finding:** The custom_access_token_hook needs to read `users.org_id` for the JWT-issuing user, but the policy lets `supabase_auth_admin` SELECT every row in `public.users` unconditionally. If the auth role is ever assumed in a context other than the hook (an Edge Function, a misconfigured advisor, a future Auth feature), it can enumerate every user row in every tenant. The `STABLE SECURITY DEFINER SET search_path = ''` hook itself is correct, but the broad SELECT policy is not the minimal grant.
**Exploit:** Any compromise of the `supabase_auth_admin` role (or a malicious Edge Function granted this role) reads every PII column on every user — emails, phones, hire_date, hourly_rate, pin_hash. Note: pin_hash is bcrypt so not directly usable, but the email+role enumeration is a credential-stuffing seed list.
**Recommended fix:** Tighten to `qual: id = (event->>'user_id')::uuid` — but this requires the hook to pass user_id via session GUC, OR move to `SECURITY DEFINER` in the function with no policy (revoke `supabase_auth_admin` SELECT entirely). The function is already `SECURITY DEFINER`, so the policy may be vestigial; verify by running the hook after `DROP POLICY auth_hook_read_users` in a staging branch.

---

## P1 (fix this week)

### S-P1-1 — 16 RLS policies are `WITH CHECK (true)` or `USING (true)` for INSERT/UPDATE/DELETE
**Source:** Supabase advisor `rls_policy_always_true`.
Tables affected (all have `allow_insert`/`allow_update`/`allow_delete` USING/WITH CHECK = true on at least one DML cmd): `ai_usage`, `break_entries`, `cash_drawer_events`, `customer_addresses`, `gift_card_transactions`, `menu_item_modifier_groups`, `online_menu_items`, `order_discounts`, `order_item_modifiers`, `purchase_order_items`, `user_permission_overrides`, `demo_requests` (this one is intentional — public form).
**Finding:** Authenticated tenant A can insert/update/delete rows belonging to tenant B because the policy doesn't check `org_id`. `order_discounts` is the worst — a hostile cashier in any tenant can apply discounts to any other tenant's orders. `user_permission_overrides` is also severe — privilege escalation via permission grant on another tenant's user.
**Fix:** Replace each `allow_*` policy with the standard `org_id = auth.jwt()->>'org_id'` pattern. Demo requests can stay public-insert.

### S-P1-2 — Comp route still has BOTH a permissive in-route `validateManagerPin` AND imports nothing — opportunity for staleness
**File:** `src/app/api/orders/[id]/comp/route.ts` — has its own `validateManagerPin` (line 401) instead of the canonical one. Even after S-P0-1 fix, future authors are likely to copy this stale pattern.
**Fix:** As part of S-P0-1, delete the local helper everywhere; add an ESLint custom rule that flags `function validateManagerPin` outside `src/lib/auth/`.

### S-P1-3 — `/api/menu/items` GET interpolates `search` user input directly into PostgREST `.or()` filter
**File:** `src/app/api/menu/items/route.ts:60-64`
```
query.or(`name.ilike.%${filters.search}%,short_name.ilike.%${filters.search}%,plu_code.ilike.%${filters.search}%`)
```
**Finding:** PostgREST `.or()` with raw user input is a known filter-injection vector. A search like `%25,id.eq.<other-tenant-uuid>` won't *break* org_id (the chained `.eq('org_id',...)` is ANDed at the SQL level), but it can extend the OR group across other columns or comma-separated to add `or=(...)` patterns. Mitigated by `org_id` filter still applying, but defense-in-depth says sanitize.
**Fix:** Strip `,` `(` `)` `*` from `filters.search` before interpolation; or use `.ilike()` chained with `.or` on a server-side-built string from a whitelist.

### S-P1-4 — Public bucket `menu-photos` has broad SELECT policy allowing `LIST` of all files
**Source:** Supabase advisor `public_bucket_allows_listing`. Policy `menu_photos_public_read`.
**Finding:** Anyone can enumerate every menu photo across every tenant by listing the bucket. Image URLs include org_id in the path so file enumeration leaks competitive menu data.
**Fix:** Drop the SELECT policy on `storage.objects` for the bucket — public buckets serve direct object URLs without needing list permission.

### S-P1-5 — `function_search_path_mutable` on 3 SECURITY DEFINER-adjacent functions
**Functions:** `prevent_processor_binding_change`, `bump_order_version`, `next_order_number`.
**Finding:** Without `SET search_path = ''` an attacker who can create a same-named operator/function in a search-path-earlier schema can hijack what these triggers call. Lower risk than P0 — these are triggers, not user-callable — but trivial to fix.
**Fix:** `ALTER FUNCTION public.bump_order_version() SET search_path = ''` (and recompile body to use fully-qualified names). The custom_access_token_hook already does this correctly.

### S-P1-6 — Login route logs `user_id` + `org_id` on inactive-account branch but discloses NOTHING different to the response → info-leak via log volume
**File:** `src/app/api/auth/login/route.ts:172-185`
**Finding:** The response is generic, but the `rlog.warn('auth.login.failed', { user_id, org_id, reason: 'inactive_account' })` line creates a log row only on the inactive-account branch. Anyone with log read access (Sentry/Better Stack) can correlate request count with structural signal — especially during attacker probing. Minor.
**Fix:** Either drop user_id+org_id on the inactive branch, or also log them on the wrong-password branch (when profile lookup happens to succeed) so log shape is uniform.

---

## P2 (fix this month)

### S-P2-1 — Auth Leaked-Password Protection disabled
Supabase advisor `auth_leaked_password_protection`. Enable HIBP integration in Supabase Dashboard → Auth → Password Settings.

### S-P2-2 — `audit_log` is correctly RESTRICTIVE for UPDATE/DELETE (verified). Confirmed good.
No action — recording the verification.

### S-P2-3 — Public online-ordering endpoints have NO rate limit
`/api/online-ordering/public/menu` (GET) and `/api/online-ordering/public/order` (POST) accept unauthenticated requests with no `checkRateLimit` call. A single attacker can DoS by ordering or scraping menu listings.
**Fix:** Add `checkRateLimit('public', \`online-order:ip:${getClientIp(req)}\`)` to both.

### S-P2-4 — `/api/observability/rum` accepts unauthenticated POST with no rate limit
`src/app/api/observability/rum/route.ts` writes one log line per request with attacker-controlled `route`, `href`, `name`, `value`. Log-flooding amplification + log-injection risk if downstream parsers don't escape. Add rate limit + clamp value.

### S-P2-5 — `/api/menu/items/[id]/photo/generate` rate limit is per-user only (`bulk` tier 10/min) — no per-org or per-IP
A single tenant's owner+admin+managers can collectively bill the OpenAI key at 30+/min × $0.04 = $72/hour. Add a per-org budget (`checkRateLimit('bulk', \`menu-photo-gen:org:${user.org_id}\`)`) at e.g. 30/min/org.

---

## P3 (good-to-have)

### S-P3-1 — `idempotency_records` and `org_processor_bindings` correctly deny INSERT/UPDATE/DELETE except service_role. Verified.
### S-P3-2 — JWT custom_access_token_hook correctly stamps org_id, user_role, is_active into both top-level claims and app_metadata. Verified.
### S-P3-3 — Logger explicitly documents "Never log request bodies (PII)" and only takes typed `LogFields` with no Authorization/Cookie passthrough. `req-context.ts` does not capture headers. Good.

---

## What I checked
- Spot-checked routes: payments/void, payments/refund, payments/terminals, payments/terminals/discover, orders/[id]/comp, orders/[id]/discount, orders/[id]/void, orders/[id]/walkout, staff/checkout, staff/route, menu/items, menu/items/[id]/photo/generate, online-ordering/public/menu, online-ordering/public/order, auth/login, auth/pin-login, auth/forgot-password, observability/rum, audit-log routes.
- Reviewed migrations: `20260504110200_audit_log_restrictive_policies.sql` (RESTRICTIVE confirmed), `20260504111845_custom_access_token_hook.sql` (hook function confirmed correct), `20260504063726_audit_log_expansion.sql`, `20260504200000_menu_photos_bucket.sql`, `20260504061225_add_idempotency_records.sql`, `20260504110100_lock_down_admin_table_rls.sql`.
- Live SQL: enumerated all 96 public tables for `rowsecurity` + policy count, inspected policies on `audit_log`, `users`, `orders`, `payments`, `customers`, `idempotency_records`, `org_processor_bindings`, `locations`, `organizations`. Read function definitions of `custom_access_token_hook`, `bump_order_version`, `prevent_processor_binding_change`.
- Supabase advisors: `security` lint pass — 9 RLS-no-policy, 16 always-true permissive policies, 1 public-bucket-allows-listing, 1 leaked-password-protection-disabled, 3 mutable-search-path.
- Secret hygiene: grepped `src/` and `load-tests/` for `OPENAI_API_KEY`, `sk-`, `AIza`, `service_role_key` literals — only `process.env.*` references found, no hardcoded keys. `.gitignore` correctly excludes `.env*`.
- pin_hash exposure: enumerated every read of `pin_hash` (8 routes + 2 offline modules). All are server-side; pin_hash is never returned in response bodies.

## Confidence

Medium-high on RLS, manager-PIN gates, and JWT hook — these I verified live against the production DB. Medium on PostgREST filter injection (S-P1-3) — needs a runtime test against PostgREST 12 to prove the cross-column pivot is blocked by the chained `eq('org_id')`. Did not exhaustively walk all 338 routes; sampled the high-risk privileged 30 + every public/unauthenticated route. Did not run dynamic tests (SQLi probes, IDOR fuzz). Did not audit Supabase Edge Functions (none deployed in `list_edge_functions` per the runbook). Sentry breadcrumb scrubbing config not reviewed — assumed-correct per V7.1.x review; flag as a future task. The four P0s are actionable, scoped, and have unambiguous fixes.
