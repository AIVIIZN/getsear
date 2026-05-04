-- 20260504110000_campaign_recipients_org_isolation.rollback.sql
-- Inverse of supabase/migrations/20260504110000_campaign_recipients_org_isolation.sql
--
-- Restores the pre-fix state: drops the four tenant-scoped policies, re-creates the
-- baseline permissive `allow_*` policies (verbatim from 00000000000000_baseline.sql
-- lines 4566 / 4610 / 4658), and drops the FK on campaign_recipients.org_id.
--
-- WARNING: Running this rollback re-opens the cross-tenant read path on
-- campaign_recipients (PII exposure). Only execute if reverting the fix is required
-- to unblock a regression; otherwise prefer rolling forward.

BEGIN;

-- 1. Reverse C2 — drop tenant-scoped policies, restore baseline permissive set.
DROP POLICY IF EXISTS "tenant_select" ON public.campaign_recipients;
DROP POLICY IF EXISTS "tenant_insert" ON public.campaign_recipients;
DROP POLICY IF EXISTS "tenant_update" ON public.campaign_recipients;
DROP POLICY IF EXISTS "tenant_delete" ON public.campaign_recipients;

CREATE POLICY "allow_select" ON public.campaign_recipients
  FOR SELECT USING (true);
CREATE POLICY "allow_insert" ON public.campaign_recipients
  FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_update" ON public.campaign_recipients
  FOR UPDATE USING (true);

-- 2. Reverse C1 — drop the FK constraint.
ALTER TABLE public.campaign_recipients
  DROP CONSTRAINT IF EXISTS campaign_recipients_org_id_fkey;

COMMIT;
