-- 20260524112703_constrain_text_status_columns.rollback.sql
-- Rollback for MARK-2 text status lifecycle constraints.

BEGIN;

ALTER TABLE public.waitlist_entries DROP CONSTRAINT IF EXISTS waitlist_entries_status_check;
ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS tables_status_check;
ALTER TABLE public.shift_swap_requests DROP CONSTRAINT IF EXISTS shift_swap_requests_status_check;
ALTER TABLE public.scheduled_shifts DROP CONSTRAINT IF EXISTS scheduled_shifts_status_check;
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS reservations_status_check;
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_subscription_status_check;
ALTER TABLE public.online_order_queue DROP CONSTRAINT IF EXISTS online_order_queue_status_check;
ALTER TABLE public.franchise_royalties DROP CONSTRAINT IF EXISTS franchise_royalties_status_check;
ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_status_check;
ALTER TABLE public.chargebacks DROP CONSTRAINT IF EXISTS chargebacks_status_check;
ALTER TABLE public.catering_events DROP CONSTRAINT IF EXISTS catering_events_status_check;
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
ALTER TABLE public.campaign_recipients DROP CONSTRAINT IF EXISTS campaign_recipients_status_check;
ALTER TABLE public.accounting_sync_log DROP CONSTRAINT IF EXISTS accounting_sync_log_status_check;

COMMIT;
