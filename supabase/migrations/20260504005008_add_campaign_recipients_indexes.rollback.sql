-- Rollback for 20260504005008_add_campaign_recipients_indexes.sql
-- WARNING: drops tracking columns and the data inside them. Only run if
-- you are intentionally reverting V5 batch 5.1.2.

BEGIN;

DROP INDEX IF EXISTS "public"."idx_campaign_recipients_customer";
DROP INDEX IF EXISTS "public"."idx_campaign_recipients_campaign_customer";
DROP INDEX IF EXISTS "public"."idx_campaign_recipients_tracking_id";
DROP INDEX IF EXISTS "public"."idx_campaign_recipients_org_status";
DROP INDEX IF EXISTS "public"."idx_campaign_recipients_campaign_status";

ALTER TABLE "public"."campaigns"
  DROP COLUMN IF EXISTS "requires_approval";

ALTER TABLE "public"."campaign_recipients"
  DROP COLUMN IF EXISTS "updated_at",
  DROP COLUMN IF EXISTS "clicked_url",
  DROP COLUMN IF EXISTS "click_count",
  DROP COLUMN IF EXISTS "open_count",
  DROP COLUMN IF EXISTS "bounce_reason",
  DROP COLUMN IF EXISTS "resend_message_id",
  DROP COLUMN IF EXISTS "tracking_id",
  DROP COLUMN IF EXISTS "org_id";

COMMIT;
