-- 20260504110200_audit_log_restrictive_policies.rollback.sql
-- Inverse of supabase/migrations/20260504110200_audit_log_restrictive_policies.sql
--
-- Restores the original permissive policies created by migration
-- 20260504063726_audit_log_expansion.sql. Note: rolling back re-introduces the
-- bypassability concern — only execute if needed to revert.

BEGIN;

DROP POLICY IF EXISTS audit_log_no_update ON public.audit_log;
DROP POLICY IF EXISTS audit_log_no_delete ON public.audit_log;

CREATE POLICY audit_log_no_update ON public.audit_log
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY audit_log_no_delete ON public.audit_log
  FOR DELETE
  USING (false);

COMMIT;
