-- ============================================================
-- 008_table_floor_tables.sql
-- Creates: floor_plans, tables
-- Also adds FK from orders.table_id to tables
-- ============================================================

-- Floor plans: visual layout sections for a location
CREATE TABLE floor_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),

    name text NOT NULL,                  -- "Main Dining", "Patio", "Bar Area"
    sort_order int NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,

    -- Canvas dimensions for the visual editor
    canvas_width int NOT NULL DEFAULT 1200,
    canvas_height int NOT NULL DEFAULT 800,
    background_image_url text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE floor_plans IS 'Floor plan sections (Main Dining, Patio, Bar Area) with canvas dimensions for visual editor';

-- Tables: individual tables on a floor plan
CREATE TABLE tables (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    floor_plan_id uuid NOT NULL REFERENCES floor_plans(id),

    name text NOT NULL,                  -- "T1", "B3", "P12"
    capacity int NOT NULL DEFAULT 4,
    shape text NOT NULL DEFAULT 'rectangle', -- 'rectangle', 'circle', 'square'

    -- Position on floor plan canvas
    pos_x int NOT NULL DEFAULT 0,
    pos_y int NOT NULL DEFAULT 0,
    width int NOT NULL DEFAULT 80,
    height int NOT NULL DEFAULT 80,
    rotation int NOT NULL DEFAULT 0,     -- Degrees

    -- Current state (denormalized for fast floor plan rendering)
    status text NOT NULL DEFAULT 'available',
    -- 'available', 'seated', 'ordered', 'served', 'check_presented', 'dirty'
    current_order_id uuid,
    current_server_id uuid REFERENCES users(id),
    seated_at timestamptz,

    is_active boolean NOT NULL DEFAULT true,
    sort_order int NOT NULL DEFAULT 0,

    -- Section assignment (for server sections)
    section text,                        -- "A", "B", "Patio", "Bar"

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE tables IS 'Physical tables on floor plans. Status is denormalized for fast rendering.';
COMMENT ON COLUMN tables.status IS 'Current table state: available, seated, ordered, served, check_presented, dirty';
COMMENT ON COLUMN tables.section IS 'Server section assignment (e.g. "A", "Patio", "Bar")';

-- Now add the deferred FK from orders to tables
ALTER TABLE orders
    ADD CONSTRAINT fk_orders_table FOREIGN KEY (table_id) REFERENCES tables(id);
