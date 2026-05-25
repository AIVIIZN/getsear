-- CRM-V7.1 Campaign wizard
-- One-way migration; rollback in supabase/_rollbacks/20260525183000_add_crm_campaign_wizard.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  segment_id uuid REFERENCES public.crm_segments(id) ON DELETE SET NULL,
  created_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  campaign_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  goal text NOT NULL,
  offer text,
  tone text NOT NULL DEFAULT 'warm',
  brand_voice text NOT NULL DEFAULT 'hospitality',
  primary_channel text NOT NULL,
  secondary_channels text[] NOT NULL DEFAULT '{}',
  subject text,
  preheader text,
  message_body text NOT NULL,
  sms_body text,
  mobile_body text,
  receipt_body text,
  scheduled_for timestamptz,
  audience_count integer NOT NULL DEFAULT 0,
  reachability jsonb NOT NULL DEFAULT '{}'::jsonb,
  preview jsonb NOT NULL DEFAULT '{}'::jsonb,
  compliance_checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT crm_campaigns_type_check CHECK (campaign_type IN ('email', 'sms', 'push', 'guest_portal', 'receipt', 'qr', 'reservation_follow_up', 'review_request', 'win_back', 'birthday', 'anniversary', 'event_invite', 'menu_announcement', 'vip_invite', 'recovery')),
  CONSTRAINT crm_campaigns_status_check CHECK (status IN ('draft', 'ready', 'scheduled', 'sending', 'sent', 'paused', 'archived')),
  CONSTRAINT crm_campaigns_primary_channel_check CHECK (primary_channel IN ('email', 'sms', 'push', 'guest_portal', 'receipt', 'qr')),
  CONSTRAINT crm_campaigns_audience_count_check CHECK (audience_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.crm_campaign_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  variant_key text NOT NULL,
  name text NOT NULL,
  subject text,
  message_body text NOT NULL,
  sms_body text,
  weight integer NOT NULL DEFAULT 100,
  preview jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_campaign_variants_weight_check CHECK (weight BETWEEN 0 AND 100),
  CONSTRAINT crm_campaign_variants_unique_key UNIQUE (campaign_id, variant_key)
);

CREATE TABLE IF NOT EXISTS public.crm_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  template_type text NOT NULL,
  channel text NOT NULL,
  subject text,
  body text NOT NULL,
  tone text NOT NULL DEFAULT 'warm',
  is_system boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_message_templates_type_check CHECK (template_type IN ('win_back', 'birthday', 'anniversary', 'event_invite', 'menu_announcement', 'vip_invite', 'recovery', 'review_request', 'reservation_follow_up')),
  CONSTRAINT crm_message_templates_channel_check CHECK (channel IN ('email', 'sms', 'push', 'guest_portal', 'receipt', 'qr'))
);

CREATE INDEX IF NOT EXISTS crm_campaigns_org_status_idx ON public.crm_campaigns(org_id, status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_campaigns_segment_idx ON public.crm_campaigns(org_id, segment_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_campaign_variants_campaign_idx ON public.crm_campaign_variants(org_id, campaign_id);
CREATE INDEX IF NOT EXISTS crm_message_templates_org_type_idx ON public.crm_message_templates(org_id, template_type, channel);

ALTER TABLE public.crm_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_campaign_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_crm_campaigns" ON public.crm_campaigns
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_campaigns" ON public.crm_campaigns
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_campaigns" ON public.crm_campaigns
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_campaigns" ON public.crm_campaigns
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_campaigns" ON public.crm_campaigns
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_campaign_variants" ON public.crm_campaign_variants
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_campaign_variants" ON public.crm_campaign_variants
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_campaign_variants" ON public.crm_campaign_variants
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_campaign_variants" ON public.crm_campaign_variants
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_campaign_variants" ON public.crm_campaign_variants
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_message_templates" ON public.crm_message_templates
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_message_templates" ON public.crm_message_templates
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_message_templates" ON public.crm_message_templates
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_message_templates" ON public.crm_message_templates
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_message_templates" ON public.crm_message_templates
  TO service_role USING (true) WITH CHECK (true);

COMMIT;
