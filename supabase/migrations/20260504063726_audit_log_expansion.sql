-- 20260504063726_audit_log_expansion.sql
-- Task: 5.4.3 — Audit log expansion
-- One-way migration; rollback in supabase/_rollbacks/20260504063726_audit_log_expansion.rollback.sql
--
-- WHY: V5.4.3 expands audit_log so every privileged action (void, comp,
-- discount, cash drop, manager override, drawer-open) carries the full
-- forensic context the compliance/dispute pipeline needs:
--   - manager_pin_user_id: when an action was PIN-gated, who supplied the
--     PIN (the *authority*) — distinct from the actor (cashier) recorded
--     in user_id.
--   - before_state / after_state: typed jsonb snapshots of the entity
--     surrounding the change (e.g., payment row before & after a void).
--     The baseline already has previous_state/new_state but the V5.4.x
--     code path standardises on before_state/after_state — both are kept
--     for backward compatibility with rows written before this migration.
--   - reason: free-text rationale (the cashier's "why").
--
-- Append-only invariant: no DELETE policy was ever created on this table;
-- this migration adds an explicit deny-all DELETE policy for defense in
-- depth so a future migration author cannot accidentally enable deletes.
-- The service-role bypass remains intact for support tooling that needs
-- to manually purge a tenant on offboarding.

BEGIN;

-- 1. New columns. All nullable so existing inserts continue to work.
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS manager_pin_user_id uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS before_state jsonb,
  ADD COLUMN IF NOT EXISTS after_state jsonb,
  ADD COLUMN IF NOT EXISTS reason text;

COMMENT ON COLUMN public.audit_log.manager_pin_user_id IS
  'When the action was manager-PIN-gated, the user_id of the manager whose '
  'PIN was used to authorise it. NULL when no PIN was required (e.g., the '
  'actor was already manager-role). Distinct from user_id, which is always '
  'the cashier/server who initiated the action.';

COMMENT ON COLUMN public.audit_log.before_state IS
  'Typed jsonb snapshot of the affected entity immediately before the '
  'change. Standard fields: id, status, amount_cents, etc. Snake_case.';

COMMENT ON COLUMN public.audit_log.after_state IS
  'Typed jsonb snapshot of the affected entity immediately after the change.';

COMMENT ON COLUMN public.audit_log.reason IS
  'Human-readable rationale entered by the actor (e.g., "Customer changed '
  'mind", "Wrong food fired"). Free text; not parsed.';

-- 2. Hot-path indexes for the back-office filter UI.
CREATE INDEX IF NOT EXISTS idx_audit_manager_pin_user
  ON public.audit_log (manager_pin_user_id)
  WHERE manager_pin_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_org_action_date
  ON public.audit_log (org_id, action, created_at DESC);

-- 3. Append-only enforcement. The baseline never created an UPDATE or
-- DELETE policy, so PostgREST already refuses both for authenticated
-- callers. We add explicit "false" policies to make the intent visible
-- and to survive any future "ENABLE ALL" sweep on the table.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_log'
      AND policyname = 'audit_log_no_update'
  ) THEN
    EXECUTE 'CREATE POLICY audit_log_no_update ON public.audit_log
             FOR UPDATE USING (false) WITH CHECK (false)';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'audit_log'
      AND policyname = 'audit_log_no_delete'
  ) THEN
    EXECUTE 'CREATE POLICY audit_log_no_delete ON public.audit_log
             FOR DELETE USING (false)';
  END IF;
END $$;

COMMIT;
