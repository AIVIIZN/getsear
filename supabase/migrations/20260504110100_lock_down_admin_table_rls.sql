-- 20260504110100_lock_down_admin_table_rls.sql
-- Task: 5.99.5 (M1a + M1b) — explicit deny policies on ops-only tables
-- One-way migration; rollback in
--   supabase/_rollbacks/20260504110100_lock_down_admin_table_rls.rollback.sql
--
-- WHY:
--   Migrations 20260504043344 (`org_processor_bindings`) and 20260504061225
--   (`idempotency_records`) both define only a `tenant_select` policy. Postgres
--   defaults the absent operations to "no policy = denied for non-service-role",
--   which is technically correct but obscures intent and is fragile against any
--   future "ENABLE ALL" sweep that creates a permissive default.
--
--   The persona rule for new tables is: every new table needs SELECT/INSERT/UPDATE/
--   DELETE policies, even if they are deny-only. This migration adds explicit
--   `USING (false)` policies for INSERT/UPDATE/DELETE on both tables. The
--   service_role bypasses RLS by design, so backend onboarding/middleware writes
--   continue to work; authenticated callers via PostgREST are denied with intent.

BEGIN;

-- 1. M1a — org_processor_bindings: deny INSERT/UPDATE/DELETE for non-service-role -

CREATE POLICY org_processor_bindings_tenant_insert
  ON public.org_processor_bindings
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY org_processor_bindings_tenant_update
  ON public.org_processor_bindings
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY org_processor_bindings_tenant_delete
  ON public.org_processor_bindings
  FOR DELETE
  USING (false);

COMMENT ON POLICY org_processor_bindings_tenant_insert ON public.org_processor_bindings IS
  'Explicit deny — V5.2.0 binding rows are written via service_role only at onboarding. '
  'service_role bypasses RLS, so this policy gates only authenticated PostgREST callers.';

COMMENT ON POLICY org_processor_bindings_tenant_update ON public.org_processor_bindings IS
  'Explicit deny — bindings are immutable post-onboarding (also enforced by trigger).';

COMMENT ON POLICY org_processor_bindings_tenant_delete ON public.org_processor_bindings IS
  'Explicit deny — deletion happens only via ON DELETE CASCADE from organizations.';

-- 2. M1b — idempotency_records: deny INSERT/UPDATE/DELETE for non-service-role ----

CREATE POLICY idempotency_records_tenant_insert
  ON public.idempotency_records
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY idempotency_records_tenant_update
  ON public.idempotency_records
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY idempotency_records_tenant_delete
  ON public.idempotency_records
  FOR DELETE
  USING (false);

COMMENT ON POLICY idempotency_records_tenant_insert ON public.idempotency_records IS
  'Explicit deny — V5.3.1 middleware writes via service_role admin client only.';

COMMENT ON POLICY idempotency_records_tenant_update ON public.idempotency_records IS
  'Explicit deny — captured response rows are write-once per (key, route, org_id).';

COMMENT ON POLICY idempotency_records_tenant_delete ON public.idempotency_records IS
  'Explicit deny — pruning is handled by a service-role cleanup job filtering on expires_at.';

COMMIT;
