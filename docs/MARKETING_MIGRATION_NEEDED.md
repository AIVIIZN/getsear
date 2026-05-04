# Marketing migration needed (5.99.6 → 5.99.5)

This file is a coordination note for task **5.99.5 (migration owner)**.
Task 5.99.6 (marketing engineer) discovered a P0 RLS gap that requires a
schema/policy migration; per the 5.99 scope guardrails 5.99.6 must NOT
write migrations itself, so the work is documented here for 5.99.5 to
pick up.

## P0: campaign_recipients RLS is wide open (cross-tenant data leak)

**Source:** `build-pipeline/logs/cross-cutting-reviews/marketing-engineer.md`
P0 finding #3 (file `supabase/migrations/00000000000000_baseline.sql`,
line 4566).

**Evidence (verified 2026-05-04 in this worktree):**

```
supabase/migrations/00000000000000_baseline.sql:4566:
  CREATE POLICY "allow_insert" ON "public"."campaign_recipients"
    FOR INSERT WITH CHECK (true);
supabase/migrations/00000000000000_baseline.sql:4610:
  CREATE POLICY "allow_select" ON "public"."campaign_recipients"
    FOR SELECT USING (true);
supabase/migrations/00000000000000_baseline.sql:4658:
  CREATE POLICY "allow_update" ON "public"."campaign_recipients"
    FOR UPDATE USING (true);
supabase/migrations/00000000000000_baseline.sql:6206-6208:
  GRANT ALL ON TABLE "public"."campaign_recipients" TO "anon";
  GRANT ALL ON TABLE "public"."campaign_recipients" TO "authenticated";
  GRANT ALL ON TABLE "public"."campaign_recipients" TO "service_role";
```

Combined effect: any authenticated Supabase REST caller (and `anon`)
can `SELECT`/`INSERT`/`UPDATE` every other org's `campaign_recipients`
rows — including `customer_id`, `tracking_id`, `resend_message_id`, and
delivery status. This is a multi-tenant invariant violation and matches
the V5 standing rule (`org_id` filter in code is the first line; RLS is
the second line).

The sister `campaigns` table is correctly scoped (lines 5348/5628/5896
already use `tenant_select`/`tenant_insert`/`tenant_update` keyed off
`request.jwt.claims.org_id`). `campaign_recipients` was missed.

## Required migration (proposed)

Suggested filename: `supabase/migrations/<timestamp>_tighten_campaign_recipients_rls.sql`

```sql
-- Tighten campaign_recipients RLS: drop wide-open policies and replace
-- with tenant-scoped predicates matching the campaigns table.
-- Fixes 5.99.6 P0 #3 (cross-tenant data leak via RLS).

BEGIN;

DROP POLICY IF EXISTS "allow_insert" ON "public"."campaign_recipients";
DROP POLICY IF EXISTS "allow_select" ON "public"."campaign_recipients";
DROP POLICY IF EXISTS "allow_update" ON "public"."campaign_recipients";

CREATE POLICY "tenant_select"
  ON "public"."campaign_recipients"
  FOR SELECT
  USING (
    "org_id" = (
      ((current_setting('request.jwt.claims', true))::json ->> 'org_id')::uuid
    )
  );

CREATE POLICY "tenant_insert"
  ON "public"."campaign_recipients"
  FOR INSERT
  WITH CHECK (
    "org_id" = (
      ((current_setting('request.jwt.claims', true))::json ->> 'org_id')::uuid
    )
  );

CREATE POLICY "tenant_update"
  ON "public"."campaign_recipients"
  FOR UPDATE
  USING (
    "org_id" = (
      ((current_setting('request.jwt.claims', true))::json ->> 'org_id')::uuid
    )
  )
  WITH CHECK (
    "org_id" = (
      ((current_setting('request.jwt.claims', true))::json ->> 'org_id')::uuid
    )
  );

CREATE POLICY "tenant_delete"
  ON "public"."campaign_recipients"
  FOR DELETE
  USING (
    "org_id" = (
      ((current_setting('request.jwt.claims', true))::json ->> 'org_id')::uuid
    )
  );

-- Keep service_role_bypass — the BullMQ worker uses createAdminClient()
-- (service_role key) to mark recipients sent/bounced/failed.

COMMIT;
```

Notes for the migration owner:
- `org_id` on `campaign_recipients` is already NOT NULL after migration
  `20260504005008_add_campaign_recipients_indexes.sql` (which backfills
  org_id from the parent campaign). No backfill needed here.
- The existing `service_role_bypass` policy at baseline:4923 should
  remain; the worker writes via the admin client.
- `GRANT ALL ... TO anon` is broader than necessary but the policies
  above are the second-line defense. Tightening grants is a separate
  cleanup if 5.99.5 wants to bundle it.

## What 5.99.6 already fixed (in code, this commit)

- `src/app/api/marketing/campaigns/[id]/recipients/route.ts` GET now
  filters `.eq('org_id', user.org_id)` (defense-in-depth).
- POST verifies the campaign id belongs to the caller's org and inserts
  the `org_id` and `channel` (NOT NULL) columns.

These belt-and-suspenders fixes hold the line until the RLS migration
above lands.
