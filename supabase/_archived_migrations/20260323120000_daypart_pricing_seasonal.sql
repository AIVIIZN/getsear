-- Migration: Daypart Pricing, Seasonal Menus, and Menu Item Availability Extensions
-- Session 4.2 — Sear POS V4

-- ============================================================================
-- 1. menu_dayparts — Configurable time-of-day periods for pricing & availability
-- ============================================================================
CREATE TABLE IF NOT EXISTS menu_dayparts (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        uuid        NOT NULL REFERENCES organizations(id),
  location_id   uuid        NOT NULL REFERENCES locations(id),
  name          text        NOT NULL,
  start_time    time        NOT NULL,
  end_time      time        NOT NULL,
  days          int[]       NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  sections      text[]      NOT NULL DEFAULT '{}',
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_dayparts_org ON menu_dayparts(org_id);
CREATE INDEX idx_menu_dayparts_location ON menu_dayparts(location_id);

ALTER TABLE menu_dayparts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON menu_dayparts
  FOR SELECT USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );
CREATE POLICY "tenant_isolation_insert" ON menu_dayparts
  FOR INSERT WITH CHECK (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );
CREATE POLICY "tenant_isolation_update" ON menu_dayparts
  FOR UPDATE USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );
CREATE POLICY "tenant_isolation_delete" ON menu_dayparts
  FOR DELETE USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );

-- ============================================================================
-- 2. seasonal_menu_items — Date-range-based seasonal item activation
-- ============================================================================
CREATE TABLE IF NOT EXISTS seasonal_menu_items (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id            uuid        NOT NULL REFERENCES organizations(id),
  location_id       uuid        NOT NULL REFERENCES locations(id),
  item_id           uuid        NOT NULL REFERENCES menu_items(id),
  replaces_item_id  uuid                 REFERENCES menu_items(id),
  start_date        date        NOT NULL,
  end_date          date        NOT NULL,
  is_active         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_seasonal_menu_items_org ON seasonal_menu_items(org_id);
CREATE INDEX idx_seasonal_menu_items_location ON seasonal_menu_items(location_id);
CREATE INDEX idx_seasonal_menu_items_dates ON seasonal_menu_items(start_date, end_date);
CREATE INDEX idx_seasonal_menu_items_item ON seasonal_menu_items(item_id);

ALTER TABLE seasonal_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON seasonal_menu_items
  FOR SELECT USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );
CREATE POLICY "tenant_isolation_insert" ON seasonal_menu_items
  FOR INSERT WITH CHECK (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );
CREATE POLICY "tenant_isolation_update" ON seasonal_menu_items
  FOR UPDATE USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );
CREATE POLICY "tenant_isolation_delete" ON seasonal_menu_items
  FOR DELETE USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );

-- ============================================================================
-- 3. Extend menu_items with availability columns (if not present)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='availability_type') THEN
    ALTER TABLE menu_items ADD COLUMN availability_type text NOT NULL DEFAULT 'always';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='available_dayparts') THEN
    ALTER TABLE menu_items ADD COLUMN available_dayparts uuid[] DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='available_start_date') THEN
    ALTER TABLE menu_items ADD COLUMN available_start_date date DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='available_end_date') THEN
    ALTER TABLE menu_items ADD COLUMN available_end_date date DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='quantity_available') THEN
    ALTER TABLE menu_items ADD COLUMN quantity_available int DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='quantity_low_threshold') THEN
    ALTER TABLE menu_items ADD COLUMN quantity_low_threshold int DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='is_running_low') THEN
    ALTER TABLE menu_items ADD COLUMN is_running_low boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='menu_items' AND column_name='price_type') THEN
    ALTER TABLE menu_items ADD COLUMN price_type text NOT NULL DEFAULT 'fixed';
  END IF;
END$$;

-- ============================================================================
-- 4. Add daypart_id to price_level_prices for daypart-specific level pricing
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='price_level_prices' AND column_name='daypart_id') THEN
    ALTER TABLE price_level_prices ADD COLUMN daypart_id uuid REFERENCES menu_dayparts(id) DEFAULT NULL;
  END IF;
END$$;

-- ============================================================================
-- 5. Updated_at trigger for new tables
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON menu_dayparts;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON menu_dayparts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON seasonal_menu_items;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON seasonal_menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
