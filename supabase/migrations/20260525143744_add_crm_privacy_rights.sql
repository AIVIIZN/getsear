-- 20260525143744_add_crm_privacy_rights.sql
-- Task: CRM-V3.2 - Privacy rights workflows
-- One-way migration; rollback in supabase/_rollbacks/20260525143744_add_crm_privacy_rights.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('export', 'delete', 'correct', 'do_not_contact', 'opt_out_sale_sharing', 'limit_sensitive_use')),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'needs_verification', 'approved', 'in_progress', 'completed', 'rejected', 'cancelled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  requested_by_name text NOT NULL,
  requested_by_contact text NOT NULL,
  details text,
  verification_status text NOT NULL DEFAULT 'staff_verified' CHECK (verification_status IN ('pending', 'staff_verified', 'failed')),
  due_at timestamptz,
  approved_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  completed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  decision_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS privacy_requests_org_guest_idx ON public.privacy_requests(org_id, guest_id);
CREATE INDEX IF NOT EXISTS privacy_requests_status_idx ON public.privacy_requests(org_id, status, due_at NULLS LAST);
CREATE INDEX IF NOT EXISTS privacy_requests_type_idx ON public.privacy_requests(org_id, request_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.data_export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  privacy_request_id uuid NOT NULL REFERENCES public.privacy_requests(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'expired')),
  export_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  storage_path text,
  generated_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  generated_at timestamptz,
  expires_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS data_export_jobs_request_idx ON public.data_export_jobs(org_id, privacy_request_id);
CREATE INDEX IF NOT EXISTS data_export_jobs_guest_idx ON public.data_export_jobs(org_id, guest_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.data_deletion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  privacy_request_id uuid NOT NULL REFERENCES public.privacy_requests(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  anonymization_report jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS data_deletion_jobs_request_idx ON public.data_deletion_jobs(org_id, privacy_request_id);
CREATE INDEX IF NOT EXISTS data_deletion_jobs_guest_idx ON public.data_deletion_jobs(org_id, guest_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.data_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  privacy_request_id uuid REFERENCES public.privacy_requests(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  access_type text NOT NULL CHECK (access_type IN ('request_created', 'request_approved', 'request_started', 'export_generated', 'guest_anonymized', 'suppression_applied', 'request_rejected', 'request_cancelled')),
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS data_access_logs_request_idx ON public.data_access_logs(org_id, privacy_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS data_access_logs_guest_idx ON public.data_access_logs(org_id, guest_id, created_at DESC);

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_deletion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.privacy_requests
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.privacy_requests
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.privacy_requests
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.privacy_requests
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.data_export_jobs
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.data_export_jobs
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.data_export_jobs
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.data_export_jobs
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.data_deletion_jobs
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.data_deletion_jobs
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.data_deletion_jobs
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.data_deletion_jobs
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.data_access_logs
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.data_access_logs
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.data_access_logs
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.data_access_logs
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

COMMIT;
