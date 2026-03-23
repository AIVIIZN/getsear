# Sear POS v4 — Complete Session Runbook

**40 sessions. Each one is a fresh Claude Code conversation.**
**Paste the prompt. Let it build. Approve or adjust. Move to the next.**

---

## How to Use This

1. Open a fresh Claude Code session
2. Copy the prompt for that session
3. Paste it
4. Let the agent work
5. Test the result against the acceptance criteria listed
6. If it passes, move to the next session
7. If it fails, paste: "The following acceptance criteria failed: [list them]. Fix these before moving on."

After every 3-4 sessions, commit and deploy:
```
git add -A && git commit -m "V4 Phase X Session Y — [description]" && git push origin main
```

---

## PHASE 1: ORDER ENTRY (4 sessions)

### Session 1.1 — Modifier Sheet & Combo Engine
**Read first:** V4_PHASE_01_ORDERS.md sections on modifiers and combos
**Prompt:**
```
Read these files COMPLETELY before doing anything:
1. V4_PHASE_01_ORDERS.md — the build spec for this session
2. MASTER_TEMPLATE.md — the build rules (especially Rules 17-21)
3. MODULE_SPECS/03_orders.md — order module spec
4. POS_UI_RESEARCH.md — modifier sheet specs (section 3)

BUILD these features (fully working, not stubs):
1. Rebuild ModifierSheet.tsx as a proper iOS page sheet:
   - Drag indicator (36x5px, centered)
   - Grouped modifier sections with radio (single-select) and checkbox (multi-select)
   - Forced modifiers auto-pop when item with required modifiers is tapped
   - Price adjustments shown right-aligned per modifier
   - "Add to Order" CTA at bottom with running total (50px tall, full-width)
   - Spring animation on open/close (0.35s)
2. Combo/meal deal engine:
   - New component ComboBuilder.tsx
   - Detects when item is part of a combo (combo_group_id on menu_items)
   - Shows combo picker: "Make it a combo? +$3.99 — includes fries + drink"
   - Each combo slot shows available options (drink choices, side choices)
   - Combo price replaces individual item prices
3. Open price items:
   - When item has price_type='open', show numpad for server to enter price
   - OpenPriceDialog.tsx component
   - Validates minimum/maximum price bounds

Test by creating an order with: 1 item with forced modifiers, 1 combo, 1 open price item.
Every button must perform a real action. No stubs. No toast("coming soon").
```

### Session 1.2 — Order Panel Deep Features
**Read first:** V4_PHASE_01_ORDERS.md sections on item editing, seats, courses
**Prompt:**
```
Read these files COMPLETELY before doing anything:
1. V4_PHASE_01_ORDERS.md
2. src/components/pos/OrderPanel.tsx — current implementation
3. src/app/(pos)/orders/page.tsx — current page
4. POS_UI_RESEARCH.md — order panel specs (section 1)

BUILD these features:
1. Item edit popover — tap any item in order list:
   - Shows: quantity stepper, modifier list (editable), special instructions field
   - Void button (red), Comp button (amber), Re-fire button (orange)
   - Re-fire sends POST /api/orders/[id]/items/[itemId]/refire with reason code
   - Create /api/orders/[id]/items/[itemId]/refire route
2. Seat color coding:
   - Each seat gets a color from a 10-color palette
   - Items in order list show colored left border matching their seat
   - Seat selector pills show matching colors
3. Course timing controls inline:
   - Each course group in order list shows FIRE / HOLD status
   - Tap "FIRE" on Course 2 → sends fire-course API → updates status
   - Visual: fired courses show green indicator, held show gray
4. Quick-add favorites bar:
   - Horizontal scrollable bar above category pills in MenuGrid
   - Shows 8-10 most-ordered items for this server (configurable)
   - Tap to instantly add to order (no modifier sheet for quick items)
   - New component QuickFavorites.tsx
5. For Here / To Go toggle:
   - Toggle in OrderPanel header next to order type chips
   - Affects tax calculation (for_here uses dine_in_tax_rate, to_go uses takeout_tax_rate)
   - Persists on order record

Test: Create order → assign seats with colors → add items per seat → fire course 1 → hold course 2 → tap item to edit → change modifier → re-fire item.
```

### Session 1.3 — Split Check Drag & Multi-Tender
**Read first:** V4_PHASE_01_ORDERS.md split and payment sections
**Prompt:**
```
Read these files COMPLETELY before doing anything:
1. V4_PHASE_01_ORDERS.md — split and multi-tender specs
2. src/app/(pos)/checks/page.tsx — current checks page
3. MODULE_SPECS/04_payments.md — payment spec

BUILD these features:
1. Drag-and-drop split check (using @dnd-kit already in package.json):
   - Two check panels side by side
   - Items are draggable between checks
   - Dragging an item moves it from Check A to Check B
   - Totals, tax recalculate on both checks instantly
   - "Split Item" option: split a single item across checks (e.g., shared appetizer)
   - Visual: dragged item shows ghost, drop zone highlights
2. Multi-tender payment:
   - On payment screen, after first payment method completes, show "Remaining: $X.XX"
   - Allow selecting second payment method for remainder
   - Support: cash + card, card + gift card, cash + gift card, any combination
   - Each payment creates its own payment record linked to the order
   - Order only closes when balance_due reaches $0
3. Auto-gratuity:
   - When guest_count >= threshold (default 6, configurable per location)
   - Auto-add gratuity line item (default 20%, configurable)
   - Shows as "Service Charge" on check, not as tip
   - Manager can remove (requires PIN)
   - Create /api/orders/[id]/auto-gratuity route

Test: Create order with 8 guests → auto-grat appears → split into 3 checks by dragging items → pay Check 1 with $20 cash + card for remainder → pay Check 2 with gift card → pay Check 3 with card.
```

### Session 1.4 — Tax Engine, Walkouts, Kitchen Close & Polish
**Read first:** V4_PHASE_01_ORDERS.md remaining features
**Prompt:**
```
Read these files COMPLETELY before doing anything:
1. V4_PHASE_01_ORDERS.md — tax, walkout, kitchen close specs
2. src/app/api/orders/[id]/items/route.ts — current tax calculation
3. src/app/api/orders/[id]/discount/route.ts — discount tax calc
4. src/app/api/orders/[id]/comp/route.ts — comp tax calc

BUILD these features:
1. Tax engine — replace ALL hardcoded 8.5% tax:
   - Fetch location's tax rates from tax_rates table
   - Support multiple tax rates (food tax, alcohol tax, takeout tax)
   - Each menu item has tax_class (food, alcohol, non_taxable)
   - Tax calculated per item based on its class + location rates
   - For Here / To Go affects which rate applies
   - Fix in: items/route.ts, discount/route.ts, comp/route.ts, merge/route.ts, order-store.ts
2. Walkout handling:
   - New status "walkout" on orders
   - Manager PIN required to mark walkout
   - Walkout records: date, server, table, amount, notes
   - Shows in void/comp report
   - Create WalkoutDialog.tsx
3. Kitchen close function:
   - Toggle in settings or via manager action
   - When kitchen closed: food items disabled in MenuGrid, drink items still available
   - Visual indicator in MenuGrid header: "KITCHEN CLOSED — Drinks Only"
   - Syncs via Supabase Realtime to all terminals
4. Order templates for regulars:
   - Save current order as template: "Table 12 usual"
   - Load template to pre-fill new order
   - Templates stored per location
   - Simple list in a slide-over panel

Run Phase 6.5 workflow verification on the ENTIRE order module:
- Create dine-in order for 8 guests → auto-grat applies → add 5 items across 3 courses → assign seats → send to kitchen → fire course 1 → add item to sent order → void 1 item (manager PIN) → apply 15% discount (manager PIN) → split by dragging 2 items to new check → pay original with cash+card multi-tender → pay split with card → close both → verify database records.
```

---

## PHASE 2: PAYMENTS (4 sessions)

### Session 2.1 — Valor PayTech REST API Integration
**Prompt:**
```
Read V4_PHASE_02_PAYMENTS.md COMPLETELY.
Read SEAR_POS_ARCHITECTURE.md Section 6 (Payment Processing).

BUILD: Replace mock CardProcessing.tsx with real Valor PayTech integration.
- Create src/lib/valor/ directory with: client.ts, types.ts, errors.ts
- Valor REST API client: sale, preauth, capture, void, refund, tip-adjust
- Card payment flow: POS sends amount → Valor terminal prompts card → result callback
- Handle: approved, declined, timeout, cancelled
- EMV chip, NFC contactless, swipe, manual entry (Valor handles card type detection)
- Store transaction_id, auth_code, card_last_four, card_brand from Valor response
- Error handling: network timeout, terminal offline, card declined with reason
- Environment variables: VALOR_API_KEY, VALOR_MERCHANT_ID, VALOR_TERMINAL_ID, VALOR_API_URL
```

### Session 2.2 — Bar Tabs & Pre-Auth Lifecycle
**Prompt:**
```
Read V4_PHASE_02_PAYMENTS.md bar tab sections.

BUILD: Complete bar tab lifecycle using Valor pre-auth.
- Open tab: pre-auth $50 (configurable) on customer's card
- Add items to tab (regular order flow, no payment yet)
- Incremental auth: when tab exceeds 80% of pre-auth, auto-increase
- Close tab: capture final amount + tip
- Walkout: if tab abandoned, capture pre-auth amount after configurable timeout (4 hours)
- Auto-close stale tabs at end of night (configurable time, e.g., 2 AM)
- Bar tab management UI: list of open tabs, balance, last activity, close button
- BullMQ job for auto-close stale tabs
- Create src/app/(pos)/bar-tabs/page.tsx
```

### Session 2.3 — Dual Pricing, Settlement & Reconciliation
**Prompt:**
```
Read V4_PHASE_02_PAYMENTS.md dual pricing and settlement sections.

BUILD:
1. Dual Pricing engine:
   - Every price displayed shows both cash price and card price (card = cash + 4%)
   - Toggle per location (Settings → Location → Enable Dual Pricing)
   - MenuGrid tiles show: "$12.99 cash / $13.51 card"
   - Order panel shows card price by default, switches to cash if cash payment selected
   - Legal compliance: signage text generator for location
2. Batch settlement:
   - Auto-settlement BullMQ job at configured time (default 2 AM)
   - Manual trigger from Settings → Payments
   - Calls Valor batch close API
   - Records settlement_batch with totals
   - Reconciliation: compare Valor batch total vs Sear payment records → flag discrepancies
3. Daily reconciliation report:
   - Shows: Sear total, Valor total, difference, transaction count match
   - Drill into mismatches
   - Create src/app/(backoffice)/reports/reconciliation/page.tsx
```

### Session 2.4 — Cash Management, Refunds, Chargebacks & Polish
**Prompt:**
```
Read V4_PHASE_02_PAYMENTS.md cash and chargeback sections.

BUILD:
1. Cash drawer management:
   - Opening count: denomination counter (bills + coins = total)
   - Closing count: same denomination counter
   - Over/short calculation: closing - (opening + cash sales - cash paid out)
   - Stored per shift per employee
   - Create CashDrawerCount.tsx component
   - Create /api/cash-drawers routes (open, close, count)
2. Refund flow:
   - Before settlement: void (reversal, no money moves)
   - After settlement: refund (money returns to card)
   - Partial refund: enter amount, reason code, manager PIN
   - Unlinked refund: different card than original (requires manager)
3. Chargeback management:
   - View disputes from Valor webhook
   - Upload evidence (receipt image, signature, delivery proof)
   - Track status: open → evidence_submitted → won/lost
   - Create src/app/(backoffice)/settings/chargebacks/page.tsx

Full Phase 2 workflow test:
Open bar tab → pre-auth $50 → add $45 of drinks → close tab with 20% tip → batch settles at 2 AM → next day customer disputes charge → upload evidence → track outcome.
```

---

## PHASE 3: KDS (3 sessions)

### Session 3.1 — Expo Screen & Multi-Station Coordination
**Prompt:**
```
Read V4_PHASE_03_KDS.md COMPLETELY.

BUILD:
1. Expo screen (new page: src/app/(fullscreen)/kds/expo/page.tsx):
   - Shows ALL tickets from ALL stations
   - Each ticket shows station completion status (grill: ✓, fry: pending, cold: ✓)
   - Ticket only shows "READY TO RUN" when all stations are complete
   - Expo can bump to mark as picked up by server
2. Multi-station coordination:
   - Order with items routed to different stations creates linked tickets
   - When Station A bumps their items, Expo sees partial completion
   - When all stations bump, Expo shows green "READY" state
   - Requires new field: kds_ticket_events.coordination_group_id (links related tickets)
3. Individual item bumping:
   - Within a ticket, each item has its own bump button
   - Bumped items show green checkmark
   - Ticket auto-bumps when all items are bumped
```

### Session 3.2 — Re-fire, Allergens, Priority & Audio
**Prompt:**
```
Read V4_PHASE_03_KDS.md re-fire, allergen, priority sections.

BUILD:
1. Re-fire workflow:
   - Server taps re-fire on POS → new KDS ticket marked "RE-FIRE" with reason
   - RE-FIRE tickets sort to TOP of queue (highest priority)
   - Visual: red "RE-FIRE" banner, pulsing border
   - Reason codes: wrong item, quality issue, temperature, timing
2. Allergen alerts on KDS:
   - When order has allergen-flagged items, ticket shows FULL-WIDTH RED BANNER
   - "⚠️ ALLERGY: PEANUTS — Seat 2" — cannot be dismissed, persists until bumped
   - Allergen data flows from menu_items.allergens through order_items to KDS
3. Ticket priority system (visual sort order):
   - RE-FIRE (red) → RUSH (orange) → VIP (purple) → Normal (default)
   - Priority badges on ticket header
   - Higher priority tickets sort left (first position)
4. Escalating audio:
   - New ticket: single chime (600Hz, 200ms)
   - Aging ticket (yellow): double chime every 30s
   - Late ticket (orange): triple chime every 15s
   - Critical ticket (red): continuous alarm until bumped
```

### Session 3.3 — Configurable Thresholds, Capacity, Printer Failover & Polish
**Prompt:**
```
Read V4_PHASE_03_KDS.md remaining sections.

BUILD:
1. Configurable time thresholds:
   - Per-category thresholds (appetizers: 8min, entrees: 15min, desserts: 10min)
   - Settings UI: KDS Settings page with threshold editor per category
   - Thresholds stored in kds_stations.config JSONB
2. Kitchen capacity indicator:
   - Top bar shows: "Kitchen Load: 78% | 24 active tickets | Avg 11:30"
   - Color codes: green (<60%), yellow (60-80%), red (>80%)
3. Printer failover:
   - If KDS station goes offline (no heartbeat for 60s), auto-print to backup kitchen printer
   - Requires printer configuration (Phase 5) — for now, create the failover logic and queue
   - Log failover events
4. Kitchen close (synced with POS):
   - Toggle on KDS header
   - Broadcasts via Supabase Realtime
   - POS MenuGrid disables food items
   - KDS shows "KITCHEN CLOSED" banner

Full Phase 3 workflow:
Send order with grill item + fry item + allergy flag → grill station sees ticket with allergen banner → fry station sees their items → fry bumps → expo shows partial → grill bumps → expo shows READY → expo bumps → "run to table 5" → re-fire the grill item (wrong temp) → RE-FIRE ticket appears at top of grill queue.
```

---

## PHASE 4: MENU MANAGEMENT (3 sessions)

### Session 4.1 — Visual Menu Builder & Photo Management
**Prompt:**
```
Read V4_PHASE_04_MENU.md COMPLETELY.

BUILD:
1. 3-panel menu builder (rebuild src/app/(backoffice)/menu/page.tsx):
   - Left panel: category tree (collapsible, drag-to-reorder)
   - Center panel: item grid for selected category (drag-to-reorder)
   - Right panel: item detail editor (form with all fields)
2. Photo upload:
   - Upload to Supabase Storage bucket "menu-images"
   - Crop/resize on client before upload (max 800x800, JPEG 80%)
   - Show preview in editor + in MenuGrid tile
   - Delete photo button
3. Drag-and-drop reorder:
   - @dnd-kit for both category tree and item grid
   - Saves sort_order via existing reorder APIs
   - Visual feedback: dragged item shows ghost, drop position highlighted
```

### Session 4.2 — Daypart Pricing, Price Levels & Seasonal Menus
**Prompt:**
```
Read V4_PHASE_04_MENU.md pricing sections.

BUILD:
1. Daypart pricing engine:
   - Define dayparts per location (Breakfast 6-11, Lunch 11-3, Happy Hour 3-6, Dinner 6-close)
   - Each item can have different prices per daypart
   - Active daypart determined by order creation time, not payment time
   - UI: price editor in item detail shows price per daypart
   - MenuGrid shows current daypart price
2. Price levels (9 supported):
   - Regular, Happy Hour, Employee, Senior, Military, Kids, Delivery, Catering, Custom
   - Each item can have override prices per level
   - Active price level set per order or per terminal
3. Seasonal menu rotation:
   - Items and categories have optional start_date / end_date
   - Auto-activate/deactivate based on date
   - "Seasonal" badge on items with date range
   - Calendar view showing upcoming activations/deactivations
```

### Session 4.3 — 86 Cascade, Allergens, Dietary Tags & Import/Export
**Prompt:**
```
Read V4_PHASE_04_MENU.md 86 and allergen sections.

BUILD:
1. Ingredient-level 86 cascade:
   - Link menu items to inventory items via recipes table
   - When inventory item is 86'd, all menu items using it are auto-86'd
   - "Running Low" status (inventory below 20% of par) shows yellow badge
   - Auto-86 when inventory hits 0
2. Allergen management:
   - 14 EU allergens + 8 US common (predefined list, checkboxes in item editor)
   - Allergen badges on menu tiles (small icons)
   - Allergen filter in MenuGrid (toggle to hide items with specific allergens)
3. Dietary tags:
   - V (Vegetarian), VG (Vegan), GF (Gluten-Free), DF (Dairy-Free), etc.
   - Tags display as colored pills on item tiles
   - Filter menu by dietary tag
4. Menu import/export:
   - Export: CSV with all items, prices, categories, modifiers, allergens
   - Import: CSV upload, preview changes, confirm to apply
   - Handles: new items, updated prices, deactivated items
```

---

## PHASE 5: HARDWARE (3 sessions)

### Session 5.1 — ESC/POS Receipt Printer Driver
**Prompt:**
```
Read V4_PHASE_05_HARDWARE.md COMPLETELY.

BUILD:
1. ESC/POS printer driver (src/lib/printing/):
   - escpos.ts: ESC/POS command builder (text, bold, align, cut, open drawer)
   - receipt-formatter.ts: format order into receipt layout
   - kitchen-formatter.ts: format order into kitchen ticket layout
   - Support: Star Micronics TSP100/TSP143, Epson TM-T88
   - Connection via WebSocket to local print server or direct network printing
2. Receipt template:
   - Restaurant name (centered, bold, double-size)
   - Address, phone
   - Date, time, server name, table
   - Itemized list with qty, name, modifiers, price
   - Subtotal, tax, tip line (if pre-printed), total
   - Dual pricing lines (cash price / card price) if enabled
   - Footer message (configurable)
   - QR code for online ordering or feedback URL
3. Printer configuration UI:
   - Settings → Printers page
   - Add printer (name, IP address, model, type: receipt/kitchen)
   - Test print button
   - Assign to station (for kitchen printers)
```

### Session 5.2 — Kitchen Printing & Cash Drawer
**Prompt:**
```
Read V4_PHASE_05_HARDWARE.md kitchen and cash drawer sections.

BUILD:
1. Kitchen ticket printing:
   - Triggered when order is sent to kitchen (same as KDS)
   - Formatted for kitchen: large text, modifiers indented, allergen CAPS
   - Routed to correct kitchen printer based on item's prep_station
   - Includes: order number, table, server, seat, course, items, mods, special instructions
2. Cash drawer trigger:
   - ESC/POS command to open drawer (via receipt printer RJ-11 port)
   - Triggers on: cash payment, cash drawer open request, shift start count
   - "No Sale" button (opens drawer, logs event, requires manager for some roles)
3. Print queue:
   - Queue prints with retry on failure (3 attempts, 5s interval)
   - Failed prints show in notification area
   - Reprint button for any recent order
```

### Session 5.3 — Barcode Scanner & Printer Failover
**Prompt:**
```
Read V4_PHASE_05_HARDWARE.md barcode and failover sections.

BUILD:
1. Barcode scanner support:
   - USB HID scanners send keystrokes ending with Enter
   - Listen for rapid keystroke pattern (>5 chars in <100ms) followed by Enter
   - Look up PLU/barcode in menu_items table
   - Auto-add item to current order
   - Works on orders page when scanner input detected
2. Kitchen printer failover (Phase 3 integration):
   - If KDS station offline, route tickets to backup printer
   - Configurable per station: primary=KDS, backup=printer
   - Failover triggers after 60s without KDS heartbeat
   - Auto-restore when KDS comes back online
3. Print job logging:
   - Log all print jobs (receipt, kitchen, report) in print_jobs table
   - Status: queued, printing, printed, failed
   - Reprint from log
```

---

## PHASE 6: STAFF & LABOR (3 sessions)

### Session 6.1 — Permissions UI, Overtime & Break Compliance
**Prompt:**
```
Read V4_PHASE_06_STAFF.md COMPLETELY.

BUILD:
1. Per-user permission configuration UI:
   - In staff detail panel: "Permissions" tab
   - Shows all permissions grouped by category (Orders, Payments, Menu, Reports, etc.)
   - Each permission shows: role default (inherited) or override (granted/denied)
   - Toggle to grant or deny specific permissions per user
   - Saves to user_permission_overrides table
2. Overtime calculation:
   - Calculate weekly hours from time_entries
   - Flag when approaching overtime (>35 hours warning, >40 overtime)
   - Overtime multiplier: 1.5x for >40 hours, configurable
   - Visual alert in staff dashboard
   - Daily overtime report
3. Break compliance:
   - Track break taken vs required (varies by state)
   - Alert if 6+ hour shift without break
   - Break compliance report
   - Auto-remind staff via POS notification
```

### Session 6.2 — Tip Pooling, Server Checkout & Cash Drawer Count
**Prompt:**
```
Read V4_PHASE_06_STAFF.md tip and cash sections.

BUILD:
1. Tip pooling configuration:
   - 4 models: Direct (keep own), Pool by Hours, Pool Equal, Hybrid
   - Configuration UI: select model, set tipout percentages, define pool participants by role
   - Tip distribution calculation engine
   - "Run Tip Distribution" button generates distribution for a date range
   - Distribution preview before committing
2. Server checkout report:
   - End-of-shift summary for each server
   - Shows: total sales, cash collected, card tips, tip-out owed, cash due to house
   - Print checkout report (receipt printer)
   - Manager sign-off
3. Cash drawer count (denomination counter):
   - Start of shift: count bills ($1, $5, $10, $20, $50, $100) + coins
   - End of shift: same count
   - Auto-calculate over/short vs expected
   - CashDrawerCount.tsx component with denomination grid
   - Store counts in cash_drawer_events table
```

### Session 6.3 — Payroll Export, Labor Forecasting & Scheduling Integration
**Prompt:**
```
Read V4_PHASE_06_STAFF.md payroll, forecasting, scheduling sections.

BUILD:
1. Payroll export:
   - CSV export of time entries for date range
   - Columns: employee name, employee ID, date, clock in, clock out, regular hours, OT hours, tips, total
   - Format compatible with ADP, Gusto, Paychex
   - Download button on labor report page
2. Labor cost forecasting:
   - Based on scheduled shifts: projected hours × hourly rate = projected labor cost
   - Compare to projected sales (based on same day last week)
   - Show labor % projection
   - Alert if projected labor % exceeds threshold (default 30%)
3. Scheduling deep features:
   - Shift marketplace: uncovered shifts posted for staff to claim
   - Swap request flow: request → manager approval → auto-notify both parties
   - Mobile-friendly schedule view (responsive for phone browser)
   - Schedule published via SMS notification to staff (Twilio, Phase 8)
```

---

## PHASE 7: REPORTS (3 sessions)

### Session 7.1 — Real-Time Dashboard & Daily Aggregation
**Prompt:**
```
Read V4_PHASE_07_REPORTS.md COMPLETELY.

BUILD:
1. Replace ALL mock data with live Supabase queries:
   - Daily sales: query orders table, sum by status=closed
   - Hourly breakdown: group by hour(created_at)
   - Payment mix: join payments table, group by method
   - Category mix: join order_items → menu_items → categories
   - Top items: group order_items, sum quantity and revenue
2. Daily metrics aggregation BullMQ job:
   - Runs at 4 AM daily
   - Aggregates: total sales, order count, avg check, covers, labor hours, labor cost, food cost
   - Writes to daily_metrics table
   - Supports re-run for specific dates
3. KPI cards show real data with comparison to previous period:
   - Today vs yesterday, or this week vs last week
   - Green/red arrow + percentage change
```

### Session 7.2 — New Report Types (Cash, Speed, Food Cost, Voids)
**Prompt:**
```
Read V4_PHASE_07_REPORTS.md new report sections.

BUILD 4 new report pages:
1. Cash Report (src/app/(backoffice)/reports/cash/page.tsx):
   - Opening count, closing count, over/short per employee
   - Cash sales total, cash paid out, expected cash
   - Date range filter
2. Speed of Service (src/app/(backoffice)/reports/speed/page.tsx):
   - Average ticket time by station
   - Average by daypart (lunch vs dinner)
   - Outlier tickets (>2x average)
   - Heatmap: time-of-day × station
3. Food Cost (src/app/(backoffice)/reports/food-cost/page.tsx):
   - Theoretical cost (from recipes × items sold)
   - Actual cost (from inventory purchases)
   - Variance by item
   - Top variance items highlighted
4. Void/Comp/Discount (src/app/(backoffice)/reports/voids/page.tsx):
   - Every void, comp, discount with: date, server, item, amount, reason, manager who approved
   - Patterns: voids by employee, voids by time of day
   - Summary totals for period
```

### Session 7.3 — P&L, Trends, Owner Dashboard, Auto-Email & PDF Export
**Prompt:**
```
Read V4_PHASE_07_REPORTS.md P&L, trends, owner sections.

BUILD:
1. P&L Summary (monthly):
   - Revenue: food sales, bar sales, other
   - COGS: food cost, bar cost
   - Gross profit
   - Operating expenses: labor, rent (manual entry), utilities (manual), supplies
   - Net profit
   - Auto-calculated from sales + labor + inventory data
2. 13-week trend analysis:
   - Rolling 13-week chart of: sales, labor %, food cost %, avg check
   - Week-over-week comparison
   - Identify trends (rising/falling/stable)
3. Owner mobile dashboard:
   - Responsive page optimized for phone viewport
   - Today's sales (live), vs same day last week
   - Labor % (live), open checks count, alerts
   - Simple, fast-loading, no charts (just numbers)
4. Auto-email daily summary:
   - SendGrid integration (uses Phase 8 email lib)
   - HTML email template: key metrics, comparison, alerts
   - BullMQ job at configured time (default 6 AM)
   - Configurable recipients per location
5. PDF export for all reports:
   - @react-pdf/renderer for server-side PDF generation
   - Download button on every report page
   - Formatted with Sear branding
```

---

## PHASE 8: INTEGRATIONS (2 sessions)

### Session 8.1 — Twilio SMS & SendGrid Email
**Prompt:**
```
Read V4_PHASE_08_INTEGRATIONS.md COMPLETELY.

BUILD:
1. Twilio SMS library (src/lib/twilio/):
   - send-sms.ts: send single SMS with template
   - Templates: order-ready, reservation-reminder, waitlist-ready, marketing
   - Opt-out handling (STOP keyword)
   - Delivery status tracking
   - Rate limiting (1 SMS per phone per minute)
2. SendGrid email library (src/lib/sendgrid/):
   - send-email.ts: send transactional email
   - HTML receipt template (responsive, branded)
   - Daily report email template
   - Marketing campaign template (with unsubscribe link, CAN-SPAM compliant)
3. Wire into existing features:
   - Order ready → SMS to customer (if phone on file)
   - Reservation 1 hour reminder → SMS
   - Waitlist "table ready" → SMS
   - Payment receipt → email (if email provided at receipt prompt)
   - Password reset → email
```

### Session 8.2 — QuickBooks & Webhooks
**Prompt:**
```
Read V4_PHASE_08_INTEGRATIONS.md QuickBooks and webhook sections.

BUILD:
1. QuickBooks Online real integration:
   - Replace mock OAuth tokens with real Intuit OAuth 2.0 flow
   - Chart of accounts mapping UI (map Sear categories to QB accounts)
   - Daily journal entry: summarize sales, taxes, tips, discounts → create QB journal entry
   - Sync status dashboard (last sync, errors, retry)
   - Idempotent sync (don't duplicate entries)
2. Webhook system:
   - CRUD for webhook endpoints: URL, events to subscribe, secret
   - HMAC-SHA256 signing of payloads
   - Events: order.created, order.closed, payment.processed, reservation.created
   - Retry with exponential backoff (3 attempts)
   - Delivery log with status
   - Create src/app/(backoffice)/settings/webhooks/page.tsx
```

---

## PHASE 9: OFFLINE MODE (3 sessions)

### Session 9.1 — Service Worker & IndexedDB Cache
**Prompt:**
```
Read V4_PHASE_09_OFFLINE.md COMPLETELY.

BUILD:
1. Service Worker (Workbox):
   - Cache app shell (HTML, CSS, JS) for offline loading
   - Cache API responses: menu, tables, staff, settings
   - Network-first strategy for API calls, fallback to cache
   - Background sync registration for offline mutations
2. IndexedDB cache (Dexie.js):
   - Tables: menu_items, menu_categories, modifiers, tables, staff, settings, orders_queue
   - Warm cache on login (fetch all data, store locally)
   - Cache invalidation: re-fetch on focus or every 5 minutes when online
3. Offline detection:
   - Use existing useOnlineStatus hook
   - Show persistent banner when offline: "Offline Mode — Orders will sync when connection returns"
   - Banner animated slide-down, amber color
```

### Session 9.2 — Offline Orders & Cash Payments
**Prompt:**
```
Read V4_PHASE_09_OFFLINE.md order and payment sections.

BUILD:
1. Offline order entry:
   - When offline, orders saved to IndexedDB orders_queue
   - Full order lifecycle works locally (add items, modifiers, seat, course)
   - Order numbers generated locally (prefix with "OFF-" to avoid conflicts)
   - Local KDS via BroadcastChannel (other tabs on same device see tickets)
2. Offline cash payments:
   - Cash payments processed locally (no network needed)
   - Change calculated locally
   - Payment record queued for sync
3. Store-and-forward card payments:
   - When offline, card auth queued with encrypted card data
   - Configurable limit ($200 per transaction default)
   - 24-hour settlement window
   - Queued transactions shown in manager review panel
```

### Session 9.3 — Sync Engine, Conflict Resolution & Clock In/Out
**Prompt:**
```
Read V4_PHASE_09_OFFLINE.md sync and clock sections.

BUILD:
1. Sync queue engine:
   - FIFO queue in IndexedDB
   - On reconnect: process queue sequentially
   - Retry failed syncs (3 attempts, exponential backoff)
   - Show sync progress bar: "Syncing 12/15 orders..."
2. Conflict resolution:
   - If server rejects (e.g., item was 86'd while offline): show conflict dialog
   - Options: retry, skip, modify
   - Log all conflicts for manager review
3. Offline clock in/out:
   - PIN verification using cached bcrypt hash (bcrypt.js WASM)
   - Time entry stored locally with device timestamp
   - Sync on reconnect with time drift detection (>5 min drift = flagged for review)
4. Offline table management:
   - Seat/clear tables locally
   - Status syncs on reconnect
```

---

## PHASE 10: TABLES & RESERVATIONS (2 sessions)

### Session 10.1 — Table Deep Features
**Prompt:**
```
Read V4_PHASE_10_TABLES.md COMPLETELY.

BUILD:
1. Table list view (alternative to floor plan):
   - Sortable table: name, status, server, guests, seated time, check total
   - Quick-action buttons per row: seat, view order, clear
2. Server section assignment UI:
   - Drag tables into sections (colored zones)
   - Each section assigned to a server
   - Color-coded table backgrounds matching section color
3. Table turn time tracking:
   - Calculate: seated_at → cleared_at duration
   - Average by server, by daypart, by table
   - Turn time report page
4. Capacity dashboard:
   - Real-time: X/Y tables occupied, X/Y seats filled
   - Estimated wait time based on average turn time
   - Show in tables page header
```

### Session 10.2 — Reservation & Waitlist Integration
**Prompt:**
```
Read V4_PHASE_10_TABLES.md reservation integration sections.

BUILD:
1. Reservation → table assignment:
   - When reservation time arrives, suggest available table
   - One-tap seat from reservation (auto-creates order, changes table status)
   - Reservation shows on table (indicator dot + party name)
2. Waitlist → SMS → seat:
   - Add to waitlist with party size and phone
   - Estimated wait time (based on current turn times)
   - "Notify" button sends SMS via Twilio (Phase 8)
   - "Seat" button assigns table + creates order
3. Embeddable reservation widget:
   - Public page: /reserve/[location-slug]
   - Shows available time slots
   - Guest enters: name, phone, email, party size, date, time, notes
   - Creates reservation via API
   - Sends confirmation SMS
   - Embeddable via iframe
```

---

## PHASE 11: OPTIONAL MODULES (5 sessions)

### Session 11.1 — Inventory Deep Features
**Prompt:**
```
Read V4_PHASE_11_MODULES.md inventory section.

BUILD: waste tracking (reason codes, log), food cost calculation (theoretical vs actual per item), low stock alerts (BullMQ job, push notification), prep list generation from reservations + historical sales + current inventory levels.
```

### Session 11.2 — Loyalty & Online Ordering
**Prompt:**
```
Read V4_PHASE_11_MODULES.md loyalty and online ordering sections.

BUILD:
- Loyalty: phone enrollment at POS checkout, tier management (bronze/silver/gold/platinum), cross-location earn/redeem, loyalty balance display in payment flow
- Online Ordering: customer-facing page at /order/[location-slug], responsive mobile-first, menu browse, cart, checkout (card only), order confirmation, pickup time selection
```

### Session 11.3 — Marketing & Delivery
**Prompt:**
```
Read V4_PHASE_11_MODULES.md marketing and delivery sections.

BUILD:
- Marketing: campaign builder with template editor (drag blocks), SMS/email preview, send via Twilio/SendGrid (Phase 8), open/click tracking, campaign analytics dashboard
- Delivery: real-time driver tracking page (GPS via device location API), proof of delivery (photo upload), delivery time tracking, third-party integration webhook receivers (DoorDash, UberEats order format)
```

### Session 11.4 — Catering & Scheduling
**Prompt:**
```
Read V4_PHASE_11_MODULES.md catering and scheduling sections.

BUILD:
- Catering: BEO (Banquet Event Order) PDF generation, event proposal builder, deposit collection via payment system (Phase 2), invoice generation, catering calendar with event detail view
- Scheduling: labor cost projection on schedule view, shift marketplace (uncovered shifts), mobile-responsive schedule, SMS notification of published schedule
```

### Session 11.5 — Drive-Thru, House Accounts & Franchise
**Prompt:**
```
Read V4_PHASE_11_MODULES.md remaining modules.

BUILD:
- Drive-Thru: dual-lane order tracking, car position tracking, speed-of-service dashboard with target times, "pull forward" order management
- House Accounts: PDF statement generation, auto-billing (monthly invoice), credit limit alerts (warning at 80%, block at 100%), payment recording with check/ACH support
- Franchise: centralized menu push (master menu → locations), consolidated P&L across locations, royalty auto-calculation (% of gross sales), franchise dashboard
```

---

## PHASE 12: SECURITY (2 sessions)

### Session 12.1 — Zod Validation, Rate Limiting & Auth Hardening
**Prompt:**
```
Read V4_PHASE_12_SECURITY.md COMPLETELY.

BUILD:
1. Zod validation audit: add safeParse to every POST/PUT/PATCH/DELETE route that's missing it (audit identified 23 routes)
2. Redis-backed rate limiting: replace all in-memory rate limiters with Redis (already in stack), 10/min for auth, 200/min default
3. Location-level authorization: create requireLocation(user, locationId) helper, add to every route that accepts location_id
4. MFA: enable TOTP for owner/admin via Supabase Auth MFA, setup flow with QR code
5. Password reset: forgot password → SendGrid email with reset link → reset form → confirm
```

### Session 12.2 — Typed Supabase, Performance & Load Test
**Prompt:**
```
Read V4_PHASE_12_SECURITY.md performance sections.

BUILD:
1. Generate Supabase TypeScript types: `supabase gen types typescript`
2. Replace ALL `as any` casts on Supabase queries with generated types
3. Add database indexes for common queries (orders by location+status, items by category, time_entries by user+date)
4. Connection pooling configuration for production
5. N+1 query audit: find and fix routes that query in loops
6. Load test setup: k6 or artillery script simulating 50 concurrent users (create orders, process payments, view KDS)
```

---

## PHASE 13: VISUAL QA & POLISH (2 sessions)

### Session 13.1 — Full Page Audit & Design Compliance
**Prompt:**
```
Read V4_PHASE_13_POLISH.md COMPLETELY.

AUDIT every page (37+) at iPad 1194x834 viewport:
- Screenshot or describe current state
- Compare to Apple Design Resources (iOS 18 Figma kit)
- Check: typography (iOS scale), spacing (8px grid), touch targets (≥44px), colors (design tokens not hardcoded), shadows (warm two-layer), borders (0.5px hairlines)
- Fix EVERY issue found
- Add empty state to every list/grid/table that's missing one
- Add loading skeleton to every async load that's missing one
- Add error state to every page that's missing one
```

### Session 13.2 — Animations, Accessibility & Cross-Browser
**Prompt:**
```
Read V4_PHASE_13_POLISH.md animation and accessibility sections.

BUILD:
1. Animation audit: spring physics on every sheet/modal/slide-over open/close, press feedback on every button/tile, skeleton-to-content reveal transition, page transition animations
2. Accessibility audit (WCAG 2.1 AA):
   - Contrast ratios ≥ 4.5:1 for text, ≥ 3:1 for UI
   - All interactive elements keyboard-navigable
   - All images/icons have alt text or aria-label
   - Focus indicators visible on every focusable element
   - Screen reader testing with VoiceOver
3. Cross-browser testing:
   - Safari on iPad (primary target)
   - Chrome on Android tablet
   - Desktop Safari, Chrome, Firefox
   - Fix any rendering differences
```

---

## SUMMARY

| Phase | Sessions | Focus |
|-------|----------|-------|
| 1 | 1.1, 1.2, 1.3, 1.4 | Order Entry depth |
| 2 | 2.1, 2.2, 2.3, 2.4 | Valor Payments |
| 3 | 3.1, 3.2, 3.3 | KDS depth |
| 4 | 4.1, 4.2, 4.3 | Menu Management |
| 5 | 5.1, 5.2, 5.3 | Hardware |
| 6 | 6.1, 6.2, 6.3 | Staff & Labor |
| 7 | 7.1, 7.2, 7.3 | Reports |
| 8 | 8.1, 8.2 | Integrations |
| 9 | 9.1, 9.2, 9.3 | Offline Mode |
| 10 | 10.1, 10.2 | Tables & Reservations |
| 11 | 11.1, 11.2, 11.3, 11.4, 11.5 | Optional Modules |
| 12 | 12.1, 12.2 | Security |
| 13 | 13.1, 13.2 | Visual QA |
| **TOTAL** | **40 sessions** | |

---

## After Each Session

```bash
# Test the acceptance criteria
# If all pass:
git add -A
git commit -m "V4 Phase X.Y — [description]"
git push origin main
ssh -i ~/.ssh/google_compute_engine ianrakow@34.132.111.219 \
  "cd /opt/sear/app && git pull origin main && npm run build && \
   cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/ && \
   pm2 reload sear-pos --update-env"
```
