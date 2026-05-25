-- Rollback CRM-V7.3 Revenue attribution basics

BEGIN;

DROP TABLE IF EXISTS public.crm_campaign_revenue_attribution;
DROP TABLE IF EXISTS public.crm_attribution_events;

COMMIT;
