-- ============================================================
-- 012_audit_log.sql
-- Creates: audit_log
-- Note: In production, consider partitioning by month for performance.
--       Supabase supports declarative partitioning or archive old entries.
-- ============================================================

-- Audit log: tracks all significant actions in the system
CREATE TABLE audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid REFERENCES locations(id),

    -- Who
    user_id uuid REFERENCES users(id),
    user_name text,                      -- Denormalized for readability
    user_role user_role,

    -- What
    action text NOT NULL,                -- 'order.void', 'menu.price_change', 'user.login', etc.
    entity_type text NOT NULL,           -- 'order', 'payment', 'menu_item', 'user'
    entity_id uuid,

    -- Details
    description text NOT NULL,
    previous_state jsonb,                -- Before the change
    new_state jsonb,                     -- After the change

    -- Context
    ip_address inet,
    user_agent text,
    terminal_id uuid,

    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE audit_log IS 'Immutable audit trail of all significant system actions. Consider partitioning by month.';
COMMENT ON COLUMN audit_log.user_name IS 'Denormalized user name for readability without joins';
COMMENT ON COLUMN audit_log.action IS 'Dot-notation action: order.void, menu.price_change, user.login, etc.';
COMMENT ON COLUMN audit_log.entity_type IS 'Table/entity type: order, payment, menu_item, user, etc.';
