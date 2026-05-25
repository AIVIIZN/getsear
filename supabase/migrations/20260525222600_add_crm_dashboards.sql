-- CRM-V10.4 Dashboards and templates
-- One-way migration; rollback in supabase/_rollbacks/20260525222600_add_crm_dashboards.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  created_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  audience text NOT NULL DEFAULT 'owner',
  status text NOT NULL DEFAULT 'active',
  template_key text,
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT crm_dashboards_audience_check CHECK (audience IN ('owner', 'manager', 'marketing', 'loyalty', 'data_quality')),
  CONSTRAINT crm_dashboards_status_check CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT crm_dashboards_template_key_check CHECK (template_key IS NULL OR template_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS public.crm_dashboard_widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dashboard_id uuid NOT NULL REFERENCES public.crm_dashboards(id) ON DELETE CASCADE,
  report_definition_id uuid REFERENCES public.crm_report_definitions(id) ON DELETE SET NULL,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  widget_key text NOT NULL,
  title text NOT NULL,
  widget_type text NOT NULL DEFAULT 'metric_card',
  metric_keys text[] NOT NULL,
  dimension_keys text[] NOT NULL DEFAULT '{}'::text[],
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  visualization text NOT NULL DEFAULT 'scorecard',
  position jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT crm_dashboard_widgets_key_check CHECK (widget_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  CONSTRAINT crm_dashboard_widgets_type_check CHECK (widget_type IN ('metric_card', 'trend', 'breakdown', 'table', 'alert_queue')),
  CONSTRAINT crm_dashboard_widgets_visualization_check CHECK (visualization IN ('table', 'line', 'bar', 'stacked_bar', 'area', 'pie', 'scorecard', 'heatmap')),
  CONSTRAINT crm_dashboard_widgets_unique_key UNIQUE (dashboard_id, widget_key)
);

CREATE INDEX IF NOT EXISTS crm_dashboards_org_audience_idx ON public.crm_dashboards(org_id, audience, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_dashboard_widgets_dashboard_idx ON public.crm_dashboard_widgets(org_id, dashboard_id, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_dashboard_widgets_report_idx ON public.crm_dashboard_widgets(org_id, report_definition_id) WHERE report_definition_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.crm_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_dashboard_widgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_crm_dashboards" ON public.crm_dashboards FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_dashboards" ON public.crm_dashboards FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_dashboards" ON public.crm_dashboards FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_dashboards" ON public.crm_dashboards FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_dashboards" ON public.crm_dashboards TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_dashboard_widgets" ON public.crm_dashboard_widgets FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_dashboard_widgets" ON public.crm_dashboard_widgets FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_dashboard_widgets" ON public.crm_dashboard_widgets FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_dashboard_widgets" ON public.crm_dashboard_widgets FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_dashboard_widgets" ON public.crm_dashboard_widgets TO service_role USING (true) WITH CHECK (true);

COMMIT;
