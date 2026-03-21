-- ============================================================
-- 006_payment_tables.sql
-- Creates: payments, tip_adjustments, payment_transactions,
--          restaurant_processors, payment_devices, settlement_batches,
--          chargebacks, surcharge_config, tip_config, daily_reconciliations
-- Note: gift_cards FK on payments deferred to 011
-- ============================================================

-- Payments applied to orders
CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    order_id uuid NOT NULL REFERENCES orders(id),

    -- Payment details
    payment_method payment_method NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',

    amount numeric(10, 2) NOT NULL,       -- Amount applied to this order
    tip_amount numeric(10, 2) NOT NULL DEFAULT 0,
    total_amount numeric(10, 2) NOT NULL, -- amount + tip

    -- Card payments
    processor_transaction_id text,        -- From payment processor
    card_brand text,                      -- 'visa', 'mastercard', 'amex'
    card_last_four text,                  -- '4242'
    auth_code text,

    -- Gift card payments (FK added in 011 after gift_cards table exists)
    gift_card_id uuid,

    -- Cash payments
    cash_tendered numeric(10, 2),
    change_due numeric(10, 2),

    -- Split payment tracking
    split_index int,                     -- 1, 2, 3... for split payments

    -- Refund tracking
    refund_amount numeric(10, 2),
    refund_reason text,
    refunded_by uuid REFERENCES users(id),
    refunded_at timestamptz,
    original_payment_id uuid REFERENCES payments(id), -- For refund records

    processed_by uuid NOT NULL REFERENCES users(id),
    processed_at timestamptz NOT NULL DEFAULT now(),

    -- Processor response data
    processor_response jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE payments IS 'Payment records applied to orders. An order can have multiple payments (split).';
COMMENT ON COLUMN payments.gift_card_id IS 'FK to gift_cards added in migration 011';
COMMENT ON COLUMN payments.original_payment_id IS 'Self-reference linking a refund record to its original payment';

-- Tip adjustments (post-close tip changes, common with card tips)
CREATE TABLE tip_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    payment_id uuid NOT NULL REFERENCES payments(id),
    order_id uuid NOT NULL REFERENCES orders(id),
    server_id uuid NOT NULL REFERENCES users(id),

    original_tip numeric(10, 2) NOT NULL,
    adjusted_tip numeric(10, 2) NOT NULL,
    reason text,

    adjusted_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tip_adjustments IS 'Post-close tip modifications (e.g., customer writes different tip on signed receipt)';

-- Detailed payment transaction records (processor-level detail)
CREATE TABLE payment_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    order_id uuid NOT NULL REFERENCES orders(id),

    -- Processor info
    processor_name text NOT NULL DEFAULT 'valor',  -- Always 'valor' (Valor PayTech)
    processor_transaction_id text,           -- Processor's reference ID
    processor_batch_id text,                 -- Which batch this settled in
    authorization_code text,                 -- 6-digit auth code

    -- Amounts (all in cents to avoid floating point)
    authorized_amount_cents integer NOT NULL,
    captured_amount_cents integer,
    tip_amount_cents integer DEFAULT 0,
    surcharge_amount_cents integer DEFAULT 0,
    refunded_amount_cents integer DEFAULT 0,

    -- Card info (masked/tokenized only -- NEVER full PAN)
    payment_method text NOT NULL,            -- 'card_emv', 'card_nfc', 'cash', etc.
    card_brand text,                         -- 'visa', 'mastercard', etc.
    card_last_four text,                     -- '4242'
    card_entry_mode text,                    -- 'emv', 'nfc', 'swipe', 'manual'
    card_token text,                         -- Processor token for this card
    is_debit boolean,

    -- Status tracking
    status text NOT NULL DEFAULT 'pending',  -- pending, authorized, captured, settled, voided, refunded
    authorized_at timestamptz,
    captured_at timestamptz,
    settled_at timestamptz,
    voided_at timestamptz,

    -- Split payment tracking
    split_group_id uuid,                     -- Links split payments together
    split_sequence integer,                  -- 1st, 2nd, 3rd split payment

    -- Staff
    server_id uuid REFERENCES users(id),
    manager_approval_id uuid,                -- If manager override was needed
    device_id text,                          -- Which iPad/reader

    -- Metadata
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    processor_raw_response jsonb,            -- Full processor response
    metadata jsonb DEFAULT '{}'::jsonb
);

COMMENT ON TABLE payment_transactions IS 'Detailed processor-level transaction records from Valor PayTech';
COMMENT ON COLUMN payment_transactions.authorized_amount_cents IS 'All amounts in cents to avoid floating point issues';

-- Payment processor configuration per restaurant/org
CREATE TABLE restaurant_processors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    processor_name text NOT NULL DEFAULT 'valor',  -- Always 'valor' (Valor PayTech)
    is_primary boolean DEFAULT true,
    is_active boolean DEFAULT true,

    -- Encrypted credentials (use Supabase Vault or app-level encryption)
    credentials_encrypted jsonb NOT NULL,  -- API keys, merchant IDs, etc.

    -- Configuration
    config jsonb DEFAULT '{}'::jsonb,      -- Location IDs, terminal IPs, etc.

    -- Processing settings
    auto_batch_close_time time,            -- e.g., '02:00:00' for 2 AM
    batch_close_timezone text DEFAULT 'America/New_York',

    -- Rate info (for reconciliation estimates)
    effective_rate_percent decimal(5, 3),   -- e.g., 2.350 for 2.35%
    per_transaction_fee_cents integer,      -- e.g., 10 for $0.10

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE restaurant_processors IS 'Payment processor config per org. Credentials are encrypted.';

-- Payment devices/readers per station
CREATE TABLE payment_devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    processor_id uuid NOT NULL REFERENCES restaurant_processors(id),

    device_serial text NOT NULL,
    device_model text NOT NULL,             -- 'VP800', 'VP550', 'VP300_Pro', 'RCKT'
    device_label text,                      -- 'Bar Reader', 'Station 1', etc.
    connection_type text NOT NULL,          -- 'bluetooth', 'wifi', 'ethernet', 'usb'

    -- For network-connected devices
    ip_address text,
    port integer,

    -- Status
    is_active boolean DEFAULT true,
    last_seen_at timestamptz,
    firmware_version text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE payment_devices IS 'Physical card reader devices (Valor VP800, VP550, VP300 Pro, RCKT)';

-- Batch settlement records
CREATE TABLE settlement_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    processor_name text NOT NULL,
    processor_batch_id text,

    -- Batch totals
    transaction_count integer NOT NULL,
    gross_amount_cents integer NOT NULL,
    refund_amount_cents integer DEFAULT 0,
    net_amount_cents integer NOT NULL,

    -- Timing
    batch_opened_at timestamptz,
    batch_closed_at timestamptz NOT NULL,
    expected_deposit_date date,
    actual_deposit_date date,
    actual_deposit_amount_cents integer,

    -- Reconciliation
    reconciled boolean DEFAULT false,
    reconciled_at timestamptz,
    variance_cents integer DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE settlement_batches IS 'End-of-day batch settlement records from the payment processor';

-- Chargeback/dispute tracking
CREATE TABLE chargebacks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    transaction_id uuid REFERENCES payment_transactions(id),
    processor_name text NOT NULL,
    processor_dispute_id text NOT NULL,

    -- Dispute details
    reason_code text NOT NULL,
    reason_description text,
    amount_cents integer NOT NULL,

    -- Deadlines
    received_at timestamptz NOT NULL,
    respond_by timestamptz NOT NULL,

    -- Our response
    status text NOT NULL DEFAULT 'open', -- open, evidence_submitted, won, lost, expired
    evidence_submitted_at timestamptz,
    evidence jsonb,

    -- Resolution
    resolved_at timestamptz,
    resolution text,                     -- 'won', 'lost', 'accepted'

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE chargebacks IS 'Chargeback/dispute tracking with evidence and deadlines';

-- Surcharge configuration per org (Dual Pricing / Cash Discount)
CREATE TABLE surcharge_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    program_type text NOT NULL DEFAULT 'none',  -- 'none', 'surcharge', 'cash_discount'
    surcharge_rate decimal(4, 2),               -- e.g., 3.00 for 3%
    cash_discount_rate decimal(4, 2),           -- e.g., 3.00 for 3%
    merchant_discount_rate decimal(4, 2),       -- Their actual processing cost rate
    state text NOT NULL,                        -- For legal validation

    -- Compliance tracking
    card_network_registered boolean DEFAULT false,
    registration_date date,
    signage_confirmed boolean DEFAULT false,

    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE surcharge_config IS 'Dual Pricing / Cash Discount / Surcharge program configuration';
COMMENT ON COLUMN surcharge_config.state IS 'US state code for legal compliance validation (surcharge rules vary by state)';

-- Tip configuration per org
CREATE TABLE tip_config (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    -- Calculation
    calculate_on text DEFAULT 'pre_tax',     -- 'pre_tax' or 'post_tax'
    suggested_percentages integer[] DEFAULT ARRAY[18, 20, 22],
    default_percentage integer DEFAULT 20,

    -- Auto-gratuity
    auto_grat_enabled boolean DEFAULT true,
    auto_grat_party_size integer DEFAULT 6,
    auto_grat_percentage integer DEFAULT 20,

    -- Distribution
    distribution_model text DEFAULT 'direct', -- 'direct', 'pool', 'hybrid'

    -- Tipout rules (for direct model)
    tipout_rules jsonb DEFAULT '[]'::jsonb,

    -- Pool rules (for pool model)
    pool_method text DEFAULT 'hours_worked',  -- 'hours_worked', 'equal', 'points'
    pool_point_values jsonb DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tip_config IS 'Tip calculation, suggested percentages, auto-gratuity, and distribution rules';
COMMENT ON COLUMN tip_config.tipout_rules IS 'JSON array of tipout rules, e.g. [{"role":"busser","percentage":3,"based_on":"sales"}]';
COMMENT ON COLUMN tip_config.pool_point_values IS 'Point values per role for pooled tip distribution, e.g. {"server":2,"busser":1}';

-- Daily reconciliation snapshots
CREATE TABLE daily_reconciliations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    business_date date NOT NULL,

    -- Revenue
    gross_sales_cents integer NOT NULL,
    discount_cents integer DEFAULT 0,
    comp_cents integer DEFAULT 0,
    net_sales_cents integer NOT NULL,
    tax_collected_cents integer NOT NULL,

    -- Payment breakdown
    credit_card_cents integer DEFAULT 0,
    cash_cents integer DEFAULT 0,
    gift_card_cents integer DEFAULT 0,
    house_account_cents integer DEFAULT 0,

    -- Card brand breakdown
    visa_cents integer DEFAULT 0,
    mastercard_cents integer DEFAULT 0,
    amex_cents integer DEFAULT 0,
    discover_cents integer DEFAULT 0,

    -- Tips
    cc_tips_cents integer DEFAULT 0,
    cash_tips_reported_cents integer DEFAULT 0,
    auto_gratuity_cents integer DEFAULT 0,

    -- Adjustments
    void_cents integer DEFAULT 0,
    refund_cents integer DEFAULT 0,
    surcharge_cents integer DEFAULT 0,

    -- Cash drawer
    cash_expected_cents integer DEFAULT 0,
    cash_counted_cents integer,
    cash_variance_cents integer,

    -- Processing
    estimated_fee_cents integer DEFAULT 0,

    -- Manager sign-off
    closed_by uuid REFERENCES users(id),
    closed_at timestamptz,
    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE(org_id, location_id, business_date)
);

COMMENT ON TABLE daily_reconciliations IS 'End-of-day financial reconciliation snapshot per location';
