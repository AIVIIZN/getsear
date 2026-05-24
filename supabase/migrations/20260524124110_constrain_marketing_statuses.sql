-- 20260524124110_constrain_marketing_statuses.sql
-- Task: MARK-2 — constrain campaign and campaign_recipients status drift
-- One-way migration; rollback in
--   supabase/_rollbacks/20260524124110_constrain_marketing_statuses.rollback.sql

BEGIN;

-- Existing legacy recipient rows used the baseline default `pending`; all
-- current send paths enqueue rows as `queued`, so normalize before tightening.
UPDATE public.campaign_recipients
SET status = 'queued'
WHERE status = 'pending';

ALTER TABLE public.campaign_recipients
  ALTER COLUMN status SET DEFAULT 'queued';

DO $$
DECLARE
  invalid_statuses text;
BEGIN
  SELECT string_agg(status || ':' || count::text, ', ' ORDER BY status)
  INTO invalid_statuses
  FROM (
    SELECT status, count(*) AS count
    FROM public.campaign_recipients
    WHERE status NOT IN (
      'queued',
      'sent',
      'delivered',
      'opened',
      'clicked',
      'bounced',
      'failed'
    )
    GROUP BY status
  ) bad_statuses;

  IF invalid_statuses IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot constrain campaign_recipients.status; invalid statuses: %',
      invalid_statuses;
  END IF;
END $$;

DO $$
DECLARE
  invalid_statuses text;
BEGIN
  SELECT string_agg(status || ':' || count::text, ', ' ORDER BY status)
  INTO invalid_statuses
  FROM (
    SELECT status, count(*) AS count
    FROM public.campaigns
    WHERE status NOT IN (
      'draft',
      'scheduled',
      'sending',
      'sent',
      'paused',
      'cancelled',
      'failed'
    )
    GROUP BY status
  ) bad_statuses;

  IF invalid_statuses IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot constrain campaigns.status; invalid statuses: %',
      invalid_statuses;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaign_recipients_status_check'
      AND conrelid = 'public.campaign_recipients'::regclass
  ) THEN
    ALTER TABLE public.campaign_recipients
      ADD CONSTRAINT campaign_recipients_status_check
      CHECK (
        status IN (
          'queued',
          'sent',
          'delivered',
          'opened',
          'clicked',
          'bounced',
          'failed'
        )
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.campaign_recipients
  VALIDATE CONSTRAINT campaign_recipients_status_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaigns_status_check'
      AND conrelid = 'public.campaigns'::regclass
  ) THEN
    ALTER TABLE public.campaigns
      ADD CONSTRAINT campaigns_status_check
      CHECK (
        status IN (
          'draft',
          'scheduled',
          'sending',
          'sent',
          'paused',
          'cancelled',
          'failed'
        )
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.campaigns
  VALIDATE CONSTRAINT campaigns_status_check;

COMMIT;
