-- Rollback for 20260525225500_add_crm_health_data_quality.sql

BEGIN;

DROP TABLE IF EXISTS public.crm_health_issues;
DROP TABLE IF EXISTS public.crm_data_quality_runs;

COMMIT;
