-- Inverse of supabase/migrations/20260524124110_constrain_marketing_statuses.sql

BEGIN;

ALTER TABLE public.campaign_recipients
  DROP CONSTRAINT IF EXISTS campaign_recipients_status_check;

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_status_check;

ALTER TABLE public.campaign_recipients
  ALTER COLUMN status SET DEFAULT 'pending';

COMMIT;
