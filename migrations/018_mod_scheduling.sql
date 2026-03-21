-- ============================================================
-- 018_mod_scheduling.sql
-- Module: mod.scheduling
-- Creates: schedule_templates, scheduled_shifts, shift_swap_requests, availability
-- ============================================================

-- Schedule templates: saved weekly schedule patterns
CREATE TABLE schedule_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),

    name text NOT NULL,                  -- "Default Week", "Holiday Week"
    is_active boolean DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE schedule_templates IS 'Saved weekly schedule patterns that can be applied to future weeks';

-- Scheduled shifts: individual shift assignments
CREATE TABLE scheduled_shifts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    template_id uuid REFERENCES schedule_templates(id),

    user_id uuid NOT NULL REFERENCES users(id),
    role user_role NOT NULL,

    shift_date date NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,

    status text NOT NULL DEFAULT 'scheduled',
    -- 'scheduled', 'confirmed', 'swap_requested', 'swapped', 'called_out', 'no_show'

    notes text,
    published_at timestamptz,            -- NULL = draft, not visible to staff

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE scheduled_shifts IS 'Individual shift assignments. Unpublished shifts are drafts not visible to staff.';

-- Shift swap requests
CREATE TABLE shift_swap_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    scheduled_shift_id uuid NOT NULL REFERENCES scheduled_shifts(id),
    requested_by uuid NOT NULL REFERENCES users(id),
    swap_with_user_id uuid REFERENCES users(id), -- NULL = open swap (anyone can take)

    status text NOT NULL DEFAULT 'pending',
    -- 'pending', 'approved', 'denied', 'taken'

    approved_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE shift_swap_requests IS 'Shift swap/drop requests with manager approval workflow';

-- Staff availability preferences
CREATE TABLE availability (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    user_id uuid NOT NULL REFERENCES users(id),

    day_of_week int NOT NULL,            -- 0=Sunday
    start_time time,
    end_time time,
    is_available boolean NOT NULL DEFAULT true,
    effective_date date,
    expiration_date date,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE availability IS 'Staff availability preferences by day of week, with optional date ranges';
