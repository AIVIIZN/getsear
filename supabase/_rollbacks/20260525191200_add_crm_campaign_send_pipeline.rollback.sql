-- Rollback for CRM-V7.2 Compliance and send pipeline

BEGIN;

DROP TABLE IF EXISTS public.crm_message_events;
DROP TABLE IF EXISTS public.crm_message_sends;
DROP TABLE IF EXISTS public.crm_campaign_send_jobs;

COMMIT;
