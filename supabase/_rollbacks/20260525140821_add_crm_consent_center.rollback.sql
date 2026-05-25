-- Rollback for 20260525140821_add_crm_consent_center.sql

BEGIN;

DROP TABLE IF EXISTS public.suppression_entries;
DROP TABLE IF EXISTS public.guest_consents;
DROP TABLE IF EXISTS public.consent_policy_versions;

COMMIT;
