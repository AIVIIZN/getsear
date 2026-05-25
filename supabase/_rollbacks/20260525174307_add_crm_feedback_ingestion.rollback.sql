-- Rollback for 20260525174307_add_crm_feedback_ingestion.sql

BEGIN;

DROP TABLE IF EXISTS public.crm_complaints;
DROP TABLE IF EXISTS public.crm_reviews;
DROP TABLE IF EXISTS public.crm_survey_responses;
DROP TABLE IF EXISTS public.crm_surveys;

COMMIT;
