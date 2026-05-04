-- 20260504043344_add_org_processor_binding.sql
-- Task: 5.2.0a — processor-binding migration
-- One-way migration; rollback in supabase/_rollbacks/20260504043344_add_org_processor_binding.rollback.sql
--
-- WHY: Sear's business model is processor-locked merchant onboarding. Each org gets
-- exactly one assigned payment processor (Valor at launch); switching is forbidden by
-- contract and must be impossible by software. This migration enforces that lock as
-- the database layer of a 3-layer defense (TypeScript const literal type, this DB
-- table + immutability trigger, and the absence of any UI surface).
-- See build-pipeline/versions/V5_OPERATIONAL.md → Batch 5.2 → 5.2.0.

BEGIN;

-- 1. The binding table. PK on org_id makes it 1:1 with organizations and prevents
--    duplicate bindings at the schema level.
CREATE TABLE IF NOT EXISTS public.org_processor_bindings (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  processor text NOT NULL CHECK (processor IN ('valor')),
  bound_at timestamptz NOT NULL DEFAULT now(),
  bound_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.org_processor_bindings IS
  'Processor lock per org. Set once at onboarding; immutable thereafter. See V5.2.0 spec.';

COMMENT ON COLUMN public.org_processor_bindings.processor IS
  'Allowed processors are constrained at the CHECK level (currently only ''valor''). '
  'Adding a new processor requires (a) a code change to expand the Processor const '
  'literal type, (b) a migration that widens this CHECK, and (c) Sear staff review.';

COMMENT ON COLUMN public.org_processor_bindings.bound_by_user_id IS
  'Owner user who completed onboarding for this org. Nullable because ON DELETE SET NULL '
  'on the FK and because backfill may not find an owner row for legacy orgs.';

-- 2. Immutability trigger. Even raw-SQL admin tooling cannot change the processor
--    field on an existing row. INSERT remains free; DELETE cascades from the org.
CREATE OR REPLACE FUNCTION public.prevent_processor_binding_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.processor IS DISTINCT FROM NEW.processor THEN
    RAISE EXCEPTION 'org_processor_bindings.processor is immutable (org_id=%, attempted to change from % to %)',
      OLD.org_id, OLD.processor, NEW.processor
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.prevent_processor_binding_change() IS
  'Enforces V5.2.0 invariant: org_processor_bindings.processor is write-once. '
  'Raises with ERRCODE check_violation so callers can catch predictably.';

DROP TRIGGER IF EXISTS prevent_processor_binding_change ON public.org_processor_bindings;
CREATE TRIGGER prevent_processor_binding_change
  BEFORE UPDATE ON public.org_processor_bindings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_processor_binding_change();

-- 3. Backfill. Every existing org gets a Valor binding; bound_by_user_id resolves
--    to the org's owner if one exists, else NULL. Idempotent via ON CONFLICT.
INSERT INTO public.org_processor_bindings (org_id, processor, bound_at, bound_by_user_id)
SELECT
  o.id,
  'valor',
  now(),
  (SELECT u.id FROM public.users u WHERE u.org_id = o.id AND u.role = 'owner' LIMIT 1)
FROM public.organizations o
ON CONFLICT (org_id) DO NOTHING;

-- 4. RLS. Tenants may read their own binding. INSERT/UPDATE/DELETE have NO policies
--    for the authenticated role, which means those operations are denied for any
--    non-service-role caller. The service_role bypasses RLS by default, so backend
--    onboarding flows can still write the initial row. Even an org owner cannot
--    mutate their own binding via the REST API — by design.
ALTER TABLE public.org_processor_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_processor_bindings_tenant_select
  ON public.org_processor_bindings
  FOR SELECT
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

COMMIT;
