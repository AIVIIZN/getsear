-- 20260525172341_add_crm_segments.sql
-- Task: CRM-V6.1 - Visual segment builder
-- One-way migration; rollback in supabase/_rollbacks/20260525172341_add_crm_segments.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text,
  segment_type text NOT NULL DEFAULT 'dynamic' CHECK (segment_type IN ('dynamic', 'static')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  match_mode text NOT NULL DEFAULT 'all' CHECK (match_mode IN ('all', 'any')),
  rule_tree jsonb NOT NULL DEFAULT '{"match":"all","rules":[]}'::jsonb,
  preview_count integer NOT NULL DEFAULT 0 CHECK (preview_count >= 0),
  last_preview_run_id uuid,
  materialized_at timestamptz,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.crm_segment_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  segment_id uuid NOT NULL REFERENCES public.crm_segments(id) ON DELETE CASCADE,
  parent_rule_id uuid REFERENCES public.crm_segment_rules(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  group_match_mode text CHECK (group_match_mode IN ('all', 'any')),
  field_key text,
  operator text,
  value jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (group_match_mode IS NOT NULL AND field_key IS NULL AND operator IS NULL)
    OR (group_match_mode IS NULL AND field_key IS NOT NULL AND operator IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.crm_segment_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  segment_id uuid NOT NULL REFERENCES public.crm_segments(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  membership_source text NOT NULL DEFAULT 'materialized' CHECK (membership_source IN ('materialized', 'manual', 'preview')),
  matched_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  added_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.crm_segment_preview_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  segment_id uuid REFERENCES public.crm_segments(id) ON DELETE SET NULL,
  requested_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  rule_tree jsonb NOT NULL,
  total_count integer NOT NULL DEFAULT 0 CHECK (total_count >= 0),
  sample_guest_ids uuid[] NOT NULL DEFAULT '{}',
  sample_guests jsonb NOT NULL DEFAULT '[]'::jsonb,
  excluded_count integer NOT NULL DEFAULT 0 CHECK (excluded_count >= 0),
  runtime_ms integer NOT NULL DEFAULT 0 CHECK (runtime_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_segments_org_name_active_idx
  ON public.crm_segments(org_id, lower(name))
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_segments_org_status_idx ON public.crm_segments(org_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS crm_segments_location_idx ON public.crm_segments(org_id, location_id) WHERE location_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_segment_rules_segment_idx ON public.crm_segment_rules(segment_id, sort_order);
CREATE INDEX IF NOT EXISTS crm_segment_rules_field_idx ON public.crm_segment_rules(org_id, field_key) WHERE field_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS crm_segment_memberships_segment_guest_idx
  ON public.crm_segment_memberships(segment_id, guest_id);
CREATE INDEX IF NOT EXISTS crm_segment_memberships_guest_idx ON public.crm_segment_memberships(org_id, guest_id);
CREATE INDEX IF NOT EXISTS crm_segment_preview_runs_segment_idx ON public.crm_segment_preview_runs(org_id, segment_id, created_at DESC);

ALTER TABLE public.crm_segments
  ADD CONSTRAINT crm_segments_last_preview_run_fk
  FOREIGN KEY (last_preview_run_id) REFERENCES public.crm_segment_preview_runs(id) ON DELETE SET NULL;

ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_segment_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_segment_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_segment_preview_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.crm_segments
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_segments
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_segments
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_segments
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_segment_rules
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_segment_rules
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_segment_rules
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_segment_rules
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_segment_memberships
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_segment_memberships
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_segment_memberships
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_segment_memberships
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_segment_preview_runs
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_segment_preview_runs
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_segment_preview_runs
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_segment_preview_runs
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

COMMIT;
