# SEAR POS Architecture — Complete Feature & Capability Extract

**Source:** `SEAR_POS_ARCHITECTURE.md` (17,935 lines)
**Purpose:** Gap analysis — spec vs reality
**Generated:** 2026-03-22

---

## PART 1: CORE MODULES (Always Active)

### Module: core.pos (Order Entry & Checkout)

**Features:**
- Full order lifecycle: draft → open → fired → ready → served → closed → voided → refunded
- 7 order types: dine_in, takeout, delivery, bar, catering, online, kiosk
- Seat-based ordering (assign items to seats 1, 2, 3, etc.)
- Coursing: fire Course 1 (apps) immediately, hold Course 2 (entrees) until manual fire
- Split checks: by seat, equal split, custom amounts, by item, mixed tender
- Merge checks
- Transfer orders: server-to-server, table-to-table
- Move order to different table
- Reopen closed orders (manager PIN)
- Add items to already-sent orders (sends only new items to kitchen)
- Void items/orders (pre-send free, post-send requires manager PIN)
- Comp items with reason codes
- Apply discounts (percentage, fixed, BOGO, free item)
- Auto-gratuity for large parties (configurable threshold + percentage)
- For Here / To Go toggle (affects tax in some jurisdictions)
- Guest name or order number assignment (auto-increment, reset daily)
- Quick-add favorites / speed buttons
- Combo / meal deal logic with upgrade pricing
- Open price items (market price, server enters price)
- Weight-based pricing (scale integration)
- Daypart-aware pricing (lunch, happy hour, dinner, late night)
- Rush / VIP order flags
- Re-fire items (corrections, priority flag)
- Order modification tracking (audit trail of every change)
- Walkout handling (specific status, house loss tracking)
- Kitchen close function (disable food orders, drinks only)

**API Endpoints (Orders):**
- `GET /api/v1/orders/` — List orders (filter: status, date, server, table)
- `POST /api/v1/orders/` — Create new order (draft)
- `GET /api/v1/orders/:id` — Get order with items, modifiers, payments
- `PUT /api/v1/orders/:id` — Update order
- `DELETE /api/v1/orders/:id` — Void order
- `POST /api/v1/orders/:id/send` — Send order to kitchen
- `POST /api/v1/orders/:id/fire-course` — Fire next course
- `POST /api/v1/orders/:id/items` — Add items to existing order
- `PUT /api/v1/orders/:id/items/:item_id` — Update order item
- `DELETE /api/v1/orders/:id/items/:item_id` — Void individual item
- `POST /api/v1/orders/:id/transfer` — Transfer to another server
- `POST /api/v1/orders/:id/move-table` — Move to different table
- `POST /api/v1/orders/:id/split` — Split order into multiple checks
- `POST /api/v1/orders/:id/merge` — Merge with another order
- `POST /api/v1/orders/:id/reopen` — Reopen closed order (manager)
- `GET /api/v1/orders/:id/modifications` — Modification history
- `POST /api/v1/orders/:id/discount` — Apply discount
- `DELETE /api/v1/orders/:id/discount/:disc_id` — Remove discount
- `POST /api/v1/orders/:id/items/:item_id/comp` — Comp an item
- `GET /api/v1/orders/open` — All open orders for location
- `GET /api/v1/orders/by-table/:table_id` — Orders for specific table

**UI Pages:**
- Main POS Order Entry (PRIMARY SCREEN — 80%+ of staff time)
- Modifier Selection Panel (slide-over or modal)
- Item Edit Popover
- Check Management List
- Check Detail View
- Split Check Interface (drag items between checks)
- Quick Actions Bar (Hold, Fire Course, Rush, Discount, Print, Void)

**Database Tables:**
- `orders` — Main order record with financials, status, assignments
- `order_items` — Line items with kitchen routing, seat, course, status flags
- `order_item_modifiers` — Modifier snapshots per order item
- `order_modifications` — Audit trail of all changes after send
- `order_discounts` — Discounts applied to orders/items

---

### Module: core.menu (Menu Management)

**Features:**
- Menu hierarchy: Restaurant → Menu → Category → Subcategory → Item → Modifier Group → Modifier
- 12 menu types: Dine-In, Lunch, Brunch, Happy Hour, Bar, Kids, Catering, Takeout, Delivery, Kiosk, Seasonal, Prix Fixe
- Multi-location menu inheritance: master menu with per-location overrides
- Locked items (corporate mandated), flexible items (local pricing +/- range), local items
- Daypart pricing with automatic switchover (order timestamp determines price, not payment)
- Section-based pricing (happy hour at bar only, not dining room)
- Seasonal menu rotation with start/end dates, auto-deactivation
- 86 management: item-level and ingredient-level 86 with cascading
- Auto-86 based on quantity countdown
- "Running Low" pre-86 status
- 86 cascade logic (86 ingredient → all items using it affected)
- Allergen tagging: 14 EU allergens + US common allergens
- Dietary tags: Vegetarian, Vegan, GF, DF, Keto, Paleo, Halal, Kosher, etc.
- Cross-contamination warnings
- Modifier groups: forced vs optional, min/max selections, default selections
- Modifier pricing: included, upcharge, replacement, replacement with upcharge, quantity-based
- Quick-add special (4 fields: name, price, station, category — under 30 seconds)
- Item data: name, short name, description, price, cost, tax class, station routing, prep time, allergens, dietary tags, photo, PLU/barcode, availability windows
- Combo/meal deal builder
- Price types: fixed, market price, open price, weight-based, size-based, time-based

**API Endpoints:**
- `GET /api/v1/menu/categories` — List categories
- `POST /api/v1/menu/categories` — Create category
- `PUT /api/v1/menu/categories/:id` — Update category
- `DELETE /api/v1/menu/categories/:id` — Soft-delete category
- `PATCH /api/v1/menu/categories/reorder` — Reorder categories
- `GET /api/v1/menu/items` — List items
- `POST /api/v1/menu/items` — Create item
- `GET /api/v1/menu/items/:id` — Get item with modifier groups
- `PUT /api/v1/menu/items/:id` — Update item
- `DELETE /api/v1/menu/items/:id` — Soft-delete item
- `PATCH /api/v1/menu/items/:id/86` — Toggle 86 status
- `PATCH /api/v1/menu/items/reorder` — Reorder items
- `GET /api/v1/menu/modifier-groups` — List modifier groups
- `POST /api/v1/menu/modifier-groups` — Create modifier group
- `PUT /api/v1/menu/modifier-groups/:id` — Update modifier group
- `DELETE /api/v1/menu/modifier-groups/:id` — Delete modifier group
- `GET /api/v1/menu/modifiers` — List modifiers
- `POST /api/v1/menu/modifiers` — Create modifier
- `PUT /api/v1/menu/modifiers/:id` — Update modifier
- `DELETE /api/v1/menu/modifiers/:id` — Delete modifier

**UI Pages:**
- Menu Management (3-panel: back-office nav, menu tree, item editor)
- Menu Tree Panel (drag-and-drop reorder, collapsible categories)
- Item Editor Form (name, description, price, category, modifiers, allergens, image, availability)
- Modifier Group Editor (modal)
- 86 Management view

**Database Tables:**
- `menu_categories` — Categories with availability windows, display properties
- `menu_items` — Items with pricing, routing, allergens, availability
- `modifier_groups` — Modifier groups with selection rules
- `modifiers` — Individual modifiers with price adjustments
- `menu_item_modifier_groups` — Join table linking items to modifier groups

---

### Module: core.staff (Users, Roles, Permissions, Time Tracking)

**Features:**
- 12 staff roles: platform_admin, owner, admin, manager, server, bartender, host, kitchen, cashier, kiosk, readonly, plus shift_lead, AGM, expo, busser, delivery_driver, catering_coordinator
- Granular permission system: role-based defaults + per-user overrides
- 4-6 digit PIN for quick clock-in / POS login
- Clock in/out with time tracking
- Break tracking (paid/unpaid)
- Overtime calculation and alerts
- Manager PIN override system for sensitive actions
- Tip tracking: credit card tips, cash tips (self-reported), tip pooling, tip-out percentages
- Tip distribution models: direct (keep own tips minus tipout), pool (by hours/equal/points), hybrid
- Server checkout reports
- Employee scheduling (when scheduling module enabled)
- Shift management
- Time entry approval workflow
- Staff across multiple locations

**API Endpoints:**
- `GET /api/v1/staff/` — List staff members
- `POST /api/v1/staff/` — Create staff member
- `GET /api/v1/staff/:id` — Get staff member
- `PUT /api/v1/staff/:id` — Update staff member
- `DELETE /api/v1/staff/:id` — Deactivate
- `POST /api/v1/staff/clock-in` — Clock in (via PIN)
- `POST /api/v1/staff/clock-out` — Clock out
- `POST /api/v1/staff/break/start` — Start break
- `POST /api/v1/staff/break/end` — End break
- `GET /api/v1/staff/time-entries` — List time entries
- `PUT /api/v1/staff/time-entries/:id` — Edit time entry (manager)
- `POST /api/v1/staff/time-entries/:id/approve` — Approve time entry
- `GET /api/v1/staff/on-duty` — Currently clocked-in staff
- `GET /api/v1/staff/tips` — Tip report for period
- `POST /api/v1/staff/tip-pool/distribute` — Distribute tip pool

**UI Pages:**
- Staff Management (data table + side detail panel)
- Employee Detail Panel (form: name, role, PIN, phone, email, pay rate, permissions)
- Time Clock Report (date range, clock in/out, hours, overtime, breaks, tips)
- Clock In/Out screen (after PIN entry)
- Cash Drawer Count (start/end of shift)

**Database Tables:**
- `users` — Staff profiles with role, PIN hash, location assignments
- `permissions` — Permission definitions
- `role_permissions` — Default permissions per role
- `user_permission_overrides` — Per-user grant/deny overrides
- `shifts` — Shift definitions with summaries
- `time_entries` — Clock in/out records with hours, tips
- `break_entries` — Break records
- `tip_distributions` — Tip distribution records
- `cash_tip_reports` — Cash tip self-reporting

---

### Module: core.reports (Reporting)

**Features:**
- Daily Sales Summary (gross/net sales, by category, by daypart, by payment type, comparison)
- Labor Report (hours, cost, labor %, overtime alerts, break compliance)
- Void/Comp/Discount Report (every transaction with reason codes, patterns)
- Cash Report (opening/closing counts, over/short, by-employee)
- Speed of Service (avg ticket time by station, by daypart, outliers)
- Server Performance (sales, covers, avg check, tip %, upsell rate, table turn time)
- Food Cost Report (theoretical vs actual, variance, waste log)
- Product Mix (PMIX) (quantity sold, revenue, food cost %, profit, menu engineering matrix)
- Tip Distribution Summary
- Reservation & Wait Times
- P&L Summary (monthly)
- Trend Analysis (13-week rolling)
- Employee Performance Reviews Data
- Owner Mobile Dashboard (today's sales, vs last week, labor %, alerts, open checks)
- Auto-email daily summary to owner
- Report export: CSV, PDF

**API Endpoints:**
- `GET /api/v1/reports/sales/daily` — Daily sales
- `GET /api/v1/reports/sales/weekly` — Weekly sales
- `GET /api/v1/reports/sales/monthly` — Monthly sales
- `GET /api/v1/reports/sales/custom` — Custom date range
- `GET /api/v1/reports/sales/hourly` — Hourly breakdown (heatmap)
- `GET /api/v1/reports/product-mix` — Product mix
- `GET /api/v1/reports/category-mix` — Category sales
- `GET /api/v1/reports/server-performance` — Sales by server
- `GET /api/v1/reports/labor` — Labor cost
- `GET /api/v1/reports/discount-summary` — Discount/comp/void summary
- `GET /api/v1/reports/payment-summary` — Payment method breakdown
- `GET /api/v1/reports/tax-report` — Tax liability
- `POST /api/v1/reports/export` — Export (returns job ID)
- `GET /api/v1/reports/export/:job_id` — Check status / download

**UI Pages:**
- Reports Dashboard (KPI cards, hourly sales chart, category pie chart, payment donut)
- Sales Report subpage
- Labor Report subpage
- Menu Mix subpage
- Server Performance subpage
- Voids/Comps/Discounts subpage
- Cash Management subpage
- Speed of Service subpage

**Database Tables:**
- `daily_metrics` — Pre-aggregated daily metrics
- `daily_item_metrics` — Product mix per item per day
- `audit_log` — Comprehensive audit trail

---

### Module: core.settings (Location Config)

**Features:**
- Organization settings (branding, defaults)
- Location settings (address, timezone, currency, business hours, tax rates)
- Terminal management (register, assign type/role, status)
- Printer configuration (receipt, kitchen, test print)
- Module management (enable/disable, configure)
- Role/permission configuration
- Tax rate management (multiple rates, inclusive/exclusive, by category)
- Daypart scheduling
- Auto-gratuity rules
- Tip calculation configuration (pre-tax/post-tax, suggested percentages)
- Surcharging / cash discount configuration

**API Endpoints:**
- `GET /api/v1/settings/organization` — Get org settings
- `PUT /api/v1/settings/organization` — Update org settings
- `GET /api/v1/settings/location/:id` — Get location settings
- `PUT /api/v1/settings/location/:id` — Update location settings
- `GET /api/v1/settings/tax-rates` — List tax rates
- `POST /api/v1/settings/tax-rates` — Create
- `PUT /api/v1/settings/tax-rates/:id` — Update
- `GET /api/v1/settings/terminals` — List terminals
- `POST /api/v1/settings/terminals` — Register
- `PUT /api/v1/settings/terminals/:id` — Update
- `DELETE /api/v1/settings/terminals/:id` — Deactivate
- `GET /api/v1/settings/printers` — List printers
- `POST /api/v1/settings/printers` — Add
- `PUT /api/v1/settings/printers/:id` — Update
- `POST /api/v1/settings/printers/:id/test` — Test print
- `GET /api/v1/settings/modules` — List modules
- `POST /api/v1/settings/modules/:id/enable` — Enable
- `POST /api/v1/settings/modules/:id/disable` — Disable
- `PUT /api/v1/settings/modules/:id/config` — Config
- `GET /api/v1/settings/roles` — List roles/permissions
- `PUT /api/v1/settings/roles/:role/permissions` — Update permissions

**UI Pages:**
- Settings list (left panel) + detail form (right panel)
- Location settings, tax rates, terminals, printers, modules, roles

**Database Tables:**
- `organizations` — Org record with plan, branding, settings JSONB
- `locations` — Location record with address, timezone, business hours, settings JSONB
- `terminals` — Device records with type, status, heartbeat
- `org_modules` — Module enable/disable per org
- `tax_rates` — Tax rate definitions
- `module_migrations` — Module migration tracking

---

## PART 2: AUTHENTICATION MODULE

### Module: Auth

**Features:**
- Email/password login (Supabase Auth)
- PIN-based quick login (terminal context)
- JWT with custom claims (org_id, role, permissions, location_ids)
- Terminal authentication (long-lived terminal token, device fingerprint)
- User session within terminal (PIN-gated, 8-hour expiry)
- Manager PIN override (one-time check for sensitive actions)
- Session management (prevent simultaneous logins)
- MFA for owner/admin roles (TOTP via Supabase Auth)
- IP allowlisting (optional, admin dashboard only)
- Rate limiting (10/min for login, 200/min default)

**API Endpoints:**
- `POST /api/v1/auth/login` — Email/password login
- `POST /api/v1/auth/login/pin` — PIN-based quick login
- `POST /api/v1/auth/refresh` — Refresh JWT
- `POST /api/v1/auth/logout` — Invalidate session
- `POST /api/v1/auth/forgot-password` — Send reset email
- `POST /api/v1/auth/reset-password` — Reset with token
- `GET /api/v1/auth/me` — Current user profile
- `PUT /api/v1/auth/me` — Update profile
- `POST /api/v1/auth/verify-manager-pin` — Verify manager PIN

**UI Pages:**
- PIN Login Screen (staff grid, numpad, PIN dots)
- Terminal Setup (first-time registration)
- Clock In/Out screen
- Manager Login (full username/password form)

---

## PART 3: PAYMENT MODULE

### Module: Payments (Valor PayTech Integration)

**Features:**
- Valor PayTech exclusive integration (REST API + Valor Connect MQTT)
- Card payments: EMV chip, NFC contactless, swipe, manual entry
- Cash payments with change calculation and denomination breakdown
- Gift card payments (Sear-managed balances)
- House account / charge account payments
- Mobile pay (Apple Pay, Google Pay via Valor terminal)
- Multi-tender payment (cash + card + gift card on same check)
- Pre-authorization for bar tabs (configurable hold amount)
- Incremental authorization (increase auth when tab exceeds hold)
- Tip handling: tip-on-receipt (auth then capture with tip), tip-on-screen (customer selects before charge)
- Tip adjustment post-authorization
- Auto-gratuity (service charge, IRS-compliant, configurable)
- Batch settlement (manual or auto at configured time)
- Void before settlement
- Refund after settlement (full or partial)
- Unlinked refund (different card — requires manager)
- Dual Pricing (4% card price, cash discount, legal all 50 states)
- Surcharging configuration (state-by-state compliance)
- Store-and-forward for offline card payments
- Tokenization for saved cards / repeat customers
- 3D Secure for online orders
- Bar tab lifecycle: open, add items, incremental auth, close with tip, walkout handling, auto-close stale tabs
- Split payments: equal, by item, custom amounts, mixed tender
- Chargeback management and representment evidence gathering
- Daily reconciliation and settlement reporting
- Processing fee estimation
- Deposit collection for catering/events

**API Endpoints:**
- `POST /api/v1/payments/` — Process payment
- `GET /api/v1/payments/:id` — Get payment details
- `POST /api/v1/payments/:id/capture` — Capture authorized payment
- `POST /api/v1/payments/:id/void` — Void payment
- `POST /api/v1/payments/:id/refund` — Process refund
- `POST /api/v1/payments/:id/adjust-tip` — Adjust tip
- `POST /api/v1/payments/preauth` — Pre-authorize card
- `GET /api/v1/payments/settlement-report` — End-of-day settlement

**UI Pages:**
- Payment Screen (check summary left, payment method buttons right)
- Card Payment Flow (present card, processing, approved, tip prompt, receipt prompt)
- Cash Payment Flow (numpad, quick amounts, change due display)
- Tip Selection Screen (percentage buttons, custom, no tip)
- Receipt Options (print, email, text, no receipt)

**Database Tables:**
- `payments` — Payment records with method, status, card info, tips
- `payment_transactions` — Detailed transaction records (from payment processing spec)
- `tip_adjustments` — Post-close tip changes
- `gift_cards` — Gift card records with balances
- `gift_card_transactions` — Gift card transaction ledger
- `settlement_batches` — Batch settlement records
- `chargebacks` — Chargeback/dispute tracking
- `customer_payment_methods` — Saved card tokens
- `daily_reconciliations` — Daily financial reconciliation snapshots
- `restaurant_processors` — Processor configuration per restaurant
- `payment_devices` — Payment reader devices
- `surcharge_config` — Surcharging/cash discount configuration
- `tip_config` — Tip calculation and distribution configuration
- `cash_drawers` — Cash drawer records
- `cash_drawer_events` — Cash drawer event log

---

## PART 4: TABLE MANAGEMENT MODULE

### Module: mod.tables (Table Management & Floor Plan)

**Features:**
- Visual floor plan with drag-and-drop table placement (edit mode)
- Table shapes: square, rectangle, circle, booth, bar seat
- Table status colors: available, seated, ordered, entrees served, check presented, needs attention, reserved
- Server section assignments with color-coded background tints
- Table turn time tracking (seated to cleared)
- Seat guests at table
- Clear/mark table available
- Table detail popover (check summary, actions)
- Waitlist and reservation info in bottom status bar
- Capacity tracking (occupied/total tables)
- List view alternative to floor plan
- Multiple floor plans per location (Main Dining, Patio, Bar Area)

**API Endpoints:**
- `GET /api/v1/tables/` — List tables with status
- `GET /api/v1/tables/floor-plans` — List floor plans
- `GET /api/v1/tables/floor-plans/:id` — Get floor plan with tables
- `PUT /api/v1/tables/floor-plans/:id` — Update floor plan layout
- `POST /api/v1/tables/floor-plans` — Create floor plan
- `POST /api/v1/tables/:id/seat` — Seat guests
- `POST /api/v1/tables/:id/clear` — Clear table
- `PUT /api/v1/tables/:id/status` — Update status
- `GET /api/v1/tables/:id/history` — Turn history
- `GET /api/v1/tables/sections` — Server section assignments
- `PUT /api/v1/tables/sections` — Update sections

**UI Pages:**
- Floor Plan View (visual table layout with status colors)
- Table Detail Popover (check info, actions)
- List View (sortable table list)
- Edit Mode (drag-and-drop table placement)

**Database Tables:**
- `floor_plans` — Floor plan definitions with canvas dimensions
- `tables` — Table records with position, shape, capacity, status, section

---

## PART 5: OPTIONAL MODULES

### Module: mod.kds (Kitchen Display System)

**Features:**
- Station-based routing (grill, saute, fry, cold, bar, expo, dessert)
- Multi-station item coordination (steak frites = grill + fry)
- Ticket aging with color-coded timers (green → yellow → orange → red → flashing red)
- Configurable time thresholds per restaurant/category/item
- All-day counts per station (aggregate of items being cooked)
- Expo screen (full ticket view, track all stations)
- Bump items/tickets (mark complete)
- Recall bumped items
- Course management (FIRE / HOLD / RUSH)
- Re-fire workflow with reason codes
- Allergy alerts (prominent, cannot be dismissed, full-width red banner)
- VIP and special request flags
- "Ready to run" notification to servers
- Kitchen load/capacity indicator (percentage, ticket count)
- Station-to-expo messaging
- Ticket priority: RE-FIRE → RUSH → VIP → Normal
- Audio alerts (new ticket chime, late ticket alert)
- Printer fallback for KDS failure
- "86 Imminent" alerts
- Kitchen close function
- Multi-brand support (ghost kitchen, color-coded by brand)

**API Endpoints:**
- `GET /api/v1/kds/stations` — List KDS stations
- `POST /api/v1/kds/stations` — Create station
- `PUT /api/v1/kds/stations/:id` — Update station config
- `GET /api/v1/kds/stations/:id/tickets` — Active tickets for station
- `POST /api/v1/kds/tickets/:item_id/bump` — Bump item
- `POST /api/v1/kds/tickets/:order_id/bump-all` — Bump entire order
- `POST /api/v1/kds/tickets/:item_id/recall` — Recall bumped item
- `GET /api/v1/kds/metrics` — Performance metrics

**UI Pages:**
- KDS Station View (full screen, no chrome, horizontal ticket scroll)
- Expo Screen (all tickets from all stations)
- All-Day Panel (expandable aggregate counts)
- Recall Panel (recently bumped tickets)

**Database Tables:**
- `kds_stations` — Station definitions with routing rules
- `kds_ticket_events` — Ticket lifecycle events (received, started, bumped, recalled)

---

### Module: mod.inventory (Inventory Management)

**Features:**
- Inventory items with units of measure, par levels, reorder points
- Recipe/ingredient linking (menu item → inventory items with quantities)
- Purchase orders (draft, submitted, partial, received, cancelled)
- Vendor management
- Inventory counts
- Manual adjustments
- Waste tracking with reason codes
- Food cost calculation (theoretical vs actual)
- Low stock alerts
- Prep list generation from reservation forecast + historical data
- Inventory transactions (receive, waste, transfer, count, sale deduction)

**API Endpoints:**
- `GET /api/v1/inventory/items` — List items
- `POST /api/v1/inventory/items` — Create
- `PUT /api/v1/inventory/items/:id` — Update
- `POST /api/v1/inventory/items/:id/count` — Record count
- `POST /api/v1/inventory/items/:id/adjust` — Manual adjustment
- `GET /api/v1/inventory/items/low-stock` — Below par level
- `GET /api/v1/inventory/vendors` — List vendors
- `POST /api/v1/inventory/vendors` — Create vendor
- `GET /api/v1/inventory/purchase-orders` — List POs
- `POST /api/v1/inventory/purchase-orders` — Create PO
- `POST /api/v1/inventory/purchase-orders/:id/receive` — Receive PO
- `GET /api/v1/inventory/recipes` — List recipes
- `POST /api/v1/inventory/recipes` — Create recipe
- `GET /api/v1/inventory/waste-log` — Waste report
- `POST /api/v1/inventory/waste` — Record waste

**Database Tables:**
- `inventory_items` — Inventory records with quantities, par levels
- `inventory_transactions` — Transaction ledger
- `recipes` — Menu item to inventory item mapping
- `vendors` — Vendor records
- `purchase_orders` — PO headers
- `purchase_order_items` — PO line items

---

### Module: mod.loyalty (Loyalty & Rewards)

**Features:**
- Program types: points, visits, spend-based
- Points per dollar / per visit configuration
- Redemption thresholds and reward values
- Tier system: bronze, silver, gold, platinum
- Loyalty account per customer
- Earn/redeem/adjust/expire transactions
- Cross-location loyalty
- Phone number enrollment at checkout (no app download required)

**API Endpoints (from CLAUDE.md — 10 routes):**
- Points/visits/spend tracking
- Tiers and rewards
- Cross-location support

**Database Tables:**
- `loyalty_programs` — Program definitions
- `loyalty_accounts` — Customer loyalty accounts with balances, tiers
- `loyalty_transactions` — Transaction ledger

---

### Module: mod.reservations (Reservations & Waitlist)

**Features:**
- Reservation creation, update, cancel, confirm
- Waitlist management with estimated wait times
- SMS reminders and "table ready" notifications
- Table assignment for reservations
- No-show tracking
- Availability checking
- Reservation status: pending, confirmed, seated, completed, no_show, cancelled

**API Endpoints:**
- `GET /api/v1/reservations/` — List reservations
- `POST /api/v1/reservations/` — Create
- `PUT /api/v1/reservations/:id` — Update
- `DELETE /api/v1/reservations/:id` — Cancel
- `POST /api/v1/reservations/:id/seat` — Mark seated
- `POST /api/v1/reservations/:id/no-show` — Mark no-show
- `POST /api/v1/reservations/:id/confirm` — Send confirmation
- `GET /api/v1/reservations/waitlist` — Current waitlist
- `POST /api/v1/reservations/waitlist` — Add to waitlist
- `PUT /api/v1/reservations/waitlist/:id` — Update entry
- `POST /api/v1/reservations/waitlist/:id/notify` — Notify guest
- `POST /api/v1/reservations/waitlist/:id/seat` — Seat from waitlist
- `GET /api/v1/reservations/availability` — Check slots

**Database Tables:**
- `reservations` — Reservation records
- `waitlist_entries` — Waitlist records

---

### Module: mod.online_ordering (Online Ordering)

**Features:**
- Commission-free online ordering
- Public-facing menu with slug-based URLs
- Online-specific pricing overrides
- Order queue management (accept/reject/prepare)
- Estimated ready time
- Customer notification when ready
- Order throttling (extend times or pause when kitchen overwhelmed)
- QR code ordering
- Scheduled orders
- Integration with DoorDash, Uber Eats, Grubhub as order sources

**Database Tables:**
- `online_menus` — Online menu configurations
- `online_menu_items` — Items available online with price overrides
- `online_order_queue` — Order processing queue

---

### Module: mod.scheduling (Staff Scheduling)

**Features:**
- Schedule templates ("Default Week", "Holiday Week")
- Scheduled shifts per employee with role, date, time
- Shift status: scheduled, confirmed, swap_requested, swapped, called_out, no_show
- Shift swap requests with manager approval
- Employee availability tracking
- Schedule publishing (draft vs visible)
- Labor cost forecasting based on schedule

**Database Tables:**
- `schedule_templates` — Template definitions
- `scheduled_shifts` — Shift assignments
- `shift_swap_requests` — Swap request records
- `availability` — Employee availability by day/time

---

### Module: mod.marketing (Marketing & Campaigns)

**Features:**
- Campaign types: email, SMS, push, email+SMS
- Campaign lifecycle: draft, scheduled, sending, sent, paused, cancelled
- Target segmentation (min visits, last visit within days, tags)
- Recipient tracking (sent, delivered, opened, clicked, bounced, unsubscribed)
- Attached discount/offer
- Stats: recipients, opened, clicked, redeemed

**Database Tables:**
- `campaigns` — Campaign definitions
- `campaign_recipients` — Per-recipient tracking

---

### Module: mod.delivery (Delivery Management)

**Features:**
- Delivery zones (GeoJSON polygons) with fees and minimum orders
- Driver assignment and tracking (GPS lat/lng)
- Delivery status: pending, assigned, picked_up, en_route, delivered, failed
- Estimated vs actual delivery time
- Delivery instructions
- Proof of delivery (photo, signature)

**Database Tables:**
- `delivery_zones` — Zone definitions
- `deliveries` — Delivery records with tracking

---

### Module: mod.gift_cards (Gift Cards)

**Features:**
- Physical and digital gift cards
- 16-digit card numbers, PIN optional
- Activation, redemption, reload, balance check
- Partial redemption (apply available balance, collect rest via other method)
- Digital card email delivery
- Transaction history per card
- Cross-location gift card support
- Expiration tracking (state law compliance)

---

### Module: mod.catering (Catering Management)

**Features:**
- Event lifecycle: inquiry → proposal → confirmation → BEO → execution → billing
- Event builder with per-head pricing tiers, itemized pricing
- Beverage packages (open bar, limited, consumption-based)
- Staffing charges and rental charges
- Service charge calculation (20-22%)
- PDF proposal generation
- Deposit collection and payment processing
- BEO (Banquet Event Order) generation and distribution
- Prep list auto-generation from BEO
- Day-of-event dashboard
- Post-event billing (guaranteed minimum, consumption bar, add-ons)
- Invoice generation
- Multiple revision tracking
- Catering calendar

---

### Module: mod.customers (Customer Management / CRM)

**Features:**
- Customer profiles: name, email, phone, notes, tags
- VIP tagging
- Allergen storage per customer (auto-populates on seating)
- Visit tracking: total visits, total spent, average check, last visit
- Marketing opt-in
- Birthday/anniversary tracking
- Order history per customer
- Customer lookup by phone/email
- Merge duplicate records
- Customer addresses for delivery

**API Endpoints:**
- `GET /api/v1/customers/` — Search/list
- `POST /api/v1/customers/` — Create
- `GET /api/v1/customers/:id` — Get with history
- `PUT /api/v1/customers/:id` — Update
- `GET /api/v1/customers/:id/orders` — Order history
- `GET /api/v1/customers/:id/loyalty` — Loyalty account
- `POST /api/v1/customers/lookup` — Lookup by phone/email
- `POST /api/v1/customers/merge` — Merge duplicates

**Database Tables:**
- `customers` — Customer profiles with stats
- `customer_addresses` — Delivery addresses

---

### Module: mod.drive_thru (Drive-Through)

**Features:**
- Dual-lane ordering
- Order confirmation display at order point
- Car tracking (lane, position at window)
- Speed-of-service timers (order to car leaving window, target 180 seconds)
- "Pull forward" orders for delayed items
- Pre-sell boards / suggestive selling prompts

---

### Module: mod.kiosk (Self-Service Kiosk)

**Features:**
- Simplified touch-friendly interface
- Category browsing with photos (required for kiosk)
- Allergen filters
- Upsell prompts
- Order review screen
- Card/tap payment only (no cash)
- Order number assignment and receipt
- Accessibility: text size, screen reader, wheelchair height
- Language selection
- Timeout (60 seconds inactivity → attract screen)
- Staff alert on error

---

## PART 6: REAL-TIME & INFRASTRUCTURE

### Real-Time Communication

**Features:**
- Supabase Realtime (WebSocket) for: order updates, table status, 86 notifications, KDS
- SSE (Server-Sent Events) fallback
- Local network relay for offline intra-restaurant communication
- Channels: `orders:{locationId}`, `86:{locationId}`, `tables:{locationId}`

**Real-Time Events:**
- `SSE /api/v1/events/orders` — Order status changes
- `SSE /api/v1/events/kds` — Kitchen ticket feed
- `SSE /api/v1/events/tables` — Table status changes
- `SSE /api/v1/events/86` — 86 notifications

---

### Offline-First Architecture

**Features:**
- Service Worker + IndexedDB for client-side data
- Local SQLite relay (Raspberry Pi or mini-PC) for intra-restaurant communication
- Offline order entry, cash payments, table management, clock in/out
- Store-and-forward for card payments
- Sync queue with conflict resolution on reconnect
- Offline mode banner / indicator
- Menu cached locally in IndexedDB

---

### Background Jobs (Celery/BullMQ)

**Scheduled Tasks:**
- Daily metrics aggregation (4 AM)
- Stale session cleanup (every 30 min)
- Sync offline relays (every 5 min)
- Gift card expiration check (6 AM)
- Low stock alerts (every 4 hours)
- Send receipt emails
- Send SMS notifications
- Generate reports async
- Process async event hooks

---

## PART 7: COMPLETE DATABASE TABLE LIST

### Core Tables
1. `organizations`
2. `locations`
3. `terminals`
4. `org_modules`
5. `module_migrations`
6. `users`
7. `permissions`
8. `role_permissions`
9. `user_permission_overrides`
10. `menu_categories`
11. `menu_items`
12. `modifier_groups`
13. `modifiers`
14. `menu_item_modifier_groups`
15. `tax_rates`
16. `orders`
17. `order_items`
18. `order_item_modifiers`
19. `order_modifications`
20. `payments`
21. `tip_adjustments`
22. `discounts`
23. `order_discounts`
24. `floor_plans`
25. `tables`
26. `customers`
27. `customer_addresses`
28. `shifts`
29. `time_entries`
30. `break_entries`
31. `cash_drawers`
32. `cash_drawer_events`
33. `gift_cards`
34. `gift_card_transactions`
35. `audit_log`

### Module Tables
36. `kds_stations` (mod.kds)
37. `kds_ticket_events` (mod.kds)
38. `inventory_items` (mod.inventory)
39. `inventory_transactions` (mod.inventory)
40. `recipes` (mod.inventory)
41. `vendors` (mod.inventory)
42. `purchase_orders` (mod.inventory)
43. `purchase_order_items` (mod.inventory)
44. `loyalty_programs` (mod.loyalty)
45. `loyalty_accounts` (mod.loyalty)
46. `loyalty_transactions` (mod.loyalty)
47. `online_menus` (mod.online_ordering)
48. `online_menu_items` (mod.online_ordering)
49. `online_order_queue` (mod.online_ordering)
50. `reservations` (mod.reservations)
51. `waitlist_entries` (mod.reservations)
52. `schedule_templates` (mod.scheduling)
53. `scheduled_shifts` (mod.scheduling)
54. `shift_swap_requests` (mod.scheduling)
55. `availability` (mod.scheduling)
56. `campaigns` (mod.marketing)
57. `campaign_recipients` (mod.marketing)
58. `delivery_zones` (mod.delivery)
59. `deliveries` (mod.delivery)
60. `daily_metrics` (mod.analytics)
61. `daily_item_metrics` (mod.analytics)

### Payment-Specific Tables (from Part 6)
62. `payment_transactions` (detailed transaction records)
63. `restaurant_processors` (processor config)
64. `payment_devices` (reader devices)
65. `settlement_batches` (batch settlement)
66. `chargebacks` (dispute tracking)
67. `surcharge_config` (surcharge/cash discount)
68. `tip_config` (tip rules)
69. `tip_distributions` (tip payout records)
70. `cash_tip_reports` (self-reported cash tips)
71. `daily_reconciliations` (daily financial snapshots)
72. `customer_payment_methods` (saved card tokens)

---

## PART 8: ALL UI SCREENS SPECIFIED

1. **PIN Login Screen** — Staff grid, numpad, PIN dots
2. **Terminal Setup** — First-time device registration
3. **Clock In/Out** — After PIN, clock in button, time display
4. **Cash Drawer Count** — Denomination counting, start-of-shift
5. **Main POS Order Entry** — PRIMARY SCREEN (menu grid + order panel + category tabs)
6. **Modifier Selection** — Slide-over panel with modifier groups
7. **Item Edit Popover** — Quantity, modifiers, instructions, void
8. **Table Management / Floor Plan** — Visual floor plan with table status
9. **Table Detail Popover** — Check info, actions
10. **Check Management List** — All open checks
11. **Check Detail View** — Itemized check with seat grouping
12. **Split Check Interface** — Drag items between checks
13. **Payment Screen** — Payment method selection
14. **Card Payment Flow** — Present card → processing → approved → tip → receipt
15. **Cash Payment Flow** — Numpad → quick amounts → change due
16. **KDS Station View** — Full-screen ticket display
17. **Expo Screen** — All stations, all tickets
18. **Reports Dashboard** — KPI cards, charts, date selectors
19. **Report Subpages** — Sales, Labor, Menu Mix, Server Perf, Voids, Cash, Speed
20. **Menu Management** — 3-panel: nav, tree, editor
21. **Modifier Group Editor** — Modal form
22. **Staff Management** — Data table + detail panel
23. **Employee Detail** — Form with permissions
24. **Time Clock Report** — Date range, punch times, hours
25. **Settings** — List + detail form pattern

---

## PART 9: INTEGRATIONS SPECIFIED

### Required (Tier 1)
1. **Valor PayTech** — Payment processing (REST API + Valor Connect MQTT)
2. **Supabase** — Database, Auth, Realtime, Storage
3. **Twilio** — SMS (order ready, reservations, waitlist, marketing)
4. **SendGrid** — Email (receipts, reports, marketing)

### Required (Tier 2)
5. **QuickBooks / Xero** — Accounting (auto-export daily sales)
6. **7shifts / HotSchedules / Homebase** — Scheduling
7. **ADP / Gusto / Paychex** — Payroll (export timecards, tips)
8. **OpenTable / Resy** — Reservations (bidirectional sync)
9. **DoorDash / Uber Eats / Grubhub** — Delivery platforms (receive orders)

### Hardware
10. **Star Micronics / Epson** — Receipt printers (ESC/POS)
11. **Valor VP800/VP550/VP300 Pro/RCKT/VL500** — Payment terminals
12. **Standard cash drawers** — RJ-11 trigger via printer
13. **Barcode scanners** — Bluetooth/USB
14. **Scales** — Bluetooth/USB for weight-based items

---

## PART 10: OPERATIONAL SCENARIOS SPECIFIED

1. Server drops iPad mid-service — Data recovery, spare device
2. Internet goes down during dinner rush — Full offline mode spec
3. Guest claims double charge — Transaction investigation workflow
4. Kitchen runs out of salmon — 86 cascade process
5. Large party splits check 8 ways — Complex split with shared items
6. Multi-tender payment — Cash + card + gift card
7. Server transfers tables mid-shift — Transfer workflow with tip handling
8. Manager voids item sent 20 minutes ago — Void vs comp decision tree
9. Customer disputes auto-gratuity — Legal context, removal workflow
10. Power outage — Data persistence, battery operations
11. Guest has severe allergy — Allergen flagging, kitchen protocol
12. Wrong food sent to wrong table — Re-fire workflow
13. Customer walks out without paying — Walkout procedure
14. Happy hour pricing change mid-week — Daypart management
15. New menu item added during service — Quick-add workflow
