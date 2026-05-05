-- 20260504194320_v7_indexes_align.rollback.sql
-- Inverse of supabase/migrations/20260504194320_v7_indexes_align.sql
--
-- WARNING: idx_campaign_recipients_campaign_status is ALSO declared in
-- 20260504005008_add_campaign_recipients_indexes.sql. Dropping it here
-- without also reverting that migration will leave the schema in a state
-- where a `db reset` recreates it from the earlier file. That's harmless
-- (the index is desired) but expected — this rollback only undoes the
-- alignment file, not the original index creation.
--
-- Indexes only — no data loss.

BEGIN;

DROP INDEX IF EXISTS public.idx_kds_ticket_events_item_event_created;
DROP INDEX IF EXISTS public.idx_house_account_transactions_account_created;
DROP INDEX IF EXISTS public.idx_order_modifications_order_created;
DROP INDEX IF EXISTS public.idx_campaign_recipients_campaign_status;

COMMIT;
