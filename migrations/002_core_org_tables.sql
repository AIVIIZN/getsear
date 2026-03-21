-- ============================================================
-- 002_core_org_tables.sql
-- Creates: organizations, locations, terminals, org_modules, module_migrations
-- ============================================================

-- Organizations: top-level tenant (restaurant group or single restaurant)
CREATE TABLE organizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text UNIQUE NOT NULL,           -- URL-friendly identifier

    -- Subscription/billing
    plan text NOT NULL DEFAULT 'starter', -- starter, professional, enterprise
    subscription_status text NOT NULL DEFAULT 'trialing',
    trial_ends_at timestamptz,

    -- Branding
    logo_url text,
    primary_color text DEFAULT '#1a1a2e',

    -- Contact
    owner_name text,
    owner_email text,
    owner_phone text,

    -- Settings (org-wide defaults)
    settings jsonb NOT NULL DEFAULT '{}',
    -- settings contains: default_currency, default_timezone,
    -- receipt_header, receipt_footer, tip_percentages, etc.

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

COMMENT ON TABLE organizations IS 'Top-level tenant: a restaurant group or single restaurant';
COMMENT ON COLUMN organizations.settings IS 'Org-wide defaults: default_currency, default_timezone, receipt_header, receipt_footer, tip_percentages, etc.';

-- Locations: physical restaurant locations within an org
CREATE TABLE locations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    name text NOT NULL,                  -- "Downtown Location"
    slug text NOT NULL,                  -- "downtown"

    -- Address
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    zip text,
    country text DEFAULT 'US',
    latitude numeric(10, 7),
    longitude numeric(10, 7),

    -- Contact
    phone text,
    email text,

    -- Operations
    timezone text NOT NULL DEFAULT 'America/New_York',
    currency text NOT NULL DEFAULT 'USD',

    -- Business hours: JSONB array
    -- [{"day": "monday", "open": "11:00", "close": "22:00"}, ...]
    business_hours jsonb NOT NULL DEFAULT '[]',

    -- Location-specific settings (overrides org defaults)
    settings jsonb NOT NULL DEFAULT '{}',

    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,

    UNIQUE(org_id, slug)
);

COMMENT ON TABLE locations IS 'Physical restaurant locations within an organization';
COMMENT ON COLUMN locations.settings IS 'Location-specific overrides: auto_gratuity_pct, default_tax_rate_id, receipt_printer_ip, kitchen_printer_ip, order_number_prefix, etc.';
COMMENT ON COLUMN locations.business_hours IS 'JSON array of day/open/close objects, e.g. [{"day":"monday","open":"11:00","close":"22:00"}]';

-- Terminals: iPads, KDS screens, kiosks registered to a location
CREATE TABLE terminals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),

    name text NOT NULL,                  -- "Bar iPad 1"
    terminal_type terminal_type NOT NULL,
    device_id text,                      -- Browser fingerprint or assigned ID

    -- Current state
    is_online boolean NOT NULL DEFAULT false,
    last_heartbeat_at timestamptz,
    -- current_user_id added after users table exists (see 003)

    settings jsonb NOT NULL DEFAULT '{}',

    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE terminals IS 'Registered devices: iPads, KDS screens, kiosks, customer-facing displays';
COMMENT ON COLUMN terminals.settings IS 'Device config: assigned_sections, default_order_type, printer_ip, etc.';

-- Module management: which optional modules are enabled per org
CREATE TABLE org_modules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    module_id text NOT NULL,             -- 'mod.kds', 'mod.inventory', etc.
    is_enabled boolean NOT NULL DEFAULT true,
    enabled_at timestamptz NOT NULL DEFAULT now(),
    disabled_at timestamptz,

    -- Module-specific configuration
    config jsonb NOT NULL DEFAULT '{}',

    -- Which locations have this module (null = all locations)
    location_ids uuid[] DEFAULT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE(org_id, module_id)
);

COMMENT ON TABLE org_modules IS 'Tracks which optional modules (KDS, inventory, loyalty, etc.) are enabled per org';

-- Module migrations: tracks which module schema migrations have been applied per org
CREATE TABLE module_migrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    module_id text NOT NULL,
    migration_name text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(org_id, module_id, migration_name)
);

COMMENT ON TABLE module_migrations IS 'Tracks per-org module schema migrations that have been applied';
