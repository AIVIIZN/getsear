-- ============================================================
-- 020_mod_delivery.sql
-- Module: mod.delivery
-- Creates: delivery_zones (with GeoJSON), deliveries
-- ============================================================

-- Delivery zones: geographic areas with fees and time estimates
CREATE TABLE delivery_zones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),

    name text NOT NULL,
    -- GeoJSON polygon defining the zone boundary
    zone_polygon jsonb NOT NULL,
    delivery_fee numeric(10, 2) NOT NULL DEFAULT 0,
    min_order_amount numeric(10, 2),
    estimated_minutes int DEFAULT 30,
    is_active boolean DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE delivery_zones IS 'Geographic delivery zones defined by GeoJSON polygons';
COMMENT ON COLUMN delivery_zones.zone_polygon IS 'GeoJSON polygon defining the delivery zone boundary';

-- Deliveries: individual delivery assignments and tracking
CREATE TABLE deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    order_id uuid NOT NULL REFERENCES orders(id),

    driver_id uuid REFERENCES users(id),

    pickup_time timestamptz,
    delivery_time timestamptz,
    estimated_delivery_at timestamptz,
    actual_delivery_at timestamptz,

    status text NOT NULL DEFAULT 'pending',
    -- 'pending', 'assigned', 'picked_up', 'en_route', 'delivered', 'failed'

    delivery_address jsonb NOT NULL,
    delivery_instructions text,
    delivery_fee numeric(10, 2) NOT NULL DEFAULT 0,
    driver_tip numeric(10, 2) DEFAULT 0,

    -- Tracking
    driver_lat numeric(10, 7),
    driver_lng numeric(10, 7),
    last_location_at timestamptz,

    proof_of_delivery_url text,          -- Photo
    signature_url text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE deliveries IS 'Delivery assignments with driver tracking, proof of delivery, and signatures';
