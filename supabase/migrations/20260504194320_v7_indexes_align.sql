-- 20260504194320_v7_indexes_align.sql
-- Task: DATA-1 — Phantom V7.2.1 alignment
-- One-way migration; rollback in supabase/_rollbacks/20260504194320_v7_indexes_align.rollback.sql
--
-- WHY: The migration-author cross-cutting audit (build-pipeline/logs/
-- cross-cutting-reviews/2026-05-05/migration-author.md) found that the row
--   version=20260504194320 name='v7_indexes_align'
-- exists in supabase_migrations.schema_migrations on the live project
-- (lbekiyxqemxozmghgmtp) but no matching SQL file exists in
-- supabase/migrations/. That makes `supabase db diff` flag drift forever,
-- and any future `supabase db reset` would fail to reproduce production.
--
-- The four indexes recorded under that phantom version were created on
-- live by an out-of-band run during the V7.2.1 batch (see commit
-- 56275d8 "fix(7.2.1): online_order_queue index leads with org_id" —
-- this companion alignment file was never authored).
--
-- This file reproduces those indexes verbatim (queried from pg_indexes on
-- the live project before authoring, see task brief). Each uses
-- IF NOT EXISTS so applying this against a database that already has the
-- index (production) is a no-op, while a fresh `db reset` will recreate
-- them and the schema_migrations row.
--
-- NOTE: idx_campaign_recipients_campaign_status is ALSO declared in
-- 20260504005008_add_campaign_recipients_indexes.sql with the same
-- definition (campaign_id, status). The migration-author audit flagged
-- this as a duplicate. Including it here anyway so this alignment file
-- is a faithful mirror of what schema_migrations records — Postgres'
-- IF NOT EXISTS makes the second declaration a no-op.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_kds_ticket_events_item_event_created
  ON public.kds_ticket_events USING btree (order_item_id, event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_house_account_transactions_account_created
  ON public.house_account_transactions USING btree (house_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_modifications_order_created
  ON public.order_modifications USING btree (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_status
  ON public.campaign_recipients USING btree (campaign_id, status);

COMMIT;
