-- 20260504111845_custom_access_token_hook.rollback.sql
-- Inverse of supabase/migrations/20260504111845_custom_access_token_hook.sql
--
-- WARNING: rolling this back removes the JWT claim injection. If the hook
-- has been enabled in the Supabase dashboard at Auth -> Hooks, DISABLE IT
-- THERE FIRST or every signin will fail with "function does not exist".
-- After disabling in the dashboard, run this rollback.

BEGIN;

DROP POLICY IF EXISTS auth_hook_read_users ON public.users;

REVOKE SELECT ON public.users FROM supabase_auth_admin;
-- Leave USAGE on schema public granted; revoking it can break other
-- supabase_auth_admin operations that depend on it.

DROP FUNCTION IF EXISTS public.custom_access_token_hook(jsonb);

COMMIT;
