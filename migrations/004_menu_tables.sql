-- ============================================================
-- 004_menu_tables.sql
-- Creates: tax_rates, menu_categories, menu_items, modifier_groups,
--          modifiers, menu_item_modifier_groups
-- Note: tax_rates created first since menu_items references it
-- ============================================================

-- Tax configuration
CREATE TABLE tax_rates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid REFERENCES locations(id),   -- NULL = org-wide default

    name text NOT NULL,                  -- "State Sales Tax", "City Tax", "Alcohol Tax"
    rate numeric(6, 4) NOT NULL,         -- 0.0825 = 8.25%
    is_inclusive boolean NOT NULL DEFAULT false, -- VAT-style (price includes tax)
    is_default boolean NOT NULL DEFAULT false,

    -- Applicability
    applies_to text[] DEFAULT '{}',      -- Empty = all items; ['alcohol', 'food', 'merchandise']

    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tax_rates IS 'Tax rate definitions. Can be org-wide or location-specific.';
COMMENT ON COLUMN tax_rates.rate IS 'Decimal rate, e.g. 0.0825 = 8.25%';
COMMENT ON COLUMN tax_rates.is_inclusive IS 'If true, the item price already includes this tax (VAT-style)';
COMMENT ON COLUMN tax_rates.applies_to IS 'Item categories this tax applies to. Empty array = all items.';

-- Menu categories
CREATE TABLE menu_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid REFERENCES locations(id),  -- NULL = org-wide template

    name text NOT NULL,
    description text,
    sort_order int NOT NULL DEFAULT 0,

    -- Availability
    is_active boolean NOT NULL DEFAULT true,
    available_start_time time,           -- Category only shows during these hours
    available_end_time time,
    available_days int[] DEFAULT '{0,1,2,3,4,5,6}', -- 0=Sunday

    -- Display
    color text,                          -- Hex color for POS button
    image_url text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

COMMENT ON TABLE menu_categories IS 'Menu categories (Appetizers, Entrees, Drinks, etc.)';
COMMENT ON COLUMN menu_categories.available_days IS 'Days of week category is available. 0=Sunday, 6=Saturday.';

-- Menu items
CREATE TABLE menu_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    category_id uuid NOT NULL REFERENCES menu_categories(id),
    location_id uuid REFERENCES locations(id),   -- NULL = org-wide

    name text NOT NULL,
    short_name text,                     -- Abbreviated for kitchen tickets
    description text,

    -- Pricing
    price numeric(10, 2) NOT NULL,
    cost numeric(10, 2),                 -- Food cost for margin tracking

    -- Tax
    tax_rate_id uuid REFERENCES tax_rates(id),
    is_taxable boolean NOT NULL DEFAULT true,

    -- Prep
    prep_station text,                   -- 'grill', 'fryer', 'cold', 'bar', 'expo'
    prep_time_minutes int,
    course text,                         -- 'appetizer', 'entree', 'dessert', 'drink'

    -- Availability
    is_active boolean NOT NULL DEFAULT true,
    is_86d boolean NOT NULL DEFAULT false,       -- Temporarily unavailable
    available_start_time time,
    available_end_time time,
    available_days int[] DEFAULT '{0,1,2,3,4,5,6}',

    -- Display
    color text,
    image_url text,
    sort_order int NOT NULL DEFAULT 0,

    -- Nutrition/allergens (optional, for online ordering)
    nutrition jsonb,
    allergens text[],                    -- ['gluten', 'dairy', 'nuts', ...]

    -- PLU / barcode
    plu_code text,
    barcode text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

COMMENT ON TABLE menu_items IS 'Individual menu items within categories';
COMMENT ON COLUMN menu_items.is_86d IS 'Temporarily unavailable (restaurant industry term for "out of")';
COMMENT ON COLUMN menu_items.prep_station IS 'Kitchen routing: grill, fryer, cold, bar, expo';
COMMENT ON COLUMN menu_items.cost IS 'Food cost per unit for margin tracking';

-- Modifier groups (e.g., "Temperature", "Sides", "Add-ons")
CREATE TABLE modifier_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    name text NOT NULL,                  -- "Temperature", "Sides", "Add-ons"

    -- Selection rules
    min_selections int NOT NULL DEFAULT 0,  -- 0 = optional
    max_selections int NOT NULL DEFAULT 1,  -- 1 = pick one, >1 = pick many

    -- If true, server must actively choose (even if 0 min_selections)
    is_required_prompt boolean NOT NULL DEFAULT false,

    sort_order int NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

COMMENT ON TABLE modifier_groups IS 'Groups of modifiers (Temperature, Sides, Add-ons)';
COMMENT ON COLUMN modifier_groups.is_required_prompt IS 'If true, POS forces server to interact with this group even if min_selections is 0';

-- Individual modifiers within a group
CREATE TABLE modifiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    modifier_group_id uuid NOT NULL REFERENCES modifier_groups(id),

    name text NOT NULL,
    short_name text,
    price_adjustment numeric(10, 2) NOT NULL DEFAULT 0, -- Additional cost

    is_default boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    sort_order int NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

COMMENT ON TABLE modifiers IS 'Individual modifier options within a modifier group';

-- Join table: which modifier groups apply to which menu items
CREATE TABLE menu_item_modifier_groups (
    menu_item_id uuid NOT NULL REFERENCES menu_items(id),
    modifier_group_id uuid NOT NULL REFERENCES modifier_groups(id),
    sort_order int NOT NULL DEFAULT 0,
    PRIMARY KEY (menu_item_id, modifier_group_id)
);

COMMENT ON TABLE menu_item_modifier_groups IS 'Join table linking menu items to their available modifier groups';
