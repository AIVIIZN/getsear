-- Rollback for 20260525143744_add_crm_privacy_rights.sql

BEGIN;

DROP TABLE IF EXISTS public.data_access_logs;
DROP TABLE IF EXISTS public.data_deletion_jobs;
DROP TABLE IF EXISTS public.data_export_jobs;
DROP TABLE IF EXISTS public.privacy_requests;

COMMIT;
