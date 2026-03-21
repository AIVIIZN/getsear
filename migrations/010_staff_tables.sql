-- ============================================================
-- 010_staff_tables.sql
-- Creates: shifts, time_entries, break_entries, cash_drawers,
--          cash_drawer_events, tip_distributions, cash_tip_reports
-- ============================================================

-- Shifts: defined shift periods (Lunch, Dinner, etc.)
CREATE TABLE shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),

    -- Shift definition
    name text,                           -- "Lunch", "Dinner", "All Day"
    shift_date date NOT NULL,
    start_time timestamptz NOT NULL,
    end_time timestamptz,                -- NULL = still open

    -- Manager on duty
    manager_id uuid REFERENCES users(id),

    -- Summary (populated on close)
    total_sales numeric(12, 2),
    total_labor_cost numeric(10, 2),
    total_comps numeric(10, 2),
    total_voids numeric(10, 2),

    is_closed boolean NOT NULL DEFAULT false,
    closed_by uuid REFERENCES users(id),
    closed_at timestamptz,

    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE shifts IS 'Defined shift periods (Lunch, Dinner) with summary stats populated on close';

-- Time entries: individual clock-in/out records
CREATE TABLE time_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    user_id uuid NOT NULL REFERENCES users(id),
    shift_id uuid REFERENCES shifts(id),

    clock_in timestamptz NOT NULL,
    clock_out timestamptz,

    role_during_shift user_role,         -- Role worked (might differ from primary role)
    hourly_rate numeric(8, 2),           -- Rate during this shift

    -- Calculated
    regular_hours numeric(5, 2),
    overtime_hours numeric(5, 2),
    total_pay numeric(10, 2),

    -- Tips
    cash_tips numeric(10, 2) NOT NULL DEFAULT 0,
    credit_tips numeric(10, 2) NOT NULL DEFAULT 0,
    tip_out_given numeric(10, 2) NOT NULL DEFAULT 0,
    tip_out_received numeric(10, 2) NOT NULL DEFAULT 0,

    notes text,

    -- Approval
    is_approved boolean NOT NULL DEFAULT false,
    approved_by uuid REFERENCES users(id),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE time_entries IS 'Individual employee clock-in/out records with hours, pay, and tip tracking';

-- Break entries within a time entry
CREATE TABLE break_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    time_entry_id uuid NOT NULL REFERENCES time_entries(id),

    break_type text NOT NULL DEFAULT 'unpaid', -- 'paid', 'unpaid'
    start_time timestamptz NOT NULL,
    end_time timestamptz,
    duration_minutes int,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE break_entries IS 'Break periods within a time entry (paid or unpaid)';

-- Cash drawers
CREATE TABLE cash_drawers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    terminal_id uuid REFERENCES terminals(id),

    name text NOT NULL DEFAULT 'Main Drawer',

    -- Current state
    is_open boolean NOT NULL DEFAULT false,
    opened_by uuid REFERENCES users(id),
    opened_at timestamptz,

    starting_cash numeric(10, 2),
    current_cash numeric(10, 2),

    -- Close-out
    expected_cash numeric(10, 2),
    actual_cash numeric(10, 2),
    over_short numeric(10, 2),
    closed_by uuid REFERENCES users(id),
    closed_at timestamptz,

    notes text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cash_drawers IS 'Cash drawer sessions with open/close tracking and over/short calculation';

-- Cash drawer events: every transaction affecting the drawer
CREATE TABLE cash_drawer_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    cash_drawer_id uuid NOT NULL REFERENCES cash_drawers(id),

    event_type cash_drawer_event_type NOT NULL,
    amount numeric(10, 2) NOT NULL,
    running_total numeric(10, 2) NOT NULL,

    -- Context
    order_id uuid REFERENCES orders(id),
    payment_id uuid REFERENCES payments(id),
    description text,

    performed_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cash_drawer_events IS 'Ledger of all cash drawer activity: sales, refunds, paid-in/out, counts';

-- Tip distributions: tracks how tips are distributed to staff
CREATE TABLE tip_distributions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    shift_date date NOT NULL,

    -- Source transaction
    transaction_id uuid REFERENCES payment_transactions(id),
    order_id uuid REFERENCES orders(id),

    -- Tip info
    tip_amount_cents integer NOT NULL,
    tip_type text NOT NULL,               -- 'credit_card', 'cash_reported', 'auto_gratuity'

    -- Distribution
    staff_id uuid NOT NULL REFERENCES users(id),
    distribution_method text NOT NULL,     -- 'direct', 'pool', 'tipout'
    amount_cents integer NOT NULL,         -- Amount this staff member receives

    -- For tipout tracking
    tipout_from_staff_id uuid REFERENCES users(id),
    tipout_percentage decimal(5, 2),

    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tip_distributions IS 'Per-employee tip distribution records for payroll and tax reporting';
COMMENT ON COLUMN tip_distributions.tip_type IS 'Source: credit_card, cash_reported, or auto_gratuity (treated as wages)';

-- Cash tip self-reporting by employees
CREATE TABLE cash_tip_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    staff_id uuid NOT NULL REFERENCES users(id),
    shift_date date NOT NULL,
    reported_amount_cents integer NOT NULL,
    reported_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(org_id, staff_id, shift_date)
);

COMMENT ON TABLE cash_tip_reports IS 'Employee self-reported cash tips per shift (required for tax compliance)';
