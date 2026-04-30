# V8 — Trust & Onboarding

## Theme
By the end of V8, a stranger reads about Sear, signs up at 9am, and rings up their first order at 9:30am with no human help.

## Exit criteria
- ✅ Self-serve signup → org → location → menu → terminals → first order in <30 minutes for 5 of 5 unaided strangers.
- ✅ In-app help: every page has a contextual help drawer.
- ✅ Real seed data per signup: 60+ menu items, 30 tables, 25 staff, week of order history.
- ✅ Error message audit: every error speaks human.
- ✅ RLS audit: malicious tenant cannot read another tenant's data via any vector.
- ✅ Branded transactional emails (welcome, magic link, password reset, receipt, statement, weekly summary).
- ✅ Subscription wiring: Stripe checkout for trial → starter → pro → enterprise tiers.

## Batch 8.0 — Onboarding flow (sequential, ~10 hours)

### 8.0.1 — Onboarding wizard
**Files:** `src/app/(setup)/onboarding/page.tsx` and step components, `src/lib/onboarding/state-machine.ts`
**Acceptance:** 6-step wizard (org → location → menu seed → terminals → first user → tour). Progress indicator. Resume mid-flow. Persists to DB.

### 8.0.2 — Menu seed wizard
**Files:** `src/lib/onboarding/seed-menus/{burger,pizza,asian,fine-dining,cafe,bar}.json`, UI to pick + customize
**Acceptance:** 6 cuisine templates, each ≥40 items with modifiers and pricing. Owner can customize any item before commit.

### 8.0.3 — First-order tour
**Files:** `src/lib/onboarding/tour.ts`, `src/components/onboarding/Tour.tsx`
**Acceptance:** First-time owner sees 8-step guided tour; can replay anytime via Help drawer.

## Batch 8.1 — In-app help (parallel, ~5 hours)

### 8.1.1 — Help drawer + content registry
**Files:** `src/components/help/HelpDrawer.tsx`, `src/content/help/*.mdx`
**Acceptance:** Every page has ? button → opens drawer with page-specific MDX content.

### 8.1.2 — Searchable help index
**Files:** `src/components/help/HelpSearch.tsx`, `src/lib/help/index.ts` (fuse.js)
**Acceptance:** ⌘K opens search; fuzzy matches 30+ help topics.

### 8.1.3 — 12 short screencasts (manual, deferred if no human)
**Files:** `public/help/videos/*.mp4`, embedded in HelpDrawer
**Acceptance:** 12 videos in repo embedded contextually. If no recording binary or human present, defer with `needs_human_recording`.

## Batch 8.2 — Error message audit (parallel, ~3 hours)

### 8.2.1 — API error rewrite
**Files:** All API routes (~150)
**Acceptance:** Every `NextResponse.json({error})` has `code`, `message` (sentence), and `action` (what user can do). UI shows message + action button.

### 8.2.2 — UI error standardization
**Files:** `src/components/ui-v2/feedback/ErrorToast.tsx` extension, applied across forms
**Acceptance:** Network errors → "Try again". Permission errors → "Ask manager". Etc.

## Batch 8.3 — RLS & security audit (parallel, ~6 hours)

### 8.3.1 — RLS test suite
**Files:** `e2e/security/rls.spec.ts`, `scripts/rls-fuzz.mjs`
**Acceptance:** 100+ test cases simulate malicious cross-tenant access attempts; all return 403 or empty. No leakage.

### 8.3.2 — CSRF + rate limit + auth header review
**Files:** `src/middleware.ts`, security headers in `next.config.ts`
**Acceptance:** OWASP top 10 baseline; rate limits on auth endpoints; CSP set; CSRF tokens on form submits.

### 8.3.3 — OWASP ZAP scan in CI
**Files:** `.github/workflows/security-scan.yml`
**Acceptance:** Zero high/critical findings.

## Batch 8.4 — Email + subscription (parallel, ~6 hours)

### 8.4.1 — Branded transactional emails
**Files:** `src/emails/{welcome,magic-link,password-reset,receipt,statement,weekly-summary}.tsx`, `src/lib/email/send.ts`
**Acceptance:** All 6 emails branded; preview server runs locally.
**Needs:** RESEND_API_KEY.

### 8.4.2 — Stripe Billing wiring
**Files:** `src/app/api/billing/**/route.ts`, `src/app/(backoffice)/settings/billing/page.tsx`, webhooks
**Acceptance:** Owner subscribes via Stripe Checkout; webhook updates `org.tier`. Trial → starter ($69/mo) → pro ($199/mo) → enterprise (talk-to-us).
**Needs:** STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.

### 8.4.3 — Feature gating by tier
**Files:** `src/lib/billing/features.ts`, applied across pages
**Acceptance:** Locked features show upgrade CTAs. Tier-gated routes return 402 Payment Required for non-subscribers.

## Batch 8.5 — Demo + ship (sequential, ~3 hours)

### 8.5.1
- 5 stranger signup attempts. If no humans available, simulate via Playwright.
- Tag `v8.0.0`.

## Bonus batches

### Bonus Batch 8.6 — PCI tokenized everything (parallel, ~6h)

#### 8.6.1 — Tokenize card-on-file
**Files:** `src/lib/payments/tokenize.ts`
**Acceptance:** DB has no PAN columns; only tokens + last4.

#### 8.6.2 — Hosted-fields card entry
**Files:** `src/components/payments/HostedCardEntry.tsx`
**Acceptance:** Card details never traverse our servers (iframe to processor).

#### 8.6.3 — PCI scope statement
**Files:** `docs/PCI_COMPLIANCE.md`
**Acceptance:** SAQ A-EP-ready document.

### Bonus Batch 8.7 — Customer-facing PWA (parallel, ~10h)

#### 8.7.1 — Customer app shell
**Files:** `src/app/(customer)/`
**Acceptance:** `{slug}.getsear.com` shows branded customer app.

#### 8.7.2 — Order ahead
**Files:** `src/app/(customer)/order/page.tsx`
**Acceptance:** Customer places pickup order; appears in POS as online order.

#### 8.7.3 — Loyalty view
**Files:** `src/app/(customer)/loyalty/page.tsx`
**Acceptance:** Points balance, available rewards, history.

#### 8.7.4 — Reservation booking
**Files:** `src/app/(customer)/reserve/page.tsx`
**Acceptance:** Books reservation through same `/api/reservations`.

#### 8.7.5 — Pay-at-table via QR
**Files:** `src/app/(customer)/pay/[checkId]/page.tsx`, QR generation on receipts
**Acceptance:** Scan QR → see check → tip → pay; no server interaction needed.

### Bonus Batch 8.8 — Server handheld (parallel, ~6h)

#### 8.8.1 — Mobile POS layout
**Files:** `src/app/(pos)/handheld/`
**Acceptance:** POS subset works at 390px width; one-thumb operation.

#### 8.8.2 — Tap-to-Pay on iPhone
**Files:** `src/lib/payments/handheld.ts`
**Acceptance:** Stripe Tap-to-Pay or Valor mobile SDK; iPhone takes payments.

#### 8.8.3 — Tableside flow
**Files:** `src/app/(pos)/handheld/table/[id]/page.tsx`
**Acceptance:** Server scans QR on table → loads check → fires → pays without returning to station.
