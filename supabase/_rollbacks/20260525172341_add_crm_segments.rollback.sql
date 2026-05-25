-- Rollback for 20260525172341_add_crm_segments.sql

BEGIN;

ALTER TABLE IF EXISTS public.crm_segments DROP CONSTRAINT IF EXISTS crm_segments_last_preview_run_fk;
DROP TABLE IF EXISTS public.crm_segment_preview_runs;
DROP TABLE IF EXISTS public.crm_segment_memberships;
DROP TABLE IF EXISTS public.crm_segment_rules;
DROP TABLE IF EXISTS public.crm_segments;

COMMIT;
