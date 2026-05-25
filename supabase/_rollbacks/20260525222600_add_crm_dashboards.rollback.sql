-- Rollback for CRM-V10.4 dashboards and templates

BEGIN;

DROP TABLE IF EXISTS public.crm_dashboard_widgets;
DROP TABLE IF EXISTS public.crm_dashboards;

COMMIT;
