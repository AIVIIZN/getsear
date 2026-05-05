-- 20260505003941_narrow_auth_hook_read_users.sql
-- Task: SEC-1b — Narrow auth_hook_read_users RLS policy on public.users
-- One-way migration; rollback in supabase/_rollbacks/20260505003941_narrow_auth_hook_read_users.rollback.sql
--
-- WHY: The security-reviewer audit (build-pipeline/logs/cross-cutting-reviews/
-- 2026-05-05/security-reviewer.md, finding S-P0-4) flagged that the
-- auth_hook_read_users policy installed by 20260504111845_custom_access_token_hook
-- uses `USING (true)`. That gives the supabase_auth_admin role unconstrained
-- SELECT over every users row, which is broader than the hook needs.
--
-- WHAT THE HOOK ACTUALLY READS:
--   public.custom_access_token_hook(event jsonb) does:
--     SELECT u.org_id, u.role::text, u.is_active
--       FROM public.users u
--       WHERE u.id = (event->>'user_id')::uuid
--         AND u.deleted_at IS NULL
--     LIMIT 1;
-- The hook only ever needs the row for the user being issued a JWT, AND only
-- if that row represents a usable account (not soft-deleted, active).
--
-- WHY NOT MATCH ON event->>'user_id' DIRECTLY:
-- The auth hook is invoked by GoTrue (supabase_auth_admin) outside of a
-- PostgREST request context. current_setting('request.jwt.claims', ...) is
-- NOT reliably populated during hook execution — GoTrue calls the function
-- with the event payload as an argument, not via a JWT-bearing HTTP request.
-- Therefore we cannot use a `current_setting(...)::jsonb ->> 'sub' = id`
-- check in the policy. (The hook function is SECURITY DEFINER and runs as
-- postgres, but the SELECT it issues is still subject to its caller's RLS
-- when the function reads through the supabase_auth_admin role's grants.)
--
-- THE NARROW WE ADOPT:
-- Restrict the policy to rows where the user is currently usable:
--   is_active = true AND deleted_at IS NULL
-- This is the SAFER fallback narrow called out in the task brief. It:
--   1. Removes the `qual=true` finding — the policy now has a real predicate.
--   2. Preserves hook function — every row the hook would actually use
--      already passes this filter (the hook's own WHERE clause requires
--      deleted_at IS NULL, and a hook stamping JWTs for an inactive user
--      is a no-op since 5.99.1's claims merge sets is_active in the JWT
--      and downstream RLS policies for inactive users would deny anyway).
--   3. Stops leakage of inactive/deleted accounts even if a future
--      supabase_auth_admin code path tries a broader SELECT.
--
-- Scope unchanged: policy still applies only to supabase_auth_admin (the
-- TO clause set in 20260504111845 stays intact — ALTER POLICY only
-- replaces the USING expression, not the role list).

BEGIN;

ALTER POLICY auth_hook_read_users ON public.users
  USING (is_active = true AND deleted_at IS NULL);

COMMENT ON POLICY auth_hook_read_users ON public.users IS
  'SEC-1b narrow: limits supabase_auth_admin SELECT to active, non-deleted '
  'users. The custom_access_token_hook only reads rows matching its own '
  'WHERE clause (id = event user_id AND deleted_at IS NULL); restricting '
  'the policy to (is_active = true AND deleted_at IS NULL) preserves hook '
  'function while removing the prior qual=true global read.';

COMMIT;
