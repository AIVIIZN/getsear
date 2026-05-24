# Migration Audit — 2026-05-05

Auditor: migration-author. Project: `lbekiyxqemxozmghgmtp`. Scope: `supabase/migrations/`, live schema, RLS, JWT hook. Read-only.

## Summary

Schema discipline is in good shape. RLS is enabled on **all 99** public tables. The "4 drift indexes" flagged in the handoff are actually all present in the remote `supabase_migrations.schema_migrations` history under a migration named `v7_indexes_align` (version `20260504194320`) that exists ONLY as a remote row — there is no matching file in `supabase/migrations/`. The custom_access_token_hook is correctly defined and granted. Two narrow gaps need follow-up: the missing migration file (CI db-diff will flag forever until reconciled), and 8 tables that have RLS enabled but no policies (effective lockout for non-service-role; intentional but undocumented).

---

## P0 — fix immediately

### P0-1. Phantom migration `v7_indexes_align` exists in remote but not in repo
The four "drift" indexes the handoff calls out are all already attached to a tracked migration row:
- `idx_kds_ticket_events_item_event_created` on `(order_item_id, event_type, created_at)`
- `idx_house_account_transactions_account_created` on `(house_account_id, created_at DESC)`
- `idx_order_modifications_order_created` on `(order_id, created_at DESC)`
- `idx_campaign_recipients_campaign_status` on `(campaign_id, status)` ← **also exists** in `20260504005008_add_campaign_recipients_indexes.sql` line 42 (duplicate definition, same name → harmless idempotent re-create)

The remote `schema_migrations` row has version `20260504194320`, name `v7_indexes_align`, and 5 statements (the 4 drift indexes plus a duplicate of `idx_kds_ticket_events_org_station_created` that is already in the v7 file).

**Fix (recommended): write the missing file at the same timestamp so `db:diff` is clean and history is reproducible.** Do NOT drop the indexes — three of them are useful (FK lookup paths). Create:

```sql
-- supabase/migrations/20260504194320_v7_indexes_align.sql
-- Reconciles repo with remote v7_indexes_align migration row applied 2026-05-04.
-- Idempotent: every CREATE INDEX uses IF NOT EXISTS.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_kds_ticket_events_item_event_created
  ON public.kds_ticket_events (order_item_id, event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_house_account_transactions_account_created
  ON public.house_account_transactions (house_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_modifications_order_created
  ON public.order_modifications (order_id, created_at DESC);

-- idx_campaign_recipients_campaign_status already created in 20260504005008,
-- restated here for parity with the remote schema_migrations row.
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_status
  ON public.campaign_recipients (campaign_id, status);

COMMIT;
```

Plus the paired rollback at `supabase/_rollbacks/20260504194320_v7_indexes_align.rollback.sql` that drops only the 3 unique-to-this-migration indexes (do NOT drop `idx_campaign_recipients_campaign_status` — owned by the earlier migration).

This is **additive-only** and matches what the live DB already has, so `supabase db reset` and `npm run build` will both pass post-merge.

---

## P1 — address this batch

### P1-1. Eight RLS-enabled tables have ZERO policies (effective lockout)
Advisor `rls_enabled_no_policy` flags:
`drive_thru_cars`, `drive_thru_lanes`, `inventory_waste_log`, `order_throttle_config`, `print_queue`, `print_routing`, `printers`, `receipt_config`, `shift_marketplace`.

Behaviour: every non-service-role query returns 0 rows or 403. App currently routes printer/queue/throttle through the admin client, so this is fine in practice — but it is **silent** (no comment in baseline) and will trip the next dev who tries to use the anon/authenticated client. Either (a) add a `tenant_*` policy quartet matching the rest of the schema, or (b) document in baseline with `COMMENT ON TABLE … IS 'service_role only — RLS blocks all other roles intentionally'`.

### P1-2. `custom_access_token_hook` looks correct but verify dashboard toggle
Function definition is good: STABLE, SECURITY DEFINER, `SET search_path = ''`, reads `org_id`/`user_role`/`is_active` from `public.users`, merges them top-level AND under `app_metadata`. Grants verified: EXECUTE granted to `supabase_auth_admin`, `service_role`, `postgres`; REVOKE from PUBLIC/anon/authenticated is implicit via the migration. Function is **not** in the advisor's `function_search_path_mutable` list (search_path is correctly set), unlike `prevent_processor_binding_change`, `bump_order_version`, `next_order_number` — see P2-1.

Migration code is correct; the runbook caveat that the dashboard toggle (`Auth → Hooks → Customize Access Token (JWT) Claims`) must be flipped manually still applies. There is no MCP advisor lint that confirms whether the hook is wired in the dashboard — Ian must verify in the UI. Until flipped, the 209 baseline `tenant_*` policies all evaluate to `org_id = NULL → false`, and the app's `.eq('org_id', …)` filters via the admin client are the sole tenant boundary.

---

## P2 — quality / hygiene

### P2-1. Three security-definer-adjacent functions have mutable search_path
Advisor flags: `prevent_processor_binding_change`, `bump_order_version`, `next_order_number`. None are SECURITY DEFINER (verified — only `custom_access_token_hook` is), so the risk surface is limited, but Supabase advisor still wants `SET search_path = ''` on every function. Add to a follow-up migration:
```sql
ALTER FUNCTION public.prevent_processor_binding_change() SET search_path = '';
ALTER FUNCTION public.bump_order_version() SET search_path = '';
ALTER FUNCTION public.next_order_number(uuid) SET search_path = '';  -- verify args
```

### P2-2. `menu-photos` bucket has broad public listing
Advisor `public_bucket_allows_listing` on `menu-photos`. The bucket is intentionally public-read for object URLs, but the SELECT policy is `bucket_id = 'menu-photos'` with no path scope, which means any client can `LIST` the entire bucket. Tighten to require an exact path (e.g., `bucket_id = 'menu-photos' AND name LIKE 'public/%'`) OR drop the SELECT policy entirely (signed URLs already work for public buckets without it).

### P2-3. 14 baseline `allow_*` policies use `USING (true)` / `WITH CHECK (true)`
Advisor `rls_policy_always_true` lists permissive INSERT/UPDATE/DELETE policies on: `ai_usage`, `break_entries`, `cash_drawer_events`, `customer_addresses`, `demo_requests` (this one is intentional — public lead capture), `gift_card_transactions`, `menu_item_modifier_groups`, `online_menu_items`, `order_discounts`, `order_item_modifiers`, `purchase_order_items`, `user_permission_overrides`. These date from `batch_14_*` through `batch_18_*` baseline policies — pre-V5. Replace with `org_id = (auth.jwt() ->> 'org_id')::uuid` in a follow-up `tighten_baseline_permissive_rls.sql` migration AFTER the JWT hook is dashboard-enabled (otherwise everything breaks).

### P2-4. One ALTER COLUMN SET NOT NULL in `20260504005008_add_campaign_recipients_indexes.sql`
Line 32: `ALTER COLUMN "org_id" SET NOT NULL` after backfill. Permitted because the immediately preceding `UPDATE` ensures every row passes the constraint, but it doesn't follow the additive-only "ADD CONSTRAINT … NOT VALID, validate, enable" pattern documented in CLAUDE.md. Acceptable since it is gated by the backfill; flag for future convention adherence.

---

## P3 — informational

- **Filename compliance:** all 13 non-baseline migrations match `^\d{14}_[a-z0-9_]+\.sql`. Timestamps strictly ascending. No drift.
- **Rollback pairing:** all 13 forward migrations have a paired rollback in `supabase/_rollbacks/`. No rollbacks live in `migrations/` (Supabase CLI re-apply trap avoided).
- **Destructive operations search:** zero `DROP COLUMN`, zero `DROP TABLE`, zero `RENAME` across post-baseline migrations. The only `ALTER COLUMN … SET NOT NULL` is the one in P2-4.
- **`drop_redundant_orders_index` (V5.99.5):** the `DROP INDEX` is paired with a recreate-rollback file — additive-rule-compliant.
- **`auth.jwt() ->> 'org_id'` vs `current_setting('request.jwt.claims',...)`:** the baseline uses the older `current_setting(...)` form. Both resolve identically once the hook is enabled — no action needed, but new policies should standardize on `auth.jwt() ->> 'org_id'` per the runbook template.
- **Leaked-password protection** is disabled at the Auth project level (advisor warning). Out of migration scope; flag for project-settings owner.

---

## Recommended execution order (not by me — main session)

1. Write `supabase/migrations/20260504194320_v7_indexes_align.sql` + rollback (P0-1). Commit.
2. Verify dashboard hook toggle is on (P1-2). If off, every `tenant_*` policy is decorative.
3. Add `tenant_*` policy quartets to the 8 silently-locked tables (P1-1).
4. Patch `SET search_path = ''` on the three flagged functions (P2-1).
5. Tighten or drop the `menu-photos` SELECT policy (P2-2).
6. Plan `tighten_baseline_permissive_rls.sql` for after JWT hook is verified live (P2-3).

Word count: ~1,090.
