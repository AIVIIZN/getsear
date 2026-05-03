-- Migration: Menu Allergens, 86 Cascade, Ingredients
-- Session 4.3: 86 Cascade, Allergens, Dietary Tags & Import/Export
-- Date: 2026-03-23

-- ---------------------------------------------------------------------------
-- 1. Add new columns to menu_items (if not present)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  -- dietary_tags: array of tag IDs like 'vegetarian', 'vegan', 'gluten_free'
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu_items' AND column_name = 'dietary_tags'
  ) THEN
    ALTER TABLE menu_items ADD COLUMN dietary_tags text[] DEFAULT NULL;
  END IF;

  -- may_contain: JSONB array of allergen IDs for "may contain" warnings
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu_items' AND column_name = 'may_contain'
  ) THEN
    ALTER TABLE menu_items ADD COLUMN may_contain text[] DEFAULT NULL;
  END IF;

  -- cross_contamination_warning: blanket warning flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu_items' AND column_name = 'cross_contamination_warning'
  ) THEN
    ALTER TABLE menu_items ADD COLUMN cross_contamination_warning boolean NOT NULL DEFAULT false;
  END IF;

  -- ingredient_list: raw text ingredient list for auto-detection
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu_items' AND column_name = 'ingredient_list'
  ) THEN
    ALTER TABLE menu_items ADD COLUMN ingredient_list text DEFAULT '';
  END IF;

  -- quantity_available: for auto-86 tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu_items' AND column_name = 'quantity_available'
  ) THEN
    ALTER TABLE menu_items ADD COLUMN quantity_available integer DEFAULT NULL;
  END IF;

  -- quantity_low_threshold: threshold for "running low" badge
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu_items' AND column_name = 'quantity_low_threshold'
  ) THEN
    ALTER TABLE menu_items ADD COLUMN quantity_low_threshold integer DEFAULT NULL;
  END IF;

  -- is_running_low: computed flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu_items' AND column_name = 'is_running_low'
  ) THEN
    ALTER TABLE menu_items ADD COLUMN is_running_low boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. menu_item_ingredients junction table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity numeric(10,4) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'each',
  is_minor boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (menu_item_id, ingredient_id)
);

CREATE INDEX IF NOT EXISTS idx_menu_item_ingredients_item
  ON menu_item_ingredients(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_ingredients_ingredient
  ON menu_item_ingredients(ingredient_id);

-- RLS
ALTER TABLE menu_item_ingredients ENABLE ROW LEVEL SECURITY;

-- Allow read for authenticated users (item-level access controlled elsewhere)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'menu_item_ingredients' AND policyname = 'menu_item_ingredients_select'
  ) THEN
    CREATE POLICY menu_item_ingredients_select ON menu_item_ingredients
      FOR SELECT USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. eighty_six_log table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS eighty_six_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  location_id uuid NOT NULL REFERENCES locations(id),
  ingredient_id uuid REFERENCES inventory_items(id) ON DELETE SET NULL,
  item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('86', 'restore')),
  performed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eighty_six_log_org_location
  ON eighty_six_log(org_id, location_id);
CREATE INDEX IF NOT EXISTS idx_eighty_six_log_ingredient
  ON eighty_six_log(ingredient_id) WHERE ingredient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eighty_six_log_item
  ON eighty_six_log(item_id);
CREATE INDEX IF NOT EXISTS idx_eighty_six_log_created
  ON eighty_six_log(created_at DESC);

-- RLS
ALTER TABLE eighty_six_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'eighty_six_log' AND policyname = 'tenant_isolation_select_eighty_six_log'
  ) THEN
    CREATE POLICY tenant_isolation_select_eighty_six_log ON eighty_six_log
      FOR SELECT USING (
        org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'eighty_six_log' AND policyname = 'tenant_isolation_insert_eighty_six_log'
  ) THEN
    CREATE POLICY tenant_isolation_insert_eighty_six_log ON eighty_six_log
      FOR INSERT WITH CHECK (
        org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. menu_item_photos table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS menu_item_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_item_photos_item
  ON menu_item_photos(item_id);

-- RLS
ALTER TABLE menu_item_photos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'menu_item_photos' AND policyname = 'menu_item_photos_select'
  ) THEN
    CREATE POLICY menu_item_photos_select ON menu_item_photos
      FOR SELECT USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Enable Realtime on eighty_six_log and menu_items for 86 propagation
-- ---------------------------------------------------------------------------

-- Ensure menu_items changes are published via Realtime
-- (This is typically configured in the Supabase Dashboard, but we add the
-- publication here as a safety net)
DO $$
BEGIN
  -- Add menu_items to the realtime publication if not already there
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'menu_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
  END IF;

  -- Add eighty_six_log to realtime publication
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'eighty_six_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE eighty_six_log;
  END IF;
END $$;
