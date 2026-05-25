-- Rollback for 20260525152428_add_crm_import_tools.sql

BEGIN;

DROP TABLE IF EXISTS public.crm_import_mappings;
DROP TABLE IF EXISTS public.crm_import_rows;
DROP TABLE IF EXISTS public.crm_import_jobs;

COMMIT;
