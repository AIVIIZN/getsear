-- ============================================================
-- 016_mod_online_ordering.sql
-- Module: mod.online_ordering
-- Creates: online_menus, online_menu_items, online_order_queue
-- ============================================================

-- Online menus: curated menus for online ordering
CREATE TABLE online_menus (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),

    name text NOT NULL,
    slug text NOT NULL,                  -- Public URL slug
    is_active boolean DEFAULT true,
    settings jsonb DEFAULT '{}',         -- theme, colors, logo, min_order, delivery_fee, etc.

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE online_menus IS 'Curated menus published for online ordering with custom settings';

-- Online menu item overrides
CREATE TABLE online_menu_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    online_menu_id uuid NOT NULL REFERENCES online_menus(id),
    menu_item_id uuid NOT NULL REFERENCES menu_items(id),

    is_available boolean DEFAULT true,
    sort_order int DEFAULT 0,
    online_price numeric(10, 2),         -- Override price for online (NULL = use menu_item price)
    online_description text,             -- Extended description for online

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE online_menu_items IS 'Per-item overrides for online ordering: price, availability, description';

-- Online order acceptance queue
CREATE TABLE online_order_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    order_id uuid NOT NULL REFERENCES orders(id),

    status text NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'preparing'
    estimated_ready_minutes int,
    accepted_by uuid REFERENCES users(id),
    accepted_at timestamptz,
    customer_notified_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE online_order_queue IS 'Queue for incoming online orders that need restaurant acceptance';
