-- 20260504063726_audit_log_expansion.rollback.sql
-- Inverse of supabase/migrations/20260504063726_audit_log_expansion.sql
--
-- WARNING: rolling this back loses every manager_pin_user_id, before_state,
-- after_state, and reason value written since the migration ran. Audit data
-- is forensically sensitive — coordinate with compliance before invoking.

BEGIN;

DROP POLICY IF EXISTS audit_log_no_delete ON public.audit_log;
DROP POLICY IF EXISTS audit_log_no_update ON public.audit_log;

DROP INDEX IF EXISTS public.idx_audit_org_action_date;
DROP INDEX IF EXISTS public.idx_audit_manager_pin_user;

ALTER TABLE public.audit_log
  DROP COLUMN IF EXISTS reason,
  DROP COLUMN IF EXISTS after_state,
  DROP COLUMN IF EXISTS before_state,
  DROP COLUMN IF EXISTS manager_pin_user_id;

COMMIT;
