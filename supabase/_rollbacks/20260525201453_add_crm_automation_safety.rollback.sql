BEGIN;

DROP INDEX IF EXISTS public.crm_automations_safety_config_gin_idx;
DROP INDEX IF EXISTS public.crm_automation_runs_frequency_cap_idx;

ALTER TABLE public.crm_automations
  DROP COLUMN IF EXISTS safety_config;

COMMIT;
