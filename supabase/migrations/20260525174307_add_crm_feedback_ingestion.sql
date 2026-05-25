-- 20260525174307_add_crm_feedback_ingestion.sql
-- Task: CRM-V9.1 - Feedback and review ingestion
-- One-way migration; rollback in supabase/_rollbacks/20260525174307_add_crm_feedback_ingestion.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  source_type text NOT NULL DEFAULT 'receipt_qr' CHECK (
    source_type IN ('receipt_qr', 'email', 'sms', 'reservation_follow_up', 'online_order_follow_up', 'manual', 'review_import')
  ),
  trigger_event text NOT NULL DEFAULT 'post_visit' CHECK (
    trigger_event IN ('post_visit', 'receipt', 'reservation_complete', 'online_order_complete', 'manager_manual', 'review_import')
  ),
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.crm_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  survey_id uuid REFERENCES public.crm_surveys(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  staff_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (
    source_type IN ('receipt_qr', 'email', 'sms', 'reservation_follow_up', 'online_order_follow_up', 'manual', 'review_import')
  ),
  rating integer CHECK (rating BETWEEN 1 AND 5),
  nps_score integer CHECK (nps_score BETWEEN 0 AND 10),
  sentiment text NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  topics text[] NOT NULL DEFAULT '{}' CHECK (
    topics <@ ARRAY['food', 'service', 'speed', 'cleanliness', 'pricing', 'reservation', 'delivery', 'staff_compliment']::text[]
  ),
  response_text text,
  contact_requested boolean NOT NULL DEFAULT false,
  submitted_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (length(trim(provider)) > 0),
  external_review_id text,
  reviewer_display_name text,
  rating numeric(2,1) CHECK (rating >= 0 AND rating <= 5),
  title text,
  body text,
  review_url text,
  published_at timestamptz,
  imported_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  sentiment text NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  topics text[] NOT NULL DEFAULT '{}' CHECK (
    topics <@ ARRAY['food', 'service', 'speed', 'cleanliness', 'pricing', 'reservation', 'delivery', 'staff_compliment']::text[]
  ),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, provider, external_review_id)
);

CREATE TABLE IF NOT EXISTS public.crm_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  staff_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  survey_response_id uuid REFERENCES public.crm_survey_responses(id) ON DELETE SET NULL,
  review_id uuid REFERENCES public.crm_reviews(id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (
    source_type IN ('survey_response', 'review', 'manual_entry', 'receipt_qr', 'email_sms', 'reservation_follow_up', 'online_order_follow_up')
  ),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'linked_to_recovery', 'dismissed')),
  recovery_status text NOT NULL DEFAULT 'needs_recovery' CHECK (recovery_status IN ('needs_recovery', 'routed', 'dismissed')),
  topics text[] NOT NULL DEFAULT '{}' CHECK (
    topics <@ ARRAY['food', 'service', 'speed', 'cleanliness', 'pricing', 'reservation', 'delivery', 'staff_compliment']::text[]
  ),
  issue_summary text NOT NULL CHECK (length(trim(issue_summary)) > 0),
  complaint_text text,
  routed_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_surveys_org_status_idx ON public.crm_surveys(org_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS crm_surveys_location_idx ON public.crm_surveys(org_id, location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_survey_responses_org_submitted_idx ON public.crm_survey_responses(org_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS crm_survey_responses_guest_idx ON public.crm_survey_responses(org_id, guest_id, submitted_at DESC) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_survey_responses_order_idx ON public.crm_survey_responses(org_id, order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_survey_responses_negative_idx ON public.crm_survey_responses(org_id, sentiment, submitted_at DESC) WHERE sentiment = 'negative';
CREATE INDEX IF NOT EXISTS crm_reviews_org_published_idx ON public.crm_reviews(org_id, published_at DESC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_reviews_guest_idx ON public.crm_reviews(org_id, guest_id, created_at DESC) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_reviews_negative_idx ON public.crm_reviews(org_id, sentiment, created_at DESC) WHERE sentiment = 'negative';
CREATE INDEX IF NOT EXISTS crm_complaints_org_status_idx ON public.crm_complaints(org_id, status, recovery_status, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_complaints_guest_idx ON public.crm_complaints(org_id, guest_id, created_at DESC) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_complaints_order_idx ON public.crm_complaints(org_id, order_id) WHERE order_id IS NOT NULL;

ALTER TABLE public.crm_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.crm_surveys
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_surveys
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_surveys
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_surveys
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_survey_responses
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_survey_responses
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_survey_responses
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_survey_responses
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_reviews
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_reviews
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_reviews
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_reviews
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_complaints
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_complaints
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_complaints
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_complaints
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

COMMIT;
