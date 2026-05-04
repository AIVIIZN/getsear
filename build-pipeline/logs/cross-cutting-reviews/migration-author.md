The Write tool is being blocked from writing to `build-pipeline/logs/cross-cutting-reviews/migration-author.md` (each attempt requires interactive permission approval). I've completed the full review — delivering the content here so it can be saved manually or via approval on a retry:

---

# Cross-Cutting Review — V5 Schema Migrations

**Verdict: CONCERNS** — additive-only-compliant overall, but four issues warrant remediation before V6 lands.

## CRITICAL

**C1. `campaign_recipients.org_id` has no FK to `organizations`** *(20260504005008)* — Migration adds the tenant column, backfills, sets NOT NULL, but never adds the FK. Sibling migrations 043344 and 061225 do this correctly. Result: orphan possibility on org delete. Fix: follow-up `ADD CONSTRAINT ... NOT VALID` then `VALIDATE`.

**C2. `campaign_recipients` RLS still permissive** *(gap not closed by 20260504005008)* — Baseline policies `allow_select`/`allow_insert`/`allow_update USING (true)` (lines 4566/4610/4658) remain. The new `org_id` is stored but does not gate access — any authenticated request reads any tenant's recipient list including PII (`bounce_reason`, `clicked_url`, `resend_message_id`). Tenant-isolation defect. Fix: replace with 4 tenant-scoped policies.

## MAJOR

**M1. Persona-rule violation: missing INSERT/UPDATE/DELETE policies** — `org_processor_bindings` (043344) and `idempotency_records` (061225) only define `tenant_select`. Persona rule: every new table needs all four policies, even if permissive. Comments defending "no policy = deny" are technically right but obscure intent. Add explicit `USING (false)` policies for the other three operations.

**M2. RLS predicate style inconsistency** — Baseline uses `(current_setting('request.jwt.claims', true))::json ->> 'org_id'::uuid`. New V5 tables use `(SELECT org_id FROM users WHERE id = auth.uid())`. Both work; the JWT pattern is faster and matches established style; the new pattern fails differently when the `users` row is soft-deleted. Pick one in DEFAULTS.md.

## MEDIUM

- **Md1.** `audit_log` soft-rename — `before_state`/`after_state` shadow `previous_state`/`new_state`. Schedule a `safe_drop` task in STATE.yaml.
- **Md2.** `orders_id_version_org_idx (id, version, org_id)` is redundant against the PK on `id`. Drop in follow-up.
- **Md3.** `audit_log_no_update`/`audit_log_no_delete` are permissive `USING (false)` policies — Postgres ORs permissive, so a future `USING (true)` policy bypasses the deny. Use `AS RESTRICTIVE`.
- **Md4.** `campaign_recipients` backfill orphan-row risk — `SET NOT NULL` will fail if any orphan rows exist (FK has no CASCADE). No pre-validation gate.
- **Md5.** Composite UNIQUE `(campaign_id, customer_id)` assumed without duplicate check.
- **Md6.** `org_processor_bindings.bound_by_user_id` FK has no covering index.

## LOW

- **L1.** `bump_order_version()` comment misrepresents implementation (says it bumps beyond caller value; actually preserves caller value when `> OLD.version`).
- **L2.** Index naming inconsistency: `idx_<table>_<col>` (5008) vs `<table>_<col>_idx` (rest).
- **L3.** `requires_approval boolean NOT NULL DEFAULT false` — fine, flagged for completeness.
- **L4.** Six migrations clustered in a 6-hour window on 2026-05-04.

## VERIFIED CORRECT

- Every new table is tenant-scoped, RLS-enabled, `org_id`-indexed (except C1's missing FK).
- `gen_random_uuid()` volatile defaults correctly produce per-row unique values (PG11+ behavior).
- `org_processor_bindings` immutability trigger uses `ERRCODE = 'check_violation'` and runs in row's exclusive lock.
- `bump_order_version` trigger uses `WHEN (OLD.* IS DISTINCT FROM NEW.*)` to skip no-ops; idempotent under replay.
- `idempotency_records` PK `(key, route, org_id)` matches middleware lookup; `expires_at_idx` matches cleanup cron.
- `audit_log` `DO $$ ... CREATE POLICY` block is the correct workaround for pre-PG16 absence of `CREATE POLICY IF NOT EXISTS`.
- All forward migrations wrap in `BEGIN/COMMIT`; idempotency guards consistent.
- All rollbacks correctly placed in `supabase/_rollbacks/` (out of `migrations/`).
- All filenames match `^\d{14}_lowercase_slug\.sql$`.
- `ALTER DEFAULT PRIVILEGES` (baseline lines 6772–6775) auto-GRANTs to anon/authenticated/service_role — SELECT RLS policies on new tables are reachable.
- `'owner'` is a valid `user_role` enum value (baseline line 142).
- **No `DROP COLUMN`, no `DROP TABLE`, no `RENAME` in forward migrations. Additive-only rule compliant.**

## ROLLBACK COMPLETENESS

All six rollback files are complete inverses. Per-step audit verified: every column added has a `DROP COLUMN` in rollback; every index has a `DROP INDEX`; every trigger + function pair drops in correct order (trigger before function); every CREATE TABLE rolls back via DROP TABLE (cascading policies/indexes). No missing inverse operations.

## RECOMMENDED FOLLOW-UP TASKS (for STATE.yaml)

1. **5.1.2-fixup** — add FK `campaign_recipients.org_id → organizations(id)` (NOT VALID + VALIDATE).
2. **5.1.2-fixup-2** — replace `campaign_recipients` permissive RLS with 4 tenant-scoped policies.
3. **5.2.0a-fixup** — explicit `USING (false)` INSERT/UPDATE/DELETE policies on `org_processor_bindings`.
4. **5.3.1-fixup** — explicit `USING (false)` INSERT/UPDATE/DELETE policies on `idempotency_records`.
5. **5.4.1-fixup** — drop redundant `orders_id_version_org_idx`.
6. **5.4.3-fixup** — convert `audit_log_no_update`/`audit_log_no_delete` to `AS RESTRICTIVE`.
7. **safe_drop:audit_log_old_state_columns** — backfill new state columns from old, drop `previous_state`/`new_state`.
8. **DEFAULTS.md update** — codify RLS predicate style + index naming convention.

---

**Note on file output:** The Write tool requires interactive permission approval for the target path `/Users/ianrakow/Desktop/getsear/build-pipeline/logs/cross-cutting-reviews/migration-author.md` (outside the persona's default scope of `supabase/migrations/` and `src/types/supabase.ts`). Approve the prompt to persist this report, or copy this output into the file directly. The directory has been confirmed to exist.
