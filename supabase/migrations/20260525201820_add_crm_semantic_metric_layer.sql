-- CRM-V10.1 Semantic metric layer
-- One-way migration; rollback in supabase/_rollbacks/20260525201820_add_crm_semantic_metric_layer.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_metric_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL,
  formula text NOT NULL,
  value_type text NOT NULL,
  allowed_dimensions text[] NOT NULL DEFAULT '{}'::text[],
  default_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_tables text[] NOT NULL DEFAULT '{}'::text[],
  owner_role text NOT NULL DEFAULT 'owner',
  version integer NOT NULL DEFAULT 1,
  validation_status text NOT NULL DEFAULT 'validated',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT crm_metric_definitions_key_check CHECK (metric_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  CONSTRAINT crm_metric_definitions_value_type_check CHECK (value_type IN ('currency', 'number', 'percent', 'duration', 'count', 'score')),
  CONSTRAINT crm_metric_definitions_validation_status_check CHECK (validation_status IN ('draft', 'validated', 'deprecated')),
  CONSTRAINT crm_metric_definitions_unique_key UNIQUE (org_id, metric_key, version)
);

CREATE TABLE IF NOT EXISTS public.crm_dimension_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dimension_key text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL,
  source_table text NOT NULL,
  source_column text NOT NULL,
  value_type text NOT NULL,
  allowed_metrics text[] NOT NULL DEFAULT '{}'::text[],
  default_grain text,
  validation_status text NOT NULL DEFAULT 'validated',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT crm_dimension_definitions_key_check CHECK (dimension_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  CONSTRAINT crm_dimension_definitions_value_type_check CHECK (value_type IN ('text', 'date', 'number', 'boolean', 'location', 'user', 'enum')),
  CONSTRAINT crm_dimension_definitions_validation_status_check CHECK (validation_status IN ('draft', 'validated', 'deprecated')),
  CONSTRAINT crm_dimension_definitions_unique_key UNIQUE (org_id, dimension_key)
);

CREATE TABLE IF NOT EXISTS public.crm_report_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  created_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  report_type text NOT NULL DEFAULT 'custom',
  status text NOT NULL DEFAULT 'draft',
  metric_keys text[] NOT NULL,
  dimension_keys text[] NOT NULL DEFAULT '{}'::text[],
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  visualization text NOT NULL DEFAULT 'table',
  schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
  explanation text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT crm_report_definitions_status_check CHECK (status IN ('draft', 'active', 'scheduled', 'archived')),
  CONSTRAINT crm_report_definitions_type_check CHECK (report_type IN ('custom', 'campaign_roi', 'retention', 'loyalty', 'recovery', 'guest_ltv', 'menu_affinity', 'location_comparison')),
  CONSTRAINT crm_report_definitions_visualization_check CHECK (visualization IN ('table', 'line', 'bar', 'stacked_bar', 'area', 'pie', 'scorecard', 'heatmap'))
);

CREATE TABLE IF NOT EXISTS public.crm_report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_definition_id uuid REFERENCES public.crm_report_definitions(id) ON DELETE SET NULL,
  requested_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  metric_keys text[] NOT NULL DEFAULT '{}'::text[],
  dimension_keys text[] NOT NULL DEFAULT '{}'::text[],
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_count integer NOT NULL DEFAULT 0,
  data_quality_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_report_runs_status_check CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'preview'))
);

CREATE INDEX IF NOT EXISTS crm_metric_definitions_org_key_idx ON public.crm_metric_definitions(org_id, metric_key, validation_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_dimension_definitions_org_key_idx ON public.crm_dimension_definitions(org_id, dimension_key, validation_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_report_definitions_org_status_idx ON public.crm_report_definitions(org_id, status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_report_runs_report_idx ON public.crm_report_runs(org_id, report_definition_id, created_at DESC);

ALTER TABLE public.crm_metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_dimension_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_report_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_report_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_crm_metric_definitions" ON public.crm_metric_definitions FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_metric_definitions" ON public.crm_metric_definitions FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_metric_definitions" ON public.crm_metric_definitions FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_metric_definitions" ON public.crm_metric_definitions FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_metric_definitions" ON public.crm_metric_definitions TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_dimension_definitions" ON public.crm_dimension_definitions FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_dimension_definitions" ON public.crm_dimension_definitions FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_dimension_definitions" ON public.crm_dimension_definitions FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_dimension_definitions" ON public.crm_dimension_definitions FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_dimension_definitions" ON public.crm_dimension_definitions TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_report_definitions" ON public.crm_report_definitions FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_report_definitions" ON public.crm_report_definitions FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_report_definitions" ON public.crm_report_definitions FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_report_definitions" ON public.crm_report_definitions FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_report_definitions" ON public.crm_report_definitions TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_report_runs" ON public.crm_report_runs FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_report_runs" ON public.crm_report_runs FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_report_runs" ON public.crm_report_runs FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_report_runs" ON public.crm_report_runs FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_report_runs" ON public.crm_report_runs TO service_role USING (true) WITH CHECK (true);

COMMIT;
