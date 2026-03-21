-- ============================================================
-- 007_discount_tables.sql
-- Creates: discounts, order_discounts
-- ============================================================

-- Discount definitions
CREATE TABLE discounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    name text NOT NULL,                  -- "Happy Hour", "Employee 50%", "Senior 10%"
    discount_type discount_type NOT NULL,

    -- Value
    percentage numeric(5, 2),            -- For percentage type
    fixed_amount numeric(10, 2),         -- For fixed_amount type

    -- Applicability
    applies_to text NOT NULL DEFAULT 'order', -- 'order', 'item', 'category'
    category_ids uuid[],                 -- If applies_to = 'category'
    item_ids uuid[],                     -- If applies_to specific items

    -- Rules
    requires_manager_approval boolean NOT NULL DEFAULT false,
    max_discount_amount numeric(10, 2),  -- Cap for percentage discounts
    min_order_amount numeric(10, 2),     -- Minimum order to apply

    -- Scheduling
    is_active boolean NOT NULL DEFAULT true,
    start_date date,
    end_date date,
    available_days int[],
    available_start_time time,
    available_end_time time,

    -- Tracking
    promo_code text,                     -- Optional promo code

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

COMMENT ON TABLE discounts IS 'Discount definitions: Happy Hour, Employee, Senior, promo codes, etc.';
COMMENT ON COLUMN discounts.applies_to IS 'Scope: order (entire check), item (specific items), category (item categories)';

-- Discounts applied to specific orders
CREATE TABLE order_discounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    order_id uuid NOT NULL REFERENCES orders(id),
    discount_id uuid REFERENCES discounts(id),   -- NULL for custom/manual discounts
    order_item_id uuid REFERENCES order_items(id), -- NULL if order-level discount

    name text NOT NULL,
    discount_type discount_type NOT NULL,
    value numeric(10, 2) NOT NULL,       -- The percentage or fixed amount
    applied_amount numeric(10, 2) NOT NULL, -- Actual dollar amount removed

    applied_by uuid NOT NULL REFERENCES users(id),
    approved_by uuid REFERENCES users(id),

    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE order_discounts IS 'Discounts applied to a specific order or order item';
