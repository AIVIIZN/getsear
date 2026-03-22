# Module 04: Payment Processing

## Overview

The Payments module handles all money movement in Sear POS. It integrates exclusively with Valor PayTech for card processing via Valor Connect (MQTT) and REST API. Card data never touches Sear servers — Valor terminals encrypt at point of capture and return tokens. The module supports card, cash, gift cards, house accounts, Apple Pay, Google Pay, bar tabs, split payments, tips, surcharging/dual pricing, and end-of-day settlement.

**Who uses it:** Servers and cashiers process payments. Bartenders manage bar tabs. Managers handle voids, refunds, and settlement. Owners review reconciliation reports. The system itself runs automatic settlement and tip processing.

**Why it matters:** This is where revenue materializes. Payment accuracy is non-negotiable. PCI compliance is mandatory. Dual Pricing is Sear's core revenue model (1.9% of 4% card surcharge). Every payment must be reconciled, every tip tracked, every refund auditable.

---

## Database Tables

### Core Tables

- **`payments`** — Payment records. Fields: `order_id`, `payment_method` (enum: cash, credit_card, debit_card, gift_card, house_account, apple_pay, google_pay, external), `status` (enum: pending, authorized, captured, settled, declined, voided, refunded, failed), `amount`, `tip_amount`, `total_amount`, `processor_transaction_id`, `card_brand`, `card_last_four`, `auth_code`, `gift_card_id`, `cash_tendered`, `change_due`, `split_index`, `refund_amount`, `refund_reason`, `refunded_by`, `refunded_at`, `original_payment_id`, `processed_by`, `processor_response` (jsonb).
- **`tip_adjustments`** — Post-close tip changes. Fields: `payment_id`, `order_id`, `server_id`, `original_tip`, `adjusted_tip`, `reason`, `adjusted_by`.
- **`gift_cards`** — Gift card records. Fields: `card_number` (masked in responses), `card_number_hash` (SHA-256 for lookups), `pin_hash`, `initial_balance`, `current_balance`, `purchased_by_customer_id`, `purchase_order_id`, `recipient_name/email/phone`, `message`, `is_active`, `expires_at`.
- **`gift_card_transactions`** — Ledger of gift card activity. Fields: `gift_card_id`, `transaction_type` (purchase, reload, redeem, refund, adjustment), `amount`, `balance_after`, `order_id`, `payment_id`.
- **`cash_drawers`** — Cash drawer state. Fields: `terminal_id`, `is_open`, `opened_by`, `starting_cash`, `current_cash`, `expected_cash`, `actual_cash`, `over_short`.
- **`cash_drawer_events`** — Cash drawer event log. Fields: `event_type` (enum: open_shift, close_shift, cash_sale, cash_refund, paid_in, paid_out, tip_payout, no_sale, count), `amount`, `running_total`, `order_id`, `payment_id`.
- **`order_discounts`** — (Shared with Orders) Discount tracking.

### New Tables (for rebuild)

- **`house_accounts`** — Corporate/house billing accounts. Fields: `id`, `org_id`, `account_name`, `contact_name`, `contact_email`, `contact_phone`, `billing_address` (jsonb), `credit_limit` (numeric 10,2), `current_balance` (numeric 10,2), `payment_terms` (text: net_15, net_30, net_60), `is_active`, `created_at`, `updated_at`.
- **`house_account_transactions`** — Charge/payment ledger. Fields: `id`, `house_account_id`, `transaction_type` (charge, payment, credit, adjustment), `amount`, `balance_after`, `order_id`, `payment_id`, `invoice_id`, `description`, `performed_by`, `created_at`.
- **`settlement_batches`** — End-of-day batch records. Fields: `id`, `org_id`, `location_id`, `batch_date`, `total_card_amount`, `total_cash_amount`, `total_gift_card_amount`, `total_tips`, `total_refunds`, `card_count`, `cash_count`, `status` (open, closed, reconciled), `closed_by`, `closed_at`, `valor_batch_id`, `reconciliation_notes`.
- **`surcharge_config`** — Per-location surcharge/dual pricing config. Fields: `id`, `org_id`, `location_id`, `is_enabled`, `surcharge_percentage` (numeric 5,4), `is_prohibited_state`, `debit_excluded`, `prepaid_excluded`, `visa_cap`, `mastercard_cap`, `signage_acknowledged`, `created_at`.

---

## API Routes

### Blueprint: `/api/v1/payments/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/` | Process payment (cash, card, gift card, house account) | Yes |
| GET | `/:id` | Get payment details | Yes |
| POST | `/:id/capture` | Capture authorized payment | Yes |
| POST | `/:id/void` | Void payment (before settlement) | Manager+ |
| POST | `/:id/refund` | Process refund (full or partial) | Manager+ |
| POST | `/:id/adjust-tip` | Adjust tip amount post-close | Yes |
| POST | `/preauth` | Pre-authorize a card (bar tabs) | Yes |
| GET | `/settlement-report` | End-of-day settlement summary | Manager+ |
| POST | `/settle` | Close batch and settle | Manager+ |
| POST | `/gift-cards/activate` | Activate a new gift card | Yes |
| GET | `/gift-cards/:number/balance` | Check gift card balance | Yes |
| POST | `/gift-cards/:number/reload` | Reload gift card | Yes |
| POST | `/cash-drawer/open` | Open cash drawer (start of shift) | Yes |
| POST | `/cash-drawer/close` | Close and count cash drawer | Yes |
| POST | `/cash-drawer/paid-in` | Record paid-in | Manager+ |
| POST | `/cash-drawer/paid-out` | Record paid-out | Manager+ |
| POST | `/cash-drawer/no-sale` | Open drawer without transaction | Yes |
| GET | `/reconciliation/daily` | Daily reconciliation report | Manager+ |
| POST | `/reconciliation/close-day` | Close business day | Manager+ |
| GET | `/reconciliation/match-deposit` | Match bank deposit to batch | Manager+ |

---

## UI Pages / Components

### Payment Flow Screen — `/pos/payment`
- **Full state machine UI** with these states:
  1. **Amount display:** Shows order total, balance due, tip suggestion
  2. **Method selection:** Card, Cash, Gift Card, House Account, Split
  3. **Card processing:** "Present card on terminal" with terminal animation, then auth result
  4. **Cash processing:** Numpad for tendered amount, auto-change calculation, denomination breakdown
  5. **Gift card processing:** Card number entry or scan, balance check, partial/full redemption
  6. **Tip screen:** Suggested tip buttons (18%, 20%, 22%, custom), "No Tip" option
  7. **Receipt prompt:** Print, Email, SMS, No Receipt
  8. **Complete:** Confirmation with transaction details

### Split Payment Interface
- Shows order total and remaining balance
- Multiple payment rows, each with method + amount
- "Split Equal" button (divide by N guests)
- "Split by Item" (assign items to payments)
- "Custom Amount" (enter arbitrary dollar amounts per payment)
- Mixed tender support (e.g., $30 card + $15 cash + $5 gift card)

### Cash Drawer Count — `/pos/cash-drawer`
- Denomination grid: pennies, nickels, dimes, quarters, $1, $5, $10, $20, $50, $100
- Quantity input for each denomination
- Running total
- Expected cash display (from system tracking)
- Over/short calculation and display
- Notes field for discrepancies
- Submit and close drawer

### Settlement Report — `/reports/settlement`
- Card totals by brand (Visa, MC, Amex, Discover)
- Cash total
- Gift card total
- House account charges
- Tips collected
- Refunds/voids
- Net settlement amount
- Valor batch ID for cross-reference
- Close batch button

---

## Business Rules

### Payment State Machine

```
PENDING → AUTHORIZED → CAPTURED → SETTLED
              ↓             ↓
           VOIDED        REFUNDED
PENDING → DECLINED
PENDING → FAILED
```

### Card Payments

1. **Valor integration:** All card processing goes through Valor PayTech. Sear sends transaction requests via Valor Connect (MQTT) or REST API. Valor terminal handles card read, encryption, and PIN entry. Sear receives token, auth code, last 4, card brand.

2. **Authorization flow:** (a) Sear sends auth request to Valor with amount. (b) Valor terminal prompts customer. (c) Card data encrypted at terminal. (d) Valor routes to backend processor. (e) Auth response (approved/declined) returned with token. (f) Sear stores token, never raw card data.

3. **Capture:** After tip is added, Sear sends capture request with final amount (original + tip). This occurs at settlement or when manually captured.

4. **Void vs refund:** If payment has not settled (same batch), void the authorization. If payment has settled, process a refund. Voids are free; refunds may incur interchange.

5. **Dual pricing / surcharging:** Card price = cash price + surcharge percentage (configurable, default 4%). Display both prices. Debit cards and prepaid cards CANNOT be surcharged (Durbin Amendment). Prohibited states (CA, CT, ME, MA) disable surcharging. Visa cap: 3%. Mastercard cap: 4%.

6. **Apple Pay / Google Pay:** Processed through Valor terminal as contactless. Same flow as card. Card brand determined by underlying card in wallet.

### Cash Payments

7. **Cash tendering:** Server enters tendered amount. System calculates change. Cash drawer kicks via receipt printer or direct command. `cash_drawer_events` record created.

8. **Denomination tracking:** Optional denomination breakdown on cash count for drawer reconciliation.

9. **Paid-in/paid-out:** Manager can record money added to (paid-in) or removed from (paid-out) the drawer with reason. Both create `cash_drawer_events`.

### Gift Cards

10. **Activation:** Gift cards are activated with an initial balance, linked to a purchase order. Card numbers are stored hashed (SHA-256) for lookup security. The unhashed number is returned only at activation.

11. **Redemption:** Partial redemption allowed. Remaining balance stays on card. If gift card balance is less than order total, the difference must be covered by another payment method (split).

12. **Reload:** Additional funds can be added to an active card.

13. **Cross-location:** Gift cards work across all locations within the organization.

### Bar Tabs

14. **Pre-authorization:** Card is pre-authed for a configurable amount (default $50). Customer keeps their card. Order items accumulate on the tab.

15. **Tab close:** Final amount (items + tip) captured against the pre-auth. If final exceeds pre-auth by >20%, incremental auth may be needed.

16. **Walkout protection:** If tab is open past close time with no close action, auto-gratuity (configurable, default 20%) is added and the pre-auth captured.

17. **Stale tab auto-close:** Tabs open longer than configurable threshold (default 4 hours) trigger an alert to the bartender.

### Split Payments

18. **Multiple payment methods on one order.** Each payment gets a `split_index` (1, 2, 3...). `balance_due` recalculates after each payment. Order closes when `balance_due = 0`.

### Tips

19. **Suggested tips:** Configurable percentages (default: 18%, 20%, 22%). Custom amount option. "No Tip" option.

20. **Auto-gratuity:** For parties of N+ (configurable), auto-gratuity is added as a service charge (not a tip — IRS treatment differs). Treated as revenue, not employee tip.

21. **Tip adjustment:** Post-close, tips can be adjusted (common when processing card slips). Creates `tip_adjustments` record. Must be done before batch settlement.

22. **Tip distribution:** See 07_staff.md for tip pooling and distribution.

### Settlement / Reconciliation

23. **Batch close:** At end of day, all captured card transactions are batched and sent to Valor for settlement. The batch ID is stored.

24. **Daily reconciliation:** Compare expected cash (starting + sales - payouts) vs counted cash. Compare expected card totals vs processor batch totals.

25. **Close day workflow:** (a) All tabs must be closed. (b) All tips entered. (c) Cash drawers counted. (d) Batch settled. (e) Daily report generated. (f) Close action creates `settlement_batches` record.

---

## Dependencies

- **01_auth** — Authentication, manager PIN for voids/refunds
- **03_orders** — Order data, balance_due updates
- **10_settings** — Surcharge config, terminal config, tax rates
- **External: Valor PayTech** — Card processing (MQTT + REST)
- **External: Redis DB 0** — Celery task queue for async settlement

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `payment.completed` | `events.orders` | `{payment_id, order_id, method, amount, balance_due}` | Payment processed |
| `payment.declined` | `events.orders` | `{order_id, reason}` | Card declined |
| `payment.voided` | `events.orders` | `{payment_id, order_id}` | Payment voided |
| `payment.refunded` | `events.orders` | `{payment_id, order_id, amount}` | Refund processed |
| `settlement.closed` | `events.reports` | `{batch_id, location_id, totals}` | Batch settled |
| `cash_drawer.opened` | `events.pos` | `{drawer_id, terminal_id}` | Drawer opened |
| `cash_drawer.alert` | `events.pos` | `{drawer_id, reason}` | Drawer left open too long |

### Subscribed Events
| Event | Action |
|-------|--------|
| `order.closed` | Trigger tip distribution calculation |
| `order.voided` | Void any pending payments on the order |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `auto_close_stale_tabs` | Every 30 minutes | Alert bartender about tabs open > threshold |
| `batch_settlement` | Configurable (default 11 PM location TZ) | Auto-settle batch if not manually closed |
| `tip_adjustment_reminder` | 30 min before auto-settle | Notify managers of unadjusted tips |
| `daily_reconciliation_calc` | Daily at 4 AM | Pre-calculate reconciliation numbers |
| `gift_card_expiry_check` | Daily at midnight | Deactivate expired gift cards |

---

## Acceptance Criteria

### Card Payments
- [ ] User can process a card payment through Valor terminal
- [ ] Card data never touches Sear servers (only token, last 4, brand, auth code stored)
- [ ] Approved payment updates order `amount_paid` and `balance_due`
- [ ] Declined card shows clear error message
- [ ] Payment record created with `processor_transaction_id`

### Cash Payments
- [ ] User can enter cash tendered amount via numpad
- [ ] Change due calculated and displayed correctly
- [ ] Cash drawer kicks on cash payment
- [ ] `cash_drawer_events` record created with correct running total

### Gift Cards
- [ ] User can activate a gift card with initial balance
- [ ] User can check balance by card number
- [ ] User can redeem partial or full balance as payment
- [ ] User can reload a gift card
- [ ] Gift card works across all locations in the org
- [ ] Card numbers stored as SHA-256 hashes

### Bar Tabs
- [ ] User can pre-authorize a card for a bar tab
- [ ] Items can be added to a tab without re-swiping
- [ ] Tab can be closed with tip added to final capture amount
- [ ] Stale tabs (>4 hours) trigger alert to bartender
- [ ] Walkout tabs auto-apply gratuity at close time

### Split Payments
- [ ] User can split payment equally across N guests
- [ ] User can split by item assignment
- [ ] User can enter custom split amounts
- [ ] Mixed tender works (card + cash + gift card on one order)
- [ ] Order closes when total `balance_due` reaches 0

### Tips
- [ ] Tip suggestion buttons show correct percentages
- [ ] Custom tip amount can be entered
- [ ] Tips are adjustable post-close before settlement
- [ ] Tip adjustments create `tip_adjustments` records

### Void / Refund
- [ ] Manager can void a payment before settlement
- [ ] Manager can process full or partial refund after settlement
- [ ] Void/refund require manager PIN
- [ ] Void/refund create audit trail

### Settlement
- [ ] Manager can view settlement report with card/cash/gift card breakdowns
- [ ] Manager can close batch and trigger Valor settlement
- [ ] Settlement creates `settlement_batches` record
- [ ] Daily reconciliation shows expected vs actual for cash and cards

### Dual Pricing
- [ ] Surcharge percentage is configurable per location
- [ ] Debit and prepaid cards excluded from surcharging
- [ ] Surcharging disabled in prohibited states (CA, CT, ME, MA)
- [ ] Both cash and card prices displayed to customer

### House Accounts
- [ ] User can charge to a house account at POS
- [ ] System enforces credit limit
- [ ] House account transactions create ledger entries
- [ ] Balance updates in real time
