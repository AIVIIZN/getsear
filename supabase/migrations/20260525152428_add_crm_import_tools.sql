-- 20260525152428_add_crm_import_tools.sql
-- Task: CRM-V12.1 - Import and migration tools
-- One-way migration; rollback in supabase/_rollbacks/20260525152428_add_crm_import_tools.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (source_type IN ('csv', 'pos_customers', 'mailchimp', 'constant_contact', 'toast', 'square', 'opentable', 'reservation_system', 'loyalty', 'gift_cards', 'spreadsheet')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'importing', 'completed', 'completed_with_errors', 'failed', 'rolled_back')),
  file_name text NOT NULL,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  merge_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  original_row_count integer NOT NULL DEFAULT 0 CHECK (original_row_count >= 0),
  valid_row_count integer NOT NULL DEFAULT 0 CHECK (valid_row_count >= 0),
  invalid_row_count integer NOT NULL DEFAULT 0 CHECK (invalid_row_count >= 0),
  duplicate_row_count integer NOT NULL DEFAULT 0 CHECK (duplicate_row_count >= 0),
  imported_guest_count integer NOT NULL DEFAULT 0 CHECK (imported_guest_count >= 0),
  rollback_safe boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  rolled_back_at timestamptz,
  rolled_back_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_import_jobs_org_status_idx ON public.crm_import_jobs(org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_import_jobs_org_source_idx ON public.crm_import_jobs(org_id, source_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.crm_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  job_id uuid NOT NULL REFERENCES public.crm_import_jobs(id) ON DELETE CASCADE,
  row_number integer NOT NULL CHECK (row_number > 0),
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_status text NOT NULL CHECK (validation_status IN ('valid', 'invalid', 'duplicate', 'imported', 'skipped', 'rolled_back')),
  errors text[] NOT NULL DEFAULT ARRAY[]::text[],
  warnings text[] NOT NULL DEFAULT ARRAY[]::text[],
  duplicate_guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  imported_guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, row_number)
);

CREATE INDEX IF NOT EXISTS crm_import_rows_org_job_idx ON public.crm_import_rows(org_id, job_id, row_number);
CREATE INDEX IF NOT EXISTS crm_import_rows_status_idx ON public.crm_import_rows(org_id, job_id, validation_status);
CREATE INDEX IF NOT EXISTS crm_import_rows_imported_guest_idx ON public.crm_import_rows(org_id, imported_guest_id) WHERE imported_guest_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.crm_import_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (source_type IN ('csv', 'pos_customers', 'mailchimp', 'constant_contact', 'toast', 'square', 'opentable', 'reservation_system', 'loyalty', 'gift_cards', 'spreadsheet')),
  name text NOT NULL,
  field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  merge_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS crm_import_mappings_org_source_idx ON public.crm_import_mappings(org_id, source_type, is_default) WHERE deleted_at IS NULL;

ALTER TABLE public.crm_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_import_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.crm_import_jobs
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_import_jobs
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_import_jobs
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_import_jobs
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_import_rows
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_import_rows
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_import_rows
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_import_rows
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_import_mappings
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_import_mappings
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_import_mappings
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_import_mappings
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

COMMIT;
