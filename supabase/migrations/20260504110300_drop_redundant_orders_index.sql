-- 20260504110300_drop_redundant_orders_index.sql
-- Task: 5.99.5 (Md2) — drop the redundant orders_id_version_org_idx
-- One-way migration; rollback in
--   supabase/_rollbacks/20260504110300_drop_redundant_orders_index.rollback.sql
--
-- WHY:
--   Migration 20260504063720_add_order_version_columns.sql created
--   `orders_id_version_org_idx (id, version, org_id)` to "speed up the WHERE
--   id=? AND version=? AND org_id=? gate". This is redundant: `orders_pkey`
--   is already a UNIQUE B-tree on `id`, which yields exactly one row per
--   id-equality probe. The downstream version + org_id checks are filtered
--   in-tuple after the PK lookup; an extra B-tree on (id, version, org_id)
--   adds zero query benefit and pays the full write-amplification cost on
--   every order INSERT/UPDATE.
--
--   Dropping an index is permitted under the additive-only rule (indexes are
--   exempt — they are an optimisation, not a contract). The PK guarantees
--   the index's stated purpose; correctness is preserved.

BEGIN;

DROP INDEX IF EXISTS public.orders_id_version_org_idx;

COMMIT;
