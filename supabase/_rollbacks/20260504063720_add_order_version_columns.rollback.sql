-- 20260504063720_add_order_version_columns.rollback.sql
-- Inverse of supabase/migrations/20260504063720_add_order_version_columns.sql
-- Drops the trigger, the function, the index, and the column.

BEGIN;

DROP TRIGGER IF EXISTS bump_order_version_trigger ON public.orders;
DROP FUNCTION IF EXISTS public.bump_order_version();
DROP INDEX IF EXISTS public.orders_id_version_org_idx;
ALTER TABLE public.orders DROP COLUMN IF EXISTS version;

COMMIT;
