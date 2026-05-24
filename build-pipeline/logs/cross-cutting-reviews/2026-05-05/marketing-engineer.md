# Marketing / Email Pipeline Audit — 2026-05-05

Branch: `main` @ `77aa1e1`. Read-only review of campaigns CRUD, BullMQ workers, Resend dispatch, react-email templates, open/click tracking, recipients management.

The 5.99.5 + 5.99.6 fixes for tenant RLS, send-route validation, queue idempotency, and campaigns CRUD schema drift are all in place and correctly implemented. The remaining issues below are residual gaps rather than regressions.

---

## P0 — Ship-blocking

### P0-1 — Two parallel email pipelines; legacy SendGrid path is wired but stale
- `src/lib/marketing/send-campaign.ts:73-112` still implements the *legacy* SendGrid + Twilio synchronous send path used by the older marketing UI; `src/app/api/integrations/email/webhook/route.ts:1-37` consumes its delivery events.
- The Resend + BullMQ pipeline (5.1.x) is the canonical path. There is **no Resend webhook handler** anywhere under `src/app/api/` (grep for `Resend`, `Svix-Id`, `webhooks/resend` — zero hits).
- Result: bounces / complaints / unsubscribes that arrive *after* the synchronous Resend.send() returns 200 (delivery failures, ISP complaints, spam reports) are never reflected in `campaign_recipients.status`. Suppression list never gets fed. Sender reputation will degrade.
- **Fix:** add `src/app/api/integrations/resend/webhook/route.ts` with Svix signature verification (`svix` package, secret in `RESEND_WEBHOOK_SECRET` env), handle `email.bounced` / `email.complained` / `email.delivered` events, look up the recipient by `resend_message_id` (already persisted at worker line 343), and update status + write a suppression row. Decide whether to retire `src/lib/marketing/send-campaign.ts` or leave it for SMS-only campaigns; either way, document.

### P0-2 — `campaign_recipients.status` allowed values are not constrained
- Baseline `campaign_recipients.status` (line 365 of `00000000000000_baseline.sql`) is `text DEFAULT 'pending'` with **no CHECK constraint**. Code paths write at least eight different values: `pending`, `queued`, `sent`, `delivered`, `opened`, `clicked`, `bounced`, `failed` (worker line 360, send route line 211, recipients route line 149, analytics line 78-79, 175).
- `analytics.ts:78-79` rolls up `SENT_STATES = {sent,delivered,opened,clicked}` and `DELIVERED_STATES = {delivered,opened,clicked}` — but nothing in the code path writes `delivered`. `delivered` is unreachable today, so analytics will under-report once the Resend webhook (P0-1) starts emitting it. The `pending` baseline default also leaks through if any code path inserts without explicit status.
- **Fix:** add migration that (1) UPDATEs all `'pending'` rows to `'queued'`, (2) sets default to `'queued'`, (3) adds `CHECK (status IN ('queued','sent','delivered','opened','clicked','bounced','failed','cancelled'))`. Will surface drift bugs immediately.

---

## P1 — Correctness / data-integrity

### P1-1 — Open-pixel count race (lost-update under concurrent opens)
- `src/lib/marketing/analytics.ts:118-143` reads `open_count` then writes `open_count + 1` from JS. Two near-simultaneous opens (Gmail proxy + native client + forwarded) read the same value and clobber each other. Same pattern in `upsertClick` (line 153-180).
- **Fix:** RPC or use the [Postgres atomic increment pattern](https://supabase.com/docs/reference/javascript/rpc) — wrap as `select set_open_event(p_tracking_id uuid)` that runs `UPDATE ... SET open_count = open_count + 1, opened_at = COALESCE(opened_at, now()) WHERE tracking_id = $1` in a single statement. Cheaper *and* race-free.

### P1-2 — Missing CHECK constraint + state-machine on `campaigns.status`
- `campaigns.status text DEFAULT 'draft'` (baseline line 381) has no CHECK; `src/app/api/marketing/campaigns/[id]/route.ts:15` accepts the enum at the API layer but the DB will tolerate any string. `src/app/api/marketing/campaigns/[id]/send/route.ts:86` only allows the transition `draft|scheduled → sending` — but a manual UPDATE-by-typo could set `status='Sent'` (capitalised) and break analytics matching.
- **Fix:** add `CHECK (status IN ('draft','scheduled','sending','sent','cancelled','failed'))` and pair with a state-machine row constraint or trigger (low priority).

### P1-3 — Send-route enqueue rollback on Redis failure leaves campaign in zombie state
- `src/app/api/marketing/campaigns/[id]/send/route.ts:247-258` — if `enqueueCampaignEmails` throws, recipients are already inserted with `status='queued'` and `queueError` is logged but the campaign **still** transitions to `'sending'` at line 264. There is no worker sweep to pick up `status='queued'` rows whose jobs never made it to Redis. They stay queued forever.
- **Fix:** either (a) on Redis failure return 502 and DELETE the inserted recipients (the upsert is non-conflict so DELETE WHERE campaign_id = id AND created_at > start_ts is safe), or (b) keep them but also enqueue a "campaign-recovery" job + a periodic sweeper that re-enqueues stuck `queued` rows older than N minutes. Option (a) is simpler.

### P1-4 — `markRecipient` org-mismatch path swallows errors silently
- `src/workers/campaign-email-worker.ts:374-389` — on a join lookup failure or org mismatch, the function `console.error`s and returns. The processor then goes on to call `markRecipient` again post-send to set `status='sent'`, which will **also** silently fail. Result: recipient looks `'queued'` forever even though the email was sent.
- **Fix:** on org-mismatch, throw — the `'failed'` listener at line 491 already catches and marks. Even better, fold the org check into the actual UPDATE WHERE clause (`.eq('id', recipientId).eq('org_id', orgId)`) so the round-trip lookup goes away.

### P1-5 — Tenant-isolation hole on `campaign_recipients` POST
- `src/app/api/marketing/campaigns/[id]/recipients/route.ts:144-161` validates that the **campaign** belongs to the caller's org (good — fix from 5.99.6 #5) but does **not** validate that each `customer_id` in the array belongs to the same org. A manager could insert a row with their own `org_id` + `campaign_id` but a `customer_id` from another tenant.
- The FK `campaign_recipients_customer_id_fkey` (baseline line 3245-3246) references `customers(id)` without an org check. The row would insert successfully, then the worker at `campaign-email-worker.ts:230-237` *correctly* enforces org scoping on the customer fetch (`.eq('org_id', org_id)`) and bounces it as `'customer missing email'` — so no email actually leaks. But the orphan row pollutes analytics + suppression history.
- **Fix:** add `.in('id', customer_ids).eq('org_id', user.org_id)` SELECT before insert; if `count !== customer_ids.length`, return 400 listing the missing IDs. Should land alongside the org_id NOT NULL constraint already in place.

### P1-6 — Click-redirect URL stored is the **decoded** URL, not the rewritten one
- `src/app/api/marketing/track/click/route.ts:90` writes `url: target.toString()` (the decoded base href). When the email body contains `?utm_source=newsletter`, the redirect 302s correctly but the analytics row records the original — fine. However, the click-tracking template builder (`campaign.tsx:35-40`) base64-encodes the *target* (not normalised) — so any pre-existing `&` encoding gets double-handled on receipt. Sample manually before shipping a campaign with query strings.

---

## P2 — Hygiene / consistency

### P2-1 — Two definitions of `CampaignEmailJobData`
- `src/workers/campaign-email-worker.ts:46-58` and `src/lib/queue/campaign-email-queue.ts:23-30` both define the type; the producer one includes `customer_id`, the worker's does not. There is a TODO at line 29-30 of the worker. They've drifted: producer includes `customer_id`, worker reads `recipient_id` only. Currently harmless but a footgun.
- **Fix:** export the canonical type from `lib/queue/campaign-email-queue.ts`, import in worker.

### P2-2 — `process.env.START_WORKERS === '1'` auto-start hides config in import side-effects
- `campaign-email-worker.ts:558-560` — module-load auto-start is fine for prod but means any unit test that imports the file pays for a Redis connection unless `START_WORKERS` is unset. Recommend gating by both `START_WORKERS` and `NODE_ENV !== 'test'`.

### P2-3 — Open-pixel response Cache-Control sufficient but no Vary
- `src/app/api/marketing/track/open/route.ts:36-43` sends `Cache-Control: no-store` correctly but also has `Pragma: no-cache, Expires: 0` — fine. Optional: add `Vary: User-Agent` so any intermediate caches (Apple Mail proxy) don't merge by URL alone. Negligible risk.

### P2-4 — DNT / Sec-GPC not honoured
- Spec says "Privacy: respect Do Not Track?" — neither tracking endpoint inspects the `DNT: 1` or `Sec-GPC: 1` headers. Industry consensus has moved away from DNT but Sec-GPC is becoming legally meaningful (CCPA). Low priority but worth a flag — at minimum, log without recording when `Sec-GPC: 1` is set.

### P2-5 — `recipients_count` is set from segment resolution but stale on partial enqueue failure
- `src/app/api/marketing/campaigns/[id]/send/route.ts:265` writes `recipients_count: recipients.length` — this is the *resolved* count, not the *enqueued* count (which can be lower if Redis fails). Use `enqueued` instead, or persist both.

### P2-6 — No worker-level rate limiter; concurrency=10 is a static cap
- `src/workers/campaign-email-worker.ts:481` sets `concurrency: 10`. Resend's free tier is 100/day, paid is 10/sec across the account. With 10 concurrent workers each potentially submitting in <100ms, a single 5k-recipient campaign can exceed 10/s and get throttled. Resend returns 429; current `classifyResendError` will treat 4xx as `'bounced'` and *not retry*. So a rate-limit storm permanently bounces a chunk of recipients.
- **Fix:** add `429` to the retry kind in `classifyResendError`, and apply a BullMQ `limiter: { max: 8, duration: 1000 }` in the producer.

---

## P3 — Polish

### P3-1 — Plain-text email fallback missing
- `_layout.tsx` and `campaign.tsx` only emit HTML. Resend SDK accepts a `text:` field for plain-text alternative. Without it, accessibility and some corporate-mail rendering are degraded.

### P3-2 — `customers.unsubscribe_token` SET NOT NULL with default — fine, but no rotate path
- The token is single-purpose and long-lived (`unsubscribe/route.ts:30-72`). If it ever leaks, there's no admin endpoint to rotate. Low priority — token is unguessable UUIDv4.

### P3-3 — `requires_approval` flag exists but no UI surface
- Migration `20260504005008` adds `requires_approval boolean DEFAULT false`. Send route honours it (line 94-136). No campaigns CRUD path lets a manager *set* it to `true`. Either remove or expose in PUT body schema.

### P3-4 — `campaign-email-worker.ts` registers a custom backoff strategy at line 485-487 that the file header (line 19-22) acknowledges is unused
- Dead code with a long explanatory comment. Either delete or wire up.

---

## Verified clean

- Tenant RLS on `campaign_recipients` is correctly tenant-scoped by `20260504110000_campaign_recipients_org_isolation.sql` (replaces baseline `USING (true)` policies).
- BullMQ `defaultJobOptions.attempts: 1` prevents the dup-send footgun (queue line 84-89, fix from 5.99.6 #4).
- Worker uses deterministic `jobId = ${campaign_id}:${recipient_id}` (queue line 96-98) — re-POST of `/send` is idempotent.
- Click redirect rejects non-http(s) protocols (route line 83-85), strips control chars + NULs from base64 (line 53-58), and uses 302 not 307.
- Resend API key is read from env (worker line 108-114), throws if absent — never hardcoded.
- `target_segment` and `created_by` are correctly populated on campaign create (route line 116-129, fix from 5.99.6 #1).
- Recipient payload Zod schema enforces UUIDs + 500 cap (recipients route line 13-15, fix from 5.99.6).
- Unsubscribe is org-implicit-scoped (token is unique across all tenants) and idempotent.

---

End of audit. Word count ~1,180.
