-- ============================================================
-- 011_gift_card_tables.sql
-- Creates: gift_cards, gift_card_transactions
-- Also adds FK from payments.gift_card_id to gift_cards
-- ============================================================

-- Gift cards
CREATE TABLE gift_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    card_number text NOT NULL,           -- Unique card number (masked in API responses)
    card_number_hash text NOT NULL,      -- For lookups
    pin_hash text,                       -- Optional PIN

    initial_balance numeric(10, 2) NOT NULL,
    current_balance numeric(10, 2) NOT NULL,

    -- Purchaser
    purchased_by_customer_id uuid REFERENCES customers(id),
    purchased_at timestamptz NOT NULL DEFAULT now(),
    purchase_order_id uuid REFERENCES orders(id),

    -- Recipient
    recipient_name text,
    recipient_email text,
    recipient_phone text,
    message text,

    -- Status
    is_active boolean NOT NULL DEFAULT true,
    expires_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE gift_cards IS 'Gift card records. Card numbers are hashed for lookup; raw numbers masked in API.';
COMMENT ON COLUMN gift_cards.card_number_hash IS 'Hashed card number for secure lookups';

-- Gift card transaction history
CREATE TABLE gift_card_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    gift_card_id uuid NOT NULL REFERENCES gift_cards(id),

    transaction_type text NOT NULL,      -- 'purchase', 'reload', 'redeem', 'refund', 'adjustment'
    amount numeric(10, 2) NOT NULL,      -- Positive for loads, negative for redemptions
    balance_after numeric(10, 2) NOT NULL,

    order_id uuid REFERENCES orders(id),
    payment_id uuid REFERENCES payments(id),

    performed_by uuid REFERENCES users(id),
    notes text,

    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE gift_card_transactions IS 'Gift card balance change history: purchases, reloads, redemptions, refunds';

-- Now add the deferred FK from payments to gift_cards
ALTER TABLE payments
    ADD CONSTRAINT fk_payments_gift_card FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id);
