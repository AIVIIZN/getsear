-- 20260525113405_add_crm_guest_core_schema.rollback.sql
-- Rollback for CRM-V1.1 guest core schema.

BEGIN;

DROP TABLE IF EXISTS public.guest_timeline_events;
DROP TABLE IF EXISTS public.guest_tags;
DROP TABLE IF EXISTS public.crm_tags;
DROP TABLE IF EXISTS public.guest_allergies;
DROP TABLE IF EXISTS public.guest_preferences;
DROP TABLE IF EXISTS public.guest_notes;
DROP TABLE IF EXISTS public.guest_identifiers;
DROP TABLE IF EXISTS public.guest_contact_points;
DROP TABLE IF EXISTS public.guests;

COMMIT;
