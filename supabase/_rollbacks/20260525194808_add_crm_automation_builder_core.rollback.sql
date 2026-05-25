BEGIN;

DROP TABLE IF EXISTS public.crm_automation_failures;
DROP TABLE IF EXISTS public.crm_automation_runs;
DROP TABLE IF EXISTS public.crm_automation_enrollments;
DROP TABLE IF EXISTS public.crm_automation_actions;
DROP TABLE IF EXISTS public.crm_automation_triggers;
DROP TABLE IF EXISTS public.crm_automations;

COMMIT;
