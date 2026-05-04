-- 20260504061225_add_idempotency_records.rollback.sql
-- Inverse of supabase/migrations/20260504061225_add_idempotency_records.sql
-- Drops the table (cascading the indexes + RLS policy).

BEGIN;

DROP POLICY IF EXISTS idempotency_records_tenant_select ON public.idempotency_records;
DROP INDEX IF EXISTS idempotency_records_org_id_idx;
DROP INDEX IF EXISTS idempotency_records_expires_at_idx;
DROP TABLE IF EXISTS public.idempotency_records;

COMMIT;
