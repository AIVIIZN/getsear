-- Rollback for 20260525203849_add_crm_integrations_hub.sql

BEGIN;

DROP TABLE IF EXISTS public.crm_webhook_events;
DROP TABLE IF EXISTS public.crm_integration_events;
DROP TABLE IF EXISTS public.crm_integration_connections;

COMMIT;
