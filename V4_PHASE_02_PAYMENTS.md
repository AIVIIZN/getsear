# V4 Phase 2: Payment Processing — Real Valor Integration

Paste this ENTIRE file + MASTER_TEMPLATE.md into a fresh Claude Code session.
Then say: "Follow the MASTER_TEMPLATE. Start at Phase 1."

---

## 1.1 What is this?

A production-depth implementation of Valor PayTech payment processing for Sear POS. The current payment system is a mock — `src/lib/payments/valor-mock.ts` simulates card processing with fake delays and always-approve responses. This phase replaces the mock with real Valor REST API integration, Valor Connect MQTT for terminal communication, and implements every payment flow a restaurant encounters: standard dine-in payments, bar tab pre-auth lifecycle, tip-on-receipt and tip-on-screen flows, batch settlement, void before settlement, refund after settlement, dual pricing display, store-and-forward for offline payments, daily reconciliation, chargeback management, and cash management.

After this phase, a restaurant can process real card payments through Valor hardware (VP800, VP550, VP300 Pro, RCKT) and reconcile at end of day.

**This is NOT a greenfield build.** The existing codebase at /Users/ianrakow/Desktop/getsear already has:
- `src/lib/payments/valor-mock.ts` — mock Valor integration (to be replaced)
- `src/app/api/payments/process/route.ts` — payment processing route (uses mock)
- `src/app/api/payments/capture/route.ts` — capture route
- `src/app/api/payments/void/route.ts` — void route
- `src/app/api/payments/refund/route.ts` — refund route
- `src/app/api/payments/preauth/route.ts` — pre-auth route
- `src/app/api/payments/settlement/route.ts` — settlement route
- `src/app/api/payments/tip-adjust/route.ts` — tip adjust route
- `src/app/api/payments/gift-card/` — gift card routes (check-balance, activate, reload)
- `src/components/payments/CardProcessing.tsx` — card processing UI (shows fake spinner)
- `src/components/payments/CashTender.tsx` — cash payment UI
- `src/components/payments/TipSelector.tsx` — tip selection UI
- `src/components/payments/PaymentMethodGrid.tsx` — payment method picker
- `src/components/payments/PaymentComplete.tsx` — payment success screen
- `src/components/payments/GiftCardFlow.tsx` — gift card payment flow
- `src/components/payments/HouseAccountFlow.tsx` — house account flow
- `src/stores/order-store.ts` — includes payment-related state

**Read these files BEFORE planning:**
- CLAUDE.md — project config, tech stack, coding rules
- SEAR_POS_ARCHITECTURE.md — Part 6: Payment Processing Architecture (ENTIRE section, lines 8619-11900). Read ALL of it: Valor Integration Layer, Valor REST API examples, Valor Connect pattern, Standard Payment Flow (2.1), Bar Tab Flow (2.2), Split Payment Flow (2.3), Cash Payment Flow (2.4), Gift Card System (2.5), Refund/Void Flow (2.6), Surcharging/Cash Discount (2.7), PCI Scope, Tip Flow, Tip Calculation Engine, Tip Distribution Models, Daily Settlement Flow, Chargeback Handling, Valor Settlement & Reconciliation, iPad + Valor Terminal Architecture
- BUSINESS_RULES.md — payment-related business rules
- Scenario 6 (Multi-Tender Payment) in Architecture doc

---

## 1.2 Tech stack

Already built. Do not change:
- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- **Components:** shadcn/ui (heavily customized)
- **State:** Zustand v5 + Immer
- **Database:** Supabase (PostgreSQL) — existing tables for payments, payment_transactions, checks, gift_cards, gift_card_transactions
- **Auth:** Supabase Auth + cookie-based SSR
- **Payment processor:** Valor PayTech (REST API + Valor Connect MQTT)
- **Background jobs:** BullMQ v5 + Redis (for batch settlement scheduling, stale tab auto-close)

---

## 1.3 User roles

- **Server**: Processes payments (card, cash, gift card). Enters tips from signed receipts. Cannot void/refund without manager approval over threshold.
- **Bartender**: Opens and closes bar tabs. Pre-auths cards. Adds items to open tabs. Closes tabs with tip. Handles walkout captures.
- **Manager**: Everything server can do PLUS: void transactions, process refunds, approve refunds over $50, approve unlinked refunds (different card), override tip adjustments, run batch settlement, access cash management, view chargeback cases.
- **Owner**: Everything manager can do PLUS: view reconciliation reports, configure dual pricing, manage chargeback disputes, view processing fee analysis.
- **Cashier (QSR)**: Processes direct sale payments (auth+capture in one step). Handles cash payments. Opens and counts cash drawer.

---

## 1.4 Pages and features

### Page: Payment Flow — `/payments` (or inline from order panel)
- **Who:** Server, Bartender, Manager, Owner
- **Trigger:** "Pay" button on order panel or check
- **Layout:** Replaces menu grid area (right 70%). Order panel stays visible on left showing check being paid.

#### Check Summary (Top)
- Check number and table
- Itemized list (collapsed by default, expandable)
- Subtotal
- Tax (from location settings)
- Auto-gratuity (if applicable)
- Discount (if applicable)
- **Total due** (large, bold, 32px)
- Dual pricing display: "Card Price: $XX.XX | Cash Price: $XX.XX" (cash price = card price minus 4% dual pricing discount). Only shown if dual pricing is enabled for this location.

#### Payment Method Selector
- Grid of payment method buttons (large, 80px tall tiles):
  - **Credit/Debit Card** — card icon, "Card" label
  - **Cash** — bill icon, "Cash" label
  - **Gift Card** — gift icon, "Gift Card" label
  - **House Account** — building icon, "House Acct" label
  - **Comp** — tag icon, "Comp" label (manager only)
- Each button shows a brief description below label (e.g., "Tap, dip, or swipe")

#### Credit/Debit Card Flow
1. Server taps "Card" → screen shows "Preparing terminal..."
2. System sends transaction to Valor terminal via Valor Connect (MQTT) or REST API
3. Screen shows "Present Card on Terminal" with Valor terminal illustration and animated dots
4. **Terminal interaction (on Valor hardware):**
   - VP800: Customer-facing screen shows amount, dual pricing, and prompts for card
   - VP550/VP300 Pro: Terminal displays amount and waits for card
   - RCKT (Bluetooth): Pairs with iPad, shows amount on small screen
5. Card entry: EMV chip insert, NFC contactless tap, magnetic swipe, or manual keyed entry
6. If dual pricing enabled: Terminal shows both cash and card price
7. If tip-on-screen flow (counter-service): Terminal shows tip prompt before authorization
8. Processing: "Authorizing..." with spinner
9. **Success:** Green checkmark, "Approved" message, authorization code displayed, last 4 digits, card brand
10. **Decline:** Red X, decline reason (Insufficient Funds, Do Not Honor, Card Expired, etc.), "Try Another Card" and "Try Again" buttons
11. **Timeout:** "Terminal not responding" after 120 seconds, "Cancel" option
12. **For tip-on-receipt flow (full-service):** Auth obtained for check amount only (capture=false). Receipt prints with tip line. Server enters tip later → system captures with tip.
13. **For tip-on-screen flow (counter-service):** Auth+capture in one step including tip (capture=true). No receipt tip line needed.
- **Partial card payment:** Before sending to terminal, server can enter a specific dollar amount to charge on this card (for multi-tender). Numpad with "Charge $XX.XX on card" confirmation.

#### Cash Payment Flow
1. Server taps "Cash" → numpad appears
2. Quick amount buttons: Exact ($XX.XX), $20, $50, $100
3. Server enters cash tendered amount
4. If cash < total: "Short by $X.XX — collect more or add another payment"
5. If cash >= total: Shows change due prominently (large green text)
6. Denomination breakdown suggestion: "Change: 1x$10, 1x$5, 3x$1, 1x quarter, 1x dime, 1x nickel"
7. "Open Drawer" button (sends cash drawer kick signal via printer RJ-11)
8. "Accept Cash" confirms payment
9. Cash payment recorded — no processor involved
10. If dual pricing enabled: cash price is the base menu price (no surcharge). System records at cash price.

#### Gift Card Flow
1. Server taps "Gift Card" → enter card number (keypad) or scan (barcode reader)
2. System queries balance from Sear's gift card database
3. Shows: Card number (masked), current balance, amount to apply
4. If balance >= check total: "Apply Full Balance ($XX.XX)" or enter custom amount
5. If balance < check total: "Apply Full Balance ($XX.XX) — Remaining: $YY.YY" — server must add another payment for remainder
6. After redemption: shows new balance on card
7. Gift card transaction logged in gift_card_transactions table

#### House Account Flow
1. Server taps "House Account" → customer search (name, phone, account number)
2. Shows account details: customer name, company, credit limit, current balance, available credit
3. If check total <= available credit: "Charge to Account" button
4. If check total > available credit: "Exceeds credit limit by $X — Manager approval required" → Manager PIN
5. Requires customer PIN or signature (configurable per account)
6. Transaction recorded, account balance updated

#### Comp Flow
1. Server taps "Comp" → Manager PIN required
2. Reason codes: Owner Comp, Food Quality, Service Recovery, Promo, VIP, Other
3. Can comp full check or specific amount
4. Comp recorded with manager, reason, amount for reporting

#### Payments Applied List
- Below payment method buttons: list of all payments applied to this check
- Each row: payment method icon, amount, status (Approved / Pending / Declined)
- "Remaining Balance: $XX.XX" prominently displayed
- When remaining balance = $0: "Check Paid" banner, "Print Receipt" and "Email Receipt" buttons appear
- "Done" button returns to order view

### Page: Tip Entry — Post-Authorization
- **Who:** Server (for tip-on-receipt flow)
- **Trigger:** After card authorized (capture=false) and server has signed receipt
- **Layout:** Overlay on payment page
- **Features:**
  - Server enters tip amount from signed receipt via numpad
  - Quick tip buttons: 18%, 20%, 22%, Custom, No Tip (percentages calculated on pre-tax subtotal by default, configurable to post-tax)
  - Shows: subtotal, tax, tip, new total
  - "Confirm Tip" → system calls capture with tip amount
  - Tip validation: if tip > 50% of check total, warning: "Tip exceeds 50% of check total. Confirm?" (fraud prevention)
  - Tip adjustment window: tips can be adjusted within 24-48 hours (configurable) after entry

### Bar Tab Management
- **Location:** Bartender's order panel for bar seats
- **Open Tab Flow:**
  1. Customer approaches bar → bartender creates new order type "Bar Tab"
  2. "Hold Card" button → Valor terminal activated → customer inserts/taps card
  3. Pre-auth for configurable default amount ($50 default, $500 max)
  4. Tab opens — card info stored as token (last 4 + brand displayed, NEVER full PAN)
  5. Tab shows customer name, card on file indicator, running total, auth amount
- **Adding Items:**
  1. Bartender adds items normally to the open tab
  2. Running total tracked against auth amount
  3. When running total * 1.3 (buffer for tax + tip) exceeds auth amount:
     - System auto-fires incremental auth for additional amount
     - If incremental auth not supported: void original, re-auth at higher amount using stored token
     - If neither works: flag tab "OVER AUTH" for manager attention — allow items to continue (don't block service)
- **Close Tab:**
  1. Bartender taps "Close Tab" → check presented
  2. Tip entry (on-receipt or on-screen, configurable)
  3. Capture at final amount (subtotal + tax + tip)
  4. Card hold released for any amount above capture
  5. Receipt options: print, email, text, no receipt
- **Tab Timeout:**
  - Idle tabs (no items added in 4 hours) flagged for auto-close
  - BullMQ job runs every 30 minutes checking for stale tabs
  - Manager alerted before auto-close
  - Tabs approaching 7-day pre-auth expiry: urgent alert to manager
- **Tab Walkout:**
  - If customer leaves without closing: capture at running total + tax + configurable auto-gratuity (default 20%)
  - Logged as walkout with manager approval

### Batch Settlement
- **Who:** Manager, Owner
- **Location:** Settings → Payments → Settlement (or quick action from manager dashboard)
- **Auto-settlement:**
  - BullMQ job configured to run at 2:00 AM (configurable per location)
  - Closes batch with Valor API
  - Records batch ID, transaction count, gross amount, net amount
  - Generates settlement report
- **Manual settlement:**
  - Manager taps "Settle Now" → confirmation dialog showing:
    - Number of transactions in current batch
    - Total amount
    - Open checks warning (if any): "3 checks still open. Settle anyway?"
  - Settlement executes → shows batch result
- **Pre-settlement checks:**
  1. All tips entered? If not, prompt to enter or auto-capture at auth amount (no tip)
  2. Open bar tabs? Offer to auto-close stale tabs
  3. Show count and total for review

### Void (Before Settlement)
- **Trigger:** From order/check view → select transaction → "Void"
- **Rules:**
  - Can only void before batch settlement (after settlement, must use refund)
  - Releases card hold immediately — no interchange cost
  - Manager PIN required for amounts over $50 (configurable threshold)
- **Flow:**
  1. Select transaction from check
  2. "Void this payment of $XX.XX?" confirmation
  3. Manager PIN if over threshold
  4. Reason code: Customer Request, Wrong Amount, Duplicate Charge, Fraud Suspected, Other
  5. Valor void API called
  6. Transaction status updated to VOIDED
  7. Check reopens (becomes unpaid again)
  8. Audit trail logged

### Refund (After Settlement)
- **Trigger:** From order history or transaction search → "Refund"
- **Rules:**
  - Used after batch has settled (funds already moved)
  - Full refund: credit back entire captured amount
  - Partial refund: credit specific amount (e.g., one item was wrong)
  - Maximum refund window: 120 days (configurable)
  - Manager PIN required for amounts over $50
  - Unlinked refund (to different card): ALWAYS requires manager approval
  - Refunds generate interchange cost (restaurant pays fees both ways)
- **Flow:**
  1. Find original transaction (search by date, amount, last 4, order number)
  2. "Refund" → full or partial?
  3. If partial: enter refund amount. Cannot exceed original amount minus any previous refunds.
  4. Manager PIN if over threshold
  5. Reason code: Customer Request, Wrong Amount, Food Quality, Service Issue, Other
  6. Valor refund API called
  7. Credit issued to original card (or new card if unlinked)
  8. Transaction status: REFUNDED or PARTIALLY_REFUNDED
  9. Audit trail logged

### Dual Pricing Engine
- **Configuration:** Per-location setting in location_settings table
  - `dual_pricing_enabled`: boolean
  - `dual_pricing_rate`: decimal (default 4.00%)
  - `cash_discount_display`: "Cash Discount" or "Card Surcharge" (legal distinction)
- **Menu display:** When enabled, each menu item shows:
  - Card price (the listed menu price)
  - Cash price (menu price minus dual_pricing_rate%)
  - e.g., Burger: Card $16.00 | Cash $15.36
- **Check display:**
  - If paying by card: total is menu prices (no adjustment)
  - If paying by cash: each item shows cash discount, total reflects lower prices
  - Receipt shows both prices clearly per legal requirements
- **Legal compliance:**
  - Structured as cash DISCOUNT (not card surcharge) — legal in all 50 states
  - Signage requirement note: "Cash Discount pricing in effect" (not Sear's responsibility to post signage, but system should remind restaurant during setup)
  - Debit cards: dual pricing applies to debit too (unlike surcharging, which cannot apply to debit under Durbin Amendment)
- **Valor terminal display:** VP800 customer-facing screen shows both prices. Valor handles the dual pricing calculation on the terminal side.

### Store-and-Forward (Offline Card Payments)
- **Trigger:** Valor terminal or internet connection is unavailable
- **Flow:**
  1. Server processes card → terminal/connection unavailable
  2. System offers "Store and Forward" option
  3. Card details captured by Valor terminal locally (encrypted, P2PE)
  4. Transaction queued in local storage with status "QUEUED_OFFLINE"
  5. Banner shows: "1 payment pending — will process when connection restores"
  6. When connection restores: BullMQ job processes queued transactions
  7. If approved: update to CAPTURED
  8. If declined: alert manager — must collect alternative payment from guest (guest may have already left)
- **Risk controls:**
  - Floor limit: maximum transaction amount for store-and-forward ($100 default, configurable)
  - Manager approval required for offline transactions over floor limit
  - Maximum number of offline transactions before blocking (20 default)
  - Stale queue alert: if offline transactions haven't synced in 4 hours, urgent alert

### Daily Reconciliation
- **Who:** Manager, Owner
- **Location:** Reports → Daily Reconciliation
- **Auto-generated:** BullMQ job runs at 4:00 AM after batch settlement
- **Report shows:**
  - **Revenue:** Gross sales, discounts, comps, net sales, tax collected
  - **Payment breakdown:** Credit card total, cash total, gift card total, house account total
  - **Card detail:** Visa total, Mastercard total, Amex total, Discover total
  - **Tips:** Credit card tips, cash tips reported, auto-gratuity, total tips
  - **Adjustments:** Voids, refunds, surcharges/dual pricing collected
  - **Cash drawer:** Expected cash, counted cash, over/short
  - **Batch info:** Batch ID, transaction count, batch total
  - **Processor deposit match:** Valor settlement amount vs. Sear records. Variance flagged if > $1.00.
  - **Effective processing cost:** Gross fees minus dual pricing offset. Shows effective rate %.
- **Export:** PDF, CSV

### Cash Management
- **Opening Count:**
  - At shift start, cashier/manager enters denomination count of starting bank
  - Denominations: $100, $50, $20, $10, $5, $1, quarters, dimes, nickels, pennies
  - Calculator totals automatically
  - Starting bank amount recorded
- **Closing Count:**
  - At shift end, same denomination count
  - System calculates: starting bank + cash sales - cash paid out = expected cash
  - Actual count vs expected = over/short
  - If variance > $5.00: manager sign-off required
  - If variance > $25.00: flag for investigation
- **Cash drops:**
  - Mid-shift cash drops to safe (reduces cash in drawer)
  - Recorded with amount, time, staff member
  - Subtracted from expected drawer total
- **Paid outs:**
  - Cash paid out for vendor COD, petty cash, etc.
  - Recorded with amount, reason, vendor name, receipt reference
  - Manager approval required

### Chargeback Management
- **Who:** Manager, Owner
- **Location:** Reports → Chargebacks (or Settings → Payments → Chargebacks)
- **Chargeback notification:** When Valor sends chargeback webhook:
  1. Case created in chargeback_cases table
  2. Manager notified via in-app alert
  3. Evidence auto-gathered from POS data:
     - Original receipt/check detail
     - Card entry mode (EMV = strong evidence)
     - Authorization code
     - Server name
     - Signed receipt (if captured)
     - Tip receipt and entry timestamp
- **Chargeback case view:**
  - Case ID, amount, reason code and description
  - Response deadline (countdown)
  - Original transaction details
  - Auto-gathered evidence
  - Upload additional evidence (photos of signed receipt, etc.)
  - Recommended action: FIGHT (EMV transaction), ACCEPT (small amount), REVIEW
  - Status: Open, Under Review, Won, Lost, Expired
- **Statistics:** Win rate, total chargebacks, total amount lost, by reason code

---

## 1.5 Look and feel

- **Mode:** Light mode only
- **Vibe:** Secure, professional, trustworthy — financial transactions must feel solid
- **Reference products:** Apple Pay payment confirmation, Stripe Dashboard for reconciliation, Toast payment flow
- **Color direction:** Same Sear design system. Payment success = green (#22C55E). Payment failure = red (#EF4444). Pending = amber (#F59E0B). Cash = green tint. Card = blue tint. Gift card = purple tint.
- **Typography:** Large, clear amounts. Total = 32px bold. Payment status = 24px. All financial amounts right-aligned and monospace-like for readability.
- **Touch targets:** 48px minimum for all payment action buttons. Large numpad keys (64px) for cash entry and tip entry.
- **Animation:** Smooth state transitions (authorized → captured → settled). Green checkmark animation on payment success (scale+fade, 0.5s). Red shake animation on decline.
- **Dual pricing display:** Card price in standard text, cash price in green with "SAVE $X.XX" badge
- **Terminal status indicator:** Live connection status for Valor terminal — green dot = connected, amber = reconnecting, red = offline

---

## 1.6 Business rules and special behavior

### Transaction State Machine
```
PENDING → AUTHORIZED → CAPTURED → SETTLED
                ↓            ↓
             DECLINED     VOIDED
                          REFUNDED
                          PARTIALLY_REFUNDED
             TIMED_OUT
             ERROR
```
- PENDING: Transaction initiated, waiting for terminal response
- AUTHORIZED: Auth obtained, not yet captured (tip-on-receipt flow, bar tabs)
- CAPTURED: Captured with final amount including tip. Will settle in next batch.
- SETTLED: Batch closed, funds moved to merchant account
- DECLINED: Issuer declined the transaction
- VOIDED: Reversed before settlement (no interchange cost)
- REFUNDED: Credit issued after settlement (interchange cost applies)
- PARTIALLY_REFUNDED: Partial credit issued
- TIMED_OUT: Terminal didn't respond within 120 seconds
- ERROR: System/network error

### Bar Tab Lifecycle
```
TAB_OPEN → (add items) → CLOSE_REQUESTED → TIP_ENTERED → CAPTURED → SETTLED
     ↓                          ↓
  INCREMENTAL_AUTH           WALKOUT
     ↓
  OVER_AUTH (flagged)
```
- Initial pre-auth amount: $50 default, configurable $25-$500
- Incremental auth threshold: when running_total * 1.3 > auth_amount
- Auto-close: 4 hours idle (configurable)
- Pre-auth expiry: 7 days (Visa/MC standard). Alert at day 6.
- Walkout auto-gratuity: 20% default (configurable)

### Tip Rules
- **Tip-on-receipt (full-service):** Auth for check amount only → customer writes tip → server enters → capture with tip
- **Tip-on-screen (counter-service/QSR):** Tip prompt before card → auth+capture with tip included
- **Valor on-terminal tipping:** VP800/VP550/RCKT support on-device tip prompt. Customer sees tip options on terminal screen.
- Suggested tip percentages: configurable (default 18%, 20%, 22%)
- Tip calculation base: pre-tax subtotal (configurable to post-tax)
- Tip validation: warning if tip > 50% of check, block if > 100% (likely keying error)
- Tip adjustment window: 24-48 hours after initial entry (configurable)
- Cash tips: not tracked by system unless server declares at clock-out

### Void Rules
- Only before batch settlement
- Manager PIN for amounts > $50 (configurable)
- Releases hold immediately on customer's card
- No interchange cost to restaurant
- Reason code required
- Full audit trail

### Refund Rules
- Only after settlement
- Full or partial
- Manager PIN for amounts > $50 or any unlinked refund
- Maximum refund window: 120 days
- Cannot refund more than original captured amount minus previous refunds
- Unlinked refund (different card): highest risk, always requires manager
- Restaurant pays interchange fees on the refund (fees both ways)

### Dual Pricing Legal Rules
- Structured as CASH DISCOUNT, not surcharge — legal in all 50 states
- Surcharging is prohibited in CT, MA, PR — but cash discounts are legal everywhere
- Debit cards: cash discount applies (unlike surcharging under Durbin Amendment)
- Prepaid cards: cash discount applies
- Receipt must show both prices clearly
- Menu/signage must disclose cash discount program
- Valor terminal handles display of both prices on customer-facing screen

### PCI Compliance Rules (Non-Negotiable)
- NEVER store full PAN, CVV, track data, or PIN blocks anywhere in Sear's system
- Only store: last 4, card brand, expiration (after auth), processor tokens, auth codes, transaction IDs
- All card interaction happens on Valor P2PE terminal — Sear never touches card data
- TLS 1.2+ on all connections
- Tokens encrypted at rest in Supabase (pgcrypto or application-level encryption)
- Audit logging for all payment-related access

### Settlement Rules
- Auto-settlement at configurable time (default 2:00 AM)
- Pre-settlement checks: all tips entered, open tabs resolved
- Batch close sends to Valor API
- Settlement report generated and stored
- Reconciliation against Valor's settlement data
- Discrepancy alert if variance > $1.00

### Cash Management Rules
- Starting bank recorded at shift open
- Cash drops tracked (reduce expected drawer total)
- Paid outs require manager approval
- Closing count vs expected: over/short calculated
- Variance > $5 requires manager sign-off
- Variance > $25 flagged for investigation
- Over/short tracked per employee for pattern detection

---

## 1.7 Integrations

- **Valor PayTech REST API** (`https://api.valorpaytech.com`):
  - Auth, Sale (auth+capture), Incremental Auth, Capture, Tip Adjust, Void, Refund, Settlement
  - Authentication: API key + App ID + EPI (endpoint identifier)
  - All amounts in cents (integer)
  - Response includes: status, transaction_id, auth_code, card info (masked)
- **Valor Connect (MQTT):** POS-to-terminal communication for card-present transactions
  - POS publishes transaction request to terminal's MQTT topic
  - Terminal handles card interaction, encryption, routing
  - Terminal publishes result back
  - Timeout: 120 seconds
- **Valor Webhooks:** Settlement notifications, chargeback notifications
- **Supabase Database:** Payment transactions, batch records, gift cards, cash drawer records, chargeback cases
- **Supabase Realtime:** Payment status updates broadcast to relevant devices
- **BullMQ + Redis:**
  - `settlement-job`: Auto batch close at configured time
  - `stale-tab-job`: Check for idle bar tabs every 30 minutes
  - `offline-sync-job`: Process store-and-forward queue when connection restores
  - `reconciliation-job`: Generate daily reconciliation at 4:00 AM
  - `pre-auth-expiry-job`: Alert for tabs approaching 7-day pre-auth expiry

---

## 1.8 What's NOT in scope for this phase

- Receipt printing hardware integration (Phase 5 — use screen-based receipt in this phase)
- Cash drawer hardware trigger (Phase 5 — show "Open Drawer" button but no hardware signal)
- Saved card tokenization for repeat customers (deferred)
- Online ordering payment flow (Phase 11)
- QuickBooks journal entry export (Phase 8)
- 3D Secure for card-not-present (online only, Phase 11)
- Mobile wallet deep integration (Apple Pay / Google Pay handled by Valor terminal natively)
- Multi-location consolidated settlement (Phase 10)
- Payroll tip export (Phase 6)
- Gift card physical card printing / activation via barcode (Phase 5)

---

## 1.9 Files, acceptance criteria, and workflow tests

### Files to Create

| File | Purpose |
|------|---------|
| `src/lib/payments/valor-client.ts` | Valor REST API client — auth, sale, capture, void, refund, settlement, incremental auth, tip adjust |
| `src/lib/payments/valor-connect.ts` | Valor Connect MQTT client — send transaction to terminal, receive result |
| `src/lib/payments/valor-types.ts` | TypeScript types: PaymentMethod, TransactionStatus, CardBrand, AuthResult, CaptureResult, RefundResult, VoidResult, BatchResult, ReaderDevice |
| `src/lib/payments/dual-pricing.ts` | Dual pricing calculator — card price, cash price, discount amount, legal compliance checks |
| `src/lib/payments/tip-calculator.ts` | Tip calculation engine — suggested tips, pre-tax/post-tax base, auto-gratuity |
| `src/lib/payments/bar-tab-manager.ts` | Bar tab lifecycle — open, add item, check auth headroom, incremental auth, close, walkout, auto-close |
| `src/lib/payments/split-payment.ts` | Split payment logic — equal split, by item, custom amounts, penny rounding, mixed tender |
| `src/lib/payments/cash-manager.ts` | Cash payment processing, change calculation, denomination suggestion |
| `src/lib/payments/gift-card-system.ts` | Gift card activate, check balance, redeem, reload, transaction logging |
| `src/lib/payments/refund-manager.ts` | Void and refund logic — business rules, manager approval, audit trail |
| `src/lib/payments/reconciliation.ts` | Daily reconciliation engine — aggregate transactions, match batch, calculate fees |
| `src/lib/payments/store-forward.ts` | Store-and-forward queue — queue offline transactions, process on reconnect |
| `src/lib/payments/chargeback-manager.ts` | Chargeback case handling — evidence gathering, status tracking |
| `src/components/payments/ValorTerminalStatus.tsx` | Live terminal connection indicator |
| `src/components/payments/DualPricingDisplay.tsx` | Card vs cash price display component |
| `src/components/payments/BarTabCard.tsx` | Bar tab summary card showing auth, running total, card on file |
| `src/components/payments/TipEntrySheet.tsx` | Post-auth tip entry with numpad and quick percentage buttons |
| `src/components/payments/CashDrawerCount.tsx` | Denomination counter for opening/closing cash drawer |
| `src/components/payments/BatchSettlement.tsx` | Settlement UI — pre-checks, execute, results |
| `src/components/payments/RefundFlow.tsx` | Refund flow UI — find transaction, enter amount, reason, approval |
| `src/components/payments/VoidFlow.tsx` | Void flow UI — confirmation, reason, approval |
| `src/components/payments/ReconciliationReport.tsx` | Daily reconciliation display with all categories |
| `src/components/payments/ChargebackCase.tsx` | Chargeback case viewer — evidence, status, action buttons |
| `src/components/payments/StoreForwardBanner.tsx` | Banner showing pending offline transactions |
| `src/app/api/payments/bar-tab/open/route.ts` | Open bar tab with pre-auth |
| `src/app/api/payments/bar-tab/close/route.ts` | Close bar tab with capture + tip |
| `src/app/api/payments/bar-tab/incremental-auth/route.ts` | Increase auth on existing tab |
| `src/app/api/payments/batch/close/route.ts` | Manual batch close |
| `src/app/api/payments/batch/status/route.ts` | Get batch status |
| `src/app/api/payments/reconciliation/route.ts` | Generate/get daily reconciliation |
| `src/app/api/payments/chargebacks/route.ts` | List chargeback cases |
| `src/app/api/payments/chargebacks/[id]/route.ts` | Get/update chargeback case |
| `src/app/api/payments/cash-drawer/count/route.ts` | Submit opening/closing cash count |
| `src/app/api/payments/cash-drawer/drop/route.ts` | Record cash drop |
| `src/app/api/payments/cash-drawer/paidout/route.ts` | Record paid out |
| `src/app/api/payments/store-forward/queue/route.ts` | Get offline payment queue |
| `src/app/api/payments/store-forward/process/route.ts` | Process offline queue |
| `src/app/api/settings/dual-pricing/route.ts` | Get/set dual pricing configuration |
| `src/jobs/settlement.ts` | BullMQ job: auto batch settlement |
| `src/jobs/stale-tabs.ts` | BullMQ job: auto-close idle bar tabs |
| `src/jobs/offline-sync.ts` | BullMQ job: process store-and-forward queue |
| `src/jobs/reconciliation.ts` | BullMQ job: generate daily reconciliation |
| `src/jobs/preauth-expiry.ts` | BullMQ job: alert for expiring pre-auths |

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/payments/valor-mock.ts` | Keep as development fallback. Add `VALOR_MODE=mock\|live` env flag. When live, use valor-client.ts; when mock, use existing mock. |
| `src/app/api/payments/process/route.ts` | Wire to real Valor client (via mode flag). Handle all card entry modes, dual pricing, store-and-forward fallback. |
| `src/app/api/payments/capture/route.ts` | Wire to Valor capture API. Support tip adjustment on capture. |
| `src/app/api/payments/void/route.ts` | Wire to Valor void API. Add manager approval logic. Reason codes. |
| `src/app/api/payments/refund/route.ts` | Wire to Valor refund API. Full/partial. Manager approval. Unlinked refund support. |
| `src/app/api/payments/preauth/route.ts` | Wire to Valor auth-only API for bar tabs. Store token. |
| `src/app/api/payments/settlement/route.ts` | Wire to Valor settlement API. Pre-checks. Results storage. |
| `src/app/api/payments/tip-adjust/route.ts` | Wire to Valor tip adjust API. Validation (>50% warning, >100% block). |
| `src/app/api/payments/gift-card/check-balance/route.ts` | Query Sear gift card DB. |
| `src/app/api/payments/gift-card/activate/route.ts` | Create gift card in DB. |
| `src/app/api/payments/gift-card/reload/route.ts` | Add funds to gift card. |
| `src/components/payments/CardProcessing.tsx` | Replace fake spinner with real Valor terminal interaction UI. Show terminal status, entry mode animation, dual pricing. |
| `src/components/payments/CashTender.tsx` | Add denomination suggestion, dual pricing cash discount display, "Open Drawer" button. |
| `src/components/payments/TipSelector.tsx` | Configurable percentages, pre-tax/post-tax base, validation. |
| `src/components/payments/PaymentMethodGrid.tsx` | Add dual pricing labels, terminal status indicator. |
| `src/components/payments/PaymentComplete.tsx` | Show card details (last 4, brand, entry mode), receipt options, dual pricing savings display. |
| `src/components/payments/GiftCardFlow.tsx` | Wire to real gift card system. Balance query, partial redemption, remainder tracking. |
| `src/components/payments/HouseAccountFlow.tsx` | Wire to house account system. Credit limit check, PIN/signature. |
| `src/stores/order-store.ts` | Add payment transaction state, bar tab state, batch state. |
| `src/app/(pos)/payments/page.tsx` | Complete rewrite with multi-tender, Valor integration, all payment flows. |

### Acceptance Criteria

- [ ] Server processes card payment → Valor terminal activated via Valor Connect → "Present Card" shown on POS → card inserted (EMV) → "Authorizing..." → approved → auth code and last 4 displayed → tip entry if tip-on-receipt
- [ ] Card declined → decline reason shown (Insufficient Funds / Do Not Honor / etc.) → "Try Another Card" option works
- [ ] Valor terminal offline → "Terminal not responding" after 120s → store-and-forward option offered
- [ ] Dual pricing enabled → check shows card price and cash price → paying by cash uses lower price → paying by card uses menu price → receipt shows both
- [ ] Server processes cash payment → numpad → enters $60 for $47.32 check → change due: $12.68 → denomination breakdown shown → "Open Drawer" button visible
- [ ] Multi-tender: $37.42 gift card applied → remaining $15.08 → cash $20 → change $4.92 → check closes with both payments recorded
- [ ] Partial card payment → server enters $25 → charges $25 on card → remaining $22.50 → second card charged for remainder → both transactions recorded
- [ ] Bartender opens bar tab → card pre-authed for $50 → tab shows card on file with last 4 digits
- [ ] Bar tab running total ($54) exceeds auth ($50) → incremental auth fires automatically → new auth amount shown
- [ ] Bar tab closed with tip → capture at subtotal + tax + tip → correct amount captured → excess auth released
- [ ] Stale bar tab (4+ hours idle) → BullMQ job flags it → manager alerted → auto-close option with capture
- [ ] Bar tab walkout → manager PIN → capture at running total + tax + 20% auto-gratuity → logged as walkout
- [ ] Tip-on-receipt flow: auth for $92.68 → server enters $18 tip → capture for $110.68 → tip recorded separately
- [ ] Tip-on-screen flow (counter-service): customer selects 20% tip on terminal → sale for $55.62 (includes tip) → captured immediately
- [ ] Tip > 50% of check → warning shown → server can confirm or re-enter
- [ ] Tip adjustment within 24 hours → manager can adjust tip → Valor tip-adjust API called → new amount captured
- [ ] Void before settlement → manager PIN → reason code → Valor void API → transaction voided → hold released → check reopens
- [ ] Refund after settlement → full refund → manager PIN → reason → Valor refund API → credit to original card → logged
- [ ] Partial refund → $25 of $80 transaction → refund processed → remaining refundable: $55 → logged
- [ ] Unlinked refund (different card) → manager PIN required always → new card read on terminal → refund processed
- [ ] Refund on 121-day-old transaction → blocked: "Transaction exceeds 120-day refund window"
- [ ] Auto batch settlement at 2:00 AM → BullMQ job fires → Valor settlement API called → batch result recorded → reconciliation generated
- [ ] Manual batch settlement → pre-checks shown (open tips, open tabs) → settle → results displayed
- [ ] Daily reconciliation report → all categories populated → Valor deposit matched against Sear records → variance shown
- [ ] Cash management: opening count entered → cash sales throughout day → closing count → over/short calculated → variance > $5 requires manager sign-off
- [ ] Cash drop recorded → reduces expected drawer total → accounted for in closing count
- [ ] Store-and-forward: offline transaction queued → connection restores → auto-processed → if declined, manager alerted
- [ ] Chargeback notification received via webhook → case created → evidence auto-gathered → manager notified → recommended action shown
- [ ] Gift card: check balance → $45 balance shown → apply to $30 check → $30 deducted → remaining balance $15 → transaction logged
- [ ] Gift card: $15 balance applied to $30 check → $15 deducted → remaining $15 on check → server adds card payment for remainder
- [ ] PCI compliance: NO full PAN, CVV, track data, or PIN stored anywhere in database or logs — only last 4, brand, token, auth code
- [ ] All payment actions create audit trail entries with staff ID, timestamp, amount, method, and any manager approvals

### End-to-End Workflow Tests

**Workflow 1: Full Dine-In Payment with Tip-on-Receipt**
1. Server creates order for Table 5 → 3 entrees ($28 + $32 + $24 = $84), 2 drinks ($12 + $10 = $22)
2. Subtotal: $106. Tax (8.875%): $9.41. Total: $115.41
3. Server taps "Pay" → "Card"
4. Valor VP800 terminal activates → customer-facing screen shows $115.41 and dual pricing
5. Customer inserts chip card → EMV read → authorized → auth code displayed
6. Merchant receipt prints with tip line
7. Customer writes $23 tip
8. Server enters $23 tip in POS → capture called with $115.41 + $23 = $138.41
9. Check closed. Both payments recorded.
10. End of day: transaction appears in batch. Settlement runs. Reconciliation matches.
11. **Verify:** Auth code correct, tip recorded separately, batch total includes this transaction, reconciliation shows no variance

**Workflow 2: Bar Tab Lifecycle (Open → Items → Incremental Auth → Close with Tip)**
1. Customer at bar → bartender opens tab "John S"
2. Card inserted → pre-auth $50 → approved → tab open with card on file
3. John orders: IPA $8, Wings $14, Margarita $12, 2x Shots $20 → running total $54
4. $54 * 1.3 = $70.20 > $50 auth → incremental auth fires → new auth $100
5. John orders: 1 more beer $8 → running total $62
6. Bartender closes tab → subtotal $62, tax $5.27 → total $67.27
7. Tip on terminal: John selects 20% ($12.45) → capture for $79.72
8. Excess auth ($100 - $79.72 = $20.28) released
9. Tab status: closed
10. **Verify:** All incremental auths tracked, final capture correct, tip separated, excess released

**Workflow 3: Multi-Tender Split Payment (Gift Card + Cash + Card)**
1. Check total: $127.43
2. Server taps "Pay" → "Gift Card" → enters card number → balance $45.00
3. Apply full balance → $45.00 applied → remaining: $82.43
4. Server taps "Cash" → enters $40.00 → remaining: $42.43
5. Server taps "Card" → Valor terminal activates → customer inserts card → authorized for $42.43
6. Tip entry: $8 → capture for $50.43
7. All three payments recorded: GC $45, Cash $40, Card $50.43
8. Check closed. Total payments: $135.43 (includes $8 tip)
9. **Verify:** Gift card balance reduced to $0, cash recorded, card with tip captured, check fully paid

**Workflow 4: Void + Refund Lifecycle**
1. Server processes card payment for $85.00 → authorized and captured
2. Manager realizes wrong amount → taps Void → enters PIN → reason "Wrong Amount" → void processed → hold released
3. Correct amount: $78.00 → new payment processed → captured
4. Next day (after settlement): customer calls about overcharge. Original $78 charge settled.
5. Manager processes partial refund of $15.00 → PIN → reason "Wrong Amount" → refund to original card
6. Transaction shows PARTIALLY_REFUNDED with $15 refunded, $63 remaining
7. **Verify:** Void released hold instantly, refund credited after settlement, audit trail complete for both

**Workflow 5: Settlement + Reconciliation**
1. Full day of service: 45 card transactions totaling $4,237.50 in gross charges
2. 3 voids totaling $125.00 (removed from batch)
3. Net card transactions: $4,112.50
4. 2:00 AM: BullMQ settlement job fires → Valor batch close API → batch closed
5. Batch result: 42 transactions (45 - 3 voids), $4,112.50 gross
6. Next business day: Valor deposits $4,009.00 to bank account
7. Reconciliation: $4,112.50 gross - $103.50 estimated fees = $4,009.00 → matches → no variance
8. If dual pricing enabled: report shows $164.50 in dual pricing surcharge collected, reducing effective processing cost
9. **Verify:** Settlement timing correct, batch count matches, reconciliation calculates correctly, dual pricing offset shown

**Workflow 6: Store-and-Forward + Offline Recovery**
1. Internet drops during dinner service
2. Server processes card → Valor terminal offline → "Store and Forward" offered
3. Server accepts → card swiped on terminal → encrypted locally → transaction queued
4. POS shows "1 payment pending" banner
5. 3 more offline transactions queued (all under $100 floor limit)
6. Server tries $150 offline transaction → "Exceeds floor limit. Manager approval required." → Manager approves.
7. Internet restores → BullMQ job processes queue → 4 approved, 1 declined
8. Declined transaction: manager alerted → customer already left → logged as potential loss
9. **Verify:** All 5 transactions processed after reconnect, declined one flagged, floor limit enforced
