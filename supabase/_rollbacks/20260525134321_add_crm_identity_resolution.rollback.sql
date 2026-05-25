-- Rollback for 20260525134321_add_crm_identity_resolution.sql

BEGIN;

DROP TABLE IF EXISTS public.guest_merge_decisions;
DROP TABLE IF EXISTS public.guest_relationships;
DROP TABLE IF EXISTS public.guest_households;
DROP TABLE IF EXISTS public.guest_merge_candidates;

COMMIT;
