-- 20260505030000_sec2_close_rls_lockout.sql
-- Task: SEC-2 — close the RLS-no-policies lockout on 9 tables
-- One-way migration; rollback in
--   supabase/_rollbacks/20260505030000_sec2_close_rls_lockout.rollback.sql
--
-- WHY:
--   Three independent cross-cutting audit specialists (P0-SEC-2 + migration-author
--   P1-1 + supabase P1-5) flagged 9 tables that have `relrowsecurity = true` but
--   ZERO policies. In Postgres, "RLS enabled + no policies" means every query from
--   `authenticated` (and any non-bypass role) returns zero rows and every write
--   silently fails the policy check. These tables are effectively unreachable for
--   the application despite being part of feature surfaces (printers, drive-thru,
--   inventory waste, shift marketplace, etc.).
--
--   The fix: add the canonical 4-policy tenant scope (SELECT/INSERT/UPDATE/DELETE)
--   plus a service_role_bypass policy on each. Policy expression matches the V5
--   idiomatic pattern used by 20260504110000_campaign_recipients_org_isolation:
--     org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
--
-- CLASSIFICATION (verified via execute_sql against project lbekiyxqemxozmghgmtp):
--   All 9 tables have `org_id uuid NOT NULL` — every one is tenant-scoped.
--   Some additionally carry `location_id` (nullable on most), but org_id is the
--   primary tenant boundary so policies key off org_id only. Cross-org joins on
--   location_id would still be blocked because every row's org_id is checked first.
--
--     drive_thru_cars       → tenant-scoped (org_id only)
--     drive_thru_lanes      → tenant-scoped (org_id only; location_id nullable)
--     inventory_waste_log   → tenant-scoped (org_id only; location_id nullable)
--     order_throttle_config → tenant-scoped (org_id only; location_id nullable)
--     print_queue           → tenant-scoped (org_id only)
--     print_routing         → tenant-scoped (org_id only; location_id nullable)
--     printers              → tenant-scoped (org_id only; location_id NOT NULL)
--     receipt_config        → tenant-scoped (org_id only; location_id nullable)
--     shift_marketplace     → tenant-scoped (org_id only)
--
-- SAFETY:
--   Pre-migration verification confirmed pg_policy rows = 0 for all 9 tables, so
--   there is no name collision risk. CREATE POLICY is non-idempotent in Postgres,
--   so this migration is a clean first-write. Rollback drops every policy this
--   migration created and restores the pre-existing zero-policy state.

BEGIN;

-- ============================================================================
-- 1. drive_thru_cars — per-car records during a drive-thru visit
-- ============================================================================

CREATE POLICY tenant_select ON public.drive_thru_cars
  FOR SELECT
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_insert ON public.drive_thru_cars
  FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_update ON public.drive_thru_cars
  FOR UPDATE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_delete ON public.drive_thru_cars
  FOR DELETE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY service_role_bypass ON public.drive_thru_cars
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2. drive_thru_lanes — lane configuration per location
-- ============================================================================

CREATE POLICY tenant_select ON public.drive_thru_lanes
  FOR SELECT
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_insert ON public.drive_thru_lanes
  FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_update ON public.drive_thru_lanes
  FOR UPDATE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_delete ON public.drive_thru_lanes
  FOR DELETE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY service_role_bypass ON public.drive_thru_lanes
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. inventory_waste_log — tenant audit trail of inventory waste events
-- ============================================================================

CREATE POLICY tenant_select ON public.inventory_waste_log
  FOR SELECT
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_insert ON public.inventory_waste_log
  FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_update ON public.inventory_waste_log
  FOR UPDATE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_delete ON public.inventory_waste_log
  FOR DELETE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY service_role_bypass ON public.inventory_waste_log
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. order_throttle_config — per-tenant or per-location order throttle config
-- ============================================================================

CREATE POLICY tenant_select ON public.order_throttle_config
  FOR SELECT
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_insert ON public.order_throttle_config
  FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_update ON public.order_throttle_config
  FOR UPDATE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_delete ON public.order_throttle_config
  FOR DELETE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY service_role_bypass ON public.order_throttle_config
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 5. print_queue — per-tenant printer job queue
-- ============================================================================

CREATE POLICY tenant_select ON public.print_queue
  FOR SELECT
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_insert ON public.print_queue
  FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_update ON public.print_queue
  FOR UPDATE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_delete ON public.print_queue
  FOR DELETE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY service_role_bypass ON public.print_queue
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 6. print_routing — per-tenant routing rules from prep stations to printers
-- ============================================================================

CREATE POLICY tenant_select ON public.print_routing
  FOR SELECT
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_insert ON public.print_routing
  FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_update ON public.print_routing
  FOR UPDATE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_delete ON public.print_routing
  FOR DELETE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY service_role_bypass ON public.print_routing
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 7. printers — per-tenant printer hardware registry
-- ============================================================================

CREATE POLICY tenant_select ON public.printers
  FOR SELECT
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_insert ON public.printers
  FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_update ON public.printers
  FOR UPDATE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_delete ON public.printers
  FOR DELETE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY service_role_bypass ON public.printers
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 8. receipt_config — per-tenant receipt template / printer settings
-- ============================================================================

CREATE POLICY tenant_select ON public.receipt_config
  FOR SELECT
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_insert ON public.receipt_config
  FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_update ON public.receipt_config
  FOR UPDATE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_delete ON public.receipt_config
  FOR DELETE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY service_role_bypass ON public.receipt_config
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 9. shift_marketplace — per-tenant shift-trade / pickup board
-- ============================================================================

CREATE POLICY tenant_select ON public.shift_marketplace
  FOR SELECT
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_insert ON public.shift_marketplace
  FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_update ON public.shift_marketplace
  FOR UPDATE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY tenant_delete ON public.shift_marketplace
  FOR DELETE
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY service_role_bypass ON public.shift_marketplace
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
