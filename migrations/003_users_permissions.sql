-- ============================================================
-- 003_users_permissions.sql
-- Creates: users, permissions, role_permissions, user_permission_overrides
-- Also adds current_user_id FK to terminals
-- ============================================================

-- Users: staff members linked to Supabase Auth
CREATE TABLE users (
    id uuid PRIMARY KEY,                 -- Matches Supabase Auth user ID
    org_id uuid NOT NULL REFERENCES organizations(id),

    -- Profile
    email text,
    phone text,
    first_name text NOT NULL,
    last_name text NOT NULL,
    display_name text,                   -- What shows on receipts/orders
    avatar_url text,

    -- POS-specific
    pin_hash text,                       -- 4-6 digit PIN for quick clock-in / POS login
    role user_role NOT NULL DEFAULT 'server',

    -- Which locations this user can access
    location_ids uuid[] NOT NULL DEFAULT '{}',

    -- Employment
    hire_date date,
    hourly_rate numeric(8, 2),
    is_active boolean NOT NULL DEFAULT true,

    settings jsonb NOT NULL DEFAULT '{}',

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

COMMENT ON TABLE users IS 'Staff members. Primary key matches Supabase Auth user ID.';
COMMENT ON COLUMN users.pin_hash IS '4-6 digit hashed PIN for quick POS login and clock-in';
COMMENT ON COLUMN users.location_ids IS 'Array of location UUIDs this user can access';

-- Now add the FK from terminals to users
ALTER TABLE terminals
    ADD COLUMN current_user_id uuid REFERENCES users(id);

-- Granular permissions beyond role-based defaults
CREATE TABLE permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,           -- 'orders.void', 'reports.payroll', 'menu.edit'
    module_id text NOT NULL,             -- Which module defines this permission
    description text,
    category text,                       -- Grouping for settings UI
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE permissions IS 'Granular permission definitions, grouped by module and category';

-- Default permissions per role
CREATE TABLE role_permissions (
    role user_role NOT NULL,
    permission_id uuid NOT NULL REFERENCES permissions(id),
    PRIMARY KEY (role, permission_id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE role_permissions IS 'Default permission grants per user_role';

-- Per-user permission overrides (grant/deny beyond role defaults)
CREATE TABLE user_permission_overrides (
    user_id uuid NOT NULL REFERENCES users(id),
    permission_id uuid NOT NULL REFERENCES permissions(id),
    granted boolean NOT NULL,            -- true = explicitly grant, false = explicitly deny
    PRIMARY KEY (user_id, permission_id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_permission_overrides IS 'Per-user overrides: explicitly grant or deny permissions beyond role defaults';
