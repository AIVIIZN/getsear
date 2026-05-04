-- 20260504063720_add_order_version_columns.sql
-- Task: 5.4.1 — optimistic locking for orders
-- One-way migration; rollback in supabase/_rollbacks/20260504063720_add_order_version_columns.rollback.sql
--
-- WHY: Two terminals frequently edit the same order at the same time
-- ("Sally added an appetizer; the bartender just split the check"). Without
-- a version column, last-write-wins silently clobbers concurrent edits and
-- the kitchen ends up with the wrong ticket. V5.4.1 introduces a per-order
-- monotonic version that the API checks against an `If-Match` header on
-- every mutating request: mismatch → 409 with the current state, the client
-- shows the StaleOrderModal, the user merges manually.
--
-- Mechanism:
--   - `orders.version int NOT NULL DEFAULT 1` — every existing row starts at 1
--   - BEFORE-UPDATE trigger that auto-increments `version` on every row update.
--     The trigger is the source of truth: handlers don't manually `version + 1`,
--     so a route that forgets the bump still gets monotonic versions. The
--     trigger is a no-op when the new version was passed in (e.g., ON CONFLICT
--     replays from the offline queue) since `NEW.version > OLD.version` already
--     holds; we still bump beyond that to guarantee monotonicity.
--   - Additive only: existing INSERTs that don't mention `version` get DEFAULT 1.
--     Existing UPDATEs that don't mention `version` get auto-bumped by the
--     trigger. No application code change is forced by this migration alone.
--
-- Concurrency note: Postgres BEFORE-UPDATE triggers run inside the row's
-- already-acquired exclusive lock for that update statement, so two concurrent
-- writers serialize on the row. Either both succeed sequentially (each sees
-- the other's bump) or one's WHERE-clause-on-version misses (handler returns
-- 409). We do NOT use SELECT FOR UPDATE in handlers — the version-check WHERE
-- clause is the lock.

BEGIN;

-- 1. Add the version column with a safe default. Existing rows get version=1.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.orders.version IS
  'Optimistic-lock version. Monotonically increased by trigger on every UPDATE. '
  'API mutating routes check `If-Match: <version>` and return 409 on mismatch '
  'with the current server state. See src/lib/orders/concurrency.ts.';

-- 2. Trigger function: bump version on every UPDATE. Idempotent and self-healing —
--    if the caller tried to set NEW.version (replay, manual fix, etc.), we still
--    force a bump beyond OLD.version so monotonicity holds across all writers.
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

COMMENT ON FUNCTION public.bump_order_version() IS
  'Auto-increment orders.version on every UPDATE. Source of truth for the '
  'V5.4.1 optimistic-lock check; handlers must not skip this trigger.';

-- 3. Wire the trigger. DROP-then-CREATE is safe in a fresh migration; the
--    DROP IF EXISTS guard makes it idempotent if the migration is partially
--    re-run.
DROP TRIGGER IF EXISTS bump_order_version_trigger ON public.orders;

CREATE TRIGGER bump_order_version_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  -- Only fire if anything actually changed; avoids noise on no-op writes.
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION public.bump_order_version();

COMMENT ON TRIGGER bump_order_version_trigger ON public.orders IS
  'BEFORE UPDATE: increments orders.version. Skips no-op updates (OLD = NEW). '
  'See migration 20260504063720_add_order_version_columns.sql.';

-- 4. Index for the (id, version, org_id) lookup that handlers will perform.
--    The PK already covers (id); adding a partial covering index for the
--    common 3-tuple speeds up the WHERE id=? AND version=? AND org_id=?
--    pattern that gates every conditional update.
CREATE INDEX IF NOT EXISTS orders_id_version_org_idx
  ON public.orders(id, version, org_id);

COMMIT;
