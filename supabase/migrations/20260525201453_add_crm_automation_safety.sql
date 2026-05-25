-- CRM-V8.2 Automation safety
-- One-way migration; rollback in supabase/_rollbacks/20260525201453_add_crm_automation_safety.rollback.sql

BEGIN;

ALTER TABLE public.crm_automations
  ADD COLUMN IF NOT EXISTS safety_config jsonb NOT NULL DEFAULT jsonb_build_object(
    'frequency_cap_count', 1,
    'frequency_cap_window_hours', 24,
    'audience_size_limit', 5000,
    'estimated_cost_cents', 0,
    'suppression_rules', '{}'::jsonb,
    'exit_conditions', '[]'::jsonb
  );

CREATE INDEX IF NOT EXISTS crm_automation_runs_frequency_cap_idx
  ON public.crm_automation_runs(org_id, automation_id, guest_id, status, created_at DESC)
  WHERE guest_id IS NOT NULL AND status IN ('queued', 'running', 'succeeded');

CREATE INDEX IF NOT EXISTS crm_automations_safety_config_gin_idx
  ON public.crm_automations USING gin (safety_config);

COMMIT;
