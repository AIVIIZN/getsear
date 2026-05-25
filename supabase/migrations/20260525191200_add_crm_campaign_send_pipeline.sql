-- CRM-V7.2 Compliance and send pipeline
-- One-way migration; rollback in supabase/_rollbacks/20260525191200_add_crm_campaign_send_pipeline.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_campaign_send_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  segment_id uuid REFERENCES public.crm_segments(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  requested_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  approved_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'scheduled',
  approval_status text NOT NULL DEFAULT 'approved',
  scheduled_for timestamptz,
  throttle_per_minute integer NOT NULL DEFAULT 60,
  holdout_percent numeric(5,2) NOT NULL DEFAULT 0,
  audience_count integer NOT NULL DEFAULT 0,
  queued_count integer NOT NULL DEFAULT 0,
  holdout_count integer NOT NULL DEFAULT 0,
  compliance_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_campaign_send_jobs_status_check CHECK (status IN ('pending_approval', 'scheduled', 'queued', 'sending', 'completed', 'blocked', 'failed', 'cancelled')),
  CONSTRAINT crm_campaign_send_jobs_approval_check CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT crm_campaign_send_jobs_throttle_check CHECK (throttle_per_minute BETWEEN 1 AND 10000),
  CONSTRAINT crm_campaign_send_jobs_holdout_check CHECK (holdout_percent >= 0 AND holdout_percent <= 50),
  CONSTRAINT crm_campaign_send_jobs_counts_check CHECK (audience_count >= 0 AND queued_count >= 0 AND holdout_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.crm_message_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  send_job_id uuid REFERENCES public.crm_campaign_send_jobs(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.crm_campaign_variants(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  is_test boolean NOT NULL DEFAULT false,
  recipient_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  compliance_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  subject text,
  body_preview text,
  provider text,
  provider_message_id text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_message_sends_channel_check CHECK (channel IN ('email', 'sms', 'push', 'receipt')),
  CONSTRAINT crm_message_sends_status_check CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'suppressed', 'blocked', 'test_sent', 'holdout'))
);

CREATE TABLE IF NOT EXISTS public.crm_message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  send_job_id uuid REFERENCES public.crm_campaign_send_jobs(id) ON DELETE SET NULL,
  send_id uuid REFERENCES public.crm_message_sends(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_message_events_type_check CHECK (event_type IN ('queued', 'scheduled', 'sent', 'delivered', 'opened', 'clicked', 'redeemed', 'unsubscribed', 'complained', 'bounced', 'failed', 'blocked', 'test_sent', 'holdout'))
);

CREATE INDEX IF NOT EXISTS crm_campaign_send_jobs_org_status_idx ON public.crm_campaign_send_jobs(org_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS crm_campaign_send_jobs_campaign_idx ON public.crm_campaign_send_jobs(org_id, campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_message_sends_campaign_idx ON public.crm_message_sends(org_id, campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_message_sends_job_status_idx ON public.crm_message_sends(org_id, send_job_id, status);
CREATE INDEX IF NOT EXISTS crm_message_sends_guest_idx ON public.crm_message_sends(org_id, guest_id, created_at DESC) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_message_events_campaign_type_idx ON public.crm_message_events(org_id, campaign_id, event_type, event_at DESC);
CREATE INDEX IF NOT EXISTS crm_message_events_send_idx ON public.crm_message_events(org_id, send_id, event_at DESC) WHERE send_id IS NOT NULL;

ALTER TABLE public.crm_campaign_send_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_message_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_message_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_crm_campaign_send_jobs" ON public.crm_campaign_send_jobs
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_campaign_send_jobs" ON public.crm_campaign_send_jobs
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_campaign_send_jobs" ON public.crm_campaign_send_jobs
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_campaign_send_jobs" ON public.crm_campaign_send_jobs
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_campaign_send_jobs" ON public.crm_campaign_send_jobs
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_message_sends" ON public.crm_message_sends
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_message_sends" ON public.crm_message_sends
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_message_sends" ON public.crm_message_sends
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_message_sends" ON public.crm_message_sends
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_message_sends" ON public.crm_message_sends
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_message_events" ON public.crm_message_events
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_message_events" ON public.crm_message_events
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_message_events" ON public.crm_message_events
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_message_events" ON public.crm_message_events
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_message_events" ON public.crm_message_events
  TO service_role USING (true) WITH CHECK (true);

COMMIT;
