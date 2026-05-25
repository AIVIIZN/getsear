-- 20260525210000_add_crm_ai_gateway.sql
-- Task: CRM-V11.1 - AI Gateway For CRM
-- One-way migration; rollback in supabase/_rollbacks/20260525210000_add_crm_ai_gateway.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_ai_prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  template_key text NOT NULL,
  name text NOT NULL,
  task_type text NOT NULL CHECK (task_type IN ('guest_summary', 'server_brief', 'next_best_action', 'segment_draft', 'campaign_draft', 'report_builder', 'recovery_message', 'data_cleanup')),
  provider text NOT NULL DEFAULT 'rules' CHECK (provider IN ('gemini', 'openai', 'rules')),
  model text NOT NULL DEFAULT 'deterministic-rules',
  system_prompt text NOT NULL,
  user_prompt text NOT NULL,
  output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  retrieval_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  safety_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  approval_required boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_ai_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  prompt_template_id uuid REFERENCES public.crm_ai_prompt_templates(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  task_type text NOT NULL CHECK (task_type IN ('guest_summary', 'server_brief', 'next_best_action', 'segment_draft', 'campaign_draft', 'report_builder', 'recovery_message', 'data_cleanup')),
  provider text NOT NULL CHECK (provider IN ('gemini', 'openai', 'rules')),
  model text NOT NULL,
  status text NOT NULL CHECK (status IN ('completed', 'refused', 'failed', 'cached', 'dry_run')),
  prompt_hash text NOT NULL,
  prompt_redaction_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  estimated_cost_cents integer NOT NULL DEFAULT 0 CHECK (estimated_cost_cents >= 0),
  confidence numeric(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  output_summary text,
  source_citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  safety_flags text[] NOT NULL DEFAULT '{}'::text[],
  approval_required boolean NOT NULL DEFAULT true,
  reviewed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  request_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_ai_tool_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  audit_log_id uuid NOT NULL REFERENCES public.crm_ai_audit_logs(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  tool_input_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  tool_output_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'refused')),
  safety_flags text[] NOT NULL DEFAULT '{}'::text[],
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_ai_prompt_templates_key_idx
  ON public.crm_ai_prompt_templates(org_id, template_key, version);
CREATE INDEX IF NOT EXISTS crm_ai_prompt_templates_active_idx
  ON public.crm_ai_prompt_templates(org_id, task_type, active);
CREATE INDEX IF NOT EXISTS crm_ai_audit_logs_org_task_idx
  ON public.crm_ai_audit_logs(org_id, task_type, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_ai_audit_logs_guest_idx
  ON public.crm_ai_audit_logs(org_id, guest_id, created_at DESC)
  WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_ai_audit_logs_actor_idx
  ON public.crm_ai_audit_logs(org_id, actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_ai_tool_calls_audit_idx
  ON public.crm_ai_tool_calls(org_id, audit_log_id, started_at DESC);

ALTER TABLE public.crm_ai_prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_ai_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_ai_tool_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_crm_ai_prompt_templates" ON public.crm_ai_prompt_templates
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_ai_prompt_templates" ON public.crm_ai_prompt_templates
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_ai_prompt_templates" ON public.crm_ai_prompt_templates
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_ai_prompt_templates" ON public.crm_ai_prompt_templates
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_ai_prompt_templates" ON public.crm_ai_prompt_templates
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_ai_audit_logs" ON public.crm_ai_audit_logs
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_ai_audit_logs" ON public.crm_ai_audit_logs
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_ai_audit_logs" ON public.crm_ai_audit_logs
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_ai_audit_logs" ON public.crm_ai_audit_logs
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_ai_audit_logs" ON public.crm_ai_audit_logs
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_ai_tool_calls" ON public.crm_ai_tool_calls
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_ai_tool_calls" ON public.crm_ai_tool_calls
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_ai_tool_calls" ON public.crm_ai_tool_calls
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_ai_tool_calls" ON public.crm_ai_tool_calls
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_ai_tool_calls" ON public.crm_ai_tool_calls
  TO service_role USING (true) WITH CHECK (true);

COMMIT;
