# V9 — Integrations & Monetization

## Theme
Sear plugs into the stack restaurants already have. Owners stop weighing "but I'd lose my DoorDash" and the first paying customer rings up.

## Exit criteria
- ✅ DoorDash + UberEats inbound: orders appear in Sear, fire to KDS, payments reconcile.
- ✅ Square + Toast import: paste competitor URL → menu auto-imports in <2 minutes.
- ✅ QuickBooks daily Z-out push: nightly job posts revenue/tax/tips/COGS to QB.
- ✅ Twilio: SMS for reservations + marketing + customer service.
- ✅ Webhooks API: 3rd-party devs subscribe to `order.created`, `payment.captured`, etc.
- ✅ First Stripe-billed paying customer.

## Batch 9.0 — DoorDash / UberEats inbound (parallel, ~12 hours)

### 9.0.1 — DoorDash Drive integration
**Files:** `src/app/api/webhooks/doordash/route.ts`, `src/lib/integrations/doordash/`, env
**Acceptance:** Sandbox order arrives → appears on POS as 3rd-party order → fires to KDS.
**Needs:** DOORDASH credentials.

### 9.0.2 — UberEats integration
**Files:** `src/app/api/webhooks/ubereats/route.ts`, `src/lib/integrations/ubereats/`
**Acceptance:** Same.
**Needs:** UBEREATS credentials.

### 9.0.3 — Olo abstraction layer
**Files:** `src/lib/integrations/third-party/types.ts`, adapter classes
**Acceptance:** Single API/UI works regardless of source.

### 9.0.4 — UI: 3rd-party badge + auto-accept toggle
**Files:** `src/app/(pos)/orders/page.tsx`, settings
**Acceptance:** Orders distinguishable by badge; auto-accept preference per source.

## Batch 9.1 — QuickBooks (parallel, ~6 hours)

### 9.1.1 — QB OAuth
**Files:** `src/app/api/integrations/quickbooks/oauth/route.ts`, `src/lib/integrations/quickbooks/client.ts`
**Acceptance:** Owner connects QB; tokens encrypted; refresh works.
**Needs:** QUICKBOOKS credentials.

### 9.1.2 — Daily Z-out push
**Files:** `src/workers/quickbooks-zout.ts`, BullMQ scheduled
**Acceptance:** Nightly at 2am: revenue, sales tax, tips, COGS, refunds, voids → QB journal entries. Retries with backoff.

### 9.1.3 — Account mapping UI
**Files:** `src/app/(backoffice)/settings/integrations/quickbooks/page.tsx`
**Acceptance:** Owner maps Sear categories to QB GL accounts.

## Batch 9.2 — Menu importer (parallel, ~6 hours)

### 9.2.1 — Square importer
**Files:** `src/lib/import/square.ts`, `src/app/api/import/square/route.ts`
**Acceptance:** Paste square.site URL → 60+ items imported with prices/photos in <2min.

### 9.2.2 — Toast importer
**Files:** `src/lib/import/toast.ts`
**Acceptance:** Same for toasttab.com URLs.

### 9.2.3 — Generic importer
**Files:** `src/app/(backoffice)/menu/import/page.tsx`
**Acceptance:** CSV upload → field mapping UI → preview → commit.

## Batch 9.3 — Twilio SMS (parallel, ~4 hours)

### 9.3.1 — Twilio SDK + opt-in/out
**Files:** `src/lib/sms/twilio.ts`, `src/app/api/webhooks/twilio/route.ts`
**Acceptance:** SMS sends; STOP keyword unsubscribes; opt-in tracked in audit.
**Needs:** TWILIO credentials.

### 9.3.2 — Reservation SMS sequences
**Files:** `src/workers/reservation-sms.ts`
**Acceptance:** Confirmations + reminders + waitlist nudges fire on time.

### 9.3.3 — Marketing SMS
**Files:** Extend `src/workers/campaign-email-worker.ts` to multi-channel
**Acceptance:** Campaigns can choose email or SMS or both.

## Batch 9.4 — Webhooks API (parallel, ~5 hours)

### 9.4.1 — Outbound webhook system
**Files:** `src/lib/webhooks/dispatcher.ts`, `src/app/api/webhooks/subscriptions/route.ts`, settings UI
**Acceptance:** Owner registers URL; events fire with HMAC sig; retries on 5xx with exponential backoff.

### 9.4.2 — Webhook docs site
**Files:** `docs/api/webhooks.md`, `src/app/(backoffice)/settings/integrations/webhooks/page.tsx`
**Acceptance:** Docs published; "test endpoint" tool works.

## Batch 9.5 — Demo + ship (sequential, ~3 hours)

- DoorDash sandbox order → ring up → reconcile → confirm in QB.
- First Stripe-billed customer (real or trusted friend with real CC).
- Tag `v9.0.0`.

## Bonus batches

### Bonus Batch 9.6 — Tax automation (parallel, ~4h)

#### 9.6.1 — Stripe Tax / Avalara
**Files:** `src/lib/tax/stripe-tax.ts`
**Acceptance:** Live tax calc per order based on delivery zip + product taxability across 5 test jurisdictions.

#### 9.6.2 — Filing-ready exports
**Files:** `src/app/(backoffice)/reports/tax-filing/page.tsx`
**Acceptance:** End-of-month CSV per state.

### Bonus Batch 9.7 — Direct booking widget (parallel, ~5h)

#### 9.7.1 — Embeddable widget
**Files:** `src/app/book/[slug]/page.tsx`
**Acceptance:** `<iframe src="//book.getsear.com/{slug}">` works on any external site.

#### 9.7.2 — Cross-restaurant network
**Files:** `src/lib/network/customer-portability.ts`
**Acceptance:** Customer profile follows them across Sear restaurants with consent.

### Bonus Batch 9.8 — Earned wage access (parallel, ~3h)

#### 9.8.1 — DailyPay / Branch
**Files:** `src/lib/integrations/dailypay/`
**Acceptance:** Employees see balance + withdraw works on test.

#### 9.8.2 — 1099 + IRS 8027
**Files:** `src/app/(backoffice)/reports/tax-forms/page.tsx`
**Acceptance:** Year-end forms auto-generate per employee.

### Bonus Batch 9.9 — Apple/Google Wallet (parallel, ~2h)

#### 9.9.1 — Apple PassKit
**Files:** `src/lib/wallet/passkit.ts`
**Acceptance:** Customer adds loyalty card to Apple Wallet; updates push on points change.

#### 9.9.2 — Google Wallet
**Files:** `src/lib/wallet/google-wallet.ts`
**Acceptance:** Same for Android.
