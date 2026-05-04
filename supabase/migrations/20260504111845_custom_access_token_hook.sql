-- 20260504111845_custom_access_token_hook.sql
-- Task: 5.99.1 — Cross-cutting fix: install custom_access_token_hook so RLS works
-- One-way migration; rollback in supabase/_rollbacks/20260504111845_custom_access_token_hook.rollback.sql
--
-- WHY: The baseline (supabase/migrations/00000000000000_baseline.sql) ships ~209
-- tenant_select/insert/update/delete policies that gate access on
--   org_id = (current_setting('request.jwt.claims', true))::json->>'org_id'
-- but Supabase's default JWT does NOT contain an org_id claim. Result: every
-- authenticated query has org_id=NULL on the JWT side and the policy evaluates
-- to false, so the RLS layer is decorative. The application has compensated
-- by routing essentially every server-side query through createAdminClient()
-- (the service-role client), which bypasses RLS — leaving tenant isolation
-- resting entirely on application-level .eq('org_id', user.org_id) filters.
-- Any route that forgets the filter leaks across tenants.
--
-- WHAT THIS FIXES:
-- (1) Defines public.custom_access_token_hook(event jsonb) RETURNS jsonb that
--     reads org_id, role, and is_active from public.users for the user being
--     issued a JWT, and merges them into the claims object.
-- (2) Hardens grants so only supabase_auth_admin (the role GoTrue runs as
--     when invoking auth hooks) can EXECUTE the function. Anon, authenticated,
--     and public are explicitly REVOKEd.
-- (3) Grants supabase_auth_admin SELECT on public.users so the hook can
--     read the row at token-issuance time without a service-role bypass.
-- (4) Adds an RLS policy on public.users that lets supabase_auth_admin read
--     ALL rows (needed for the hook to look up any user's org_id at signin).
--
-- WHAT THIS DOES NOT DO (yet):
-- - The hook function is created but Supabase ALSO requires a dashboard toggle
--   at Auth → Hooks → "Customize Access Token (JWT) Claims" → set the dropdown
--   to public.custom_access_token_hook. That flip cannot be performed via
--   migration or MCP — Ian must enable it in the dashboard. Until enabled,
--   the function exists but is never called, so behavior is unchanged from
--   today's broken state. After enabling, every newly issued JWT will carry
--   org_id and the 209 baseline tenant_* policies start enforcing.
-- - The 209 baseline policies are NOT modified by this migration. They will
--   keep using current_setting('request.jwt.claims', ...)->>'org_id'. Once
--   the hook is enabled, that expression resolves to the real org_id and the
--   policies start enforcing as designed.
-- - Defense-in-depth: the application's existing .eq('org_id', user.org_id)
--   filters are NOT removed — they remain the first line of defense per the
--   project's "tenant scoping: every query filters by org_id; RLS is the
--   second line" rule (CLAUDE.md). RLS now becomes a real second line.
--
-- Hook contract (from Supabase docs):
--   input event = { "user_id": uuid, "claims": jsonb, "authentication_method": text }
--   output      = same shape, with claims merged/overridden as desired
-- We never replace the original claims, only add to them under app_metadata
-- (top-level org_id is also added so the existing baseline policies work
-- without a baseline rewrite).

BEGIN;

-- 1. The hook function. Reads from public.users using the SECURITY DEFINER
--    privilege of postgres so we don't need to relax users' RLS for the
--    auth hook role beyond what's needed for the join in step 4. We still
--    REVOKE/GRANT EXECUTE explicitly so only supabase_auth_admin can call it.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims jsonb;
  user_org_id uuid;
  user_role text;
  user_is_active boolean;
BEGIN
  -- Pull the existing claims off the event so we can merge into them.
  claims := COALESCE(event->'claims', '{}'::jsonb);

  -- Look up the org_id, role, and is_active for this user.
  -- public.users.id is the auth.users.id mirror, so event->>'user_id' joins directly.
  SELECT u.org_id, u.role::text, u.is_active
    INTO user_org_id, user_role, user_is_active
    FROM public.users u
    WHERE u.id = (event->>'user_id')::uuid
      AND u.deleted_at IS NULL
    LIMIT 1;

  -- If the user has no row in public.users (e.g., auth.users created but
  -- onboarding incomplete), or has been soft-deleted, return claims
  -- unchanged. The 209 baseline policies will continue to evaluate
  -- org_id=NULL -> false and the request will be denied — which is the
  -- correct behavior for an incomplete profile.
  IF user_org_id IS NULL THEN
    RETURN jsonb_build_object('claims', claims);
  END IF;

  -- Merge org_id at the top level (this is what the 209 baseline policies
  -- read via current_setting('request.jwt.claims', true)::json->>'org_id').
  claims := claims || jsonb_build_object(
    'org_id',     user_org_id::text,
    'user_role',  user_role,
    'is_active',  user_is_active
  );

  -- Also stash inside app_metadata for clients that read claims that way.
  -- app_metadata is the canonical Supabase location for server-controlled
  -- claims (vs. user_metadata which the user can write).
  claims := jsonb_set(
    claims,
    '{app_metadata}',
    COALESCE(claims->'app_metadata', '{}'::jsonb) || jsonb_build_object(
      'org_id',    user_org_id::text,
      'user_role', user_role,
      'is_active', user_is_active
    ),
    true
  );

  RETURN jsonb_build_object('claims', claims);
END;
$$;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
  'Supabase auth hook: injects org_id, user_role, and is_active into JWT '
  'claims at token-issuance time so the 209 tenant_* RLS policies in the '
  'baseline can enforce tenant isolation. Must be enabled in the Supabase '
  'dashboard at Auth -> Hooks -> Customize Access Token (JWT) Claims '
  '(cannot be enabled via migration). See task 5.99.1.';

-- 2. Lock down EXECUTE. Only supabase_auth_admin (the role GoTrue uses when
--    invoking hooks) is allowed to call this function. Authenticated users,
--    the anon role, and the public pseudo-role are explicitly denied so a
--    PostgREST caller cannot trigger the function and probe other tenants'
--    org_id values.
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- 3. Grant supabase_auth_admin the privileges it needs to read public.users
--    inside the hook. SECURITY DEFINER runs as the function owner (postgres)
--    so this technically isn't required for the body to execute, but Supabase
--    docs explicitly recommend granting the role direct access for clarity
--    and to keep the function inspectable when debugging in production.
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON public.users TO supabase_auth_admin;

-- 4. RLS policy that lets supabase_auth_admin read every users row. The
--    existing baseline policies on public.users gate on the broken JWT claim
--    too, so without this policy the hook itself would be blocked when
--    looking up the org_id (a chicken-and-egg deadlock). The policy is
--    scoped strictly to the supabase_auth_admin role; no other role gains
--    broader access.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'users'
      AND policyname = 'auth_hook_read_users'
  ) THEN
    EXECUTE $POLICY$
      CREATE POLICY auth_hook_read_users
        ON public.users
        FOR SELECT
        TO supabase_auth_admin
        USING (true)
    $POLICY$;
  END IF;
END
$$;

COMMIT;
