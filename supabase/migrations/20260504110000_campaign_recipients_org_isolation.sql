-- 20260504110000_campaign_recipients_org_isolation.sql
-- Task: 5.99.5 (C1 + C2) — close two tenant-isolation gaps on campaign_recipients
-- One-way migration; rollback in
--   supabase/_rollbacks/20260504110000_campaign_recipients_org_isolation.rollback.sql
--
-- WHY:
--   C1 — Migration 20260504005008 added `campaign_recipients.org_id` and backfilled
--        it from the parent campaign, but never added an FK to `organizations(id)`.
--        Sibling migrations 20260504043344 and 20260504061225 do this correctly. Without
--        the FK an org delete cannot cascade and orphan rows are possible.
--   C2 — Baseline policies `allow_select` / `allow_insert` / `allow_update` (lines
--        4566 / 4610 / 4658 of 00000000000000_baseline.sql) are `USING (true)` /
--        `WITH CHECK (true)` — any authenticated request reads any tenant's recipient
--        list including PII (`bounce_reason`, `clicked_url`, `resend_message_id`).
--        Replace with four explicit tenant-scoped policies matching the pattern used
--        by the newer V5 migrations: `org_id = (SELECT org_id FROM users WHERE id = auth.uid())`.
--
-- This is a security fix; once applied, RLS finally gates this table by tenant.

BEGIN;

-- 1. C1 — Add the missing FK on campaign_recipients.org_id ------------------------

-- NOT VALID first so the constraint takes effect for new rows immediately while
-- skipping a full table scan; VALIDATE then proves every existing row is good.
-- The 20260504005008 backfill already populated org_id from campaigns, so VALIDATE
-- should succeed cleanly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaign_recipients_org_id_fkey'
      AND conrelid = 'public.campaign_recipients'::regclass
  ) THEN
    ALTER TABLE public.campaign_recipients
      ADD CONSTRAINT campaign_recipients_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE
        NOT VALID;
  END IF;
END $$;

ALTER TABLE public.campaign_recipients
  VALIDATE CONSTRAINT campaign_recipients_org_id_fkey;

-- 2. C2 — Replace permissive RLS with tenant-scoped policies ---------------------
--
-- DROP POLICY is acceptable here because we immediately replace each with a stricter
-- policy in the same transaction. The old policies were effectively wide-open and
-- this strictly tightens access; service_role_bypass remains intact for backend code.

DROP POLICY IF EXISTS "allow_select" ON public.campaign_recipients;
DROP POLICY IF EXISTS "allow_insert" ON public.campaign_recipients;
DROP POLICY IF EXISTS "allow_update" ON public.campaign_recipients;

-- Tenant-scoped SELECT: an authenticated user sees only their own org's recipients.
CREATE POLICY "tenant_select" ON public.campaign_recipients
  FOR SELECT
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

-- Tenant-scoped INSERT: a row's org_id must match the caller's org.
CREATE POLICY "tenant_insert" ON public.campaign_recipients
  FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

-- Tenant-scoped UPDATE: caller may only modify rows in their own org, and may not
-- relocate a row to another org via the WITH CHECK clause.
CREATE POLICY "tenant_update" ON public.campaign_recipients
  FOR UPDATE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

-- Tenant-scoped DELETE: caller may only delete rows in their own org. Realistically
-- DELETE is service-role-only (workers prune); this exists for completeness so the
-- table has all four operation classes covered.
CREATE POLICY "tenant_delete" ON public.campaign_recipients
  FOR DELETE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

COMMIT;
