-- ============================================================
-- 019_mod_marketing.sql
-- Module: mod.marketing (depends on mod.loyalty)
-- Creates: campaigns, campaign_recipients
-- ============================================================

-- Marketing campaigns
CREATE TABLE campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),

    name text NOT NULL,
    campaign_type text NOT NULL,         -- 'email', 'sms', 'push', 'email_sms'
    status text NOT NULL DEFAULT 'draft',
    -- 'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'

    subject text,                        -- Email subject
    body_html text,                      -- Email body
    sms_body text,                       -- SMS body

    -- Targeting
    target_segment jsonb NOT NULL,       -- Filter criteria
    -- { "min_visits": 5, "last_visit_within_days": 30, "tags": ["vip"] }
    target_count int,                    -- Estimated recipients

    -- Scheduling
    scheduled_for timestamptz,
    sent_at timestamptz,

    -- Stats
    recipients_count int DEFAULT 0,
    opened_count int DEFAULT 0,
    clicked_count int DEFAULT 0,
    redeemed_count int DEFAULT 0,

    -- Attached offer
    discount_id uuid REFERENCES discounts(id),

    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE campaigns IS 'Marketing campaigns (email, SMS, push) with targeting, scheduling, and stats';
COMMENT ON COLUMN campaigns.target_segment IS 'Filter criteria: min_visits, last_visit_within_days, tags, loyalty_tier, etc.';

-- Campaign recipient tracking
CREATE TABLE campaign_recipients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES organizations(id),
    campaign_id uuid NOT NULL REFERENCES campaigns(id),
    customer_id uuid NOT NULL REFERENCES customers(id),

    channel text NOT NULL,               -- 'email', 'sms'
    status text NOT NULL DEFAULT 'pending',
    -- 'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed'

    sent_at timestamptz,
    opened_at timestamptz,
    clicked_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE campaign_recipients IS 'Per-recipient delivery and engagement tracking for campaigns';
