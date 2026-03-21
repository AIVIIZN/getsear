-- ============================================================
-- 024_schema_fixes.sql
-- Soft-delete columns, unique constraints, race condition fix
-- ============================================================

-- ============================================================
-- Soft-delete columns for tables missing them
-- ============================================================

ALTER TABLE tax_rates
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE vendors
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

ALTER TABLE terminals
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

-- ============================================================
-- Unique constraints: one config row per org
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_surcharge_config_org_unique
    ON surcharge_config(org_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tip_config_org_unique
    ON tip_config(org_id);

-- ============================================================
-- Fix next_order_number() race condition with advisory lock
-- ============================================================

CREATE OR REPLACE FUNCTION next_order_number(p_location_id uuid, p_date date)
RETURNS integer AS $$
DECLARE
  next_num integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_location_id::text || p_date::text));
  SELECT COALESCE(MAX(order_number), 0) + 1 INTO next_num
  FROM orders
  WHERE location_id = p_location_id
    AND DATE(created_at) = p_date;
  RETURN next_num;
END;
$$ LANGUAGE plpgsql;
