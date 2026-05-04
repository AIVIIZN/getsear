-- 20260504192408_v7_indexes.rollback.sql
-- Rollback for: 20260504192408_v7_indexes.sql (V7.2.1 — index audit)
-- Drops the 11 indexes added by the forward migration.
-- Indexes only — no data is lost.

BEGIN;

DROP INDEX IF EXISTS public.idx_kds_ticket_events_org_station_created;
DROP INDEX IF EXISTS public.idx_kds_ticket_events_order;
DROP INDEX IF EXISTS public.idx_inventory_transactions_org_created;
DROP INDEX IF EXISTS public.idx_inventory_transactions_item_created;
DROP INDEX IF EXISTS public.idx_house_account_transactions_org_created;
DROP INDEX IF EXISTS public.idx_accounting_sync_log_org_created;
DROP INDEX IF EXISTS public.idx_print_queue_org_status_created;
DROP INDEX IF EXISTS public.idx_print_queue_printer_status;
DROP INDEX IF EXISTS public.idx_online_order_queue_loc_status_created;
DROP INDEX IF EXISTS public.idx_loyalty_transactions_account_created;
DROP INDEX IF EXISTS public.idx_order_modifications_org_created;

COMMIT;
