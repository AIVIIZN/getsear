-- ============================================================
-- 015_mod_loyalty.sql
-- Module: mod.loyalty
-- Creates: loyalty_programs, loyalty_accounts, loyalty_transactions
-- ============================================================

-- Loyalty program definitions
CREATE TABLE loyalty_programs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    name text NOT NULL,
    program_type text NOT NULL,          -- 'points', 'visits', 'spend_based'
    points_per_dollar numeric(6, 2) DEFAULT 1,
    points_per_visit int DEFAULT 0,
    redemption_threshold int,            -- Points needed to redeem
    reward_value numeric(10, 2),         -- Dollar value of reward
    is_active boolean DEFAULT true,
    settings jsonb DEFAULT '{}',

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE loyalty_programs IS 'Loyalty program definitions: points-based, visit-based, or spend-based';

-- Loyalty accounts: one per customer per program
CREATE TABLE loyalty_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    customer_id uuid NOT NULL REFERENCES customers(id),
    program_id uuid NOT NULL REFERENCES loyalty_programs(id),

    points_balance int NOT NULL DEFAULT 0,
    lifetime_points int NOT NULL DEFAULT 0,
    tier text DEFAULT 'bronze',          -- 'bronze', 'silver', 'gold', 'platinum'

    enrolled_at timestamptz DEFAULT now(),
    last_activity_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE loyalty_accounts IS 'Per-customer loyalty enrollment with points balance and tier';

-- Loyalty point transactions
CREATE TABLE loyalty_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    loyalty_account_id uuid NOT NULL REFERENCES loyalty_accounts(id),

    transaction_type text NOT NULL,      -- 'earn', 'redeem', 'adjustment', 'expire'
    points int NOT NULL,
    balance_after int NOT NULL,
    order_id uuid REFERENCES orders(id),
    description text,

    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE loyalty_transactions IS 'Loyalty point earn/redeem/adjustment/expiration history';
