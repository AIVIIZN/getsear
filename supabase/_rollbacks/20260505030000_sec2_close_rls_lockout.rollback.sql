-- 20260505030000_sec2_close_rls_lockout.rollback.sql
-- Rollback for SEC-2 — drop the 5 policies (4 tenant + 1 service_role_bypass)
-- on each of the 9 RLS-lockout tables. Returns each table to the pre-migration
-- "RLS enabled + zero policies" state. Apply only if a regression in the SELECT
-- expression breaks application reads and a forward fix is not feasible.

BEGIN;

-- 1. drive_thru_cars
DROP POLICY IF EXISTS tenant_select ON public.drive_thru_cars;
DROP POLICY IF EXISTS tenant_insert ON public.drive_thru_cars;
DROP POLICY IF EXISTS tenant_update ON public.drive_thru_cars;
DROP POLICY IF EXISTS tenant_delete ON public.drive_thru_cars;
DROP POLICY IF EXISTS service_role_bypass ON public.drive_thru_cars;

-- 2. drive_thru_lanes
DROP POLICY IF EXISTS tenant_select ON public.drive_thru_lanes;
DROP POLICY IF EXISTS tenant_insert ON public.drive_thru_lanes;
DROP POLICY IF EXISTS tenant_update ON public.drive_thru_lanes;
DROP POLICY IF EXISTS tenant_delete ON public.drive_thru_lanes;
DROP POLICY IF EXISTS service_role_bypass ON public.drive_thru_lanes;

-- 3. inventory_waste_log
DROP POLICY IF EXISTS tenant_select ON public.inventory_waste_log;
DROP POLICY IF EXISTS tenant_insert ON public.inventory_waste_log;
DROP POLICY IF EXISTS tenant_update ON public.inventory_waste_log;
DROP POLICY IF EXISTS tenant_delete ON public.inventory_waste_log;
DROP POLICY IF EXISTS service_role_bypass ON public.inventory_waste_log;

-- 4. order_throttle_config
DROP POLICY IF EXISTS tenant_select ON public.order_throttle_config;
DROP POLICY IF EXISTS tenant_insert ON public.order_throttle_config;
DROP POLICY IF EXISTS tenant_update ON public.order_throttle_config;
DROP POLICY IF EXISTS tenant_delete ON public.order_throttle_config;
DROP POLICY IF EXISTS service_role_bypass ON public.order_throttle_config;

-- 5. print_queue
DROP POLICY IF EXISTS tenant_select ON public.print_queue;
DROP POLICY IF EXISTS tenant_insert ON public.print_queue;
DROP POLICY IF EXISTS tenant_update ON public.print_queue;
DROP POLICY IF EXISTS tenant_delete ON public.print_queue;
DROP POLICY IF EXISTS service_role_bypass ON public.print_queue;

-- 6. print_routing
DROP POLICY IF EXISTS tenant_select ON public.print_routing;
DROP POLICY IF EXISTS tenant_insert ON public.print_routing;
DROP POLICY IF EXISTS tenant_update ON public.print_routing;
DROP POLICY IF EXISTS tenant_delete ON public.print_routing;
DROP POLICY IF EXISTS service_role_bypass ON public.print_routing;

-- 7. printers
DROP POLICY IF EXISTS tenant_select ON public.printers;
DROP POLICY IF EXISTS tenant_insert ON public.printers;
DROP POLICY IF EXISTS tenant_update ON public.printers;
DROP POLICY IF EXISTS tenant_delete ON public.printers;
DROP POLICY IF EXISTS service_role_bypass ON public.printers;

-- 8. receipt_config
DROP POLICY IF EXISTS tenant_select ON public.receipt_config;
DROP POLICY IF EXISTS tenant_insert ON public.receipt_config;
DROP POLICY IF EXISTS tenant_update ON public.receipt_config;
DROP POLICY IF EXISTS tenant_delete ON public.receipt_config;
DROP POLICY IF EXISTS service_role_bypass ON public.receipt_config;

-- 9. shift_marketplace
DROP POLICY IF EXISTS tenant_select ON public.shift_marketplace;
DROP POLICY IF EXISTS tenant_insert ON public.shift_marketplace;
DROP POLICY IF EXISTS tenant_update ON public.shift_marketplace;
DROP POLICY IF EXISTS tenant_delete ON public.shift_marketplace;
DROP POLICY IF EXISTS service_role_bypass ON public.shift_marketplace;

COMMIT;
