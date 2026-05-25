-- 20260525050335_reconcile_trust3_schema_drift.sql
-- Task: TRUST-3 — reconcile live schema drift so db:diff is trustworthy.
-- One-way migration; rollback in supabase/_rollbacks/20260525050335_reconcile_trust3_schema_drift.rollback.sql
--
-- The linked Supabase project already has this effective schema. This file
-- folds the live-only drift back into the committed migration chain so a fresh
-- migration replay matches production and `npm run db:diff` can pass.

BEGIN;

DROP INDEX IF EXISTS public.idx_house_account_transactions_org_created;

CREATE INDEX IF NOT EXISTS idx_audit_log_org_created
  ON public.audit_log USING btree (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_org_status_created
  ON public.orders USING btree (org_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION public.bump_order_version()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.version IS NULL OR NEW.version <= OLD.version THEN
    NEW.version := OLD.version + 1;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  claims jsonb;
  user_org_id uuid;
  user_role text;
  user_is_active boolean;
BEGIN
  claims := COALESCE(event->'claims', '{}'::jsonb);

  SELECT u.org_id, u.role::text, u.is_active
    INTO user_org_id, user_role, user_is_active
    FROM public.users u
    WHERE u.id = (event->>'user_id')::uuid
      AND u.deleted_at IS NULL
    LIMIT 1;

  IF user_org_id IS NULL THEN
    RETURN jsonb_build_object('claims', claims);
  END IF;

  claims := claims || jsonb_build_object(
    'org_id',     user_org_id::text,
    'user_role',  user_role,
    'is_active',  user_is_active
  );

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
$function$;

COMMIT;
