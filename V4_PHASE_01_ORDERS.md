# V4 Phase 1: Order Entry — Production Depth

Paste this ENTIRE file + MASTER_TEMPLATE.md into a fresh Claude Code session.
Then say: "Follow the MASTER_TEMPLATE. Start at Phase 1."

---

## 1.1 What is this?

A production-depth rebuild of the Sear POS order entry system. The current order flow has basic CRUD — you can add items to an order and send them. But it lacks the features that make a POS usable in a real restaurant: modifier sheets that auto-pop for forced modifiers, combo/meal deal builders, open price items, seat color coding, course fire timing, split check drag-and-drop, multi-tender payment, auto-gratuity, re-fire with reason codes, walkout handling, and dynamic tax calculation from location settings.

This phase takes order entry from "demo prototype" to "a server can work a Friday night dinner rush." Every button performs a real action through the full stack. Every edge case (network failure, concurrent users, forced modifier validation) is handled.

**This is NOT a greenfield build.** The existing codebase at /Users/ianrakow/Desktop/getsear already has:
- `src/app/(pos)/orders/page.tsx` — main POS page (needs significant enhancement)
- `src/components/pos/OrderPanel.tsx` — order panel (needs rebuild)
- `src/components/pos/MenuGrid.tsx` — menu grid (needs modifier + combo support)
- `src/components/pos/ModifierSheet.tsx` — basic modifier sheet (needs full rebuild as iOS page sheet)
- `src/components/pos/CourseSelector.tsx` — course picker (needs fire/hold integration)
- `src/components/pos/SeatSelector.tsx` — seat picker (needs color coding)
- `src/stores/order-store.ts` — Zustand order state (needs combo, split, multi-tender)
- `src/app/api/orders/` — 15 API routes (need enhancement for combos, re-fire, walkout)

**Read these files BEFORE planning:**
- CLAUDE.md — project config, tech stack, coding rules
- SEAR_POS_ARCHITECTURE.md — Sections 1.1 (Fine Dining workflow), 1.2 (Casual Dining), "Modifier Complexity: Real-World Examples", "Forced vs Optional Modifiers", "Combo / Meal Deal Logic", "Happy Hour / Daypart Pricing", "86 Cascade Logic", "Pricing Models", Scenario 5 (Split Check 8 Ways), Scenario 6 (Multi-Tender), Scenario 8 (Manager Voids), Scenario 9 (Auto-Gratuity Dispute), Scenario 13 (Walkout)
- UI_DESIGN.md — design system tokens
- BUSINESS_RULES.md — operational logic and state machines

---

## 1.2 Tech stack

Already built. Do not change:
- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- **Components:** shadcn/ui (heavily customized — not default look)
- **State:** Zustand v5 + Immer
- **Database:** Supabase (PostgreSQL) — existing tables for orders, order_items, checks, modifiers, combos
- **Auth:** Supabase Auth + cookie-based SSR
- **Real-time:** Supabase Realtime for order status sync across devices
- **Drag & Drop:** @dnd-kit for split check item dragging
- **Icons:** Lucide React (every icon MUST have a text label)

---

## 1.3 User roles

- **Server** (primary user): Creates orders, adds items with modifiers, assigns seats, fires courses, sends to kitchen, splits checks, processes multi-tender payments. Cannot void/comp without manager PIN.
- **Bartender**: Same as server but focused on bar tabs. Opens tabs with pre-auth, adds items, closes tabs with tip. Needs full food AND drink menu visible simultaneously.
- **Manager**: Everything server can do PLUS: void/comp items (with reason codes), remove auto-gratuity, override prices, apply discounts, handle walkouts, approve open-price items over range.
- **Owner**: Everything manager can do. Full access.
- **Kitchen** (read-only for this phase): Sees orders come in on KDS. Does not interact with order entry.

---

## 1.4 Pages and features

### Page: Orders (Main POS Screen) — `/orders`
- **Who:** Server, Bartender, Manager, Owner
- **Layout:** 2-panel split — Order Panel (30% left, ~390px on 1366px iPad landscape), Menu Grid (70% right, ~976px)
- **What's on it:**

#### Order Panel (Left Side)
- **Header:** Order type badge (Dine-In / Bar Tab / Takeout / Delivery), table number, guest count, server name, order timer (time since created)
- **Seat tabs:** Horizontal row of seat tabs (Seat 1, Seat 2, ..., All). Each seat gets a distinct color from a palette of 12 (blue, green, orange, purple, pink, teal, amber, rose, cyan, lime, indigo, fuchsia). Active seat highlighted. Tapping a seat filters the item list to that seat only. "All" shows all items grouped by seat with colored left-border.
- **Item list:** Scrollable list of order items. Each item shows:
  - Seat color indicator (4px left border)
  - Item name (16px semibold)
  - Modifiers listed below in 13px muted text (indented)
  - Course badge (C1, C2, C3...) with fire status (FIRE=green, HOLD=gray, SENT=blue)
  - Quantity (left side)
  - Price (right side, aligned)
  - Combo items grouped with combo name header and combo price on header, individual items indented below with no individual prices shown
  - "86'd" items show with strikethrough and red text
- **Item tap action:** Opens Item Edit Popover (see below)
- **Totals section (fixed at bottom):**
  - Subtotal
  - Tax (calculated from location settings — NOT hardcoded 8.5%)
  - Auto-gratuity line (if applicable, with percentage shown)
  - Discount line (if applicable, with name shown)
  - **Total** (bold, 20px)
  - For-Here / To-Go toggle (affects tax calculation — some jurisdictions tax differently)
- **Action buttons (fixed at bottom):**
  - "Send" button (primary, ember orange, 48px tall) — sends unfired courses to kitchen
  - "Pay" button (secondary, 48px tall) — opens payment flow
  - "Hold" button (small, amber) — marks order as held
  - "..." more menu: Transfer, Move Table, Split Check, Print Check, Void Order, Walkout

#### Item Edit Popover
- **Trigger:** Tap any item in the order list
- **Display:** Bottom sheet (iOS-style) sliding up from bottom with drag indicator
- **Contents:**
  - Item name and current price at top
  - Quantity stepper (- / qty / +)
  - "Edit Modifiers" button — reopens modifier sheet for this item
  - "Special Instructions" text field (max 100 chars, with char counter)
  - "Change Seat" — seat selector dropdown
  - "Change Course" — course selector
  - "Void Item" — requires manager PIN if item already sent to kitchen. Shows VoidReasonDialog.
  - "Comp Item" — requires manager PIN. Shows CompDialog with reason codes.
  - "Re-fire" — sends item back to kitchen with RE-FIRE flag. Shows reason picker: Wrong Temp, Wrong Item, Dropped, Quality Issue, Guest Changed Mind, Other.
  - Price override (manager only) — tap price to edit, requires manager PIN
- **Empty state:** N/A (only appears when item exists)

#### Menu Grid (Right Side)
- **Category bar:** Horizontally scrollable row of colored category pills (48px tall). Each category has its own background color (defined in menu management). Active category has full opacity, inactive is 60% opacity. Categories: Appetizers, Soups & Salads, Entrees, Sides, Desserts, Cocktails, Wine, Beer, Spirits, NA Beverages, Kids, Specials
- **Search bar:** Sticky below categories. Fuzzy search across item name, PLU, short name. Results appear instantly as you type, replacing the grid.
- **Favorites bar:** Optional row below search showing server's pinned quick-add items (configurable per user, max 10 items). Small chips with item name only. One-tap add.
- **Item grid:** Responsive grid of square tiles (120-140px). Each tile shows:
  - Category color bar at top (6px)
  - Item name (14px semibold, max 2 lines, ellipsis)
  - Price (13px, below name)
  - Dietary icons (tiny icons: V, VG, GF, DF) in bottom-left
  - "86" red badge overlay when unavailable (desaturated tile, not tappable)
  - "LOW" amber badge when running low (still tappable, shows count remaining)
  - "MP" badge for market price items
  - Combo items have a "COMBO" badge in top-right
- **Tap action:**
  - Simple item (no forced modifiers): Adds to order immediately at active seat/course
  - Item with forced modifiers: Opens Modifier Sheet automatically
  - Market price item: Opens price entry numpad first, then modifier sheet if applicable
  - Open price item: Opens price entry numpad (requires manager approval if outside configured range)
  - Combo item: Opens Combo Builder
- **Empty state for category with no items:** "No items in this category" centered text

#### Modifier Sheet (Full Rebuild as iOS Page Sheet)
- **Display:** Full-height page sheet from right (70% width on iPad), with drag indicator at top. Backdrop dims left panel.
- **Header:** Item name, base price, "Cancel" and "Done" buttons
- **Layout:** Vertical scroll of modifier groups, one section per group
- **Each modifier group section:**
  - Group name as section header (e.g., "Temperature", "Size", "Add-Ons")
  - "(Required)" badge in red if forced modifier
  - Radio buttons for single-select groups (e.g., Temperature: Rare / MR / Med / MW / Well)
  - Checkboxes for multi-select groups (e.g., Toppings: Lettuce, Tomato, Onion...)
  - Default selections pre-checked
  - Price shown inline for upcharge modifiers (+$2.50)
  - Quantity stepper for quantity-based modifiers (e.g., Extra Shot +$1.20, can add multiple)
  - "Included" / "Replacement" / "Upcharge" pricing type shown per modifier
  - Quantity limit enforcement (e.g., "Select up to 2 cheeses included, additional $1.00 each")
- **Validation:** Cannot tap "Done" if any forced modifier group is incomplete. Unfilled forced groups show red border with "Required" message. If server tries to close without completing, scroll to first incomplete group and flash it.
- **Running total:** Footer shows live-updating price as modifiers are added/removed
- **Nested modifiers:** If a modifier has sub-modifiers (e.g., selecting "Oat Milk" reveals "Extra Hot / Normal" sub-option), expand inline below the parent modifier.

#### Combo Builder
- **Trigger:** Tapping a combo item in the menu grid
- **Display:** Full-height page sheet from right (same as modifier sheet)
- **Layout:** Step-by-step wizard. Header shows combo name and fixed combo price.
- **Each step:** "Step 1: Choose Entree", "Step 2: Choose Side", "Step 3: Choose Drink"
  - Grid of options for that step
  - Items with upcharge show "+$1.50" badge
  - Each step's selected item can have its own modifiers (e.g., burger in combo still needs temp). If it has forced modifiers, modifier sub-sheet opens after selection.
- **Progress indicator:** Step dots at top (1 of 3, 2 of 3, etc.)
- **Footer:** Running total (combo base + any upcharges), "Back" and "Next"/"Add to Order" buttons
- **"Make it a combo" suggestion:** When server adds items individually that match an existing combo (e.g., adds burger + fries + drink separately and a "Lunch Special" combo exists), a toast notification appears: "Save $X — Make it a Lunch Special combo?" with "Yes" and "Dismiss" buttons.

#### Course Fire Controls
- **Inline in Order Panel:** Each course group header shows:
  - Course name/number (e.g., "Course 1 — Appetizers")
  - Fire status badge: FIRE (green), HOLD (gray), SENT (blue, with timestamp)
  - "Fire" button (only visible for HOLD courses) — tapping fires that course to kitchen
  - "Hold" button (only visible for FIRE courses) — puts course on hold
  - "Rush" button — marks course as RUSH (requires reason code: Guest Complaint, Long Wait, VIP, Manager Request). Sends RUSH flag to KDS.
- **"Fire All" button:** In the "..." more menu. Fires all held courses simultaneously. Confirmation dialog: "Fire all remaining courses for this order?"
- **"Fire When Ready" option:** In the "..." more menu. Switches course control from server-initiated to kitchen-initiated. KDS shows "FIRE WHEN READY" tag.
- **Course assignment during item add:** When adding an item, it auto-assigns to the current active course. Server can change course via a small course chip below the item in the order list (tappable, shows dropdown).

#### Split Check (Drag-and-Drop)
- **Trigger:** "Split Check" from order panel "..." menu
- **Display:** Full-screen overlay replacing the normal 2-panel layout
- **Layout:**
  - Top bar: "Split Check — Table 7" with "Cancel" and "Confirm Split" buttons, "Unassigned items: X" counter
  - Left column (40%): Unassigned items list (all items from original order). Items show seat color, name, modifiers, price.
  - Right area (60%): Horizontally scrollable row of check columns (Check A, Check B, Check C...). Each check column shows assigned items and running total.
- **Adding checks:** "+" button to add another check column. Can also "Split by Seat" (one-tap: creates one check per seat with that seat's items auto-assigned) or "Split Equal" (enter N, divides total equally with penny rounding on last check).
- **Drag-and-drop:** Using @dnd-kit. Drag items from unassigned column into check columns. Drag items between check columns.
- **Shared items:** When dragging a shared item (e.g., appetizer), a dialog asks: "Assign to one check" / "Split equally across selected checks" / "Split custom amounts"
- **"Move Seat" shortcut:** Tap a seat color in unassigned → "Move all Seat 3 items to Check C" with one action
- **Validation:** "Confirm Split" disabled until unassigned count = 0. Each check must have at least one item (or be removed).
- **Tax recalculation:** Each check independently calculates tax based on its items.
- **After split:** Each check can be paid independently with different payment methods. Paid checks show as locked (green checkmark). Unpaid checks remain editable.
- **Edge case:** If a check is already paid and server tries to move items from it, block with: "Check A is already paid. Cannot move items from a paid check."

#### Multi-Tender Payment
- **Trigger:** "Pay" button on order panel (or on individual check after split)
- **Display:** Payment flow page (replaces menu grid area, order panel stays visible)
- **Check total display:** Large, prominent total at top. Shows subtotal, tax, auto-gratuity (if any), discount (if any), total.
- **"Add Payment" button:** Opens payment method selector
- **Payment methods:**
  - Cash — opens numpad for amount tendered. Shows change due. Quick buttons: Exact, $20, $50, $100. "Open Drawer" fires on cash acceptance.
  - Credit Card — sends to Valor terminal (or mock in dev). Shows "Present Card on Terminal" with animated spinner.
  - Gift Card — enter card number or scan. Shows balance. Apply full balance or enter custom amount. If balance < check total, shows remaining balance needed.
  - House Account — search customer, select account. Requires PIN. Shows credit limit and current balance.
  - Comp — requires manager PIN + reason code (Owner Comp, Food Quality, Service Recovery, Promo, Other)
- **Multi-tender tracking:** As payments are applied, each shows in a "Payments Applied" list with method icon, amount, and status. Remaining balance decrements. Check does NOT close until total payments >= check total.
- **Overpayment on cash:** Calculates and displays change due.
- **Partial card payment:** Server can enter a specific card amount (e.g., $20 on this card) rather than charging the full remaining balance.
- **Tip handling:** For credit card payments, after card approval, tip entry screen appears (if using tip-on-receipt model). Quick tip buttons: 18%, 20%, 22%, Custom, No Tip. Tip calculated on pre-tax subtotal (configurable to post-tax).

#### Auto-Gratuity
- **Rules engine:** Configurable per location:
  - Party size threshold (default: 6)
  - Percentage (default: 20%)
  - Private dining: always apply
  - Specific events: always apply
- **Auto-application:** When guest count meets/exceeds threshold, auto-gratuity line appears on check automatically. Displays as "Service Charge (20%)" or "Gratuity (20%)" (configurable wording).
- **Removal:** Manager only. Tap the auto-gratuity line → "Remove Auto-Gratuity" → Manager PIN → Reason code (Guest Objection, Manager Discretion, Policy Exception).
- **Logging:** Every auto-gratuity application and removal logged with who, when, why, table, party size.

#### For Here / To Go Toggle
- **Location:** In order panel totals section, small toggle switch
- **Effect:** Changes tax calculation. "To Go" may apply different tax rate depending on jurisdiction (some states don't tax takeout food). Tax rate pulled from location settings, NOT hardcoded.
- **Visual:** "For Here" default. Toggle to "To Go" shows updated tax immediately.

#### Re-fire Workflow
- **Trigger:** "Re-fire" button in Item Edit Popover
- **Flow:**
  1. Select reason: Wrong Temp, Wrong Item, Dropped, Quality Issue, Guest Changed Mind, Other (free text)
  2. Confirm: "Re-fire [Item Name] to kitchen?"
  3. Item sent to KDS with RE-FIRE priority flag (appears at top of queue, red highlight)
  4. Original item remains on check (it was already prepared). Re-fired item shows "RE-FIRE" tag in order panel.
  5. If the re-fire replaces a voided/comped item, the void/comp flow handles the price, and the re-fire handles the kitchen ticket.

#### Walkout Handling
- **Trigger:** "Walkout" from order panel "..." menu
- **Flow:**
  1. Manager PIN required
  2. Reason codes: Guest Left Without Paying, Guest Dissatisfied, Error, Other
  3. System marks order status as "walkout"
  4. If bar tab with pre-auth card on file: option to capture at current total + auto-gratuity
  5. If no card on file: log as house loss. Amount tracked in walkout reporting.
  6. All walkouts appear in end-of-day void/comp/walkout report
- **Visual:** Walkout orders show with red "WALKOUT" badge in order history

#### Kitchen Close Function
- **Trigger:** Manager action from quick menu or settings
- **Effect:** Disables all food categories in menu grid. Only beverage categories remain tappable. Food tiles show "KITCHEN CLOSED" overlay.
- **Sync:** Broadcasts to all POS terminals via Supabase Realtime. Also syncs to KDS.
- **Reversible:** Manager can reopen kitchen.

#### Tax Calculation
- **Source:** Location settings table in database. Each location has:
  - Base tax rate (e.g., 8.875%)
  - Alcohol tax rate (may differ)
  - Tax-exempt items (gift cards)
  - To-go tax rate (may differ by jurisdiction)
- **Kill the hardcoded 8.5%:** Remove ALL hardcoded tax rates from frontend and backend. Tax rates come from `location_settings` table ONLY.
- **Per-item tax class:** Each menu item has a tax_class (food, alcohol, non_taxable). System applies the correct rate per item.

---

## 1.5 Look and feel

- **Mode:** Light mode only (professional enterprise SaaS)
- **Vibe:** Premium, fast, confident, professional — like Apple's Square Register crossed with Toast's speed
- **Reference products:** Toast POS order entry, Square for Restaurants, Apple's design language (SF Pro typography feel, consistent 8px grid, generous padding)
- **Color direction:** Warm off-white background (#FAFAF8), Ember orange (#F06B18) for primary actions, dark charcoal text, warm-tinted shadows (not blue-gray). Category colors from a curated palette (not random).
- **Typography:** System font stack (SF Pro on iPad, Inter on web). 14-16px for body, 12-13px for labels and modifiers, 20-24px for section headers, 32px for large totals.
- **Touch targets:** 44px minimum everywhere. 48px for primary action buttons. No tiny icons.
- **Animation:** Spring physics on all sheet/popover transitions (0.3s ease-out minimum). Haptic-feel feedback on button taps (scale animation 0.97 on press). Smooth drag with drop shadows during split check drag.
- **iPad landscape primary:** All layouts optimized for 1366x1024 (iPad Pro 12.9") and 1194x834 (iPad Air/Pro 11"). Must also work at 1024x768 (iPad 10.2").
- **Specific visual elements:**
  - Frosted glass (backdrop-blur-xl) on bottom sheets and popovers
  - Seat colors as consistent left-border indicators throughout
  - Category pills with rounded-full corners and subtle shadow
  - Order items with hover/tap state (slight background change)
  - Combo items grouped with subtle indent and connecting line
  - Skeleton loading on menu grid while items load

---

## 1.6 Business rules and special behavior

### Order Lifecycle State Machine
```
DRAFT → OPEN → SENT → PARTIALLY_PAID → PAID → CLOSED
                  ↓         ↓
               HELD       VOID
                  ↓
               WALKOUT
```
- DRAFT: Order created, items being added, not yet sent to kitchen
- OPEN: Order exists but not all courses sent
- SENT: All courses sent to kitchen
- PARTIALLY_PAID: Some checks paid, some remain
- PAID: All checks paid
- CLOSED: Payment reconciled, order archived
- HELD: Temporarily paused (server can resume)
- VOID: Entire order voided (manager required)
- WALKOUT: Guest left without paying

### Modifier Rules
- Forced modifiers MUST be completed before item can be added to order. If server tries to send order with incomplete forced modifiers, block with error showing which items need completion.
- Default modifiers auto-selected. Server only changes if guest requests different.
- Modifier pricing types: Included ($0), Upcharge (fixed +$X), Replacement ($0 swap), Replacement with Upcharge (+$X swap), Quantity-Based (first N free, additional at cost), Percentage-Based (rare, +50% for extra portion).
- Nested modifiers: selecting a parent modifier can reveal sub-modifiers (e.g., selecting "Oat Milk" shows "Extra Hot" option).

### Combo Rules
- Combo price replaces individual item prices (don't show individual prices within combo on check)
- Each combo step can require its own modifiers (burger in combo still needs temp)
- "Make it a combo" detection: when items match an existing combo and the combo saves money, suggest it
- Combo void: if one item in combo is voided, entire combo reverts to individual pricing for remaining items (configurable: or keep combo pricing minus voided item)
- Multiple combos per order supported

### Split Check Rules
- Cannot split a check that has any paid portions (must void payment first)
- Penny rounding: last check absorbs rounding remainder
- Shared items can be split equally or by custom amounts
- Tax recalculates per check independently
- Each check gets its own payment(s)
- Once a check is paid, it locks. Other unpaid checks remain editable.

### Auto-Gratuity Rules
- Treated as service charge (not tip) per IRS Revenue Ruling 2012-18
- Applied automatically when party size >= threshold
- Removable by manager only with reason code
- Displayed as separate line on check (wording configurable: "Service Charge" or "Gratuity")
- Configured per location (threshold, percentage, always-apply conditions)

### Void/Comp Rules
- Void: removes item from check entirely. Used for wrong item, never received.
- Comp: item stays on check at $0. Used for service recovery, quality issues.
- Both require manager PIN if item was already sent to kitchen
- Reason code required (cannot proceed without one): Food Quality, Wrong Item Sent, Never Received, Guest Changed Mind, Allergy Concern, Service Recovery, Manager Comp, Other
- Audit trail: transaction ID, table, seat, item, original price, type, reason, manager PIN, timestamp
- Threshold alerts: if total void/comp exceeds configured $ amount in a shift, notify GM

### Walkout Rules
- Manager PIN required
- If bar tab with card on file: can capture at running total + configurable auto-gratuity %
- If no card: logged as house loss
- All walkouts tracked in daily reporting
- Walkout amount attributed to server for audit purposes (not punitive — for pattern detection)

### Tax Rules
- Tax rates from location_settings table, NEVER hardcoded
- Per-item tax class: food, alcohol, non_taxable
- For-here vs to-go may use different rates
- Auto-gratuity is NOT taxed (it's a service charge)
- Discounts reduce taxable amount (tax on discounted price, not original)
- Comp items: tax on $0 = $0

### Price Override Rules
- Manager PIN required for any manual price change
- Market price items: acceptable range configured per item (e.g., $38-$65 for lobster). If server enters price outside range, manager approval required.
- Open price items: always require price entry. Manager approval if no range set.

### Allergen Alerts
- If a guest at Seat 3 has a shellfish allergy logged (from customer profile or manual flag), and server adds lobster bisque to Seat 3, system shows WARNING dialog: "Seat 3 — Shellfish Allergy. Continue?" Force-acknowledge (cannot be accidentally dismissed — must type "CONFIRM" or hold button for 3 seconds).

---

## 1.7 Integrations

- **Supabase Realtime:** Order changes broadcast to all POS terminals and KDS in real-time (< 3 second latency). Channels: `orders:{location_id}`, `kitchen:{location_id}`, `tables:{location_id}`
- **Supabase Database:** All order CRUD, modifier lookups, combo definitions, tax rates, location settings
- **KDS (Phase 3):** Orders sent via Realtime channel. Course fire/hold/rush commands sent via same channel. This phase wires the POS side; Phase 3 wires the KDS side.
- **Payment Processing (Phase 2):** Multi-tender payment UI built in this phase with mock card processing. Phase 2 replaces mock with real Valor integration.
- **@dnd-kit:** Split check drag-and-drop

---

## 1.8 What's NOT in scope for this phase

- Real Valor card processing (Phase 2 — use mock in this phase)
- Batch settlement and reconciliation (Phase 2)
- KDS display and ticket management (Phase 3)
- Kitchen printer integration (Phase 5)
- Cash drawer hardware integration (Phase 5)
- Receipt printing (Phase 5)
- Menu management UI / menu builder (Phase 4)
- Daypart pricing engine (Phase 4 — use current prices in this phase)
- Seasonal menu rotation (Phase 4)
- Ingredient-level 86 cascade (Phase 4 — manual 86 toggle works in this phase)
- Online ordering (Phase 11)
- Offline mode / store-and-forward (Phase 9)
- Order templates for regulars (deferred — not critical for v4 launch)
- Wine bottle tracking / pour tracking (deferred — fine dining specific)
- Barcode scanner support (Phase 5)

---

## 1.9 Files, acceptance criteria, and workflow tests

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/pos/ComboBuilder.tsx` | Step-by-step combo/meal deal builder page sheet |
| `src/components/pos/ItemEditPopover.tsx` | Bottom sheet for editing items (qty, modifiers, void, comp, re-fire) |
| `src/components/pos/SplitCheckView.tsx` | Full-screen split check with drag-and-drop |
| `src/components/pos/MultiTenderPayment.tsx` | Multi-payment method flow UI |
| `src/components/pos/PriceEntryNumpad.tsx` | Numpad for market price / open price entry |
| `src/components/pos/FavoritesBar.tsx` | Quick-add favorites strip below search |
| `src/components/pos/AutoGratuityBanner.tsx` | Auto-gratuity line in order totals with remove action |
| `src/components/pos/ForHereToGoToggle.tsx` | Toggle affecting tax calculation |
| `src/components/pos/RefireDialog.tsx` | Re-fire reason code picker |
| `src/components/pos/WalkoutDialog.tsx` | Walkout flow with manager PIN and reason |
| `src/components/pos/KitchenCloseOverlay.tsx` | Overlay on food items when kitchen is closed |
| `src/components/pos/ComboSuggestionToast.tsx` | "Make it a combo" notification toast |
| `src/app/api/orders/[id]/refire/route.ts` | Re-fire item to kitchen with reason code |
| `src/app/api/orders/[id]/walkout/route.ts` | Mark order as walkout |
| `src/app/api/orders/[id]/auto-gratuity/route.ts` | Apply/remove auto-gratuity |
| `src/app/api/settings/tax-rates/route.ts` | Get tax rates for location |
| `src/app/api/menu/combos/route.ts` | CRUD for combo definitions |
| `src/app/api/menu/combos/[id]/route.ts` | Get/update specific combo |
| `src/app/api/orders/[id]/kitchen-close/route.ts` | Toggle kitchen close status |
| `src/lib/tax/calculator.ts` | Tax calculation engine (replaces hardcoded 8.5%) |
| `src/lib/orders/combo-detection.ts` | Logic to detect if individual items match a combo |
| `src/lib/orders/split-check.ts` | Split check calculation logic (equal, by seat, custom, penny rounding) |

### Files to Modify

| File | Changes |
|------|---------|
| `src/app/(pos)/orders/page.tsx` | Add combo support, item edit popover, split check, multi-tender, auto-gratuity, for-here/to-go, kitchen close |
| `src/components/pos/OrderPanel.tsx` | Seat color coding, course fire buttons, item tap → edit popover, totals with dynamic tax + auto-grat + discount, action buttons restructured |
| `src/components/pos/MenuGrid.tsx` | Combo item badges, 86/LOW/MP badges, favorites bar, market price tap handler, combo builder trigger, kitchen close overlay, search with fuzzy match |
| `src/components/pos/ModifierSheet.tsx` | Full rebuild as iOS page sheet — grouped radio/checkbox, forced modifier validation, running total, nested modifiers, quantity-based modifiers, default selections |
| `src/components/pos/CourseSelector.tsx` | Fire/Hold/Rush buttons per course, Fire All, Fire When Ready |
| `src/components/pos/SeatSelector.tsx` | Color coding with 12-color palette, color persists across all views |
| `src/components/pos/QuickActions.tsx` | Move actions into order panel "..." menu, remove standalone strip |
| `src/components/pos/VoidReasonDialog.tsx` | Ensure all reason codes present, optional free-text, re-fire option after void |
| `src/components/pos/CompDialog.tsx` | Ensure reason codes, manager PIN, comp amount tracking |
| `src/components/pos/ManagerPinDialog.tsx` | Ensure PIN verification calls real API, error handling for wrong PIN |
| `src/components/pos/AllergenWarningDialog.tsx` | Force-acknowledge (type CONFIRM or hold 3s), cannot accidentally dismiss |
| `src/stores/order-store.ts` | Add combo state, split check state, multi-tender state, auto-gratuity, for-here/to-go, course fire status, re-fire tracking, walkout status |
| `src/stores/menu-store.ts` | Add combo definitions, favorites, kitchen close state |
| `src/app/api/orders/route.ts` | Support combo items in order creation |
| `src/app/api/orders/[id]/items/route.ts` | Support combo items, validate forced modifiers server-side |
| `src/app/api/orders/[id]/send/route.ts` | Validate all forced modifiers complete before send, include course fire status |
| `src/app/api/orders/[id]/split/route.ts` | Full split logic — equal, by seat, custom, shared item splitting, penny rounding |
| `src/app/(pos)/payments/page.tsx` | Wire up multi-tender payment, tip entry, receipt options |
| `src/app/(pos)/checks/page.tsx` | Show split checks, individual check payment status |
| `src/hooks/use-realtime.ts` | Add channels for kitchen close, 86 updates, order sync |

### Acceptance Criteria

- [ ] Server creates a new dine-in order for Table 7, 4 guests → order appears in panel with table and guest count
- [ ] Server taps "Grilled Salmon" which has forced modifier "Temperature" → modifier sheet auto-pops → cannot close until temperature selected → price updates with any upcharges
- [ ] Server adds a "Build Your Own Burger" with 9 modifier groups → all forced groups validated → defaults pre-selected → running total updates live
- [ ] Server taps "Lunch Special" combo → combo builder opens → selects entree (with temp modifier) → selects side (Onion Rings +$1.50) → selects drink → combo added to order at $14.99 + $1.50 = $16.49
- [ ] Server adds burger + fries + drink individually → "Make it a combo" toast appears → tapping "Yes" replaces 3 items with combo at lower price
- [ ] Server taps market price "Lobster" → numpad opens → enters $52 (within $38-$65 range) → item added at $52
- [ ] Server enters $75 for market price lobster (above $65 range) → manager PIN required → manager enters PIN → price accepted
- [ ] Each seat (1-4) has a distinct color → items in order panel show colored left border → filtering by seat works
- [ ] Course 1 items show "FIRE" badge (green) → Course 2 items show "HOLD" badge (gray) → Server taps "Fire Course 2" → badge changes to "FIRE" and sends to kitchen channel
- [ ] Server taps "Rush" on Course 2 → reason picker appears → selects "VIP" → RUSH flag sent to KDS channel
- [ ] Server taps an item in order panel → Item Edit Popover slides up → changes quantity from 1 to 2 → price doubles → changes modifier → price updates → sends correction to kitchen
- [ ] Server taps "Void Item" on a sent item → Manager PIN required → VoidReasonDialog shows → selects "Wrong Item Sent" → item removed from check → "Re-fire replacement?" prompt appears
- [ ] Server taps "Comp Item" → Manager PIN → CompDialog → selects "Service Recovery" → item price becomes $0 → comp tracked in reporting
- [ ] Server taps "Re-fire" → reason picker → selects "Wrong Temp" → RE-FIRE ticket sent to kitchen channel with priority flag
- [ ] Party of 8 seated → auto-gratuity (20%) automatically appears on check → amount is correct (20% of pre-tax subtotal)
- [ ] Manager removes auto-gratuity → Manager PIN → reason "Guest Objection" → auto-gratuity line removed → total recalculates
- [ ] Server toggles "To Go" → tax recalculates using to-go tax rate from location settings (may be different from dine-in rate)
- [ ] Tax rate comes from location_settings table → no hardcoded 8.5% anywhere in codebase
- [ ] Server opens split check view → drags items between checks → totals update in real-time → tax recalculates per check
- [ ] "Split by Seat" one-tap → creates one check per seat → items auto-assigned by seat → totals correct
- [ ] "Split Equal 4 Ways" → 4 checks with equal amounts → penny rounding on last check → total of all checks = original total exactly
- [ ] Shared appetizer ($18) → "Split equally across Check A, B, C" → $6.00 each
- [ ] Server processes multi-tender: $50 gift card (balance $37.42) → $37.42 applied → remaining $15.08 → pays $15.08 cash → change calculated → check closes
- [ ] Server processes $20 cash + remainder on credit card → both payments recorded → check total covered → check closes
- [ ] Walkout: Manager enters PIN → selects reason → order marked as walkout → tracked in reporting → if bar tab with card, option to capture
- [ ] Kitchen close: Manager activates → all food tiles show "KITCHEN CLOSED" overlay → only beverage categories remain active → broadcasts to all terminals
- [ ] Guest at Seat 3 has peanut allergy flagged → server adds "Pad Thai" (contains peanuts) to Seat 3 → ALLERGEN WARNING dialog appears → must force-acknowledge
- [ ] All order changes sync to other POS terminals within 3 seconds via Supabase Realtime

### End-to-End Workflow Tests

**Workflow 1: Full Fine Dining Service (Happy Path)**
1. Host seats party of 4 at Table 12 → Server creates order → Guest count 4, Seats 1-4
2. Server takes drink order: Seat 1 Martini (Rocks, Dirty), Seat 2 Cabernet (8oz), Seat 3 IPA, Seat 4 Sparkling Water
3. Drinks auto-fire as Course 1 → appear on bar KDS channel
4. Server takes food order: Seat 1 Caesar Salad + Ribeye MR, Seat 2 Soup + Salmon, Seat 3 Calamari + Pasta, Seat 4 Salad + Chicken GF
5. Apps are Course 1 (FIRE), Entrees are Course 2 (HOLD)
6. Server sends order → Course 1 food fires to kitchen stations
7. After apps served, server taps "Fire Course 2" → entrees fire
8. All items served → server taps "Pay" → presents check
9. Guest pays single check with credit card → tip entered → check closes
10. **Verify:** All items have correct seat colors, modifiers display correctly, course timing tracked, tax calculated from location settings, tip recorded

**Workflow 2: Split Check Nightmare (12-Top)**
1. Party of 12, 6 checks requested after ordering
2. 3 shared appetizers, individual entrees, 2 bottles of wine shared by 4 guests
3. Auto-gratuity applied (party >= 6)
4. Server opens split check → creates 6 checks
5. Moves individual entrees by seat
6. Splits shared appetizers equally across all 6 checks
7. Splits wine across 4 specific checks
8. Birthday person's entree split across 3 friends' checks
9. Unassigned counter hits 0 → Confirm Split
10. 3 checks pay by card, 2 by cash, 1 by gift card + cash
11. **Verify:** All checks total to original order total, tax correct per check, auto-gratuity proportionally distributed, all payments recorded, no penny rounding errors

**Workflow 3: Combo + Modifier Deep Test**
1. Server adds "Build Your Own Burger" combo ($14.99)
2. Step 1: Double patty (+$4.00), Temperature: Medium
3. Step 2: Pretzel bun (+$1.50)
4. Step 3: Pepper Jack cheese (included), Avocado (+$2.50), Bacon (+$2.50)
5. Step 4: Onion Rings side (included)
6. Step 5: Fountain Drink (included)
7. Combo total: $14.99 + $4.00 + $1.50 + $2.50 + $2.50 = $25.49
8. Server also adds a la carte fries ($6) — no combo suggestion (doesn't match any combo)
9. Server voids the fries → no manager PIN needed (item not yet sent)
10. Sends order → modifiers appear on kitchen ticket
11. **Verify:** Combo price shown as one line with sub-items indented, all modifiers correct, void tracked, total correct

**Workflow 4: Void/Comp/Re-fire Recovery**
1. Table 7 orders Ribeye MR → sent to kitchen → cooked and served
2. Guest complains steak is overcooked (20 minutes later)
3. Server taps Ribeye → Comp Item → Manager PIN → "Food Quality" reason → item comped ($0)
4. Server taps "Re-fire replacement" → RE-FIRE sent to kitchen with "Wrong Temp" reason and priority flag
5. New Ribeye MR appears on order as RE-FIRE item
6. Guest served correct steak
7. Check shows: original Ribeye at $0 (COMP), new Ribeye at full price — OR — original comped and replacement is the new charge (configurable)
8. **Verify:** Comp logged with manager, reason, timestamp. Re-fire appears on KDS with priority. Audit trail complete.

**Workflow 5: Walkout + Bar Tab Capture**
1. Customer opens bar tab at bar → card pre-authed for $50
2. Adds: 3 beers ($8 each), wings ($14), 2 shots ($10 each) = $58 total
3. Running total ($58) exceeds $50 auth → incremental auth fires (or mock fires)
4. Customer leaves without closing tab
5. Bartender hits "Walkout" → Manager PIN → "Guest Left Without Paying"
6. System offers: "Capture $58 + tax + 20% auto-gratuity on card on file?"
7. Manager confirms → capture sent → tab closed as walkout
8. **Verify:** Walkout logged, amount captured, auto-gratuity applied, appears in daily walkout report

**Workflow 6: Kitchen Close + For-Here/To-Go**
1. 10:30 PM — Kitchen manager activates Kitchen Close
2. All POS terminals show food items disabled
3. Server switches existing order to "To Go" → tax recalculates
4. Server can still add drinks (cocktails, beer)
5. Server tries to add a burger → blocked with "Kitchen Closed" message
6. Manager reopens kitchen for one more ticket → food items re-enable
7. **Verify:** Kitchen close syncs across all terminals, tax changes correctly on to-go toggle, food items properly disabled/enabled

**Workflow 7: Allergen Safety Check**
1. Customer at Seat 3 tells server about shellfish allergy
2. Server flags Seat 3 with shellfish allergen tag
3. Server tries to add Lobster Bisque to Seat 3
4. ALLERGEN WARNING appears: "Seat 3 — Shellfish Allergy. Continue?"
5. Server must force-acknowledge (type CONFIRM or hold button 3s)
6. Warning cannot be accidentally dismissed by tapping outside
7. If server confirms, item added with ALLERGY flag visible in order panel and sent to KDS
8. **Verify:** Warning appears, force-acknowledge works, allergy flag on KDS ticket
