-- 20260504110100_lock_down_admin_table_rls.rollback.sql
-- Inverse of supabase/migrations/20260504110100_lock_down_admin_table_rls.sql
--
-- Drops the explicit-deny INSERT/UPDATE/DELETE policies on
-- org_processor_bindings and idempotency_records, restoring the
-- "no policy = denied implicitly" state from migrations 043344 and 061225.

BEGIN;

DROP POLICY IF EXISTS org_processor_bindings_tenant_insert ON public.org_processor_bindings;
DROP POLICY IF EXISTS org_processor_bindings_tenant_update ON public.org_processor_bindings;
DROP POLICY IF EXISTS org_processor_bindings_tenant_delete ON public.org_processor_bindings;

DROP POLICY IF EXISTS idempotency_records_tenant_insert ON public.idempotency_records;
DROP POLICY IF EXISTS idempotency_records_tenant_update ON public.idempotency_records;
DROP POLICY IF EXISTS idempotency_records_tenant_delete ON public.idempotency_records;

COMMIT;
