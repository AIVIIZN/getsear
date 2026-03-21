-- ============================================================
-- 009_customer_tables.sql
-- Creates: customers, customer_addresses, customer_payment_methods
-- Also adds FK from orders.customer_id to customers
-- ============================================================

-- Customers
CREATE TABLE customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    first_name text,
    last_name text,
    email text,
    phone text,

    -- Preferences
    notes text,                          -- "Allergic to shellfish", "Prefers booth"
    tags text[],                         -- ['vip', 'regular', 'food-allergy']

    -- Stats (denormalized, updated async)
    total_visits int NOT NULL DEFAULT 0,
    total_spent numeric(12, 2) NOT NULL DEFAULT 0,
    average_check numeric(10, 2) NOT NULL DEFAULT 0,
    last_visit_at timestamptz,

    -- Marketing
    marketing_opt_in boolean NOT NULL DEFAULT false,
    birthday date,
    anniversary date,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

COMMENT ON TABLE customers IS 'Customer profiles with preferences, stats, and marketing info';
COMMENT ON COLUMN customers.tags IS 'Freeform tags: vip, regular, food-allergy, etc.';

-- Customer addresses (for delivery)
CREATE TABLE customer_addresses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    customer_id uuid NOT NULL REFERENCES customers(id),

    label text DEFAULT 'home',           -- 'home', 'work', 'other'
    line1 text NOT NULL,
    line2 text,
    city text NOT NULL,
    state text NOT NULL,
    zip text NOT NULL,

    is_default boolean NOT NULL DEFAULT false,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE customer_addresses IS 'Saved delivery addresses for customers';

-- Saved payment methods (tokens only -- NO raw card data)
CREATE TABLE customer_payment_methods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    customer_id uuid NOT NULL REFERENCES customers(id),

    -- Processor info
    processor_name text NOT NULL,
    processor_customer_id text,       -- Valor customer reference ID
    processor_card_token text NOT NULL, -- Processor's token for this card

    -- Display info (safe to store)
    card_brand text NOT NULL,
    card_last_four text NOT NULL,
    exp_month integer,
    exp_year integer,
    cardholder_name text,

    -- Status
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz
);

COMMENT ON TABLE customer_payment_methods IS 'Tokenized saved payment methods. NO raw card data stored.';

-- Now add the deferred FK from orders to customers
ALTER TABLE orders
    ADD CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id);
