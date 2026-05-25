-- CRM-V7.3 Revenue attribution basics
-- One-way migration; rollback in supabase/_rollbacks/20260525192827_add_crm_campaign_attribution.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_attribution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  send_job_id uuid REFERENCES public.crm_campaign_send_jobs(id) ON DELETE SET NULL,
  send_id uuid REFERENCES public.crm_message_sends(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_at timestamptz NOT NULL DEFAULT now(),
  attribution_window text NOT NULL DEFAULT '7_day',
  attribution_window_days integer NOT NULL DEFAULT 7,
  baseline_segment text NOT NULL DEFAULT 'lapsed',
  revenue_amount numeric(12,2) NOT NULL DEFAULT 0,
  profit_estimate_amount numeric(12,2) NOT NULL DEFAULT 0,
  cost_amount numeric(12,2) NOT NULL DEFAULT 0,
  excluded_from_roi boolean NOT NULL DEFAULT false,
  exclusion_reason text,
  attribution_rule_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_attribution_events_type_check CHECK (event_type IN ('delivered', 'opened', 'clicked', 'redeemed', 'reservation', 'order', 'revenue', 'profit_estimate', 'unsubscribed', 'complained')),
  CONSTRAINT crm_attribution_events_window_check CHECK (attribution_window IN ('same_day', '7_day', '14_day', '30_day', '45_day', 'custom')),
  CONSTRAINT crm_attribution_events_window_days_check CHECK (attribution_window_days >= 0 AND attribution_window_days <= 365),
  CONSTRAINT crm_attribution_events_baseline_check CHECK (baseline_segment IN ('would_have_visited', 'lapsed', 'first_time', 'high_risk', 'offer_sensitive', 'unknown')),
  CONSTRAINT crm_attribution_events_amounts_check CHECK (revenue_amount >= 0 AND profit_estimate_amount >= 0 AND cost_amount >= 0),
  CONSTRAINT crm_attribution_events_exclusion_reason_check CHECK (
    (excluded_from_roi = false AND exclusion_reason IS NULL)
    OR (excluded_from_roi = true AND exclusion_reason IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.crm_campaign_revenue_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  send_job_id uuid REFERENCES public.crm_campaign_send_jobs(id) ON DELETE SET NULL,
  attribution_window text NOT NULL DEFAULT '7_day',
  attribution_window_days integer NOT NULL DEFAULT 7,
  baseline_segment text NOT NULL DEFAULT 'lapsed',
  delivered_count integer NOT NULL DEFAULT 0,
  opened_count integer NOT NULL DEFAULT 0,
  clicked_count integer NOT NULL DEFAULT 0,
  redeemed_count integer NOT NULL DEFAULT 0,
  reservation_count integer NOT NULL DEFAULT 0,
  order_count integer NOT NULL DEFAULT 0,
  unsubscribe_count integer NOT NULL DEFAULT 0,
  complaint_count integer NOT NULL DEFAULT 0,
  attributed_revenue numeric(12,2) NOT NULL DEFAULT 0,
  attributed_profit_estimate numeric(12,2) NOT NULL DEFAULT 0,
  attributed_cost numeric(12,2) NOT NULL DEFAULT 0,
  excluded_guest_count integer NOT NULL DEFAULT 0,
  excluded_revenue numeric(12,2) NOT NULL DEFAULT 0,
  roi_ratio numeric(12,4),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_campaign_revenue_attr_window_check CHECK (attribution_window IN ('same_day', '7_day', '14_day', '30_day', '45_day', 'custom')),
  CONSTRAINT crm_campaign_revenue_attr_window_days_check CHECK (attribution_window_days >= 0 AND attribution_window_days <= 365),
  CONSTRAINT crm_campaign_revenue_attr_baseline_check CHECK (baseline_segment IN ('would_have_visited', 'lapsed', 'first_time', 'high_risk', 'offer_sensitive', 'unknown')),
  CONSTRAINT crm_campaign_revenue_attr_counts_check CHECK (
    delivered_count >= 0 AND opened_count >= 0 AND clicked_count >= 0 AND redeemed_count >= 0
    AND reservation_count >= 0 AND order_count >= 0 AND unsubscribe_count >= 0 AND complaint_count >= 0
    AND excluded_guest_count >= 0
  ),
  CONSTRAINT crm_campaign_revenue_attr_amounts_check CHECK (
    attributed_revenue >= 0 AND attributed_profit_estimate >= 0 AND attributed_cost >= 0 AND excluded_revenue >= 0
  ),
  CONSTRAINT crm_campaign_revenue_attr_unique UNIQUE (campaign_id, send_job_id, attribution_window, attribution_window_days, baseline_segment)
);

CREATE INDEX IF NOT EXISTS crm_attribution_events_campaign_idx ON public.crm_attribution_events(org_id, campaign_id, event_at DESC);
CREATE INDEX IF NOT EXISTS crm_attribution_events_guest_idx ON public.crm_attribution_events(org_id, guest_id, event_at DESC) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_attribution_events_order_idx ON public.crm_attribution_events(org_id, order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_attribution_events_roi_idx ON public.crm_attribution_events(org_id, campaign_id, excluded_from_roi, attribution_window);
CREATE INDEX IF NOT EXISTS crm_campaign_revenue_attr_campaign_idx ON public.crm_campaign_revenue_attribution(org_id, campaign_id, calculated_at DESC);

ALTER TABLE public.crm_attribution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_campaign_revenue_attribution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_crm_attribution_events" ON public.crm_attribution_events
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_attribution_events" ON public.crm_attribution_events
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_attribution_events" ON public.crm_attribution_events
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_attribution_events" ON public.crm_attribution_events
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_attribution_events" ON public.crm_attribution_events
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_campaign_revenue_attribution" ON public.crm_campaign_revenue_attribution
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_campaign_revenue_attribution" ON public.crm_campaign_revenue_attribution
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_campaign_revenue_attribution" ON public.crm_campaign_revenue_attribution
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_campaign_revenue_attribution" ON public.crm_campaign_revenue_attribution
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_campaign_revenue_attribution" ON public.crm_campaign_revenue_attribution
  TO service_role USING (true) WITH CHECK (true);

COMMIT;
