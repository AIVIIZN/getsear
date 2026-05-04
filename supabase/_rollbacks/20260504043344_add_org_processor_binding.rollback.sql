-- 20260504043344_add_org_processor_binding.rollback.sql
-- Inverse of supabase/migrations/20260504043344_add_org_processor_binding.sql
-- Drops the trigger, function, and table created by the forward migration.

BEGIN;
DROP TRIGGER IF EXISTS prevent_processor_binding_change ON public.org_processor_bindings;
DROP FUNCTION IF EXISTS public.prevent_processor_binding_change();
DROP TABLE IF EXISTS public.org_processor_bindings;
COMMIT;
