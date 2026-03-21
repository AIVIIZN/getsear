-- ============================================================
-- 013_mod_kds.sql
-- Module: mod.kds (Kitchen Display System)
-- Creates: kds_stations, kds_ticket_events
-- ============================================================

-- KDS stations: display screens for kitchen areas
CREATE TABLE kds_stations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),

    name text NOT NULL,                  -- "Grill", "Fryer", "Cold", "Bar", "Expo"
    station_type text NOT NULL,          -- 'prep', 'expo'
    prep_stations text[],               -- Which prep_station values route here
    terminal_id uuid REFERENCES terminals(id),  -- Assigned display device
    display_settings jsonb DEFAULT '{}', -- font_size, columns, sound, color_coding
    sort_order int DEFAULT 0,
    is_active boolean DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE kds_stations IS 'Kitchen Display System stations (Grill, Fryer, Cold, Bar, Expo)';
COMMENT ON COLUMN kds_stations.prep_stations IS 'Which prep_station values from menu_items route to this KDS';
COMMENT ON COLUMN kds_stations.display_settings IS 'Display config: font_size, columns, sound alerts, color coding rules';

-- KDS ticket events: lifecycle events for tickets on a station
CREATE TABLE kds_ticket_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    station_id uuid NOT NULL REFERENCES kds_stations(id),
    order_id uuid NOT NULL REFERENCES orders(id),
    order_item_id uuid REFERENCES order_items(id),

    event_type text NOT NULL,            -- 'received', 'started', 'bumped', 'recalled', 'all_day_updated'

    performed_by uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE kds_ticket_events IS 'KDS ticket lifecycle: received, started, bumped (done), recalled, all-day updates';
