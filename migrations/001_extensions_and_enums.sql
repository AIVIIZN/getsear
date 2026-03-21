-- ============================================================
-- 001_extensions_and_enums.sql
-- Enable extensions and create all enum types
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Order lifecycle
CREATE TYPE order_status AS ENUM (
    'draft',          -- Being built on terminal, not yet sent
    'open',           -- Sent to kitchen/bar, actively being worked
    'fired',          -- Kitchen has started preparing
    'ready',          -- Ready for pickup/serve
    'served',         -- Delivered to guest
    'closed',         -- Fully paid and complete
    'voided',         -- Cancelled entirely
    'refunded'        -- Closed then refunded
);

-- Order type
CREATE TYPE order_type AS ENUM (
    'dine_in', 'takeout', 'delivery', 'bar', 'catering', 'online', 'kiosk'
);

-- Payment status
CREATE TYPE payment_status AS ENUM (
    'pending',        -- Payment initiated
    'authorized',     -- Card authorized, not yet captured
    'captured',       -- Card charged
    'settled',        -- Funds transferred (end of day batch)
    'declined',       -- Card declined
    'voided',         -- Authorization voided before capture
    'refunded',       -- Partial or full refund
    'failed'          -- Processing error
);

-- Payment method
CREATE TYPE payment_method AS ENUM (
    'cash', 'credit_card', 'debit_card', 'gift_card', 'house_account',
    'apple_pay', 'google_pay', 'external'  -- external = third-party app
);

-- Staff role levels
CREATE TYPE user_role AS ENUM (
    'platform_admin',  -- Our internal admin
    'owner',           -- Restaurant owner
    'admin',           -- Restaurant admin/GM
    'manager',         -- Shift manager
    'server',          -- Front of house
    'bartender',       -- Bar
    'host',            -- Host/hostess
    'kitchen',         -- Back of house
    'cashier',         -- Cashier-only access
    'kiosk',           -- Kiosk device account
    'readonly'         -- View-only (accountant, etc.)
);

-- Terminal type
CREATE TYPE terminal_type AS ENUM (
    'server_station', 'bar', 'host', 'cashier', 'kds', 'kiosk', 'customer_display'
);

-- Discount type
CREATE TYPE discount_type AS ENUM (
    'percentage', 'fixed_amount', 'bogo', 'free_item'
);

-- Comp reason
CREATE TYPE comp_reason AS ENUM (
    'manager_comp', 'quality_issue', 'service_issue', 'birthday',
    'vip', 'employee_meal', 'promotional', 'other'
);

-- Void reason
CREATE TYPE void_reason AS ENUM (
    'customer_request', 'kitchen_error', 'server_error', 'wrong_item',
    'quality_issue', '86d', 'duplicate', 'other'
);

-- Cash drawer event type
CREATE TYPE cash_drawer_event_type AS ENUM (
    'open_shift', 'close_shift', 'cash_sale', 'cash_refund',
    'paid_in', 'paid_out', 'tip_payout', 'no_sale', 'count'
);
