-- ============================================================
-- 005_order_tables.sql
-- Creates: orders (with next_order_number function), order_items,
--          order_item_modifiers, order_modifications
-- Note: tables and customers referenced here are created later;
--       we use uuid type without FK constraint and add FKs in 023
-- ============================================================

-- Orders
CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    terminal_id uuid REFERENCES terminals(id),

    -- Order identification
    order_number int NOT NULL,           -- Sequential per-location, per-day
    display_number text NOT NULL,        -- "A-042" (prefix + number, shown to customer)

    -- Type and status
    order_type order_type NOT NULL DEFAULT 'dine_in',
    status order_status NOT NULL DEFAULT 'draft',

    -- Assignments (FKs to tables/customers added after those tables exist)
    server_id uuid REFERENCES users(id),
    table_id uuid,                       -- FK added in 008 after tables table is created
    customer_id uuid,                    -- FK added in 009 after customers table is created

    -- Guest info (for dine-in without customer record)
    guest_count int,
    guest_name text,                     -- For takeout / delivery
    guest_phone text,

    -- Financials (denormalized for fast reads)
    subtotal numeric(10, 2) NOT NULL DEFAULT 0,
    discount_total numeric(10, 2) NOT NULL DEFAULT 0,
    tax_total numeric(10, 2) NOT NULL DEFAULT 0,
    tip_total numeric(10, 2) NOT NULL DEFAULT 0,
    total numeric(10, 2) NOT NULL DEFAULT 0,

    -- Payment state
    amount_paid numeric(10, 2) NOT NULL DEFAULT 0,
    balance_due numeric(10, 2) NOT NULL DEFAULT 0,

    -- Timing
    opened_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,                 -- When first sent to kitchen
    closed_at timestamptz,

    -- Delivery/takeout
    scheduled_for timestamptz,           -- Scheduled pickup/delivery time
    delivery_address jsonb,              -- {line1, line2, city, state, zip}

    -- Coursing
    fire_course_2_at timestamptz,        -- When to fire entrees (manual or auto)

    -- Notes
    notes text,                          -- Internal notes for kitchen/staff

    -- Metadata
    source text DEFAULT 'pos',           -- 'pos', 'online', 'kiosk', 'phone', 'catering'
    metadata jsonb NOT NULL DEFAULT '{}',

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id),
    updated_by uuid REFERENCES users(id)
);

COMMENT ON TABLE orders IS 'Restaurant orders. Financials are denormalized -- authoritative values come from line items.';
COMMENT ON COLUMN orders.order_number IS 'Sequential per-location, per-day. Reset daily via application logic.';
COMMENT ON COLUMN orders.display_number IS 'Customer-facing order number, e.g. "A-042"';
COMMENT ON COLUMN orders.source IS 'Where the order originated: pos, online, kiosk, phone, catering';
COMMENT ON COLUMN orders.metadata IS 'Extensible data: online_order_id, delivery_partner, catering_event_id, etc.';

-- Order number sequence helper (reset daily via application logic)
CREATE OR REPLACE FUNCTION next_order_number(p_location_id uuid)
RETURNS int AS $$
DECLARE
    v_next int;
BEGIN
    SELECT COALESCE(MAX(order_number), 0) + 1 INTO v_next
    FROM orders
    WHERE location_id = p_location_id
      AND opened_at::date = CURRENT_DATE;
    RETURN v_next;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION next_order_number(uuid) IS 'Returns the next sequential order number for a location on the current day';

-- Order line items
CREATE TABLE order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

    menu_item_id uuid REFERENCES menu_items(id),  -- NULL for open/custom items

    -- Snapshot of item at time of order (menu can change, order record should not)
    name text NOT NULL,
    short_name text,

    quantity int NOT NULL DEFAULT 1,
    unit_price numeric(10, 2) NOT NULL,

    -- Modifiers affect the price
    modifier_total numeric(10, 2) NOT NULL DEFAULT 0,

    -- Line total = (unit_price + modifier_total) * quantity - discount
    discount_amount numeric(10, 2) NOT NULL DEFAULT 0,
    tax_amount numeric(10, 2) NOT NULL DEFAULT 0,
    line_total numeric(10, 2) NOT NULL,

    -- Kitchen routing
    prep_station text,
    course int DEFAULT 1,                -- 1 = first course, 2 = entree, etc.
    seat_number int,                     -- Which seat at the table

    -- Status
    is_sent boolean NOT NULL DEFAULT false,   -- Has been sent to kitchen
    is_fired boolean NOT NULL DEFAULT false,  -- Kitchen has started making it
    is_ready boolean NOT NULL DEFAULT false,  -- Ready to serve
    is_served boolean NOT NULL DEFAULT false,
    is_voided boolean NOT NULL DEFAULT false,
    void_reason void_reason,
    voided_by uuid REFERENCES users(id),
    voided_at timestamptz,

    -- Comps
    is_comped boolean NOT NULL DEFAULT false,
    comp_reason comp_reason,
    comp_amount numeric(10, 2),
    comped_by uuid REFERENCES users(id),

    notes text,                          -- "No onions", "Extra sauce", etc.

    sent_at timestamptz,
    fired_at timestamptz,
    ready_at timestamptz,
    served_at timestamptz,

    sort_order int NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id)
);

COMMENT ON TABLE order_items IS 'Line items on an order. Contains snapshot of menu item at time of order.';

-- Modifiers applied to a specific order item
CREATE TABLE order_item_modifiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,

    modifier_id uuid REFERENCES modifiers(id),   -- NULL for custom modifiers
    modifier_group_id uuid REFERENCES modifier_groups(id),

    -- Snapshot
    name text NOT NULL,
    price_adjustment numeric(10, 2) NOT NULL DEFAULT 0,
    quantity int NOT NULL DEFAULT 1,

    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE order_item_modifiers IS 'Modifiers applied to a specific order line item (snapshot at time of order)';

-- Track modifications to orders after they have been sent
CREATE TABLE order_modifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    order_id uuid NOT NULL REFERENCES orders(id),
    order_item_id uuid REFERENCES order_items(id),

    modification_type text NOT NULL,     -- 'add_item', 'remove_item', 'modify_item',
                                         -- 'change_quantity', 'void_item', 'comp_item',
                                         -- 'change_table', 'change_server', 'apply_discount'

    description text NOT NULL,           -- Human-readable: "Voided 1x Burger (wrong item)"

    -- Before/after state for the modified field
    previous_value jsonb,
    new_value jsonb,

    performed_by uuid NOT NULL REFERENCES users(id),
    approved_by uuid REFERENCES users(id),  -- Manager approval if required

    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE order_modifications IS 'Audit trail of changes made to orders after they have been sent to kitchen';
