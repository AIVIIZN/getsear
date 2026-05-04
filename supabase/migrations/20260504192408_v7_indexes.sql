-- 20260504192408_v7_indexes.sql
-- Task: V7.2.1 — Index audit + missing-index migration
-- Adds 10 indexes covering hot-path queries identified by codebase grep
-- and confirmed via EXPLAIN ANALYZE / Supabase performance advisor.
-- Rollback: supabase/_rollbacks/20260504192408_v7_indexes.rollback.sql
--
-- Notes:
--   * Plain CREATE INDEX (not CONCURRENTLY) so the migration can run inside
--     Supabase's txn wrapper. Staging row counts are <500 per affected table;
--     the brief table-lock is acceptable. If row counts grow before this
--     reaches prod, the main session can switch to CONCURRENTLY by running
--     each statement standalone via execute_sql.
--   * IF NOT EXISTS makes this idempotent — safe to re-run.
--   * Every index leads with org_id (tenant-scoped tables) for max selectivity
--     and to satisfy the multi-tenant invariant.

BEGIN;

-- 1. KDS station event timeline. station-by-station scroll loads all events
--    for the org+station, newest first. (kds_ticket_events.station_id is
--    flagged as unindexed FK by Supabase advisor.)
CREATE INDEX IF NOT EXISTS idx_kds_ticket_events_org_station_created
  ON public.kds_ticket_events (org_id, station_id, created_at DESC);

-- 2. KDS event-by-order lookup (FK from kds_ticket_events to orders).
--    Used when bumping/recalling tickets — fetches all events for an order.
CREATE INDEX IF NOT EXISTS idx_kds_ticket_events_order
  ON public.kds_ticket_events (order_id);

-- 3. Inventory ledger by org, newest first. Currently Seq Scan
--    (EXPLAIN ANALYZE: cost=0..14.38, Filter on org_id, no index used).
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_org_created
  ON public.inventory_transactions (org_id, created_at DESC);

-- 4. Per-item inventory history (FK lookup + chronological scroll).
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item_created
  ON public.inventory_transactions (inventory_item_id, created_at DESC);

-- 5. House-account ledger by org, newest first. Currently Seq Scan
--    (EXPLAIN ANALYZE: same pattern as inventory_transactions).
CREATE INDEX IF NOT EXISTS idx_house_account_transactions_org_created
  ON public.house_account_transactions (org_id, created_at DESC);

-- 6. Accounting sync log by org, newest first. The org_id FK is unindexed
--    (advisor lint) and the dashboard lists recent syncs per tenant.
CREATE INDEX IF NOT EXISTS idx_accounting_sync_log_org_created
  ON public.accounting_sync_log (org_id, created_at DESC);

-- 7. Printer worker poll loop: SELECT pending jobs by org+status,
--    oldest first. printer_id FK and org_id FK both unindexed.
CREATE INDEX IF NOT EXISTS idx_print_queue_org_status_created
  ON public.print_queue (org_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_print_queue_printer_status
  ON public.print_queue (printer_id, status);

-- 8. Online-order operator queue: SELECT pending orders by location+status,
--    newest first. All four FKs (org_id, location_id, order_id, accepted_by)
--    are flagged unindexed.
CREATE INDEX IF NOT EXISTS idx_online_order_queue_loc_status_created
  ON public.online_order_queue (location_id, status, created_at DESC);

-- 9. Loyalty account history (FK lookup + chronological).
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_account_created
  ON public.loyalty_transactions (loyalty_account_id, created_at DESC);

-- 10. order_modifications: org+created_at chronological reads
--     (audit / forensics). org_id index already exists, but composite
--     with created_at DESC eliminates the sort step.
CREATE INDEX IF NOT EXISTS idx_order_modifications_org_created
  ON public.order_modifications (org_id, created_at DESC);

COMMIT;
