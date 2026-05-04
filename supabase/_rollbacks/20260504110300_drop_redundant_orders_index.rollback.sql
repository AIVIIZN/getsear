-- 20260504110300_drop_redundant_orders_index.rollback.sql
-- Inverse of supabase/migrations/20260504110300_drop_redundant_orders_index.sql
--
-- Recreates `orders_id_version_org_idx (id, version, org_id)` as it was
-- after migration 20260504063720_add_order_version_columns.sql. The index
-- is redundant against orders_pkey, but the rollback must restore the prior
-- state byte-for-byte.

BEGIN;

CREATE INDEX IF NOT EXISTS orders_id_version_org_idx
  ON public.orders(id, version, org_id);

COMMIT;
