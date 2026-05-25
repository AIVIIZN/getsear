-- 20260525050335_reconcile_trust3_schema_drift.rollback.sql
-- Inverse of supabase/migrations/20260525050335_reconcile_trust3_schema_drift.sql

BEGIN;

CREATE INDEX IF NOT EXISTS idx_house_account_transactions_org_created
  ON public.house_account_transactions (org_id, created_at DESC);

DROP INDEX IF EXISTS public.idx_audit_log_org_created;
DROP INDEX IF EXISTS public.idx_orders_org_status_created;

CREATE OR REPLACE FUNCTION public.bump_order_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Always advance by at least 1. If a caller passed NEW.version > OLD.version,
  -- honor that floor; else use OLD.version + 1.
  IF NEW.version IS NULL OR NEW.version <= OLD.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  -- Always touch updated_at so realtime subscribers see the change. The
  -- handlers already do this in most paths but the trigger guarantees it
  -- even for callers that forget.
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

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

COMMIT;
