-- 20260525181351_add_crm_service_recovery.rollback.sql
-- Rollback for CRM-V9.2 service recovery center

BEGIN;

DROP TABLE IF EXISTS public.crm_recovery_followups;
DROP TABLE IF EXISTS public.crm_recovery_actions;
DROP TABLE IF EXISTS public.crm_recovery_cases;

COMMIT;
