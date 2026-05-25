-- 20260525225500_add_crm_health_data_quality.sql
-- Task: CRM-V12.3 - CRM Health and data quality
-- One-way migration; rollback in supabase/_rollbacks/20260525225500_add_crm_health_data_quality.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_data_quality_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'completed',
  run_source text NOT NULL DEFAULT 'manual',
  scanned_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  issue_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  impact_score numeric(10,2) NOT NULL DEFAULT 0,
  started_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_data_quality_runs_status_check CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  CONSTRAINT crm_data_quality_runs_source_check CHECK (run_source IN ('manual', 'scheduled', 'import', 'integration', 'api'))
);

CREATE TABLE IF NOT EXISTS public.crm_health_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.crm_data_quality_runs(id) ON DELETE SET NULL,
  issue_key text NOT NULL,
  issue_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  severity text NOT NULL DEFAULT 'medium',
  impact_score numeric(10,2) NOT NULL DEFAULT 0,
  affected_record_count integer NOT NULL DEFAULT 0 CHECK (affected_record_count >= 0),
  affected_table text,
  affected_record_ids uuid[] NOT NULL DEFAULT '{}',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  fix_strategy text NOT NULL DEFAULT 'review_required',
  fix_preview jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_suggestion jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  resolved_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  dismissed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  dismissed_at timestamptz,
  audit_log_id uuid REFERENCES public.audit_log(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_health_issues_type_check CHECK (issue_type IN ('duplicate_rate', 'no_contact', 'missing_consent', 'invalid_email', 'invalid_phone', 'unlinked_checks', 'unmatched_reservations', 'weak_identity', 'old_inactive_segment', 'broken_automation', 'failed_send')),
  CONSTRAINT crm_health_issues_status_check CHECK (status IN ('open', 'review_required', 'approved', 'resolved', 'dismissed')),
  CONSTRAINT crm_health_issues_severity_check CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  CONSTRAINT crm_health_issues_fix_strategy_check CHECK (fix_strategy IN ('review_required', 'merge_preview', 'consent_review', 'contact_cleanup', 'link_records', 'archive_or_repair', 'retry_or_suppress')),
  CONSTRAINT crm_health_issues_unique_open_key UNIQUE (org_id, issue_key)
);

CREATE INDEX IF NOT EXISTS crm_data_quality_runs_org_started_idx
  ON public.crm_data_quality_runs(org_id, started_at DESC);
CREATE INDEX IF NOT EXISTS crm_data_quality_runs_location_idx
  ON public.crm_data_quality_runs(org_id, location_id, started_at DESC)
  WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_health_issues_org_rank_idx
  ON public.crm_health_issues(org_id, status, impact_score DESC, severity, updated_at DESC);
CREATE INDEX IF NOT EXISTS crm_health_issues_type_idx
  ON public.crm_health_issues(org_id, issue_type, status);
CREATE INDEX IF NOT EXISTS crm_health_issues_run_idx
  ON public.crm_health_issues(org_id, run_id)
  WHERE run_id IS NOT NULL;

ALTER TABLE public.crm_data_quality_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_health_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_crm_data_quality_runs" ON public.crm_data_quality_runs
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_data_quality_runs" ON public.crm_data_quality_runs
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_data_quality_runs" ON public.crm_data_quality_runs
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_data_quality_runs" ON public.crm_data_quality_runs
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_data_quality_runs" ON public.crm_data_quality_runs
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_health_issues" ON public.crm_health_issues
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_health_issues" ON public.crm_health_issues
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_health_issues" ON public.crm_health_issues
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_health_issues" ON public.crm_health_issues
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_health_issues" ON public.crm_health_issues
  TO service_role USING (true) WITH CHECK (true);

COMMIT;
