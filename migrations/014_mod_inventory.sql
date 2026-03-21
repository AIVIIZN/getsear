-- ============================================================
-- 014_mod_inventory.sql
-- Module: mod.inventory
-- Creates: vendors, inventory_items, inventory_transactions,
--          recipes, purchase_orders, purchase_order_items
-- Note: vendors created first since inventory_items references it
-- ============================================================

-- Vendors / suppliers
CREATE TABLE vendors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    name text NOT NULL,
    contact_name text,
    email text,
    phone text,
    address jsonb,
    payment_terms text,
    notes text,
    is_active boolean DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE vendors IS 'Suppliers and vendors for inventory purchasing';

-- Inventory items
CREATE TABLE inventory_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),

    name text NOT NULL,
    sku text,
    category text,
    unit_of_measure text NOT NULL,       -- 'oz', 'lb', 'each', 'case', 'gal'
    par_level numeric(10, 3),
    reorder_point numeric(10, 3),
    current_quantity numeric(10, 3) DEFAULT 0,
    unit_cost numeric(10, 4),
    vendor_id uuid REFERENCES vendors(id),
    is_active boolean DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE inventory_items IS 'Tracked inventory items with par levels and reorder points';
COMMENT ON COLUMN inventory_items.unit_of_measure IS 'Measurement unit: oz, lb, each, case, gal, etc.';

-- Inventory transactions: every change to inventory quantity
CREATE TABLE inventory_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),

    transaction_type text NOT NULL,      -- 'receive', 'waste', 'transfer', 'count', 'sale_deduction'
    quantity_change numeric(10, 3) NOT NULL,
    quantity_after numeric(10, 3) NOT NULL,
    unit_cost numeric(10, 4),
    reference_id uuid,                   -- order_id for sale deductions, PO id for receives
    notes text,

    performed_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE inventory_transactions IS 'Ledger of all inventory quantity changes: receives, waste, transfers, counts, sales';

-- Recipes: links menu items to inventory items (bill of materials)
CREATE TABLE recipes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    menu_item_id uuid NOT NULL REFERENCES menu_items(id),
    inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),

    quantity_used numeric(10, 4) NOT NULL,
    unit_of_measure text NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE recipes IS 'Bill of materials: how much of each inventory item a menu item uses';

-- Purchase orders
CREATE TABLE purchase_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    vendor_id uuid NOT NULL REFERENCES vendors(id),

    po_number text NOT NULL,
    status text NOT NULL DEFAULT 'draft', -- 'draft', 'submitted', 'partial', 'received', 'cancelled'
    total_amount numeric(12, 2),

    ordered_at timestamptz,
    expected_at timestamptz,
    received_at timestamptz,

    notes text,
    created_by uuid NOT NULL REFERENCES users(id),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE purchase_orders IS 'Purchase orders to vendors for inventory restocking';

-- Purchase order line items
CREATE TABLE purchase_order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id),
    inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),

    quantity_ordered numeric(10, 3) NOT NULL,
    quantity_received numeric(10, 3) DEFAULT 0,
    unit_cost numeric(10, 4) NOT NULL,
    line_total numeric(10, 2) NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE purchase_order_items IS 'Line items on a purchase order';
