-- ============================================================
-- 017_mod_reservations.sql
-- Module: mod.reservations
-- Creates: reservations, waitlist_entries
-- ============================================================

-- Reservations
CREATE TABLE reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),

    customer_id uuid REFERENCES customers(id),
    guest_name text NOT NULL,
    guest_phone text,
    guest_email text,
    party_size int NOT NULL,

    reservation_date date NOT NULL,
    reservation_time time NOT NULL,
    duration_minutes int DEFAULT 90,

    table_id uuid REFERENCES tables(id),

    status text NOT NULL DEFAULT 'confirmed',
    -- 'pending', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled'

    notes text,
    special_requests text,

    confirmation_sent_at timestamptz,
    reminder_sent_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE reservations IS 'Guest reservations with confirmation/reminder tracking';

-- Waitlist
CREATE TABLE waitlist_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),

    guest_name text NOT NULL,
    guest_phone text,
    party_size int NOT NULL,

    quoted_wait_minutes int,
    position int NOT NULL,

    status text NOT NULL DEFAULT 'waiting',
    -- 'waiting', 'notified', 'seated', 'cancelled', 'no_show'

    notified_at timestamptz,
    seated_at timestamptz,
    table_id uuid REFERENCES tables(id),

    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE waitlist_entries IS 'Walk-in waitlist with position tracking and SMS notification';
