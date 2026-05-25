-- CRM-V8.1 Automation builder core
-- One-way migration; rollback in supabase/_rollbacks/20260525194808_add_crm_automation_builder_core.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  segment_id uuid REFERENCES public.crm_segments(id) ON DELETE SET NULL,
  created_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  trigger_type text NOT NULL,
  condition_tree jsonb NOT NULL DEFAULT '{}'::jsonb,
  wait_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  branch_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  measurement jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT crm_automations_status_check CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  CONSTRAINT crm_automations_trigger_type_check CHECK (
    trigger_type IN ('guest_created', 'first_visit', 'second_visit', 'birthday', 'lapsed', 'vip_visit', 'negative_feedback', 'reward_earned', 'reward_expiring', 'no_show', 'online_order', 'high_value_check', 'item_purchased', 'category_purchased', 'complaint_resolved')
  )
);

CREATE TABLE IF NOT EXISTS public.crm_automation_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.crm_automations(id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_automation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.crm_automations(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 0,
  action_type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_automation_actions_type_check CHECK (
    action_type IN ('send_email', 'send_sms', 'create_task', 'notify_manager', 'add_tag', 'remove_tag', 'add_reward', 'adjust_points', 'create_recovery', 'add_note', 'draft_ai_message', 'schedule_report', 'reservation_prompt', 'webhook')
  )
);

CREATE TABLE IF NOT EXISTS public.crm_automation_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.crm_automations(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  source_type text NOT NULL,
  source_id uuid,
  status text NOT NULL DEFAULT 'enrolled',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  exited_at timestamptz,
  exit_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT crm_automation_enrollments_status_check CHECK (status IN ('enrolled', 'completed', 'exited', 'failed'))
);

CREATE TABLE IF NOT EXISTS public.crm_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_id uuid NOT NULL REFERENCES public.crm_automations(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.crm_automation_enrollments(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  trigger_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  actions_executed jsonb NOT NULL DEFAULT '[]'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_automation_runs_status_check CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'skipped', 'test'))
);

CREATE TABLE IF NOT EXISTS public.crm_automation_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_id uuid REFERENCES public.crm_automations(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.crm_automation_runs(id) ON DELETE CASCADE,
  action_id uuid REFERENCES public.crm_automation_actions(id) ON DELETE SET NULL,
  failure_type text NOT NULL,
  message text NOT NULL,
  retryable boolean NOT NULL DEFAULT true,
  resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_automations_org_status_idx ON public.crm_automations(org_id, status, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_automation_triggers_automation_idx ON public.crm_automation_triggers(org_id, automation_id);
CREATE INDEX IF NOT EXISTS crm_automation_actions_automation_idx ON public.crm_automation_actions(org_id, automation_id, step_order);
CREATE INDEX IF NOT EXISTS crm_automation_enrollments_guest_idx ON public.crm_automation_enrollments(org_id, guest_id, status) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_automation_runs_automation_idx ON public.crm_automation_runs(org_id, automation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_automation_failures_automation_idx ON public.crm_automation_failures(org_id, automation_id, created_at DESC);

ALTER TABLE public.crm_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_automation_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_automation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_automation_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_automation_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_crm_automations" ON public.crm_automations FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_automations" ON public.crm_automations FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_automations" ON public.crm_automations FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_automations" ON public.crm_automations FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_automations" ON public.crm_automations TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_automation_triggers" ON public.crm_automation_triggers FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_automation_triggers" ON public.crm_automation_triggers FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_automation_triggers" ON public.crm_automation_triggers FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_automation_triggers" ON public.crm_automation_triggers FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_automation_triggers" ON public.crm_automation_triggers TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_automation_actions" ON public.crm_automation_actions FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_automation_actions" ON public.crm_automation_actions FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_automation_actions" ON public.crm_automation_actions FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_automation_actions" ON public.crm_automation_actions FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_automation_actions" ON public.crm_automation_actions TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_automation_enrollments" ON public.crm_automation_enrollments FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_automation_enrollments" ON public.crm_automation_enrollments FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_automation_enrollments" ON public.crm_automation_enrollments FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_automation_enrollments" ON public.crm_automation_enrollments FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_automation_enrollments" ON public.crm_automation_enrollments TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_automation_runs" ON public.crm_automation_runs FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_automation_runs" ON public.crm_automation_runs FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_automation_runs" ON public.crm_automation_runs FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_automation_runs" ON public.crm_automation_runs FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_automation_runs" ON public.crm_automation_runs TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_automation_failures" ON public.crm_automation_failures FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_automation_failures" ON public.crm_automation_failures FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_automation_failures" ON public.crm_automation_failures FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_automation_failures" ON public.crm_automation_failures FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_automation_failures" ON public.crm_automation_failures TO service_role USING (true) WITH CHECK (true);

COMMIT;
