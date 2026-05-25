-- Rollback for 20260525210000_add_crm_ai_gateway.sql

BEGIN;

DROP TABLE IF EXISTS public.crm_ai_tool_calls;
DROP TABLE IF EXISTS public.crm_ai_audit_logs;
DROP TABLE IF EXISTS public.crm_ai_prompt_templates;

COMMIT;
