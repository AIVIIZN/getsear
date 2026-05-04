-- Migration: add_campaign_recipients_indexes
-- V5 batch 5.1.2 — marketing campaign send pipeline
--
-- Adds tenant-scoping column (org_id), engagement-tracking columns
-- (tracking_id, resend_message_id, bounce_reason, open_count, click_count),
-- and the requires_approval flag on campaigns. Backfills org_id from the
-- parent campaign so existing rows are queryable by tenant immediately.
-- Adds the indexes the BullMQ worker + analytics endpoints need.

BEGIN;

-- 1. campaign_recipients: tenant-scoping + tracking columns -------------------

ALTER TABLE "public"."campaign_recipients"
  ADD COLUMN IF NOT EXISTS "org_id" "uuid",
  ADD COLUMN IF NOT EXISTS "tracking_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  ADD COLUMN IF NOT EXISTS "resend_message_id" "text",
  ADD COLUMN IF NOT EXISTS "bounce_reason" "text",
  ADD COLUMN IF NOT EXISTS "open_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "click_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "clicked_url" "text",
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT "now"();

-- Backfill org_id from parent campaign for any pre-existing rows.
UPDATE "public"."campaign_recipients" AS cr
SET "org_id" = c."org_id"
FROM "public"."campaigns" AS c
WHERE cr."campaign_id" = c."id"
  AND cr."org_id" IS NULL;

ALTER TABLE "public"."campaign_recipients"
  ALTER COLUMN "org_id" SET NOT NULL;

-- 2. campaigns: requires_approval flag for manager-PIN gating -----------------

ALTER TABLE "public"."campaigns"
  ADD COLUMN IF NOT EXISTS "requires_approval" boolean NOT NULL DEFAULT false;

-- 3. Indexes ------------------------------------------------------------------

-- Worker + analytics: list recipients of a campaign by status fast.
CREATE INDEX IF NOT EXISTS "idx_campaign_recipients_campaign_status"
  ON "public"."campaign_recipients" ("campaign_id", "status");

-- Tenant scoping for cross-campaign queries (analytics, audits).
CREATE INDEX IF NOT EXISTS "idx_campaign_recipients_org_status"
  ON "public"."campaign_recipients" ("org_id", "status");

-- Tracking pixel + click redirect lookups by tracking_id (UUID, public-facing).
CREATE UNIQUE INDEX IF NOT EXISTS "idx_campaign_recipients_tracking_id"
  ON "public"."campaign_recipients" ("tracking_id");

-- Idempotency guard: one row per (campaign, customer).
CREATE UNIQUE INDEX IF NOT EXISTS "idx_campaign_recipients_campaign_customer"
  ON "public"."campaign_recipients" ("campaign_id", "customer_id");

-- Drill-down: a customer's send history.
CREATE INDEX IF NOT EXISTS "idx_campaign_recipients_customer"
  ON "public"."campaign_recipients" ("org_id", "customer_id");

COMMIT;
