-- 20260504110200_audit_log_restrictive_policies.sql
-- Task: 5.99.5 (Md3) — convert audit_log_no_update / audit_log_no_delete to RESTRICTIVE
-- One-way migration; rollback in
--   supabase/_rollbacks/20260504110200_audit_log_restrictive_policies.rollback.sql
--
-- WHY:
--   Migration 20260504063726 (audit_log_expansion) created policies named
--   `audit_log_no_update` and `audit_log_no_delete` as plain (permissive) policies
--   with `USING (false)`. Postgres ORs permissive policies together — meaning if
--   any future migration adds a permissive `USING (true)` UPDATE/DELETE policy
--   (e.g., a misguided "admin override"), the deny is bypassed silently.
--
--   The correct semantics for a deny policy are RESTRICTIVE: Postgres ANDs every
--   restrictive policy, so a `USING (false)` RESTRICTIVE policy permanently denies
--   the operation regardless of what permissive policies exist alongside.
--
--   Postgres does not support altering a policy's permissive/restrictive flag in
--   place; the only path is DROP + CREATE. We do this in a single transaction so
--   no window exists where the deny is missing. DROP POLICY here is acceptable
--   under the additive-only rule because each drop is paired with an immediately
--   stricter replacement.

BEGIN;

-- 1. UPDATE deny — replace permissive with RESTRICTIVE.

DROP POLICY IF EXISTS audit_log_no_update ON public.audit_log;

CREATE POLICY audit_log_no_update ON public.audit_log
  AS RESTRICTIVE
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

COMMENT ON POLICY audit_log_no_update ON public.audit_log IS
  'RESTRICTIVE deny — audit_log rows are immutable. Restrictive ANDs with every '
  'permissive policy, so this cannot be bypassed by a later permissive UPDATE policy.';

-- 2. DELETE deny — same conversion.

DROP POLICY IF EXISTS audit_log_no_delete ON public.audit_log;

CREATE POLICY audit_log_no_delete ON public.audit_log
  AS RESTRICTIVE
  FOR DELETE
  USING (false);

COMMENT ON POLICY audit_log_no_delete ON public.audit_log IS
  'RESTRICTIVE deny — audit_log rows are append-only. Restrictive ANDs with every '
  'permissive policy, so this cannot be bypassed by a later permissive DELETE policy.';

COMMIT;
