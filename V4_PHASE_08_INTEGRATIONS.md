# Sear POS v4 — Phase 8: Third-Party Integrations (MASTER_TEMPLATE Part 1)

Paste this ENTIRE file + MASTER_TEMPLATE.md into a fresh Claude Code session.
Then say: "Follow the MASTER_TEMPLATE. Start at Phase 1."

---

## 1.1 What is this?

A production-depth implementation of all third-party integrations for Sear POS. Currently, Twilio, SendGrid, and QuickBooks are listed in the tech stack but have zero working code — no API clients, no message templates, no OAuth flows, no sync jobs. This phase builds real, functional integrations for all four systems: Twilio SMS (order notifications, reservation reminders, waitlist alerts, marketing campaigns), SendGrid email (receipts, reports, marketing, password reset), QuickBooks Online (real OAuth 2.0 flow, daily sales journal entry sync, chart of accounts mapping), and a generic webhook system for third-party event delivery.

Every integration must have: configuration UI in the back-office settings, template management, delivery logs with retry, and clear error handling when API keys are missing or services are down.

**Read these files BEFORE planning:**
- CLAUDE.md — project config, tech stack, all integrations listed
- SEAR_POS_ARCHITECTURE.md — section 6 (Integration Ecosystem), section 4 (owner wants QBO auto-sync, auto-email daily reports, receipt delivery)
- API_SPEC.md — any existing notification/integration routes
- SCHEMA.md — tables related to notifications, customers, orders
- BUSINESS_RULES.md — when to send notifications, marketing compliance
- UI_DESIGN.md — design system tokens

---

## 1.2 Tech stack

Already built. Do not change core stack. New dependencies for this phase:
- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- **SMS:** Twilio (`twilio` npm package — new dependency)
- **Email:** SendGrid (`@sendgrid/mail` — may already be added in Phase 7)
- **Accounting:** QuickBooks Online (`intuit-oauth`, `node-quickbooks` — new dependencies)
- **Background Jobs:** BullMQ v5 + Redis (already configured)
- **Webhook Delivery:** Built-in using BullMQ for retry/queue

---

## 1.3 User roles

- **Owner**: Full access to all integration settings, can configure API keys, manage templates, view logs, connect QuickBooks
- **Manager**: Can view delivery logs, can trigger manual sends (e.g., re-send a receipt), cannot change API keys or OAuth connections
- **Server/Bartender**: Triggers notifications implicitly (order ready, receipt send) — no direct settings access
- **Kitchen**: No integration access

---

## 1.4 Pages and features

### TWILIO SMS INTEGRATION

#### Settings: SMS Configuration (`/settings/integrations/sms`)
- Who: Owner
- What: Configuration page for Twilio. Fields: Account SID, Auth Token, sending phone number (with format validation), opt-out compliance text. "Test Connection" button that sends a test SMS to the owner's phone. Status indicator (connected/disconnected/error).
- Toggle switches for each notification type: order ready, reservation reminder, waitlist alert, marketing campaigns
- Default templates shown below each toggle (editable)

#### SMS Templates (`/settings/integrations/sms/templates`)
- Who: Owner, Manager
- What: List of all SMS message templates. Each template has: name, trigger event, message body (with merge variables like `{{customer_name}}`, `{{order_number}}`, `{{wait_time}}`), character count display (160 char SMS limit indicator). Preview pane shows rendered message with sample data.
- Templates:
  - **Order Ready:** "Hi {{customer_name}}, your order #{{order_number}} is ready for pickup at {{location_name}}!"
  - **Reservation Reminder (24hr):** "Reminder: You have a reservation at {{location_name}} tomorrow at {{reservation_time}} for {{party_size}} guests. Reply C to confirm or X to cancel."
  - **Reservation Reminder (2hr):** "Your table at {{location_name}} is ready in 2 hours ({{reservation_time}}). See you soon!"
  - **Waitlist Alert:** "Great news, {{customer_name}}! Your table at {{location_name}} is ready. Please check in within 10 minutes or your spot may be given to the next party."
  - **Marketing Campaign:** Custom body, must include opt-out text "Reply STOP to unsubscribe"
- Actions: Edit, preview, duplicate, reset to default

#### SMS Delivery Log (`/settings/integrations/sms/log`)
- Who: Owner, Manager
- What: Table of all sent SMS messages. Columns: timestamp, recipient phone (masked: ***-***-1234), template name, status (delivered/failed/pending/opted-out), Twilio SID for debugging. Filter by status, date range, template type. Retry button for failed messages.

#### SMS Trigger Points (no UI — wired into existing workflows):
- **Order Ready:** When KDS ticket is bumped and order type is takeout/delivery/online, auto-send if customer has phone on file
- **Reservation Reminder 24hr:** BullMQ scheduled job, runs daily at 10 AM, finds tomorrow's reservations with phone numbers
- **Reservation Reminder 2hr:** BullMQ scheduled job, runs every 30 minutes, finds reservations in the next 2-2.5 hour window
- **Waitlist Alert:** When host marks a table as ready for a waitlist party
- **Marketing Campaign:** Manual send from marketing module, respects opt-out list

### SENDGRID EMAIL INTEGRATION

#### Settings: Email Configuration (`/settings/integrations/email`)
- Who: Owner
- What: Configuration page for SendGrid. Fields: API Key, sender email address (with domain verification note), sender name. "Test Connection" button that sends a test email to the owner. Status indicator.
- Toggle switches: receipts, daily reports, marketing campaigns, password reset
- Reply-to address configuration

#### Email Templates (`/settings/integrations/email/templates`)
- Who: Owner, Manager
- What: Visual list of all email templates with thumbnail previews. Each template is branded HTML.
- Templates:
  - **Receipt:** Itemized order with line items, modifiers, subtotal, tax, tip, total, payment method, Sear branding, location address. Renders as responsive HTML email. Includes "How was your experience?" link.
  - **Daily Summary Report:** Same as Phase 7 email — revenue, orders, avg check, labor %, comparison chart. Includes "View Full Report" CTA button.
  - **Marketing Campaign:** Header image, body text (rich text editor), CTA button, unsubscribe footer (CAN-SPAM compliant). Supports A/B subject line testing.
  - **Password Reset:** Simple branded email with reset link, expiration notice (1 hour), security warning ("If you didn't request this, ignore this email").
  - **Welcome Email:** Sent when a new customer account is created via online ordering. Location info, loyalty program pitch.
- Actions: Preview (renders with sample data), edit (HTML template editor with merge variables), send test

#### Email Delivery Log (`/settings/integrations/email/log`)
- Who: Owner, Manager
- What: Table of all sent emails. Columns: timestamp, recipient email (masked: j***@email.com), template name, subject line, status (delivered/opened/bounced/failed), SendGrid event ID. Filter by status, date, template. Retry button for failed.

#### Email Trigger Points:
- **Receipt:** After payment is processed, if customer has email on file OR if server selects "Email Receipt" during checkout flow. Server can enter email address at checkout.
- **Daily Summary:** BullMQ job (Phase 7), after daily metrics aggregation
- **Password Reset:** From `/forgot-password` page, sends reset link
- **Marketing:** Manual send from marketing module
- **Welcome:** After first online order creates a customer account

### QUICKBOOKS ONLINE INTEGRATION

#### Settings: QuickBooks Connection (`/settings/integrations/quickbooks`)
- Who: Owner
- What: OAuth 2.0 connection flow. "Connect to QuickBooks" button starts OAuth redirect to Intuit. After authorization, shows: connected company name, connected date, last sync timestamp, sync status (success/error/pending). "Disconnect" button with confirmation dialog.
- Sync configuration: frequency (daily at 2 AM, or manual), what to sync (sales, refunds, tips, tax)

#### Chart of Accounts Mapping (`/settings/integrations/quickbooks/mapping`)
- Who: Owner
- What: Mapping table that links Sear revenue categories to QuickBooks accounts. Left column: Sear categories (Food Sales, Beverage Sales, Retail Sales, Online Orders, Catering, Gift Card Sales, Tips, Sales Tax, Refunds). Right column: dropdown of QuickBooks income/expense accounts fetched from QBO API. Auto-detect attempts to match by name; owner can override.
- "Test Mapping" button: creates a $0.00 test journal entry in QBO sandbox to verify the mapping works
- Required mappings: at least Food Sales, Beverage Sales, Sales Tax, and Tips must be mapped before sync can run

#### QuickBooks Sync Log (`/settings/integrations/quickbooks/log`)
- Who: Owner
- What: Table of all sync attempts. Columns: date, business date synced, total revenue synced, journal entry ID in QBO, status (success/partial/failed), error message if failed. "Re-sync" button for failed entries. "View in QuickBooks" link opens the journal entry in QBO.

#### Daily Sales Journal Entry (Background Job):
- What: BullMQ job runs at 2:00 AM daily (after business day closes). Queries Sear's daily totals by category. Creates a single journal entry in QBO with debits to the bank/clearing account and credits to the mapped income accounts. Handles: food revenue, beverage revenue, retail revenue, online order revenue, tips payable, sales tax payable, refunds (as contra-revenue). Net amount matches the day's total deposit.
- Error handling: If QBO API is down, retry 3 times with exponential backoff. If all retries fail, mark as failed in sync log and alert owner via email.
- Idempotency: Uses `business_date + location_id` as idempotency key. Re-syncing the same date updates the existing journal entry instead of creating a duplicate.

### WEBHOOK SYSTEM

#### Settings: Webhooks (`/settings/integrations/webhooks`)
- Who: Owner
- What: CRUD for outbound webhook endpoints. Each webhook has: name, URL, secret (for HMAC-SHA256 signature), events subscribed to (checkboxes), active/inactive toggle. Up to 10 webhooks per location.
- Available events: `order.created`, `order.updated`, `order.closed`, `payment.processed`, `payment.refunded`, `void.created`, `comp.created`, `employee.clocked_in`, `employee.clocked_out`, `item.86d`, `item.un86d`, `reservation.created`, `reservation.cancelled`, `table.status_changed`
- "Test" button: sends a sample payload to the URL and shows the response status

#### Webhook Delivery Log (`/settings/integrations/webhooks/log`)
- Who: Owner
- What: Table of all webhook deliveries. Columns: timestamp, event type, endpoint name, HTTP status code, response time (ms), status (delivered/failed/retrying). Expandable row shows full request payload and response body. Retry button for failed deliveries.

#### Webhook Delivery Engine (Background):
- What: When a subscribed event occurs, BullMQ queues a webhook delivery job. Job sends POST request with JSON payload and `X-Sear-Signature` header (HMAC-SHA256 of body using webhook secret). Retry policy: 3 attempts with exponential backoff (1min, 5min, 30min). After 3 failures, mark as failed and stop retrying. Payload includes: event type, timestamp, location_id, and the full entity data (e.g., the complete order object for `order.created`).

---

## 1.5 Look and feel

Already defined in UI_DESIGN.md. Integration-specific additions:
- **Settings pages:** Clean form layout, grouped fields with section headers, clear labels, helper text below each field
- **Connection status:** Large green/red/amber badge with text ("Connected", "Disconnected", "Error: Invalid API Key")
- **OAuth flow:** Full-page redirect with branded loading spinner on return. Success state shows confetti-like subtle animation and the connected account name.
- **Template editor:** Split pane — edit on left, live preview on right. Merge variables as highlighted chips.
- **Delivery logs:** Monospace font for IDs and timestamps. Color-coded status pills (green=delivered, red=failed, amber=pending, gray=opted-out).
- **Webhook payloads:** JSON syntax highlighting in expandable rows.
- **Loading states:** Skeleton loaders for all tables and connection status checks.
- **Empty states:** "No messages sent yet" with illustration. "Connect your QuickBooks account to start syncing" with setup wizard CTA.

---

## 1.6 Business rules and special behavior

1. **SMS opt-out compliance:** Every marketing SMS must include "Reply STOP to unsubscribe". Maintain an opt-out list in the database. If a customer replies STOP (via Twilio webhook), add them to the opt-out list. Never send marketing SMS to opted-out numbers. Transactional SMS (order ready, reservation reminders) are exempt from STOP but should still respect explicit opt-out requests.
2. **CAN-SPAM compliance:** Every marketing email must include: physical address of the restaurant, unsubscribe link, sender identification. Unsubscribe must be processed within 24 hours (immediately in practice).
3. **QuickBooks OAuth token refresh:** QBO access tokens expire after 1 hour. Refresh tokens expire after 100 days. The system must auto-refresh the access token before each API call. If the refresh token expires, mark the connection as disconnected and alert the owner to re-authenticate.
4. **QuickBooks sandbox vs production:** Support both sandbox (for testing) and production environments. Environment toggle in settings (owner only). Default to sandbox until the owner explicitly switches to production.
5. **API key security:** Twilio Auth Token, SendGrid API Key, and QuickBooks tokens are stored encrypted in the database (using `pgcrypto` or application-level AES-256). Never returned in full via API — only last 4 characters shown in the UI. Stored as env vars for the initial connection; persisted per-location in `integration_configs` table.
6. **Graceful degradation:** If Twilio is not configured, order-ready SMS silently skips (no error to server). If SendGrid is not configured, receipt email option is hidden from checkout flow. If QBO is not connected, no sync jobs run.
7. **Rate limiting:** Twilio: max 100 SMS per location per day (configurable). SendGrid: max 500 emails per location per day. Webhook delivery: max 1000 events per endpoint per day.
8. **Webhook signature verification:** Document the signature scheme in the webhook settings UI so third-party developers can verify payloads. Include sample code in Node.js and Python.
9. **Receipt email at checkout:** During payment flow, if customer has email on file, show "Email receipt to j***@email.com?" toggle (default on). If no email, show "Enter email for receipt" text field. Receipt sends asynchronously after payment — do not block the checkout flow.
10. **Duplicate prevention:** SMS and email deliveries are idempotent per event. If the same order-ready notification is triggered twice (e.g., KDS bumped, recalled, re-bumped), only one SMS/email sends.

---

## 1.7 Integrations

- **Twilio:** `twilio` npm package. Requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` env vars. Per-location phone number configurable in settings.
- **SendGrid:** `@sendgrid/mail` npm package. Requires `SENDGRID_API_KEY` env var. Dynamic templates with Handlebars.
- **QuickBooks Online:** `intuit-oauth` for OAuth 2.0 flow, `node-quickbooks` for API calls. Requires `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI` env vars. Supports sandbox and production environments.
- **BullMQ + Redis:** Existing infrastructure. New queues: `sms-delivery`, `email-delivery`, `webhook-delivery`, `qbo-sync`, `reservation-reminders`, `waitlist-alerts`.

---

## 1.8 Modules and features planned but not for this phase

- DoorDash/UberEats/Grubhub order aggregation (Phase 11: Optional Modules — Delivery)
- Xero accounting integration (future — QBO only for now)
- 7shifts/HotSchedules scheduling integration (future)
- Payroll export integrations (ADP/Gusto/Paychex — Phase 6: Staff)
- Yelp/Google review management (future)
- Zapier/Make integration layer (future)

---

## 1.9 Anything else

**Existing files to modify:**
- `src/app/(pos)/payments/page.tsx` — Add "Email Receipt" toggle to checkout flow
- `src/app/(pos)/orders/page.tsx` — Trigger order-ready SMS when applicable
- `src/components/pos/OrderPanel.tsx` — Add receipt email prompt after payment
- `src/app/(backoffice)/settings/page.tsx` — Add "Integrations" section with links to SMS, Email, QBO, Webhooks settings

**New files to create:**

### Twilio SMS
- `src/app/(backoffice)/settings/integrations/sms/page.tsx` — SMS configuration page
- `src/app/(backoffice)/settings/integrations/sms/templates/page.tsx` — SMS template management
- `src/app/(backoffice)/settings/integrations/sms/log/page.tsx` — SMS delivery log
- `src/app/api/integrations/sms/config/route.ts` — GET/PUT SMS configuration
- `src/app/api/integrations/sms/test/route.ts` — Send test SMS
- `src/app/api/integrations/sms/templates/route.ts` — CRUD SMS templates
- `src/app/api/integrations/sms/log/route.ts` — GET delivery log with filters
- `src/app/api/integrations/sms/send/route.ts` — Send SMS (internal trigger)
- `src/app/api/integrations/sms/webhook/route.ts` — Twilio inbound webhook (opt-out handling)
- `src/lib/integrations/twilio-client.ts` — Twilio SDK wrapper with error handling
- `src/lib/integrations/sms-templates.ts` — Default templates and merge variable rendering

### SendGrid Email
- `src/app/(backoffice)/settings/integrations/email/page.tsx` — Email configuration page
- `src/app/(backoffice)/settings/integrations/email/templates/page.tsx` — Email template management
- `src/app/(backoffice)/settings/integrations/email/log/page.tsx` — Email delivery log
- `src/app/api/integrations/email/config/route.ts` — GET/PUT email configuration
- `src/app/api/integrations/email/test/route.ts` — Send test email
- `src/app/api/integrations/email/templates/route.ts` — CRUD email templates
- `src/app/api/integrations/email/log/route.ts` — GET delivery log
- `src/app/api/integrations/email/send/route.ts` — Send email (internal trigger)
- `src/app/api/integrations/email/receipt/route.ts` — Send receipt email for an order
- `src/app/api/integrations/email/webhook/route.ts` — SendGrid event webhook (open/bounce tracking)
- `src/lib/integrations/sendgrid-client.ts` — SendGrid SDK wrapper
- `src/lib/integrations/email-templates.ts` — Default HTML email templates (receipt, daily report, marketing, password reset, welcome)
- `src/components/integrations/EmailTemplatePreview.tsx` — Live preview component
- `src/components/integrations/ReceiptEmail.tsx` — React component that renders receipt HTML

### QuickBooks Online
- `src/app/(backoffice)/settings/integrations/quickbooks/page.tsx` — QBO connection and settings page
- `src/app/(backoffice)/settings/integrations/quickbooks/mapping/page.tsx` — Chart of accounts mapping
- `src/app/(backoffice)/settings/integrations/quickbooks/log/page.tsx` — Sync log
- `src/app/api/integrations/quickbooks/connect/route.ts` — Start OAuth flow (redirect to Intuit)
- `src/app/api/integrations/quickbooks/callback/route.ts` — OAuth callback (exchange code for tokens)
- `src/app/api/integrations/quickbooks/disconnect/route.ts` — Revoke tokens and disconnect
- `src/app/api/integrations/quickbooks/accounts/route.ts` — Fetch chart of accounts from QBO
- `src/app/api/integrations/quickbooks/mapping/route.ts` — GET/PUT account mapping
- `src/app/api/integrations/quickbooks/sync/route.ts` — Manual trigger daily sync
- `src/app/api/integrations/quickbooks/log/route.ts` — GET sync log
- `src/lib/integrations/quickbooks-client.ts` — QBO SDK wrapper with token refresh
- `src/lib/integrations/quickbooks-journal.ts` — Journal entry builder (maps Sear categories to QBO accounts)

### Webhook System
- `src/app/(backoffice)/settings/integrations/webhooks/page.tsx` — Webhook CRUD page
- `src/app/(backoffice)/settings/integrations/webhooks/log/page.tsx` — Webhook delivery log
- `src/app/api/integrations/webhooks/route.ts` — CRUD webhook endpoints
- `src/app/api/integrations/webhooks/[id]/route.ts` — GET/PUT/DELETE individual webhook
- `src/app/api/integrations/webhooks/[id]/test/route.ts` — Send test payload
- `src/app/api/integrations/webhooks/log/route.ts` — GET delivery log
- `src/lib/integrations/webhook-dispatcher.ts` — Event dispatcher (listens for events, queues deliveries)
- `src/lib/integrations/webhook-signature.ts` — HMAC-SHA256 signing utility

### Shared
- `src/lib/integrations/config-store.ts` — Encrypted integration config storage (read/write to `integration_configs` table)
- `src/components/integrations/ConnectionStatus.tsx` — Reusable connected/disconnected badge
- `src/components/integrations/DeliveryLogTable.tsx` — Reusable delivery log table with filters
- `src/components/integrations/ApiKeyInput.tsx` — Masked API key input with show/hide toggle
- `src/components/integrations/TemplateEditor.tsx` — Split-pane template editor with variable chips
- `src/stores/integrations-store.ts` — Zustand store for integration connection states

### Workers
- `src/workers/sms-delivery.worker.ts` — BullMQ worker for SMS sending
- `src/workers/email-delivery.worker.ts` — BullMQ worker for email sending
- `src/workers/webhook-delivery.worker.ts` — BullMQ worker for webhook delivery with retry
- `src/workers/qbo-sync.worker.ts` — BullMQ worker for daily QBO journal entry sync
- `src/workers/reservation-reminder.worker.ts` — BullMQ cron worker for reservation SMS reminders

### Database Migrations
- `supabase/migrations/XXXXXX_integration_configs.sql` — `integration_configs` table (location_id, provider, encrypted_config, is_active)
- `supabase/migrations/XXXXXX_sms_delivery_log.sql` — `sms_delivery_log` table
- `supabase/migrations/XXXXXX_email_delivery_log.sql` — `email_delivery_log` table
- `supabase/migrations/XXXXXX_webhook_endpoints.sql` — `webhook_endpoints` table
- `supabase/migrations/XXXXXX_webhook_delivery_log.sql` — `webhook_delivery_log` table
- `supabase/migrations/XXXXXX_qbo_connections.sql` — `qbo_connections` table (location_id, access_token_enc, refresh_token_enc, realm_id, expires_at)
- `supabase/migrations/XXXXXX_qbo_account_mappings.sql` — `qbo_account_mappings` table
- `supabase/migrations/XXXXXX_qbo_sync_log.sql` — `qbo_sync_log` table
- `supabase/migrations/XXXXXX_sms_opt_outs.sql` — `sms_opt_outs` table (phone, opted_out_at)

---

## Acceptance Criteria

Every checkbox must pass before this phase is complete:

### Twilio SMS
- [ ] SMS configuration page allows entering Twilio credentials and saving them encrypted
- [ ] "Test Connection" sends a real SMS to a configured number and shows success/failure
- [ ] Order-ready SMS fires automatically when a takeout/delivery order is bumped on KDS and the customer has a phone number on file
- [ ] Reservation reminder SMS fires 24 hours before and 2 hours before a reservation
- [ ] Waitlist alert SMS fires when a host marks a table ready for a waitlist party
- [ ] All SMS templates are editable with merge variables and character count display
- [ ] SMS delivery log shows all sent messages with status, timestamp, and masked phone number
- [ ] Failed SMS deliveries can be retried from the log
- [ ] If a customer replies STOP, they are added to the opt-out list and no further marketing SMS are sent
- [ ] If Twilio is not configured, all SMS triggers silently skip without errors

### SendGrid Email
- [ ] Email configuration page allows entering SendGrid API key and sender details
- [ ] "Test Connection" sends a test email and shows success/failure
- [ ] Receipt email sends after payment with itemized order, totals, payment method, and Sear branding
- [ ] Receipt email can be triggered from checkout flow with "Email receipt?" toggle
- [ ] Server can enter a customer email at checkout if none is on file
- [ ] Marketing email templates include unsubscribe link and physical address (CAN-SPAM)
- [ ] Password reset email sends from the forgot-password flow with a time-limited link
- [ ] Email delivery log shows all sent emails with open/bounce tracking from SendGrid webhooks
- [ ] If SendGrid is not configured, email receipt option is hidden from checkout

### QuickBooks Online
- [ ] "Connect to QuickBooks" button starts a real OAuth 2.0 redirect to Intuit authorization
- [ ] OAuth callback exchanges code for tokens and stores them encrypted
- [ ] Connected state shows company name, connection date, and last sync time
- [ ] Chart of accounts mapping page fetches real accounts from QBO and allows mapping Sear categories
- [ ] Daily sync job creates a journal entry in QBO with correct debits/credits for the day's sales
- [ ] Journal entry includes food revenue, beverage revenue, retail, tips, tax, and refunds as separate line items
- [ ] Re-syncing the same business date updates the existing journal entry (idempotent)
- [ ] If QBO API is down, retry 3 times with backoff; if all fail, alert owner via email
- [ ] Token refresh happens automatically before API calls; expired refresh token triggers disconnect alert
- [ ] Sync log shows every sync attempt with status, amount, and QBO journal entry ID
- [ ] "Disconnect" button revokes tokens and clears stored credentials

### Webhook System
- [ ] Webhook CRUD allows creating up to 10 endpoints per location with URL, secret, and event subscriptions
- [ ] "Test" button sends a sample payload and shows the HTTP response
- [ ] When a subscribed event occurs (e.g., order.created), a webhook delivery is queued
- [ ] Webhook payload includes event type, timestamp, location_id, and full entity data
- [ ] Payload is signed with HMAC-SHA256 using the webhook secret in the `X-Sear-Signature` header
- [ ] Failed deliveries retry 3 times with exponential backoff (1min, 5min, 30min)
- [ ] Webhook delivery log shows every attempt with status, response code, and response time
- [ ] Inactive webhooks do not receive deliveries

---

## Workflow Tests

### Workflow 1: Owner Connects QuickBooks and Syncs Sales
1. Owner navigates to `/settings/integrations/quickbooks`
2. Clicks "Connect to QuickBooks" → redirected to Intuit login
3. Authorizes Sear POS → redirected back to settings page
4. Sees "Connected to: Rivera's Grill (QBO)" with green badge
5. Navigates to `/settings/integrations/quickbooks/mapping`
6. Sees Sear categories on the left, QBO accounts dropdown on the right
7. Maps "Food Sales" to "4000 - Sales of Product Income", "Beverage Sales" to "4010 - Service Income", etc.
8. Clicks "Save Mapping"
9. Clicks "Sync Now" → job runs → sync log shows "Success: $4,250.00 synced for March 22"
10. Opens QuickBooks → sees the journal entry with correct line items

### Workflow 2: Takeout Customer Gets Order-Ready SMS
1. Customer places a takeout order (phone: 555-123-4567 on file)
2. Kitchen prepares the order and bumps the KDS ticket
3. System detects: order type = takeout, customer has phone, Twilio configured
4. BullMQ queues SMS job
5. Customer receives: "Hi Sarah, your order #1047 is ready for pickup at Sear Grill Downtown!"
6. SMS appears in delivery log with status "delivered"

### Workflow 3: Server Emails Receipt at Checkout
1. Server processes a $47.82 card payment for table 5
2. Payment success screen shows: "Email receipt to j.smith@email.com?" (pre-filled from customer profile)
3. Server taps "Send"
4. Customer receives HTML email: itemized order (2x Wagyu Burger, 1x Caesar Salad, 2x IPA), subtotal $41.50, tax $3.32, tip $3.00, total $47.82, paid with Visa ending 4242
5. Email has Sear branding, restaurant address, and "How was your experience?" link

### Workflow 4: Third-Party System Receives Webhook
1. Owner creates a webhook endpoint: URL = `https://analytics.example.com/sear`, subscribed to `order.closed` and `payment.processed`
2. Owner clicks "Test" → sample payload sent → sees "200 OK" response
3. A real order closes → BullMQ queues webhook delivery
4. POST request sent to the URL with the order data and HMAC signature
5. Third-party returns 200 → delivery log shows "delivered" in 145ms

### Workflow 5: Reservation Reminder Flow
1. Customer has a reservation for Friday 7:00 PM (phone on file)
2. Thursday 10:00 AM: BullMQ cron fires reservation-reminder worker
3. Worker finds Friday reservations, queues 24-hour reminder SMS
4. Customer receives: "Reminder: You have a reservation at Sear Grill tomorrow at 7:00 PM for 4 guests. Reply C to confirm or X to cancel."
5. Customer replies "C" → Twilio webhook fires → reservation marked as confirmed
6. Friday 5:00 PM: 2-hour reminder fires: "Your table at Sear Grill is ready in 2 hours (7:00 PM). See you soon!"

### Workflow 6: Handling Integration Downtime
1. SendGrid API is down (returns 503)
2. Server processes a payment and selects "Email receipt"
3. Email job is queued, first attempt fails with 503
4. BullMQ retries after 1 minute — still 503
5. Retries after 5 minutes — SendGrid is back, email sends successfully
6. Delivery log shows: attempt 1 (failed), attempt 2 (failed), attempt 3 (delivered)
7. Server and customer see no error — the receipt arrives a few minutes late
