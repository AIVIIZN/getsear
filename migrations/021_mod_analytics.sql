-- ============================================================
-- 021_mod_analytics.sql
-- Module: mod.analytics
-- Creates: daily_metrics, daily_item_metrics
-- Pre-aggregated tables for fast dashboard queries
-- ============================================================

-- Pre-aggregated daily metrics for fast dashboard queries
CREATE TABLE daily_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    metric_date date NOT NULL,

    -- Sales
    total_revenue numeric(12, 2) DEFAULT 0,
    net_revenue numeric(12, 2) DEFAULT 0,     -- After discounts/comps/voids
    order_count int DEFAULT 0,
    average_check numeric(10, 2) DEFAULT 0,
    covers int DEFAULT 0,                      -- Guest count
    revenue_per_cover numeric(10, 2) DEFAULT 0,

    -- By type
    dine_in_revenue numeric(12, 2) DEFAULT 0,
    takeout_revenue numeric(12, 2) DEFAULT 0,
    delivery_revenue numeric(12, 2) DEFAULT 0,
    online_revenue numeric(12, 2) DEFAULT 0,

    -- Payment mix
    cash_total numeric(12, 2) DEFAULT 0,
    card_total numeric(12, 2) DEFAULT 0,
    gift_card_total numeric(12, 2) DEFAULT 0,

    -- Labor
    labor_cost numeric(12, 2) DEFAULT 0,
    labor_hours numeric(8, 2) DEFAULT 0,
    labor_percentage numeric(5, 2) DEFAULT 0,

    -- Food cost
    food_cost numeric(12, 2) DEFAULT 0,
    food_cost_percentage numeric(5, 2) DEFAULT 0,

    -- Discounts/comps/voids
    discount_total numeric(12, 2) DEFAULT 0,
    comp_total numeric(12, 2) DEFAULT 0,
    void_total numeric(12, 2) DEFAULT 0,
    refund_total numeric(12, 2) DEFAULT 0,

    -- Tips
    tip_total numeric(12, 2) DEFAULT 0,

    -- Timing
    avg_ticket_time_seconds int DEFAULT 0,
    avg_table_turn_minutes int DEFAULT 0,

    -- Hourly breakdown (for heatmap)
    hourly_revenue jsonb DEFAULT '{}',    -- {"10": 450.00, "11": 1200.00, ...}
    hourly_covers jsonb DEFAULT '{}',

    calculated_at timestamptz DEFAULT now(),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE(location_id, metric_date)
);

COMMENT ON TABLE daily_metrics IS 'Pre-aggregated daily metrics per location for fast dashboard rendering';
COMMENT ON COLUMN daily_metrics.hourly_revenue IS 'Revenue by hour for heatmap visualization, e.g. {"10":450.00, "11":1200.00}';

-- Product mix report data
CREATE TABLE daily_item_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    location_id uuid NOT NULL REFERENCES locations(id),
    metric_date date NOT NULL,
    menu_item_id uuid NOT NULL REFERENCES menu_items(id),

    quantity_sold int DEFAULT 0,
    gross_revenue numeric(10, 2) DEFAULT 0,
    food_cost numeric(10, 2) DEFAULT 0,
    margin_percentage numeric(5, 2) DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE(location_id, metric_date, menu_item_id)
);

COMMENT ON TABLE daily_item_metrics IS 'Per-item daily sales metrics for product mix analysis and menu engineering';
