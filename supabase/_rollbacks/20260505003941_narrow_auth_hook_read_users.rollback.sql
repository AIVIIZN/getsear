-- 20260505003941_narrow_auth_hook_read_users.rollback.sql
-- Inverse of supabase/migrations/20260505003941_narrow_auth_hook_read_users.sql
--
-- Restores the auth_hook_read_users policy USING expression to `true`,
-- the state shipped by 20260504111845_custom_access_token_hook.
-- WARNING: this re-opens the S-P0-4 finding (supabase_auth_admin can
-- SELECT every users row globally). Only run if the narrow is breaking
-- token issuance for legitimate users.

BEGIN;

ALTER POLICY auth_hook_read_users ON public.users
  USING (true);

COMMENT ON POLICY auth_hook_read_users ON public.users IS
  'Reverted to baseline qual=true. Re-opens S-P0-4 — narrow with '
  '20260505003941_narrow_auth_hook_read_users.sql once the underlying '
  'reason for rollback is resolved.';

COMMIT;
