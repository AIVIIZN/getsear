# Supabase platform audit — 2026-05-05

Project: `lbekiyxqemxozmghgmtp` (Sear POS, staging-only). Branch `main` @ `77aa1e1`.
Read-only. No source modified, no migrations applied.

## What was inspected
- Custom Access Token Hook (`public.custom_access_token_hook`): pg_proc def, ACL, search_path, dashboard wiring.
- Edge functions (`supabase/functions/`, `list_edge_functions`).
- Auth flows: `src/lib/supabase/{server,client,admin,middleware}.ts`, `src/middleware.ts`, `src/app/api/auth/{login,me,mfa/setup,mfa/verify}`.
- Storage: `storage.buckets`, `storage.objects`, RLS policies on `storage.objects`, `getPublicUrl` / `createSignedUrl` call sites.
- RPC: every `supabase.rpc(...)` site (only two in the codebase) cross-checked against `pg_proc`.
- TypeScript types (`src/types/database.ts`).
- Extensions (`list_extensions`).
- Performance + security advisors (`get_advisors`).
- 67 migrations on file vs. 14 staged in repo (matches; baseline collapses the older 50).

---

## Findings

### P0-1 — `ai_sales_summary` RPC is referenced in code but does NOT exist in the database
- Site: `src/lib/ai/query-builders.ts:38` calls `supabase.rpc('ai_sales_summary', { p_org_id, p_location_id, p_start_date, p_end_date, p_group_by, p_order_type })`.
- DB check: `SELECT proname FROM pg_proc WHERE proname='ai_sales_summary'` → 0 rows. No migration in `supabase/migrations/` defines it. Search of repo also returns no `CREATE FUNCTION ai_sales_summary`.
- The code has a defensive fallback path (`fallbackSalesQuery`) when the RPC errors, so functionally the AI sales tool degrades to direct selects — but every call pays a round-trip + Postgres parse error before falling back, and the failure is silently swallowed (no warn log, no advisor signal).
- Action: either (a) hand off to migration-author to create `public.ai_sales_summary(...)` matching the signature in `query-builders.ts`, or (b) drop the RPC branch and call `fallbackSalesQuery` directly. Recommend (a) — the RPC was the intended optimization (pre-aggregated rollups). Track in V7.3 / V10 AI batch.

### P0-2 — TypeScript types (`src/types/database.ts`) are massively stale
- Last commit touching the file: `aa447b0` (V5.4.3, 2026-05-04 audit_log expansion). Most recent migration: `20260504200000_menu_photos_bucket.sql`.
- Spot-checked tables NOT present in `src/types/database.ts`: `menu_item_photos`, `terminal_session`, `online_order_queue`, `ai_usage`, `idempotency_records`, `campaign_recipients` (column changes), `online_ordering_processor_bindings`, plus all V7-batch tables.
- File is hand-curated (not generated — has comments, hand-written interface names, `Functions: Record<string, never>`). The CLAUDE-md-mandated `supabase gen types typescript --linked` has effectively never run against this project.
- Symptoms in code: every menu-photo and ai_usage call has `as any` casts (e.g. `(supabase.from('menu_item_photos') as any)` in `src/app/api/menu/photos/route.ts:115`, `(supabase.from('ai_usage') as any)` in `src/lib/ai/cost-tracker.ts:27`). That's 5+ files of `any`-casts compensating for missing types — runtime errors will not be caught at compile time.
- Action: regenerate via `npx supabase gen types typescript --linked > src/types/database.ts` OR migrate to a generated `src/types/supabase.ts` (canonical Supabase pattern) and re-export the hand-curated domain types from a separate file. This is its own task; tag it as "V7.3 P0 cleanup" and commit alongside the next migration. NOT applied here per audit-only scope.

### P1-1 — `menu-photos` storage bucket is public AND lists objects (advisor `public_bucket_allows_listing`)
- `storage.buckets` row: `{public: true, file_size_limit: null, allowed_mime_types: null}` (30 objects).
- Policy `menu_photos_public_read` is `FOR SELECT TO {public} USING (bucket_id='menu-photos')` — that grants `LIST` privilege as well as direct object reads.
- Risk: any visitor can enumerate every menu photo across every tenant by hitting the bucket-list endpoint. Photos themselves are not private (they're cooked food images intended for the public menu site V8 will ship), but cross-tenant photo enumeration leaks competitor menus pre-launch.
- Also missing: `file_size_limit` (currently unbounded — 50 GB upload could DoS storage) and `allowed_mime_types` (an attacker-tenant could upload an SVG with an XSS payload that renders inline).
- Action (migration-author task): set `file_size_limit = 5_242_880` (5 MB), `allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']`, and replace the broad SELECT policy with a path-prefix-scoped one, e.g. `USING (bucket_id='menu-photos' AND (storage.foldername(name))[1] = (auth.jwt()->>'org_id'))` so each tenant can only list their own folder. Public CDN URL access (which doesn't go through this policy) still works for served images.

### P1-2 — `prevent_processor_binding_change`, `bump_order_version`, `next_order_number` have mutable `search_path`
- Advisor `function_search_path_mutable` × 3. The custom_access_token_hook properly sets `SET search_path = ''` (verified — `proconfig = {"search_path=\"\""}`). The other three do not.
- `next_order_number` is invoked by every order INSERT (`api/orders/route.ts:98`) — a search_path-poisoning attack would require an authenticated `authenticated`-role caller to plant a malicious schema, which RLS blocks today, but the hardening is cheap and follows defense-in-depth.
- Action (migration-author): add `SET search_path = ''` (or `pg_catalog, public`) to each function definition. One-line per function.

### P1-3 — `next_order_number` is `SECURITY INVOKER` but reads `orders` directly + the `orders` baseline RLS policy depends on the access-token hook
- `pg_proc.prosecdef = false` for `next_order_number` (correct default). But the code computes `MAX(order_number)` over `orders WHERE location_id=...` without any explicit `org_id` filter inside the function body. RLS now blocks cross-tenant reads (post-5.99.1 hook is live — see Verified below), so an authenticated user sees only their own org's order numbers. Two failure modes if the hook ever stops working:
  1. If the hook breaks, `request.jwt.claims->>'org_id'` is NULL again and the RLS predicate evaluates false — `MAX` returns NULL, `next_order_number` returns 1, and the very next INSERT trips the unique constraint on `(location_id, opened_at::date, order_number)`. POS goes down.
  2. If RLS is ever DISABLED for any reason (debugging, branch reset), the function happily computes `MAX` across all tenants and returns absurdly high order numbers.
- Action: pass `p_org_id` explicitly, filter inside the function, and assert `org_id = (auth.jwt()->>'org_id')::uuid`. Migration-author task. Caller already knows org_id (`api/orders/route.ts` builds the user from the bound session).

### P1-4 — Auth: leaked-password protection disabled
- Advisor `auth_leaked_password_protection`: HaveIBeenPwned check is off in dashboard.
- Action: Ian flips the toggle at Authentication → Policies → "Leaked password protection". Cannot be enabled via MCP. Add to STATE.yaml decisions for V8.1 (onboarding).

### P1-5 — 10 tables with `RLS enabled but no policies` (advisor `rls_enabled_no_policy`)
- Tables: `drive_thru_cars`, `drive_thru_lanes`, `inventory_waste_log`, `order_throttle_config`, `print_queue`, `print_routing`, `printers`, `receipt_config`, `shift_marketplace`. RLS-on with no policies = default-deny — these tables are effectively unreadable by `authenticated`. Some are read by service-role routes which is fine, but if any client component ever fetches them with the anon-keyed browser client it silently returns 0 rows.
- Spot-check: `printers` and `print_queue` are touched by client KDS components. Check whether they go through a server route or directly through `createBrowserClient`. (Out of scope here — flag for migration-author + pos-coder cross-cutting.)

### P1-6 — Defense-in-depth: 16 `rls_policy_always_true` warnings
- Advisor lists 16 policies with `USING(true)` or `WITH CHECK(true)` on tables like `ai_usage`, `break_entries`, `cash_drawer_events`, `customer_addresses`, `gift_card_transactions`, `menu_item_modifier_groups`, `online_menu_items`, `order_discounts`, `order_item_modifiers`, `purchase_order_items`, `user_permission_overrides`, `demo_requests`. INSERTs/UPDATEs/DELETEs are unrestricted — application code is the only boundary.
- Most are tenant-scoped child tables where the parent (`orders`, `order_items`, `customers`) carries the tenant predicate, but RLS does not chase FK joins automatically. A tenant-A user with a tenant-B `order_id` can write `order_item_modifiers` for tenant B today.
- Action: replace each `WITH CHECK (true)` with `WITH CHECK ((SELECT org_id FROM public.<parent> WHERE id = NEW.<parent>_id) = (auth.jwt()->>'org_id')::uuid)` or use a stored helper. Migration-author task; track separately.

### P2-1 — Performance advisors: 477 lints (228 WARN, 249 INFO)
- `auth_rls_initplan` × 221: every tenant_* RLS policy uses `current_setting('request.jwt.claims', true)::json->>'org_id'` per-row instead of `(SELECT auth.jwt() ->> 'org_id')` once. Re-write with `(SELECT ...)` wrapped in a subquery so the planner caches it. At scale (1000+-row queries) this is 5–20× win on every read. Project-wide migration; defer to V7.3 perf batch.
- `unindexed_foreign_keys` × 188: cascade-delete + JOIN paths slow. Highest-traffic offenders to fix first: `audit_log_location_id_fkey`, `ai_predictions_location_id_fkey`, anything on `orders`, `order_items`, `payments`. Migration-author task.
- `unused_index` × 60: dead weight from V5/V6 churn (e.g. `idx_audit_manager_pin_user`, `idx_menu_categories_location`). Drop in batch after confirming `pg_stat_user_indexes.idx_scan = 0` over 7+ days. Migration-author.
- `duplicate_index` × 7: e.g. `idx_audit_log_org_created` ≡ `idx_audit_org_date` on `audit_log`. Trivial drop. Migration-author.
- `auth_db_connections_absolute` × 1: connection count near pooler limit at peak. With 836 sessions total and 713 in last 24h, pool sizing should be re-checked when V8 onboarding ships (multi-tenant pressure).

### P2-2 — Edge functions: zero deployed, zero in repo
- `list_edge_functions` returns `[]`. `supabase/functions/` directory does not exist. All webhook + scheduled-job logic lives inside Next.js (BullMQ workers + Vercel-style API routes).
- Not a defect today, but: V9 (delivery integrations DoorDash/Uber Eats) and V8.1 (Resend webhooks for marketing email events) will both want isolation from the main app's connection pool. Pre-stage the directory + a `_shared/` deps file before V8 starts. Decision logged.

### P3-1 — `pgvector` not installed (V10 AI work)
- `vector` extension `installed_version = null`. V10 spec calls for embedding-based menu search and customer-LLM context. Enabling requires Ian to flip the toggle at Database → Extensions → vector. Pre-stage decision; not blocking V7/V8.

### P3-2 — `pg_cron` not installed
- Useful for the campaign-send queue (currently runs in BullMQ). If we want the cron schedule visible in Postgres for ops, enable it. Not blocking.

---

## Verified working

- **Custom Access Token Hook** is correctly defined: `STABLE SECURITY DEFINER`, `SET search_path = ''`, EXECUTE granted to `supabase_auth_admin` only (anon + authenticated explicitly REVOKEd), reads `(org_id, role, is_active)` from `public.users` and merges into top-level claims AND `app_metadata`. Confirmed live: `auth.users.raw_app_meta_data` for the active user shows `org_id = a1b2c3d4-...` (the function ran at last token issuance). One stale row has `org_id=NULL` — likely the legacy seed user without a public.users row, which is the documented graceful-degrade path.
- **`@supabase/ssr` integration** is correct: `createServerClient` in `server.ts` and `middleware.ts` use the modern `getAll`/`setAll` cookie API; `createBrowserClient` is in `client.ts`. `src/middleware.ts` correctly calls `updateSession` immediately before the auth check (the comment in `lib/supabase/middleware.ts:32-34` is honored).
- **Service-role client** (`admin.ts`) sets `autoRefreshToken: false` and `persistSession: false` — correct for a server-side, request-scoped admin client.
- **MFA flow**: `mfa/setup` enrolls TOTP via `supabase.auth.mfa.enroll`, generates 10 Crockford-base32 recovery codes, stores hashes in user metadata. `mfa/verify` calls `supabase.auth.mfa.verify`. Both rate-limited via the auth tier. No leaks identified. Recovery-code storage uses `updateUser({data:...})` which writes to `raw_user_meta_data` (user-writable) — see note below.
- **`menu-photos` write path**: `service_role` enforced via dedicated RLS policies for INSERT/UPDATE/DELETE; INSERT policy has `WITH CHECK (bucket_id='menu-photos')` correctly. Public CDN read is the documented design. Public-listing is the gap (P1-1).
- **`next_order_number` advisory lock**: `pg_advisory_xact_lock(hashtext(p_location_id::text))` correctly serializes per-location numbering inside the txn.

## Note on MFA recovery codes (P3 informational)
`updateUser({data: {mfa_recovery_codes:...}})` writes to `raw_user_meta_data` (user-controllable via direct API). A logged-in user could PATCH their own metadata to invalidate or rotate their recovery codes via the JS SDK. Not a confidentiality break (codes are stored in plaintext form, not hashed despite the `// Store hashed recovery codes` comment), but if recovery-code integrity matters, move them to a server-side `auth_recovery_codes` table written by `service_role` only. Defer to V8.1 auth-hardening.

---

## Recommended priority order for migration-author hand-offs
1. (P0) Create `public.ai_sales_summary` RPC OR remove the RPC branch. (One small migration.)
2. (P0) Regenerate `src/types/database.ts` via `supabase gen types`. (Not migration-author — that's me + a clean commit. Flag for next worktree.)
3. (P1) `menu-photos` bucket: `file_size_limit`, `allowed_mime_types`, scoped LIST policy.
4. (P1) `SET search_path = ''` on three flagged functions.
5. (P1) Tighten `next_order_number` to take + filter on `p_org_id`.
6. (P1) Replace `WITH CHECK (true)` policies on 13 tables with parent-org joins.
7. (P2) RLS init-plan rewrites (`(SELECT auth.jwt() ...)`) — large but mechanical.
8. (P2) FK index batch + duplicate-index drops + unused-index drops.

## Decisions to log to STATE.yaml (Ian-only actions)
- Enable HaveIBeenPwned leaked-password protection in dashboard (P1).
- Enable `vector` extension before V10 AI work begins (P3).
- Configure SSO providers (Google/Apple) in dashboard before V8.1 ships — env vars cannot do this.
