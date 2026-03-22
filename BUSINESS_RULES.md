# Sear POS — Business Rules

**Version:** 1.0
**Date:** 2026-03-22
**Status:** Source of truth for all operational logic

> This document defines every business rule, state machine, validation constraint, and workflow in the Sear POS system. Every rule includes specific numbers, thresholds, and time values so a developer can implement without guessing. When this document conflicts with code, this document wins — update the code.

---

## Table of Contents

1. [Order Lifecycle](#1-order-lifecycle)
2. [Payment Rules](#2-payment-rules)
3. [Menu Rules](#3-menu-rules)
4. [Table Management Rules](#4-table-management-rules)
5. [Kitchen Rules](#5-kitchen-rules)
6. [Staff Rules](#6-staff-rules)
7. [Customer Rules](#7-customer-rules)
8. [Reporting Rules](#8-reporting-rules)
9. [Security Rules](#9-security-rules)
10. [Online Ordering Rules](#10-online-ordering-rules)
11. [Reservation & Waitlist Rules](#11-reservation--waitlist-rules)
12. [Inventory Rules](#12-inventory-rules)
13. [Offline Mode Rules](#13-offline-mode-rules)
14. [Drive-Thru Rules](#14-drive-thru-rules)

---

## 1. Order Lifecycle

### 1.1 Order Status State Machine

```
draft → open → fired → ready → served → closed
  │       │       │       │       │        │
  │       │       │       │       │        └→ refunded
  │       │       │       │       │
  └───────┴───────┴───────┴───────┴→ voided
```

**Enum values:** `draft`, `open`, `fired`, `ready`, `served`, `closed`, `voided`, `refunded`

### 1.2 Valid State Transitions

| From | To | Trigger | Who Can Trigger |
|------|----|---------|-----------------|
| `draft` | `open` | Server taps "Send" — order is transmitted to kitchen/bar | Server, Bartender, Cashier |
| `draft` | `voided` | Server cancels unsent order | Server (no approval needed for unsent orders) |
| `open` | `fired` | Kitchen begins preparation on at least one item | Kitchen staff (via KDS bump), automatic on send for non-coursed items |
| `open` | `voided` | Manager voids the entire order before kitchen starts | Manager PIN required |
| `fired` | `ready` | All items on the order are marked complete by kitchen stations | Kitchen staff bump, Expo marks complete |
| `fired` | `voided` | Manager voids order mid-preparation (food quality, guest left) | Manager PIN required, reason code required |
| `ready` | `served` | Food runner or server marks order as delivered to guest | Server, Expo, Busser |
| `served` | `closed` | All payments received, balance due = $0.00 | Server, Cashier, Manager |
| `closed` | `refunded` | Post-settlement refund processed (full or partial) | Manager PIN required |
| `voided` | _(terminal)_ | Cannot transition out of voided | — |
| `refunded` | _(terminal)_ | Cannot transition out of refunded | — |

**Invalid transitions (system must reject):**
- `closed` → `open` (use "reopen" which creates audit entry, requires Manager PIN)
- `voided` → any state
- `refunded` → any state
- `draft` → `fired` (must go through `open` first)
- `ready` → `fired` (cannot go backward)
- `served` → `ready` (cannot go backward)

**Reopen closed order:** Creates a new audit log entry, requires Manager PIN + reason code. Reopened order returns to `served` status. Common reasons: tip adjustment, forgotten item, payment correction.

### 1.3 Order Number Generation

- **Sequential per location per day.** Resets to 1 at midnight in the location's configured timezone.
- **Database function:** `next_order_number(location_id)` — queries `MAX(order_number) + 1` where `opened_at::date = CURRENT_DATE` for that location.
- **Display format:** `{prefix}-{number}` where prefix is configurable per location (e.g., `A-042`, `DT-001`). Prefix stored in `locations.settings.order_number_prefix`.
- **Race condition prevention:** Use `SELECT ... FOR UPDATE` or advisory lock when generating order numbers to prevent duplicates under concurrent load.
- **Offline orders:** Assigned a temporary number prefixed with `OFF-` (e.g., `OFF-001`). On sync, the server assigns the real sequential number and the display number updates.
- **Number range:** 001–999 per day. If a location exceeds 999 orders in a day, continue incrementing (1000, 1001, etc.) — do not wrap.

### 1.4 Order Types

| Type | Description | Requires Table | Kitchen Routing |
|------|-------------|---------------|-----------------|
| `dine_in` | Standard table service | Yes | Route by station |
| `takeout` | Guest picks up at counter | No | Route by station, add packaging instructions |
| `delivery` | Delivered to address | No | Route by station, add packaging + label |
| `bar` | Bar tab / bar seat service | Optional (bar seat or standalone tab) | Drinks fire immediately, food routes normally |
| `catering` | Event/catering order | No | Route to catering prep area |
| `online` | Web/app order from customer | No | Route by station, may have dedicated KDS display |
| `kiosk` | Self-service kiosk order | No | Route by station |
| `drive_thru` | Drive-through lane order | No | Fire immediately, track lane position |
| `qr` | QR code table ordering | Yes (auto-assigned from QR code) | Route by station |

### 1.5 Order-Level Validation Rules

- **Dine-in orders** require a `table_id` unless the location setting `require_table_for_dine_in` is false.
- **Delivery orders** require `delivery_address` (line1, city, state, zip at minimum) and `guest_phone`.
- **Every order must have at least one item** before transitioning from `draft` to `open`.
- **Forced modifiers** must be satisfied before an order can be sent. If a menu item has a required modifier group with `min_selections >= 1` and no modifier is selected, the system blocks the send with: "Please select {modifier_group_name} for {item_name}."
- **86'd items** cannot be added to any order. If an item is 86'd between order entry and send, the system alerts the server: "{item_name} has been 86'd. Remove or substitute."
- **Allergen check:** If a seat has a logged allergy and the server adds an item containing that allergen, the system shows a WARNING dialog: "Seat {N} — {ALLERGEN} Allergy. This item contains {ALLERGEN}. Are you ordering for a DIFFERENT seat?" The server must explicitly acknowledge.

### 1.6 Order Item-Level State Tracking

Each `order_item` has independent boolean flags:

| Flag | Meaning | Set By |
|------|---------|--------|
| `is_sent` | Transmitted to kitchen KDS/printer | System (on order send) |
| `is_fired` | Kitchen has started preparation | Kitchen staff (KDS) or auto on send for course 1 |
| `is_ready` | Station completed this item | Kitchen staff (bump on station KDS) |
| `is_served` | Delivered to guest | Server/Runner/Expo |
| `is_voided` | Item cancelled | Manager (post-send requires PIN) |
| `is_comped` | Item zeroed out for service recovery | Manager PIN required |

**Pre-send void:** Server can void an item that has NOT been sent to kitchen (`is_sent = false`) without manager approval.
**Post-send void:** Requires manager PIN + reason code from enum: `customer_request`, `kitchen_error`, `server_error`, `wrong_item`, `quality_issue`, `86d`, `duplicate`, `other`.

### 1.7 Coursing Rules

- Each item is assigned a `course` number (integer, default 1).
- **Course 1** items fire immediately when the order is sent.
- **Course 2+** items appear on the station KDS with status "HELD" (gray background) until fired.
- **Server fires courses** from their iPad by tapping "Fire Course {N}". This sends a fire command to all stations holding items for that course.
- **Expo can also fire courses** as a backup.
- **"Fire All" emergency button:** Sends all remaining held courses to fire simultaneously. Available to Server and Manager roles.
- **"Fire When Ready" mode:** Allows kitchen to determine timing. Used for private dining or omakase. Set per-order.
- **"HOLD" button:** Server pauses a course. KDS shows "HELD BY SERVER" in blue. Kitchen does not start preparation.
- **"RUSH" button:** Server requests expedite. KDS shows "RUSH" in flashing red. Requires a reason code: `guest_complaint`, `long_wait`, `vip`. Tracked in audit log to prevent abuse.
- **Course gap alert:** If more than 20 minutes pass between clearing one course and firing the next, the system alerts the manager: "Table {N} — {X} minutes since last course cleared, next course not yet fired."

---

## 2. Payment Rules

### 2.1 Standard Card Flow

**Three phases:**
1. **Authorization** — Real-time. Card presented on Valor terminal (VP800/VP550/VP300 Pro/RCKT). Valor returns auth code + token. Card data never touches Sear servers.
2. **Capture** — At check close. Sear calls Valor capture endpoint with final amount (subtotal + tax + tip). Tip may be adjusted within the tip adjustment window.
3. **Settlement** — End-of-day batch. All captured transactions submitted to processor. Funds transfer in 1–3 business days.

**Auth-only vs. Sale:**
- `capture: false` → Auth only. Used for bar tabs, pre-auth holds, tip-adjust workflows. Must be captured later.
- `capture: true` → Sale (auth + capture in one step). Used for quick-service, takeout, standard dine-in close.

**Tip adjustment window:** Configurable per location, default 24 hours. During this window, servers or managers can adjust the tip amount on a captured transaction. After the window closes, tip adjustments require a manager override.

**Transaction timeout:** If no response from Valor within 30 seconds, the system shows "Transaction timed out — check terminal status." The transaction is marked `timed_out`. Manager must verify with Valor dashboard before retrying.

### 2.2 Cash Handling

**Cash tendering flow:**
1. Server/Cashier selects "Cash" as payment method.
2. Enters the amount tendered by the guest (e.g., $100.00 for a $87.43 check).
3. System calculates change due: $100.00 − $87.43 = $12.57.
4. System displays denomination breakdown for change:
   - $10 x 1
   - $2 x 1
   - $0.50 x 1
   - $0.05 x 1
   - $0.02 x 1
5. Cash drawer kicks open (ESC/POS command via receipt printer RJ12 cable).
6. Transaction recorded. Check closed.

**Denomination counting (open/close):**
- Cash count screen presents denominations: $100, $50, $20, $10, $5, $2, $1, $0.25, $0.10, $0.05, $0.01.
- Server taps quantity for each denomination. System calculates total.
- **Opening count:** Compared to previous night's closing count. Discrepancy flagged if > $5.00.
- **Closing count:** Compared to expected cash (opening bank + cash sales − cash payouts − safe drops). Over/short reported.
- **Over/short threshold:** Anything > $5.00 triggers an alert to GM and is logged in the cash discrepancy report. Anything > $25.00 additionally alerts the area manager (for multi-location).

**Cash drawer events tracked:**
- `open_shift` — Opening count
- `close_shift` — Closing count
- `cash_sale` — Cash payment received
- `cash_refund` — Cash refund issued
- `paid_in` — Cash added to drawer (e.g., making change from safe)
- `paid_out` — Cash removed for vendor payment, employee advance
- `tip_payout` — Cash tips paid to server
- `no_sale` — Drawer opened without a transaction (logged with employee ID, > 3 per shift triggers alert)
- `count` — Mid-shift count

### 2.3 Bar Tab Lifecycle

```
open → hold → incremental_auth → close_with_tip
  │                                      │
  │                                      └→ walkout → auto_gratuity
  │
  └→ stale_tab_auto_close (after 4 hours idle)
```

**Opening a tab:**
1. Guest presents credit card.
2. Bartender swipes/dips/taps card on Valor terminal.
3. System sends pre-authorization for configurable hold amount. Default: $50.00. Configurable range: $1.00–$500.00.
4. Tab opens with guest name (from card) + last 4 digits of card number.
5. Physical card stored in numbered card slot organizer OR returned to guest (card-on-file mode using token).
6. Bartender can tag tab with descriptor: "John - red hat", "Sarah - booth 3".

**Adding items to a tab:**
- Any bartender can add to any open tab (no tab ownership restriction).
- Tab search: by name or last 4 of card, results returned in < 2 seconds.
- When running total exceeds current auth amount (including 30% buffer for tax + tip), system triggers incremental authorization.
- **Incremental auth:** Re-authorize at 1.5x current running total. If processor doesn't support incremental auth, void original auth and create new auth at higher amount using saved token.
- If incremental auth fails AND no token available, flag tab as `over_auth` and alert manager.

**Closing a tab:**
1. Bartender retrieves card (or uses card-on-file token).
2. Taps "Close Tab."
3. Receipt prints: itemized with subtotal, tax, tip line, total, suggested tip amounts (18%, 20%, 22%).
4. Guest tips on receipt or on Valor terminal screen.
5. Final capture: subtotal + tax + tip.
6. Tab status → `closed`.

**Walkout handling:**
1. Guest left without closing tab.
2. Manager marks tab as "Walkout" (requires Manager PIN).
3. System captures at: running total + tax + 20% auto-gratuity.
4. Auto-gratuity percentage for walkouts: configurable, default 20%.
5. Tab status → `walkout`. Appears in loss prevention reports.
6. Walkout amount tracked separately from voids/comps.
7. **Important:** System does NOT have a "deduct from server paycheck" function. Walkouts are house losses. Server walkout frequency tracked for coaching purposes only.

**Stale tab auto-close:**
- Tabs with no activity for 4 hours (configurable: `AUTO_CLOSE_HOURS`): automatically closed by Celery background task.
- If running total > $0: capture at running total + tax (no auto-gratuity for stale close — gratuity only on explicit walkouts).
- If running total = $0: void the pre-authorization.
- **Pre-auth expiry warning:** Visa/Mastercard pre-auths expire after 7 days. System alerts manager 1 day before expiry: "Tab for {name} will expire tomorrow. Running total: ${amount}. Close immediately."

**Tab minimum spend:**
- Configurable per location per day-of-week and time period.
- Example: $25 minimum on Friday/Saturday nights.
- If guest closes tab below minimum: "Tab minimum is $25.00. Current total: $18.00. Add to tab or apply minimum charge?"

**Last call procedures:**
1. Manager triggers "Last Call" mode.
2. All bartender iPads show alert: "LAST CALL — 30 minutes to close."
3. Optional: disable new tab opening (only additions to existing tabs).
4. Auto-print all open tab receipts at configurable time.
5. After last call window closes: disable drink ordering, only tab closing allowed.
6. Auto-close all remaining tabs at end of night with configured auto-gratuity (18-20%, configurable).

### 2.4 Split Payments

**Split types:**

| Type | How It Works |
|------|-------------|
| **Equal split** | Total ÷ N guests. Each portion = total / N, rounded to nearest cent. Remainder (from rounding) applied to the first check. Tax split proportionally. |
| **By seat** | Items pre-assigned to seat numbers during order entry. System automatically generates one check per seat. |
| **By item** | Server drags individual items from master list to specific checks. Shared items can be split equally across selected checks or assigned to one check. |
| **Custom amount** | Server enters arbitrary dollar amounts per payment. System tracks remaining balance. |
| **Mixed tender** | Single check paid with multiple payment methods (e.g., $50 cash + $30 gift card + remainder on card). |

**Split payment rules:**
- System creates check portions, each with its own running total, tax calculation, and payment status.
- **Shared items** (appetizers, bottles of wine): can be split equally across all checks, across selected checks, or assigned to a specific check.
- **"Move seat to check"** — Transfer all items from a seat to a specific check in one action.
- **Unassigned items counter:** Server cannot finalize the split until all items are assigned (counter = 0).
- **Tax recalculates per check** after split.
- **Paid checks are locked.** Once a check portion is paid, it cannot be modified. Remaining unpaid checks can still be adjusted.
- **Check does not close until total payments >= check total.** Change is calculated for cash over-tender.
- **Each payment method recorded separately** for end-of-day reconciliation.

### 2.5 Refund Flow

| Timing | Action | Method |
|--------|--------|--------|
| **Pre-settlement** (same business day, before batch close) | **Void** the authorization | Valor void endpoint. Full amount only. Immediate release of hold on cardholder's account. |
| **Post-settlement** (after batch has settled) | **Full refund** | Valor refund endpoint. Credits the full captured amount back to the card. Appears on statement in 3–5 business days. |
| **Post-settlement** | **Partial refund** | Valor refund endpoint with specific amount. Amount must be ≤ original captured amount. |
| **No original transaction** | **Unlinked refund** | Process a standalone credit to a card. Requires Manager + Owner approval. Rare — used for situations where original transaction is not in system. |

**Refund authorization levels:**
- Server: Cannot process any refund.
- Cashier: Can process refunds up to $20.00 (configurable).
- Manager: Can process refunds of any amount. Must enter reason code.
- Unlinked refund: Requires both Manager PIN and Owner approval.

**Refund reason codes:** `customer_return`, `overcharge`, `quality_issue`, `duplicate_charge`, `never_received`, `other`.

### 2.6 Gift Cards

- **Card numbers:** Stored as SHA-256 hashes in the database. Full card number NEVER stored in plaintext.
- **Activation:** Gift card activated with a dollar amount. Minimum activation: $5.00. Maximum activation: $500.00.
- **Balance check:** Scan/swipe/enter card number → system returns current balance. Response time target: < 2 seconds.
- **Partial redemption:** Guest uses gift card for portion of check. System deducts amount used, remaining balance stays on card.
- **Reload:** Add funds to existing card. Same min/max as activation.
- **Split tender with gift card:** Guest pays $45.00 with gift card (balance $45.00), remainder $42.43 on credit card. Each payment method recorded separately.
- **Cross-location:** Gift cards work across all locations within the same organization. Balance is org-level, not location-level.
- **Expiration:** Configurable. Default: no expiration (some states prohibit gift card expiration). If state law requires an expiration, minimum 5 years from activation date.
- **Offline handling:** Cache last-known gift card balances locally. If balance query fails offline, server enters amount to try. If it would exceed balance, apply available balance and collect remainder via another method.

### 2.7 House Accounts

- **Setup:** Manager or Owner creates a house account for a customer. Requires: business name, billing contact, email, phone, billing address.
- **Credit limit:** Set per account. Default: $500.00. Range: $100.00–$50,000.00. Configurable per account.
- **Approval workflow:** First charge to a new house account requires Manager approval. Subsequent charges within credit limit: PIN authorization by the account holder or server.
- **Charging:** Server selects "House Account" as payment method → searches by name or account number → verifies identity (name + last 4 of phone) → charge applied.
- **Statement generation:** Monthly statements generated automatically on the 1st of each month. Includes: all charges, payments received, running balance. Sent via email (SendGrid).
- **Payment posting:** When customer pays their house account balance (check, card, cash), payment is posted against the account. Reduces outstanding balance.
- **Aging:** Accounts aged at 30/60/90 days. Accounts > 60 days overdue: alert to Owner. Accounts > 90 days: suspend account (no new charges allowed until balance is paid).

### 2.8 Tips

**Suggested tip amounts:**
- Displayed on receipt and Valor terminal customer-facing screen.
- Default suggestions: 18%, 20%, 22% of pre-tax subtotal.
- Custom tip option always available.
- Percentages configurable per location.

**Auto-gratuity (service charge):**
- Applied automatically based on configurable rules:
  - Party size >= N (default: 6 guests, configurable: 1–50).
  - Private dining: always.
  - Banquet/event: always.
  - Specific date/time: e.g., New Year's Eve.
- Default auto-gratuity percentage: 20% (configurable: 15%–25%).
- **Legal classification:** Auto-gratuity is a service charge, not a tip, per IRS Revenue Ruling 2012-18. Treated as restaurant revenue for tax purposes.
- **Display:** Must show as "Service Charge" or "Gratuity" on check — wording configurable per location.
- **Removal:** Only a Manager can remove auto-gratuity (Manager PIN required + reason code: `guest_objection`, `manager_discretion`, `policy_exception`).

**Tip distribution models (configurable per location):**

| Model | Description |
|-------|-------------|
| **Direct** | Server keeps 100% of their tips. Default for most restaurants. |
| **Tip-out by percentage of sales** | Server tips out fixed percentages to support roles: e.g., 3% of sales to bussers, 1% to bar, 1% to runners. |
| **Tip-out by percentage of tips** | Server tips out a percentage of their tips: e.g., 15% of tips to tip pool. |
| **Tip pool (equal by hours)** | All tips pooled and distributed proportionally by hours worked. |
| **Tip pool (by points)** | All tips pooled and distributed by assigned point values per role. E.g., Server = 10 points, Bartender = 8, Busser = 5, Runner = 3. |

**Form 8027 compliance:**
- Track all tipped employee income (credit card tips + declared cash tips + allocated tips).
- Generate IRS Form 8027 data: gross receipts, charge receipts, charge tips, service charges.
- Tip allocation required when total reported tips < 8% of gross receipts.
- System calculates and reports per pay period.

**Tip adjustment window:**
- Default: 24 hours from transaction time.
- Server or Manager can adjust tip amount within window.
- After window expires: adjustment requires Manager override.
- All tip adjustments logged with: who adjusted, old amount, new amount, timestamp.

### 2.9 Surcharging / Dual Pricing

**Sear uses Valor's Dual Pricing model (cash discount program):**
- Menu prices displayed are the **card price** (higher).
- **Cash price** is calculated as: card_price / 1.04 (rounded to nearest cent). This represents a 4% cash discount.
- Cash-paying customers pay the lower cash price.
- Card-paying customers pay the displayed card price (which includes the 4% surcharge).
- **Both prices shown** on menus, receipts, and customer-facing displays.

**Legal compliance:**
- **Cash discounts are legal in all 50 states.**
- **Surcharging prohibited in:** California, Connecticut, Maine, Massachusetts.
- In these states, Sear uses the cash discount framing (not surcharge framing). Prices shown are the cash price; card price is "standard price."
- **Card network caps:** Visa caps surcharge at 3%, Mastercard at 4%. Dual Pricing at 4% uses the cash discount model, which is not subject to network surcharge caps.
- **Debit and prepaid cards:** CANNOT be surcharged in any state. If Valor identifies a debit card, the cash price applies automatically.
- **Receipt display:** Must clearly show both cash and card prices. Format: "Cash Price: $XX.XX | Card Price: $XX.XX" or equivalent compliant disclosure.

**Revenue split (from the 4% Dual Pricing fee):**
- Sear keeps 1.9%.
- Valor keeps 2.1% (covers interchange, network fees, margin).
- Restaurant pays $0 in processing fees.

### 2.10 Pre-Authorization Rules

| Scenario | Default Hold Amount | Configurable Range | Expiry |
|----------|--------------------|--------------------|--------|
| Bar tab open | $50.00 | $1.00–$500.00 | 7 days (Visa/MC standard) |
| Dine-in card hold | $1.00 (validation only) | $1.00–$100.00 | 7 days |
| Hotel room charge | Full estimated amount | N/A | Per hotel agreement |

- **Incremental authorization:** When tab/order exceeds initial hold by more than 30% buffer, request additional authorization. New auth target = current total × 1.5.
- **Pre-auth expiry:** Visa/Mastercard pre-auths expire after ~7 days. System warns manager 1 day before expiry.
- **Declined pre-auth:** If pre-auth is declined, inform bartender/server immediately: "Card declined. Request alternative payment method."

---

## 3. Menu Rules

### 3.1 86 Toggle Propagation

**When an item or ingredient is 86'd, ALL channels sync within 3 seconds:**
- POS server iPads: item shows RED "86" overlay, cannot be ordered.
- KDS: 86'd items removed from available view.
- Online ordering: item hidden or marked "Sold Out."
- Kiosk: item hidden or marked "Sold Out."
- QR menu: item hidden or marked "Sold Out."
- Customer-facing display: item removed from promotions.

**Two levels of 86:**
1. **Ingredient 86:** Raw ingredient is gone. System cascades to ALL menu items containing that ingredient. Kitchen manager selects which items to 86 (some items may be kept if ingredient is minor/substitutable).
2. **Item 86:** Specific finished dish is unavailable (e.g., fryer broken = all fried items 86'd, but ingredients are fine).

**86 process:**
1. Kitchen manager taps "86 Manager" on KDS or management iPad.
2. Searches or selects ingredient/item.
3. For ingredient 86: system shows ALL affected menu items. Manager selects which to 86.
4. Applies 86. ALL server devices update within 3 seconds.
5. Audible notification on all server devices: "{Item} has been 86'd."
6. If a server has an unsent order containing an 86'd item: ALERT — "{Item} on Table {N} has been 86'd. Remove or substitute."

**Un-86 (restore):** Kitchen manager taps item → "Restore" → all cascaded items return to available. Server devices update immediately.

**86 quantity tracking:**
- "Running Low" status: configurable threshold (default: 5 portions remaining). Server sees "LOW" indicator. Can still order.
- "86'd" status: 0 portions. Cannot order.
- **Auto-86:** Item has a quantity count that decrements with each order sent. When count reaches 0, item auto-86's. Used for specials and food trucks.
- **Manual 86:** Kitchen manager can 86 regardless of theoretical count (they know the quality of remaining product).

**86 logging:** System records: what was 86'd, when, who 86'd it, when restored, estimated lost revenue (count of attempts to order 86'd items if logged).

### 3.2 Modifier Validation

**Modifier groups have these constraints:**

| Property | Description | Example |
|----------|-------------|---------|
| `is_required` | Must select from this group before sending | Temperature for steaks: required |
| `min_selections` | Minimum items to select | Side choice: min 1 |
| `max_selections` | Maximum items to select | Toppings: max 5 |
| `default_modifier_id` | Pre-selected option | Milk: "Whole Milk" default |
| `free_quantity` | Number of selections included in base price | First 2 cheeses free, additional $1.00 each |

**Validation rules:**
- If `is_required = true` and no modifier selected: block send with "Please select {group_name} for {item_name}."
- If selections < `min_selections`: block with "Select at least {min} from {group_name}."
- If selections > `max_selections`: block with "Select at most {max} from {group_name}."
- **Conditional modifiers:** Temperature modifier shown only for beef items. Hidden for plant-based patties. Controlled by item-to-modifier-group mapping.

**Modifier pricing models:**
1. **Included:** No charge (selecting between standard options).
2. **Upcharge:** Fixed additional cost (e.g., +$2.50 for bacon).
3. **Replacement:** Swap included item for another at no charge (sub sweet potato fries for regular fries).
4. **Replacement with upcharge:** Swap with price difference (sub truffle fries +$3.00).
5. **Quantity-based:** First N included, additional at cost (first 2 cheeses free, additional $1.00 each). Calculated as: `max(0, selections - free_quantity) × modifier_price`.
6. **Percentage-based:** Modify price by percentage (extra portion = +50% of item price).

### 3.3 Price Levels

**Up to 9 pricing tiers per item**, supporting automatic switching:

| Trigger | How It Works |
|---------|-------------|
| **Time-of-day (daypart)** | Price changes automatically at configured daypart boundaries. Dayparts: Breakfast, Lunch, Happy Hour, Dinner, Late Night. Each has a start/end time per day of week. |
| **Day-of-week** | Different prices on different days. E.g., "Taco Tuesday" pricing. |
| **Terminal/section** | Different prices at bar vs. dining room. Linked to terminal assignment or server section. |
| **Menu type** | Lunch menu vs. dinner menu vs. catering menu. Same physical item, different price per menu. |
| **Location tier** | Multi-location groups assign locations to pricing tiers (e.g., Tier 1: NYC/SF, Tier 2: Chicago, Tier 3: Suburban). Item gets a price per tier. |

**Pricing priority (when conflicts exist):**
1. Manual price override (manager-applied) — highest priority
2. Promotion/coupon pricing
3. Daypart pricing (happy hour)
4. Menu-specific pricing (lunch vs. dinner)
5. Location tier pricing
6. Base item price — lowest priority

**Price change rule:** The order timestamp determines pricing, NOT the payment timestamp. Guest who orders at 5:58 PM during happy hour gets happy hour pricing even if happy hour ends at 6:00 PM.

### 3.4 Dynamic Pricing / Happy Hour

**Daypart configuration:**
```
Daypart: "Happy Hour"
├── Schedule: Monday–Friday, 4:00 PM – 6:00 PM (configurable per day)
├── Applicable Sections: Bar Only (or All, configurable)
├── Pricing Rules:
│   ├── Well Cocktails: $5.00 (regular: $9.00)
│   ├── Draft Beer: $4.00 (regular: $7.00)
│   └── Selected Appetizers: 50% off
├── HH-Only Items: Sliders ($8), Wings ($7) — not available outside HH
├── Exclusions: Premium spirits, bottle service
└── Auto-Switch: Prices change automatically at start/end time
```

**Schedule-based activation:** Prices switch automatically at the configured time. No manual intervention required. Celery beat task validates daypart transitions every 60 seconds and updates the active pricing context.

**Manager override:** Manager can extend happy hour pricing for a specific table/tab past the scheduled end time.

**Holiday override:** System supports holiday-specific schedules (no happy hour on Thanksgiving, special holiday hours). Holiday calendar configurable per location.

### 3.5 Allergen Tracking

**14 EU allergens (required in EU, best practice everywhere):**
1. Celery
2. Cereals containing gluten (wheat, rye, barley, oats)
3. Crustaceans
4. Eggs
5. Fish
6. Lupin
7. Milk (including lactose)
8. Molluscs
9. Mustard
10. Tree Nuts (almonds, hazelnuts, walnuts, cashews, pecans, pistachios, macadamia)
11. Peanuts
12. Sesame
13. Soy
14. Sulphur dioxide / sulphites (> 10mg/kg)

**Additional US common allergens:** Coconut (FDA tree nut), Shellfish, Corn, Latex-cross-reactive fruits.

**Tagging system:**
- Each menu item tagged with CONTAINS and MAY CONTAIN for each allergen.
- Tags auto-inherit from recipe ingredients.
- Override capability for kitchen manager.
- **Severity levels:** `preference` (dietary choice), `intolerance` (discomfort), `allergy` (medical), `severe_anaphylaxis` (life-threatening).

**Seat-specific alerts:**
- When a seat has a logged allergy, RED ALLERGY BANNER persists at the top of every screen for that table. Cannot be dismissed.
- KDS tickets show allergy alert in large red text.
- Kitchen chits print: "*** ALLERGY ALERT: {ALLERGEN} — SEAT {N} ***" in oversized text.
- Kitchen staff must acknowledge allergy ticket (tap to confirm "allergy protocol followed"). Acknowledgment logged for liability.
- "Safe items only" filter: server can toggle to show only items that don't contain the logged allergen.

### 3.6 Item Availability Windows

- Items can be configured with availability rules:
  - **Always available** (default)
  - **Specific dayparts** (e.g., breakfast items only during Breakfast daypart)
  - **Specific days of week** (e.g., "Fish Fry Friday")
  - **Date range** (e.g., seasonal item available March 1 – May 31)
  - **Until 86'd** (available until manually or auto-86'd)
  - **Quantity limited** (available until count reaches 0)
- Items outside their availability window are hidden from the menu grid (not just grayed out).
- Seasonal items auto-deactivate when end date passes (doesn't delete — keeps history).
- "Tonight Only" flag for daily specials.

---

## 4. Table Management Rules

### 4.1 Table Status State Machine

```
available → reserved → seated → ordered → served → check_presented → dirty → available
     │                    │                            │
     │                    └── (direct from reservation) │
     └────────────────────────────────────────────────────── blocked (closed/maintenance)
```

| Status | Color on Floor Map | Meaning |
|--------|-------------------|---------|
| `available` | Green | Ready for seating |
| `reserved` | Hatched / Purple | Reserved for upcoming party, not yet arrived |
| `seated` | Blue | Guests seated, server notified |
| `ordered` | Amber | Food order sent to kitchen |
| `served` | Yellow | Food delivered, guests eating |
| `check_presented` | Yellow (pulsing) | Check given to guest, awaiting payment |
| `dirty` | Red | Guests departed, table needs bussing |
| `blocked` | Gray | Table closed (maintenance, combined with another table, etc.) |

### 4.2 Auto-Status Updates

| Trigger | Status Change |
|---------|--------------|
| Host seats guest (drag to table on floor map) | `available` → `seated` |
| Reservation time arrives and guest checks in | `reserved` → `seated` |
| Server sends first order to kitchen | `seated` → `ordered` |
| All items for the table marked `is_served` | `ordered` → `served` |
| Server initiates payment on the check | `served` → `check_presented` |
| All checks for the table are paid and closed | `check_presented` → `dirty` |
| Busser/host marks table as "Clean" | `dirty` → `available` |

**Timer starts on seat:** When table status changes to `seated`, a timer starts tracking total dwell time. This feeds into average turn time calculations and wait time estimates.

### 4.3 Server Section Assignment

- Floor plan divided into sections (configurable by Manager or Owner).
- Servers assigned to sections at shift start.
- **Rotation fairness:** When host seats a walk-in, the system suggests the section with the lowest current table count among on-duty servers. Host can override.
- **Table count display:** Host iPad shows each server's current table count next to their name.
- **Section rebalancing:** Manager can reassign sections mid-shift. All open tables in the reassigned section transfer to the new server (or stay with original server — configurable).

### 4.4 Table Merge / Split

**Merge tables:**
- Host drags two adjacent tables together on floor map.
- Merged table shows combined capacity.
- A single order/check spans the merged table.
- When unmerged, items can be split between the resulting tables.

**Split checks across tables:**
- Server can transfer items from one table's check to another table's check.
- Both servers must confirm the transfer (or Manager can force-transfer).
- Transferred items maintain their original prep status, seat assignment, and modifiers.

**Move table:**
- Guest moves from one table to another (e.g., from bar to dining room).
- Server taps "Move Table" → selects new table → all items, checks, and status transfer.
- Original table status → `dirty`. New table status → inherits previous status.

### 4.5 Stale Table Alerts

- Configurable inactivity threshold per table status:
  - `seated` with no order sent: alert after 10 minutes (configurable).
  - `ordered` with no food served: alert after 25 minutes (configurable, varies by concept).
  - `served` with no check presented: alert after 30 minutes (configurable).
  - `check_presented` with no payment: alert after 15 minutes (configurable).
  - `dirty` with no bussing: alert after 5 minutes.
- Alerts sent to: assigned server (push notification), host stand, manager.
- Alert format: "Table {N} — {status} for {X} minutes. Check with server."

---

## 5. Kitchen Rules

### 5.1 Ticket Routing

- Each menu item has a `prep_station` field mapping it to a KDS station.
- **Stations:** Grill, Saute, Fry, Cold/Salad, Pantry, Pizza/Oven, Dessert/Pastry, Bar, Expo.
- When an order is sent, each item routes to its assigned station's KDS.
- **Multi-station items:** An item like "Steak Frites" routes to BOTH Grill (steak) and Fry (frites). Both stations see the item. Item shows complete on Expo only when ALL stations have bumped it.
- **Expo station:** Sees ALL items from ALL stations. Shows full-ticket view with per-station completion status.
- **Bar items:** Drinks fire IMMEDIATELY to bar KDS/printer upon order send. Never held for coursing.

### 5.2 Course Firing

| Course | Default Behavior | KDS Display |
|--------|-----------------|-------------|
| Course 1 (apps/starters) | Auto-fire on order send | "FIRE" — green background |
| Course 2+ (entrees, etc.) | Held until server fires | "HELD" — gray background |
| Drinks | Always fire immediately (regardless of course) | "FIRE" |

- **Server fires courses** from their iPad: "Fire Course {N}" button.
- **Expo can also fire** as backup.
- **Auto-fire based on timing:** Optional. If enabled, Course 2 auto-fires N minutes after Course 1 is bumped by expo. N is configurable per location (default: disabled).
- **"Fire When Ready":** Allows kitchen to determine timing. Set per-order.

### 5.3 Ticket Aging

**Color-coded timers on KDS (configurable per location/category):**

| Time Since Fire | Color | Default Threshold | Meaning |
|----------------|-------|-------------------|---------|
| Fresh | Green | 0–8 minutes | On track |
| Warning | Yellow | 8–12 minutes | Watch it |
| Late | Orange | 12–18 minutes | Falling behind |
| Critical | Red | 18–25 minutes | Problem — expo should investigate |
| Emergency | Flashing Red + Audible | 25+ minutes | Food is extremely late |

**Three separate timers tracked:**
1. **Station timer:** Starts when item is FIRED to that station. Measures cook time.
2. **Table timer:** Starts when the course is FIRED. Measures guest wait from fire.
3. **Order timer:** Starts when order is entered. Measures total time from order to delivery.

**Configurable thresholds by concept:**
- Fine dining: 25 minutes for entrees acceptable. Emergency at 35+.
- Casual dining: 18 minutes target. Emergency at 25+.
- Quick-service: 5 minutes target. Emergency at 10+.
- Bar food: 12 minutes target. Emergency at 20+.

### 5.4 Rush Orders

- Server or Manager can mark an order as "RUSH" — appears on KDS in flashing red.
- Reason code required: `guest_complaint`, `long_wait`, `vip`, `re_fire`.
- **Priority queue on KDS:** RE-FIRE (highest) → RUSH → VIP → Normal. Within each category, sorted by time (oldest first).
- Rush orders get audio alert on affected stations.
- Rush usage tracked per server in reporting to prevent abuse.

### 5.5 All-Day Counts

- Displayed at bottom of each station's KDS (or on dedicated "All Day" screen).
- Shows aggregate of ALL pending items for that station across all active tickets.
- Format: `Ribeye: 3 (1 Rare, 1 MR, 1 Med)` — total count with temperature/modifier breakdown.
- Updates in real-time as new orders arrive and items are bumped.
- Tells the cook at a glance: "I need {N} things on my station right now."

### 5.6 Bump Behavior

- Cook taps "BUMP" on station KDS when their items for a ticket are complete.
- Item shows as ✓ (complete) on Expo screen.
- **Expo bump:** When all items across all stations are complete for a ticket (or course), Expo bumps the full ticket → "READY TO RUN" → server notified: "Food up for Table {N}."
- **Recall:** Bumped tickets can be recalled within 5 minutes (configurable: `BUMP_RECALL_MINUTES`). After recall window, ticket is archived.
- **Recall use case:** Expo bumped too early, or food needs to be re-plated.

### 5.7 Expo Station

- Sees all tickets, all stations, all courses.
- Tracks per-item completion status: ● (not started), ○ (in progress), ✓ (station complete).
- Identifies bottleneck: if 3 of 4 items done, the lagging station is highlighted.
- **"Ready to Run" indicator:** When all items for a course are complete, ticket highlights. Expo calls runner.
- **Re-fire:** If food quality issue, expo sends item back: "RE-FIRE {item} — Table {N}" → appears on station KDS as priority.
- **Return to kitchen:** Reason codes: `wrong_temp`, `wrong_item`, `presentation_issue`, `cold`, `contaminated`.
- **Communication to servers:** Push notification: "Table {N} food ready" or "Table {N} food delayed — ETA: {X} minutes."

### 5.8 Kitchen Capacity Management

- **Kitchen load indicator** (visible to management, host stand):
  - Green (0–60%): Normal operations.
  - Yellow (60–80%): Host quotes longer wait times for walk-ins. Online ordering shows extended times.
  - Red (80–95%): Host stops seating walk-ins temporarily. Online ordering pauses or extends delivery times.
  - Critical (95%+): "SLOW SEAT" mode — host seats one table at a time with spacing. Or "PAUSE NEW ORDERS" for online/delivery.
- **Capacity calculation:** Based on active tickets count vs. configurable maximum (e.g., 30 tickets = 100% capacity).
- **"Kitchen Closed" function:** Kitchen manager marks kitchen as closed. Servers cannot send new food orders (drinks only).

---

## 6. Staff Rules

### 6.1 Clock In / Out

- **PIN-based:** Employee enters 4–6 digit PIN to clock in/out.
- **Terminal-bound:** Clock in/out recorded with the terminal ID (which terminal they used). Optionally, terminals can be restricted to specific locations.
- **Rounding:** Configurable per location:
  - Exact time (default — to the minute).
  - Round to nearest 15 minutes.
  - Round to nearest 6 minutes (1/10 hour).
  - Round to nearest 5 minutes.
- **Early clock-in restriction:** Cannot clock in more than 5 minutes before scheduled shift without Manager approval. Configurable: 1–30 minutes.
- **Late clock-out warning:** If clocked in past scheduled end time by > 15 minutes: notification to Manager: "Employee {name} still clocked in. Scheduled end: {time}."
- **Automatic clock-out:** If no activity detected for 12 hours (configurable), system auto-clocks out the employee and alerts Manager for review.
- **Simultaneous prevention:** One employee cannot be clocked in at two locations simultaneously (for accurate overtime calculation).

### 6.2 Break Rules

| Break Type | Duration | Paid/Unpaid | Trigger |
|-----------|----------|-------------|---------|
| Short break | 10–15 minutes | Paid | Employee-initiated, tracked |
| Meal break | 30 minutes minimum | Unpaid (configurable) | Required by law in most states |

**State-specific break compliance:**
- **California:** 30-minute unpaid meal break before the 5th hour. Second 30-minute break before the 10th hour. If missed, employer owes a 1-hour penalty pay. 10-minute paid rest break per 4 hours worked.
- **New York:** 30-minute meal break for shifts > 6 hours that span the noon meal period (11 AM – 2 PM).
- **Federal:** No federal break requirement, but breaks < 20 minutes must be paid.

**System enforcement:**
- Break compliance timer: system tracks elapsed time since clock-in. Alerts manager X minutes before a required break threshold: "Employee {name} must take a meal break in {X} minutes."
- If break not taken by deadline: alert escalates. Logged for compliance audit.
- Break start/end recorded via PIN entry.
- Manager can acknowledge a waived break (where legally permitted) with reason code.

### 6.3 Overtime Calculation

| Jurisdiction | Rule |
|-------------|------|
| **Federal (FLSA)** | OT after 40 hours/week at 1.5x rate |
| **California** | OT after 8 hours/day at 1.5x, after 12 hours/day at 2x. OT after 40 hours/week. 7th consecutive day: first 8 hours at 1.5x, after 8 hours at 2x. |
| **Colorado** | OT after 12 hours/day or 40 hours/week |
| **Other states** | Most follow federal 40-hour rule; system configurable per location's state |

**Multi-location overtime:** If an employee works at multiple locations within the same organization, hours are consolidated for overtime calculation. 30 hours at Location A + 15 hours at Location B = 45 hours, with 5 hours of OT — even though neither location individually shows OT.

**Overtime alerts:**
- When employee approaches 36 hours in a week: alert to Manager.
- When employee approaches 8 hours in a day (CA): alert to Manager.
- Alert format: "Employee {name}: {X} hours this week. OT threshold in {Y} hours."

### 6.4 Tip Pool Distribution

**Calculation runs at end of shift or end of day (configurable).**

**Method 1: Tip-out by percentage of sales**
- Server tips out: 3% of net sales to bussers, 1% to bar, 1% to runners.
- Example: Server had $2,000 in sales → busser pool gets $60, bar pool gets $20, runner pool gets $20.

**Method 2: Tip pool by hours worked**
- All tips pooled. Each eligible employee receives: (their hours / total eligible hours) × total pool.
- Example: $1,200 total tips. Server A worked 8 hours, Server B worked 6 hours, Busser worked 8 hours. Total eligible hours: 22. Server A gets: (8/22) × $1,200 = $436.36.

**Method 3: Tip pool by points**
- Each role has a point value: Server = 10, Bartender = 8, Busser = 5, Runner = 3, Host = 2.
- Each employee's share: (their points × hours worked) / sum of all (points × hours) × total pool.

**Distribution rules:**
- Managers and owners are NOT eligible for tip pools (FLSA requirement unless they perform tipped duties).
- Back-of-house (kitchen) can be included in tip pools only if employer does NOT take a tip credit (varies by state and employer policy).
- Credit card processing fees: deduction from tips is legal in most states. If enabled, system calculates: tip amount × processing fee percentage (e.g., 2.49%).

### 6.5 Manager PIN Approval

**Actions requiring Manager PIN (configurable thresholds):**

| Action | Default Threshold | Configurable |
|--------|-------------------|-------------|
| Post-send void (item already in kitchen) | Always | No (always required) |
| Discount > X% of check | 10% | Yes: 1–100% |
| Discount > $Y amount | $25.00 | Yes: $1–$9,999 |
| Price override on any item | Always | No (always required) |
| Cash drawer open (no-sale) | Always | No (always required) |
| Time entry edit (clock in/out adjustment) | Always | No (always required) |
| Reopen closed check | Always | No (always required) |
| Refund > $X | $20.00 | Yes: $1–$9,999 |
| Delete/cancel order after send | Always | No (always required) |
| Change table's assigned server | Always | No (always required) |
| Apply comp | Always | No (always required) |

**Manager override tokens:**
- One-time use. Generated when Manager enters PIN for an override action.
- Expire after 5 minutes OR after single use, whichever comes first.
- Logged: which manager, what action, for which check/item, timestamp, terminal.

---

## 7. Customer Rules

### 7.1 Loyalty Earn Rules

- **Points per dollar:** Default: 1 point per $1 spent (pre-tax, pre-tip). Configurable: 0.5–10 points per dollar.
- **Points per visit:** Optional bonus: e.g., 10 bonus points per visit regardless of spend.
- **Earn exclusions:** No points earned on: tax, tips, gift card purchases, house account payments.
- **Enrollment:** At checkout with phone number only. No app download required.

**Tier thresholds (optional, configurable):**

| Tier | Points Required | Benefits |
|------|----------------|----------|
| Bronze | 0 | Base earn rate (1 pt/$1) |
| Silver | 500 | 1.5x earn rate, birthday reward |
| Gold | 1,500 | 2x earn rate, birthday reward, priority seating |
| Platinum | 5,000 | 2x earn rate, birthday reward, priority seating, quarterly VIP event |

### 7.2 Loyalty Redeem Rules

- **Minimum redemption:** 100 points = $5.00 off (configurable ratio).
- **Item restrictions:** Configurable. Can restrict redemption to food only (no alcohol), specific categories, or specific items.
- **Expiration:** Points expire after 12 months of account inactivity (no earn or redeem). Configurable: 6–36 months, or never.
- **Partial redemption:** Guest can redeem any number of points ≥ minimum. Remaining points stay on account.
- **Cannot combine with other discounts** (configurable — some locations allow stacking).
- **Real-time balance:** Loyalty balance updates immediately on earn and redeem. No batch delay.

### 7.3 Customer Merge

- **Purpose:** Combine duplicate customer records (e.g., same person enrolled twice with different phone numbers).
- **Process:** Manager selects two customer records → "Merge" → system shows both profiles side by side.
- **Preserved on merge:**
  - All order history from both records.
  - Combined loyalty points (sum of both accounts).
  - All visit history.
  - All notes and preferences.
  - Allergies from both records (union of all allergies).
- **Conflict resolution:** For conflicting fields (different email, phone, name), Manager selects which value to keep.
- **Non-reversible:** Merge cannot be undone. Warning dialog before confirmation.
- **Audit logged:** Who merged, when, which records, what conflicts were resolved.

### 7.4 House Account Rules

(See Section 2.7 for full house account payment rules.)

- **Credit limits:** $100.00–$50,000.00 per account, set by Manager/Owner.
- **Approval workflow:** New accounts require Owner approval. First charge requires Manager approval.
- **Statement generation:** Monthly on the 1st. Sent via email.
- **Aging:** 30/60/90 day aging. > 60 days: Owner alert. > 90 days: account suspended.
- **Payment methods accepted against house account balance:** Cash, check, credit card.

### 7.5 VIP Tagging and Special Treatment

- **VIP flag:** Boolean on customer profile. Set by Manager/Owner.
- **VIP effects:**
  - Server iPad shows VIP badge when seated: "VIP — {name}."
  - KDS tickets show VIP flag for priority treatment.
  - Host stand highlights VIP reservations.
  - Optional: VIP orders get priority in kitchen queue.
- **Special treatment flags (free-text notes):**
  - "Always asks for booth."
  - "Wife is celiac."
  - "Tips 30%+ — treat well."
  - "Allergic to shellfish — logged in allergies."
  - "Owner's friend — comp first drink."
- **Visit tracking:** Count of visits, last visit date, average spend, favorite items (auto-calculated from order history).
- **Win-back alert:** If a regular customer (10+ visits) hasn't visited in 30 days (configurable), system flags for Manager review. Optional: auto-send "We miss you" email/SMS.

---

## 8. Reporting Rules

### 8.1 Day Close / Reconciliation

**End-of-day procedure:**
1. **All open checks reviewed.** System shows all checks still open. Manager must close, void, or acknowledge each.
2. **Batch settlement.** System submits all captured card transactions to Valor for settlement. Includes tip adjustments.
3. **Cash count.** Manager performs cash drawer count (denomination-by-denomination).
4. **Variance detection.** Expected cash = opening bank + cash sales − cash payouts − safe drops. Actual vs. expected. Over/short reported.
5. **Deposit matching.** Cash deposit amount recorded. System matches against expected deposit. Variance flagged if > $5.00.
6. **Day close report generated.** Auto-emailed to Owner and configured recipients at 10:15 PM (configurable).

**Z Report (close-of-day):** Resets daily counters. Includes: total gross sales, net sales (after discounts/voids/comps), sales by category, sales by payment type, guest count, average check, void/comp/discount summary, labor summary, cash over/short.

**X Report (preview):** Same data as Z Report but does NOT reset counters. Can be pulled at any time during the day.

### 8.2 Pre-Aggregated Daily Metrics

- Calculated nightly by Celery background job at 3:00 AM (configurable).
- Stored in `daily_metrics` table for fast dashboard queries.
- Metrics aggregated: total revenue, guest count, average check, labor cost, labor percentage, food cost percentage, void/comp percentage, tips collected, speed of service averages.
- **Comparison baselines:** Same day last week, same day last year, trailing 7-day average, trailing 4-week average, budget (if configured).

### 8.3 PMIX (Product Mix) Classification

**Menu Engineering Matrix:**

| Classification | Popularity | Profitability | Action |
|---------------|-----------|---------------|--------|
| **Stars** | High (above average) | High (above average) | Promote heavily. Keep as-is. |
| **Plowhorses** | High (above average) | Low (below average) | Raise price cautiously, reduce food cost, or reposition. |
| **Puzzles** | Low (below average) | High (above average) | Promote more, better menu placement, rename/rebrand. |
| **Dogs** | Low (below average) | Low (below average) | Consider removing. Replace with new items. |

**Popularity threshold:** Average items sold per menu item per reporting period.
**Profitability threshold:** Average contribution margin per item (revenue − food cost).

### 8.4 Labor Cost Percentage

- **Formula:** `(total labor dollars / net revenue) × 100`
- **Labor dollars:** Sum of (hours worked × hourly rate) for all employees in the period. Includes overtime premium.
- **Target ranges:** Quick-service: 25–30%. Casual dining: 28–33%. Fine dining: 30–38%. Bar: 20–28%.
- **Alert threshold:** If labor % exceeds 32% of projected revenue for the current shift, alert GM and area manager.

### 8.5 Food Cost Percentage

- **Theoretical food cost:** `(recipe cost × items sold) / food revenue × 100` — what food cost SHOULD be based on recipes and sales.
- **Actual food cost:** `(beginning inventory + purchases − ending inventory) / food revenue × 100` — what food cost actually WAS.
- **Variance:** Actual − Theoretical. Acceptable variance: 1–2%. Variance > 3% triggers investigation (theft, waste, over-portioning).
- **Calculated weekly** (requires inventory count input).

### 8.6 Speed of Service

**Four timing segments tracked per order:**

| Segment | Start | End | Target (Casual) | Target (QSR) |
|---------|-------|-----|-----------------|---------------|
| Order-to-kitchen | Order entered | Order sent to kitchen | < 2 min | < 30 sec |
| Kitchen-to-ready | Order fired | Expo bumps complete | < 15 min | < 5 min |
| Ready-to-served | Expo bumps | Server marks served | < 3 min | < 1 min |
| Total | Order entered | Served to guest | < 20 min | < 7 min |

**Drive-thru:** Order-taken → ready → delivered-to-window. Target: < 180 seconds total.

**Outlier tracking:** Any ticket exceeding 2x the target is flagged as an outlier in reporting.

### 8.7 Franchise Royalty Calculation

- **Percentage of gross sales:** Configurable per franchise agreement. Typical: 4–8% of gross revenue.
- **Reporting period:** Monthly.
- **Calculation:** `gross_sales × royalty_percentage`. Gross sales = all revenue before discounts/comps.
- **Marketing fund contribution:** Additional percentage (e.g., 2% of gross) for brand marketing fund.
- **Automated reporting:** Generated on the 1st of each month for the prior month. Exportable for franchise accounting.

---

## 9. Security Rules

### 9.1 Password Complexity

- Minimum 12 characters.
- Must contain at least one of each: uppercase letter, lowercase letter, digit, special character.
- Cannot be the same as any of the last 5 passwords.
- Cannot contain the user's name or email prefix.
- Enforced on: email/password login accounts only (not PIN-based accounts).

### 9.2 PIN Rules

- Length: 4–6 digits (configurable per organization, default: 4).
- **Hashed with bcrypt.** Never stored in plaintext. Never hashed with SHA-256 (bcrypt is the ONLY acceptable algorithm).
- **Brute-force lockout:** 5 failed attempts → account locked for 5 minutes. Configurable: 3–10 attempts, 1–30 minute lockout.
- **Lockout escalation:** After 3 lockout periods in 1 hour → account locked until Manager reset.
- **PIN uniqueness:** Within a location, no two active employees can share the same PIN. System enforces at PIN creation/change time.
- **PIN change:** Employee can change their own PIN. Manager can reset any employee's PIN.

### 9.3 Session Expiry

| Login Type | Default Expiry | Configurable Range |
|-----------|---------------|-------------------|
| Email/password login | 8 hours | 1–24 hours |
| PIN login | 12 hours | 1–24 hours |
| Terminal (persistent device) | No expiry (heartbeat-based) | N/A |
| Kiosk | 60 seconds of inactivity → return to attract screen | 30–120 seconds |

- **Heartbeat:** Terminals send heartbeat every 30 seconds. If no heartbeat for 5 minutes, session marked offline. Device must re-authenticate.
- **Simultaneous session prevention:** One employee cannot be logged into two devices simultaneously. Second login forces logout of first device.
- **Quick-switch (PIN swap):** In high-volume environments, employees can quickly switch without full logout. New employee enters their PIN → previous session pauses, new session begins. Previous employee can re-enter PIN to resume.

### 9.4 Manager Override

- **One-time tokens:** Generated when Manager enters PIN for an approval action.
- **Token expiry:** 5 minutes OR single use, whichever first.
- **Token scope:** Specific to the action approved (e.g., "void item X on check Y"). Cannot be reused for a different action.
- **Audit trail:** Every override logged: manager_id, action_type, target (check/item/employee), timestamp, terminal_id.

### 9.5 Audit Logging

**Every state-changing action logged to `audit_log` table:**

| Field | Description |
|-------|-------------|
| `id` | UUIDv7 |
| `org_id` | Organization |
| `location_id` | Location |
| `user_id` | Who performed the action |
| `action` | Action type (e.g., `order.void`, `item.comp`, `payment.refund`, `staff.clock_in`) |
| `entity_type` | Target entity type (e.g., `order`, `order_item`, `payment`, `user`) |
| `entity_id` | Target entity ID |
| `details` | JSONB — old values, new values, reason code, notes |
| `ip_address` | Request IP |
| `terminal_id` | Which terminal |
| `created_at` | Timestamp (UTC) |

**Retention:** Audit logs retained for minimum 7 years (tax/legal compliance). Not deletable by any user role including Owner. Only platform_admin can archive.

### 9.6 Rate Limiting

| Endpoint Category | Limit |
|-------------------|-------|
| Auth (login, PIN) | 10 requests per minute per IP |
| API (general) | 200 requests per minute per user |
| API (hourly cap) | 5,000 requests per hour per user |
| Webhook callbacks | 100 per minute per endpoint |

**Lockout:** Exceeding auth rate limit → 429 response + 60-second cooldown. Repeated violations (3x in 10 minutes) → IP blocked for 15 minutes.

---

## 10. Online Ordering Rules

### 10.1 Order Throttling

- **Max orders per 15-minute window:** Configurable per location. Default: 20 orders per 15 minutes.
- When limit reached: new online orders see "We're currently very busy. Estimated wait: {X} minutes." No new orders accepted until window clears.
- **Kitchen capacity integration:** If kitchen load > 80%, online ordering automatically extends quoted prep times by 50%.

### 10.2 Acceptance Workflow

**Two modes (configurable per location):**

| Mode | Behavior |
|------|----------|
| **Auto-accept** | Orders accepted immediately. Kitchen gets ticket instantly. Default for QSR/fast-casual. |
| **Manual accept** | Order enters "Pending" state. Manager/designated staff has X minutes to accept or reject. Default: 5 minutes. |

- **Auto-reject:** If manual-accept mode and no staff accepts within the configured window (default: 10 minutes), order is auto-rejected. Customer receives refund and notification: "We're sorry, the restaurant was unable to accept your order."
- **Rejection reasons:** `too_busy`, `closing_soon`, `items_unavailable`, `delivery_area`, `other`.

### 10.3 Scheduled Orders

- **Future pickup/delivery:** Customer selects a date and time for pickup or delivery.
- **Minimum lead time:** Configurable. Default: 30 minutes for pickup, 45 minutes for delivery.
- **Maximum advance booking:** Configurable. Default: 7 days.
- **Scheduled order routing:** Order appears on kitchen KDS at a calculated time: scheduled_time − estimated_prep_time. Prep time is the longest individual item prep time on the order.
- **Cancellation policy:** Customer can cancel scheduled orders up to 1 hour before scheduled time (configurable). After that, no cancellation (or manager override).

### 10.4 Menu Availability Sync

- When any item is 86'd in the POS, the online ordering menu updates within 3 seconds.
- Daypart pricing applies to online orders based on scheduled delivery/pickup time.
- Items outside their availability window are hidden from online menu.
- **Special online-only items:** Configurable. Some items may only be available online (e.g., meal kits, family packs).

### 10.5 Delivery Zone Validation

- **GeoJSON polygon:** Each location defines its delivery area as a GeoJSON polygon.
- **Validation:** Customer enters address → system geocodes → checks if point falls within delivery polygon.
- **Delivery fee calculation:** Configurable. Options:
  - Flat fee (e.g., $5.00)
  - Distance-based tiers (e.g., 0–3 miles: $3.00, 3–5 miles: $5.00, 5–7 miles: $8.00)
  - Free delivery above minimum order (e.g., free delivery on orders > $50.00)
- **Minimum order enforcement:** Configurable per delivery zone. Default: $15.00. Orders below minimum show: "Minimum order for delivery is ${X}. Add ${Y} more to your cart."

---

## 11. Reservation & Waitlist Rules

### 11.1 Table Assignment Algorithm

1. Filter available tables by party size: prefer exact match, then smallest table that fits (table capacity >= party size).
2. If no exact match: combine adjacent tables if merge is enabled.
3. Factor in server section rotation: prefer section with lowest current load.
4. Factor in table turn time: prefer tables that have been available longest.
5. VIP preference: VIP guests get first choice of preferred seating (booth, window, patio).

### 11.2 Confirmation SMS

- Send reservation confirmation SMS (via Twilio) immediately upon booking.
- Send reminder SMS 24 hours before reservation time.
- SMS includes: restaurant name, date, time, party size, confirmation number, cancellation link.
- **Confirmation request:** SMS asks guest to confirm or cancel. If no confirmation received, reservation remains active (do not auto-cancel).

### 11.3 No-Show Handling

- **Grace period:** 15 minutes past reservation time (configurable: 5–30 minutes).
- After grace period: host can mark as "No-Show."
- No-show logged in customer profile.
- **Repeat no-show policy:** After 3 no-shows in 6 months (configurable), customer flagged. Host sees warning on future reservations: "Guest has {N} no-shows. Consider requiring credit card hold."
- **Credit card hold option:** For flagged guests, require credit card on reservation. No-show fee configurable (e.g., $25 per person).

### 11.4 Waitlist Position Calculation

- Position based on: check-in time (FIFO) + party size matching + VIP status boost.
- VIP guests may be moved up in the queue (configurable — some restaurants disable VIP queue jumping).
- **Quoted wait time:** Calculated from current table turn times (average of last 10 turns for matching table size) × number of parties ahead in queue.

### 11.5 Estimated Wait Time

- **Formula:** `(parties_ahead × average_turn_time_for_table_size) + current_longest_wait_in_queue`
- **Average turn time** = mean of last 10 completed turns for tables matching the party's size requirement.
- **Dynamic update:** Wait time recalculates every time a table clears or a party is seated.
- Displayed to host and communicated to waiting guest via SMS: "Your estimated wait is approximately {X} minutes."
- When table is ready: SMS notification: "Your table is ready! Please check in with the host."

---

## 12. Inventory Rules

### 12.1 Par Level Alerts

- **Par level:** Minimum quantity to keep on hand for each ingredient/item.
- **Reorder point:** When stock ≤ reorder point, system triggers alert: "Low stock: {ingredient} — {current_qty} remaining. Par level: {par}. Suggested order: {par - current_qty + buffer}."
- **Alert recipients:** Kitchen manager, GM, purchasing manager.
- **Par adjustment:** System suggests par level adjustments based on trailing 4-week sales velocity. Location selling 200 burgers/week in summer and 120/week in winter should have different pars.
- **Auto-generate purchase order (optional):** When stock hits reorder point, system auto-drafts a PO with suggested quantities.

### 12.2 Recipe-Based Depletion

- Each menu item linked to a recipe (list of ingredients + quantities).
- When an order item is sent to kitchen (status → `open`), system deducts ingredient quantities from inventory.
- **Voided items:** Ingredient quantities restored to inventory (assume food was not prepared).
- **Comped items:** Ingredient quantities NOT restored (food was prepared but not charged).
- **Depletion calculation:** `menu_item_quantity × recipe_ingredient_quantity × order_item_quantity`.

### 12.3 Waste Tracking

**Every waste event requires:**
- Item/ingredient wasted.
- Quantity.
- Reason code: `spoilage`, `prep_error`, `overcooked`, `customer_return`, `contamination`, `dropped`, `expired`.
- Employee who logged it.
- Timestamp.

**Waste analysis:**
- Waste by item, by location, by shift, by reason.
- Persistent overcooked waste on a specific item at a specific location = training problem.
- Waste cost calculated using current purchase price of wasted ingredients.
- Target: total waste < 2% of food purchases.

### 12.4 Actual vs. Theoretical Food Cost

- **Theoretical** = Σ (recipe cost per item × items sold) for the period.
- **Actual** = (beginning inventory value + purchases during period) − ending inventory value.
- **Variance** = Actual − Theoretical.
- Acceptable variance: 1–2%.
- Variance > 3%: investigation required. Common causes: theft, over-portioning, unrecorded waste, receiving errors, recipe cost not updated.
- Reported weekly (requires beginning and ending inventory counts).

### 12.5 Purchase Order Workflow

```
draft → submitted → approved → received → reconciled
                       │
                       └→ rejected (returns to draft with comments)
```

**Approval thresholds (configurable):**

| PO Amount | Required Approval |
|-----------|------------------|
| $0 – $2,500 | None (auto-approved) |
| $2,500 – $10,000 | Area Manager |
| $10,000+ | Regional Director |

- **Draft:** Location creates PO with vendor, items, quantities, expected prices.
- **Submitted:** PO sent for approval (if required by threshold).
- **Approved:** PO authorized. Sent to vendor (via email, EDI, or vendor portal).
- **Received:** Goods arrive. Staff enters actual quantities received. System compares to PO: flags discrepancies (short shipments, substitutions, price differences).
- **Reconciled:** Invoice matched to PO and receiving record. Three-way match: PO amount ≅ receiving amount ≅ invoice amount. Variance > 5% flagged for review.

---

## 13. Offline Mode Rules

### 13.1 Offline Detection

- System detects loss of internet connectivity within 5 seconds.
- Prominent RED banner on all devices: "OFFLINE MODE — Data syncing paused."
- Audible alert on manager device.
- Banner persists until connectivity restored.

### 13.2 What Continues Working Offline

| Function | Behavior |
|----------|----------|
| **Order entry** | Orders entered and cached locally on iPad (IndexedDB). |
| **Kitchen display** | Orders transmit via LOCAL NETWORK (WiFi between devices). If router is on (just internet down), intra-network communication continues. |
| **Cash payments** | Process normally. No internet needed. |
| **Card payments** | **Show "cash only" indicator.** Valor terminals require internet connectivity for authorization. Cannot process card payments offline. |
| **Receipt printing** | Local printers work without internet. |
| **Table management** | Floor map and table status sync via local network. |
| **Clock in/out** | Recorded locally, synced on reconnection. |
| **Menu and pricing** | Cached locally on device. |

### 13.3 What Stops Working Offline

- Online ordering / delivery platform integration — orders stop coming in.
- Cloud reporting — no real-time dashboard for remote owners.
- Gift card balance validation (fallback: use cached balances).
- Loyalty program lookups.
- SMS/email receipts — queued for later delivery.
- Card payment processing (Valor terminals need connectivity).

### 13.4 Sync on Reconnection

1. System detects connectivity restoration.
2. **Sync queue processes:** All cached orders, payments, and status changes sync to Supabase in chronological order.
3. **Card payments:** Any queued card transactions are NOT processed (since Valor terminals couldn't authorize offline). Cash-only orders sync normally.
4. **Conflict resolution:** Server timestamp wins. If cloud state and local state conflict, system flags conflicts for manual review rather than auto-overwriting.
5. Banner changes to "SYNCING..." then disappears when complete.
6. **Offline order numbers:** Temporary `OFF-` prefix orders get real sequential numbers assigned on sync.

### 13.5 Minimum Offline Duration

- System must function offline for a minimum of 4 hours (iPad battery life and operational minimum).
- All active service data (orders, checks, tables, menu, settings) cached locally.
- Local database is NOT a "degraded cache" — it is a complete working copy of all data needed for service.

---

## 14. Drive-Thru Rules

### 14.1 Lane Management

- **Dual-lane support:** Two order-taking stations feeding one kitchen.
- Order taken in lane → fires to kitchen IMMEDIATELY (no coursing in drive-thru).
- Order tied to lane position: Lane 1/Lane 2, position at window.
- **"Pull forward" orders:** If item isn't ready when car reaches window, car pulls to waiting area. Order flagged for runner delivery.

### 14.2 Speed-of-Service Tracking

**Three timing points:**

| Point | Trigger |
|-------|---------|
| Order taken | Cashier finalizes order entry |
| Ready | Kitchen marks order complete |
| Delivered to window | Window attendant marks handed off |

- **Target total time:** < 180 seconds (3 minutes) from order taken to delivered.
- **Live timer:** Visible to kitchen and window staff.
- **Alerts:** Order exceeding 180 seconds turns yellow. Exceeding 300 seconds turns red.

### 14.3 Confirmation Display

- Customer-facing screen at order point shows order items + total as they're entered.
- Allows customer to verify order before payment.
- Shows both cash and card prices (Dual Pricing).
- After payment: shows order number and "Please pull forward."

### 14.4 Digital Menu Board Schedule

- **Automatic menu swap by daypart:** Breakfast menu board from 6 AM – 10:30 AM, lunch/dinner menu board from 10:30 AM – close.
- **Schedule configurable per location.**
- **Promotional content:** Rotating featured items, combos, seasonal specials.
- **Integration with 86 system:** If item is 86'd, it is hidden or crossed out on the digital menu board within 3 seconds.
- **Weather-based suggestions (optional):** Hot weather → promote cold drinks. Cold weather → promote soups/hot drinks.

---

## Appendix: Configuration Defaults Summary

| Setting | Default Value | Configurable | Location |
|---------|--------------|-------------|----------|
| Order number reset | Midnight (location timezone) | No | — |
| Auto-gratuity party size | 6 guests | Yes | `locations.settings` |
| Auto-gratuity percentage | 20% | Yes | `locations.settings` |
| Suggested tip percentages | 18%, 20%, 22% | Yes | `locations.settings` |
| Bar tab default hold | $50.00 | Yes | `locations.settings` |
| Bar tab auto-close hours | 4 hours | Yes | `locations.settings` |
| Pre-auth expiry warning | 6 days (1 day before 7-day expiry) | No | — |
| Walkout auto-gratuity | 20% | Yes | `locations.settings` |
| PIN length | 4 digits | Yes | `organizations.settings` |
| PIN lockout threshold | 5 failed attempts | Yes | `organizations.settings` |
| PIN lockout duration | 5 minutes | Yes | `organizations.settings` |
| Session expiry (email) | 8 hours | Yes | `organizations.settings` |
| Session expiry (PIN) | 12 hours | Yes | `organizations.settings` |
| Kiosk timeout | 60 seconds | Yes | `terminals.settings` |
| KDS fresh threshold | 0–8 minutes | Yes | `locations.settings` |
| KDS warning threshold | 8–12 minutes | Yes | `locations.settings` |
| KDS late threshold | 12–18 minutes | Yes | `locations.settings` |
| KDS critical threshold | 18–25 minutes | Yes | `locations.settings` |
| Bump recall window | 5 minutes | Yes | `locations.settings` |
| Stale table alert (seated, no order) | 10 minutes | Yes | `locations.settings` |
| Cash over/short alert threshold | $5.00 | Yes | `locations.settings` |
| No-sale alert threshold | 3 per shift | Yes | `locations.settings` |
| Loyalty earn rate | 1 point per $1 | Yes | `organizations.settings` |
| Loyalty redemption rate | 100 points = $5.00 | Yes | `organizations.settings` |
| Points expiry (inactivity) | 12 months | Yes | `organizations.settings` |
| Online order throttle | 20 per 15 minutes | Yes | `locations.settings` |
| Manual accept timeout | 10 minutes | Yes | `locations.settings` |
| Scheduled order min lead time | 30 min pickup / 45 min delivery | Yes | `locations.settings` |
| Delivery minimum order | $15.00 | Yes | `locations.settings` |
| Reservation no-show grace | 15 minutes | Yes | `locations.settings` |
| Offline detection | 5 seconds | No | — |
| Auth rate limit | 10/minute per IP | Yes | `config.py` |
| API rate limit | 200/minute, 5000/hour | Yes | `config.py` |
| Audit log retention | 7 years | No | — |
| Drive-thru target time | 180 seconds | Yes | `locations.settings` |
| Early clock-in restriction | 5 minutes before scheduled shift | Yes | `locations.settings` |
| Tip adjustment window | 24 hours | Yes | `locations.settings` |
| Manager override token expiry | 5 minutes | No | — |

---

*This document is the authoritative source of truth for all business logic in Sear POS. When implementing features, reference this document. When this document is silent on a rule, document the decision here before implementing.*
