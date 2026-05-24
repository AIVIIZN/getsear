-- 20260524112703_constrain_text_status_columns.sql
-- Task: MARK-2 — constrain text-backed status lifecycle columns.
-- One-way migration; rollback in supabase/_rollbacks/20260524112703_constrain_text_status_columns.rollback.sql

BEGIN;

ALTER TABLE public.accounting_sync_log
  ADD CONSTRAINT accounting_sync_log_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text]))
  NOT VALID;

ALTER TABLE public.campaign_recipients
  ADD CONSTRAINT campaign_recipients_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'queued'::text,
    'sent'::text,
    'delivered'::text,
    'opened'::text,
    'clicked'::text,
    'bounced'::text,
    'failed'::text
  ]))
  NOT VALID;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_status_check
  CHECK (status = ANY (ARRAY[
    'draft'::text,
    'scheduled'::text,
    'sending'::text,
    'sent'::text,
    'cancelled'::text
  ]))
  NOT VALID;

ALTER TABLE public.catering_events
  ADD CONSTRAINT catering_events_status_check
  CHECK (status = ANY (ARRAY[
    'inquiry'::text,
    'quoted'::text,
    'proposal'::text,
    'proposal_sent'::text,
    'confirmed'::text,
    'in_progress'::text,
    'completed'::text,
    'cancelled'::text
  ]))
  NOT VALID;

ALTER TABLE public.chargebacks
  ADD CONSTRAINT chargebacks_status_check
  CHECK (status = ANY (ARRAY[
    'open'::text,
    'evidence_submitted'::text,
    'won'::text,
    'lost'::text,
    'expired'::text
  ]))
  NOT VALID;

ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'assigned'::text,
    'picked_up'::text,
    'in_transit'::text,
    'en_route'::text,
    'delivered'::text,
    'cancelled'::text
  ]))
  NOT VALID;

ALTER TABLE public.franchise_royalties
  ADD CONSTRAINT franchise_royalties_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'invoiced'::text,
    'paid'::text,
    'overdue'::text
  ]))
  NOT VALID;

ALTER TABLE public.online_order_queue
  ADD CONSTRAINT online_order_queue_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'accepted'::text,
    'rejected'::text,
    'ready'::text,
    'completed'::text
  ]))
  NOT VALID;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_subscription_status_check
  CHECK (subscription_status = ANY (ARRAY[
    'trialing'::text,
    'active'::text,
    'past_due'::text,
    'cancelled'::text,
    'expired'::text
  ]))
  NOT VALID;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_status_check
  CHECK (status = ANY (ARRAY[
    'draft'::text,
    'submitted'::text,
    'sent'::text,
    'received'::text,
    'reconciled'::text,
    'cancelled'::text
  ]))
  NOT VALID;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'confirmed'::text,
    'seated'::text,
    'completed'::text,
    'cancelled'::text,
    'no_show'::text
  ]))
  NOT VALID;

ALTER TABLE public.scheduled_shifts
  ADD CONSTRAINT scheduled_shifts_status_check
  CHECK (status = ANY (ARRAY[
    'scheduled'::text,
    'draft'::text,
    'published'::text,
    'confirmed'::text,
    'swapped'::text,
    'cancelled'::text
  ]))
  NOT VALID;

ALTER TABLE public.shift_swap_requests
  ADD CONSTRAINT shift_swap_requests_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'approved'::text,
    'rejected'::text,
    'cancelled'::text
  ]))
  NOT VALID;

ALTER TABLE public.tables
  ADD CONSTRAINT tables_status_check
  CHECK (status = ANY (ARRAY[
    'available'::text,
    'occupied'::text,
    'reserved'::text,
    'dirty'::text,
    'blocked'::text
  ]))
  NOT VALID;

ALTER TABLE public.waitlist_entries
  ADD CONSTRAINT waitlist_entries_status_check
  CHECK (status = ANY (ARRAY[
    'waiting'::text,
    'notified'::text,
    'seated'::text,
    'left'::text,
    'cancelled'::text
  ]))
  NOT VALID;

ALTER TABLE public.accounting_sync_log VALIDATE CONSTRAINT accounting_sync_log_status_check;
ALTER TABLE public.campaign_recipients VALIDATE CONSTRAINT campaign_recipients_status_check;
ALTER TABLE public.campaigns VALIDATE CONSTRAINT campaigns_status_check;
ALTER TABLE public.catering_events VALIDATE CONSTRAINT catering_events_status_check;
ALTER TABLE public.chargebacks VALIDATE CONSTRAINT chargebacks_status_check;
ALTER TABLE public.deliveries VALIDATE CONSTRAINT deliveries_status_check;
ALTER TABLE public.franchise_royalties VALIDATE CONSTRAINT franchise_royalties_status_check;
ALTER TABLE public.online_order_queue VALIDATE CONSTRAINT online_order_queue_status_check;
ALTER TABLE public.organizations VALIDATE CONSTRAINT organizations_subscription_status_check;
ALTER TABLE public.purchase_orders VALIDATE CONSTRAINT purchase_orders_status_check;
ALTER TABLE public.reservations VALIDATE CONSTRAINT reservations_status_check;
ALTER TABLE public.scheduled_shifts VALIDATE CONSTRAINT scheduled_shifts_status_check;
ALTER TABLE public.shift_swap_requests VALIDATE CONSTRAINT shift_swap_requests_status_check;
ALTER TABLE public.tables VALIDATE CONSTRAINT tables_status_check;
ALTER TABLE public.waitlist_entries VALIDATE CONSTRAINT waitlist_entries_status_check;

COMMIT;
