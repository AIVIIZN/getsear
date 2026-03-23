# Sear POS v4 — Phase 11: All Optional Modules to Production Depth

**Date:** 2026-03-23
**Phase:** 11 of 13
**Priority:** LOWER — weeks 3-4
**Estimated Sessions:** 4-6
**Depends On:** Phase 1 (Orders), Phase 2 (Payments), Phase 6 (Staff), Phase 7 (Reports), Phase 8 (Integrations)

---

## 1.1 What is this?

Every optional module in Sear POS currently exists as CRUD scaffolding — they have API routes that insert rows and pages that render tables. None of them deliver the depth a restaurant operator would actually pay for. This phase takes each module from "database form" to "real product feature" with complete workflows, production integrations, and polished UI.

There are 10 sub-phases, one per module. Each sub-phase is self-contained and can be built independently. Order of build should follow revenue impact: Inventory and Loyalty first (highest value to operators), then Online Ordering and Marketing (revenue generators), then the rest.

**Current state of each module:**
- **Inventory:** 7 API routes (`/api/inventory/*`), basic items/PO CRUD page at `src/app/(backoffice)/inventory/page.tsx`
- **Loyalty:** 7 API routes (`/api/loyalty/*`), basic program/account CRUD page at `src/app/(backoffice)/loyalty/page.tsx`
- **Online Ordering:** 7 API routes (`/api/online-ordering/*`), settings page at `src/app/(backoffice)/online-ordering/page.tsx`
- **Marketing:** 5 API routes (`/api/marketing/*`), campaigns page at `src/app/(backoffice)/marketing/page.tsx`
- **Delivery:** 6 API routes (`/api/delivery/*`), page at `src/app/(backoffice)/delivery/page.tsx`
- **Catering:** 5 API routes (`/api/catering/*`), page at `src/app/(backoffice)/catering/page.tsx`
- **Scheduling:** 8 API routes (`/api/scheduling/*`), page at `src/app/(backoffice)/scheduling/page.tsx`
- **Drive-Thru:** 5 API routes (`/api/drive-thru/*`), page at `src/app/(backoffice)/drive-thru/page.tsx`
- **House Accounts:** 5 API routes (`/api/house-accounts/*`), page at `src/app/(backoffice)/house-accounts/page.tsx`
- **Franchise:** 6 API routes (`/api/franchise/*`), page at `src/app/(backoffice)/franchise/page.tsx`

**Read these files BEFORE planning:**
- `CLAUDE.md` — project config, all 21 modules listed
- `SCHEMA.md` — database tables for each module
- `API_SPEC.md` — all routes per module
- `MODULE_SPECS/` — 21 individual module specification files
- `BUSINESS_RULES.md` — operational logic per module
- `UI_DESIGN.md` — design system tokens

---

## 1.2 Tech stack

No changes to core stack. Module-specific additions:

- **Twilio** — SMS for marketing campaigns, loyalty enrollment confirmation
- **SendGrid** — Email for marketing campaigns, catering proposals, house account statements
- **jsPDF / @react-pdf/renderer** — PDF generation for BEOs, invoices, proposals, statements
- **QRCode.react** — QR code generation for online ordering
- **Recharts** — Charts for inventory food cost, delivery metrics, franchise reports
- **Leaflet / Mapbox GL** — Delivery GPS tracking map
- **date-fns** — Scheduling calendar utilities
- **@dnd-kit** — Shift scheduling drag-and-drop

---

## 1.3 User roles

| Role | Modules they interact with |
|------|---------------------------|
| **Owner** | All modules — configuration and reporting |
| **Manager** | Inventory (counts, POs), Scheduling (create shifts), Catering (manage events), Franchise (view reports) |
| **Server** | Loyalty (enroll at checkout), Online Ordering (accept/reject queue) |
| **Kitchen** | Inventory (waste logging), Catering (BEO view) |
| **Delivery Driver** | Delivery (assigned deliveries, GPS tracking, proof of delivery) |
| **Host** | Online Ordering (view incoming online orders) |
| **Public** | Online Ordering (customer-facing ordering page), Reservation widget |

---

## 1.4 Pages and features

---

### SUB-PHASE 11A: INVENTORY

**Page: Inventory Dashboard**
- **Who:** Manager, Owner
- **What:** Overview with 4 KPI cards (Total SKUs, Low Stock Alerts, Open POs, Current Food Cost %), list of low-stock items, recent waste entries
- **Link:** From sidebar under Modules

**Page: Inventory Items**
- **Who:** Manager, Owner
- **What:** Full item list with current count, par level, unit cost, variance indicator
- **Actions:** Adjust count, set par level, view usage history, link to menu items (recipe)

**Feature: Waste Tracking**
- **What:** Staff logs waste events: select item, enter quantity, select reason (expired, dropped, returned, overproduction, other), optional photo, optional notes
- **Reporting:** Waste by category, by reason, by daypart, by employee, total dollar value
- **UI:** Quick-entry form accessible from inventory dashboard + kitchen-facing waste log shortcut

**Feature: Food Cost Calculation**
- **What:** Theoretical food cost computed from recipes (menu item → ingredients → unit costs) vs actual food cost (purchases - ending inventory + beginning inventory)
- **Report:** Food cost % by category, by item, variance (theoretical vs actual)
- **Alert:** If actual food cost exceeds theoretical by configurable threshold (default 3%), alert fires

**Feature: Low Stock Alerts**
- **What:** When item count falls below par level, alert appears on inventory dashboard + optional push notification to manager
- **Auto-86:** If item count hits zero and auto-86 is enabled, item is 86'd on POS with Realtime propagation

**Feature: Prep List Generation**
- **What:** Based on par levels, current counts, and projected demand (historical sales by day-of-week), generate a prep list showing what needs to be made/ordered
- **Output:** Printable prep list with item name, current count, par level, prep quantity needed
- **Schedule:** Auto-generate at configurable time (default 6 AM) via BullMQ job

#### 11A Files to CREATE

| # | File | Purpose |
|---|------|---------|
| 1 | `src/components/inventory/InventoryDashboard.tsx` | KPI cards, low stock alerts, recent waste |
| 2 | `src/components/inventory/WasteLogForm.tsx` | Quick waste entry form with reason codes |
| 3 | `src/components/inventory/FoodCostReport.tsx` | Theoretical vs actual food cost with variance |
| 4 | `src/components/inventory/PrepListView.tsx` | Auto-generated prep list with print option |
| 5 | `src/components/inventory/LowStockAlerts.tsx` | Alert cards for items below par |
| 6 | `src/components/inventory/InventoryCountSheet.tsx` | Count entry form for physical inventory |
| 7 | `src/app/api/inventory/waste/route.ts` | CRUD for waste log entries |
| 8 | `src/app/api/inventory/food-cost/route.ts` | Food cost calculation endpoint |
| 9 | `src/app/api/inventory/prep-list/route.ts` | Prep list generation endpoint |
| 10 | `src/app/api/inventory/alerts/route.ts` | Low stock alert retrieval |
| 11 | `src/stores/inventory-store.ts` | Inventory Zustand store |
| 12 | `src/lib/inventory/food-cost-calc.ts` | Food cost calculation utilities |
| 13 | `src/lib/inventory/prep-list-gen.ts` | Prep list generation logic |

#### 11A Files to MODIFY

| # | File | What changes |
|---|------|-------------|
| 1 | `src/app/(backoffice)/inventory/page.tsx` | Replace CRUD table with full dashboard + tabs (Items, Waste, Food Cost, Prep List, POs) |
| 2 | `src/app/api/inventory/items/[id]/count/route.ts` | Add auto-86 trigger when count hits zero |
| 3 | `src/app/api/inventory/items/route.ts` | Add par level, alert threshold fields |

---

### SUB-PHASE 11B: LOYALTY

**Page: Loyalty Dashboard**
- **Who:** Manager, Owner
- **What:** KPIs (Active Members, Points Issued Today, Rewards Redeemed Today, Program ROI), member growth chart, top members list

**Page: Loyalty Program Config**
- **Who:** Owner
- **What:** Configure earn rules (points per dollar, points per visit, points per specific item), tier thresholds (Bronze/Silver/Gold/Platinum), rewards catalog (free item, discount %, dollar off)

**Feature: Phone Enrollment at Checkout**
- **What:** During payment flow, server taps "Loyalty" → enters customer phone → if existing member: show points balance + available rewards → apply reward if desired. If new: auto-enroll with phone number, earn points on this transaction.
- **UI:** Inline panel in payment flow, not a separate page. Phone number input with numpad. Balance display. Reward selector.

**Feature: Tier Management**
- **What:** Visual tier editor: set tier names, point thresholds, benefits per tier (earn multiplier, birthday reward, early access)
- **Display:** Progress bar showing customer's path to next tier

**Feature: Cross-Location Earn/Redeem**
- **What:** Points earned at Location A are redeemable at Location B (within same org). Balance is org-level, not location-level.
- **Sync:** Real-time via Supabase — no stale balances

#### 11B Files to CREATE

| # | File | Purpose |
|---|------|---------|
| 1 | `src/components/loyalty/LoyaltyDashboard.tsx` | Program KPIs and member overview |
| 2 | `src/components/loyalty/TierEditor.tsx` | Visual tier configuration |
| 3 | `src/components/loyalty/RewardsCatalog.tsx` | Reward creation and management |
| 4 | `src/components/loyalty/CheckoutLoyalty.tsx` | Inline loyalty panel for payment flow |
| 5 | `src/components/loyalty/MemberLookup.tsx` | Phone-based member search/enroll |
| 6 | `src/components/loyalty/PointsHistory.tsx` | Transaction-level points history for a member |
| 7 | `src/stores/loyalty-store.ts` | Loyalty Zustand store |
| 8 | `src/app/api/loyalty/enroll/route.ts` | Phone-based quick enrollment |
| 9 | `src/app/api/loyalty/lookup/route.ts` | Look up member by phone |
| 10 | `src/app/api/loyalty/dashboard/route.ts` | Dashboard KPI aggregation |

#### 11B Files to MODIFY

| # | File | What changes |
|---|------|-------------|
| 1 | `src/app/(backoffice)/loyalty/page.tsx` | Replace CRUD with dashboard + tabs (Dashboard, Programs, Members, Rewards, Tiers) |
| 2 | `src/app/(pos)/payments/page.tsx` | Add loyalty panel integration in payment flow |
| 3 | `src/app/api/loyalty/accounts/[id]/earn/route.ts` | Ensure cross-location earning works (org-level) |
| 4 | `src/app/api/loyalty/accounts/[id]/redeem/route.ts` | Ensure cross-location redemption works |

---

### SUB-PHASE 11C: ONLINE ORDERING

**Page: Customer-Facing Ordering Page (PUBLIC)**
- **Who:** Public (restaurant customers)
- **Route:** `/order/[location-slug]` — no auth required
- **What:** Full menu browsing → item customization (modifiers) → cart → checkout (name, phone, pickup time or delivery address) → payment → confirmation
- **Layout:** Mobile-first responsive. Menu categories as horizontal tabs. Item cards with photo, name, price, description. Tap to customize. Sticky cart summary at bottom.

**Feature: QR Code Flow**
- **What:** Restaurant generates QR codes (per table for dine-in, general for takeout) → customer scans → opens ordering page → orders go to POS queue
- **Settings:** QR code generator in online ordering settings. Download as PNG. Print as table tent.

**Feature: Scheduled Orders**
- **What:** Customer selects future pickup/delivery time (today or tomorrow, within operating hours, 15min slots). Order enters queue at configurable lead time before scheduled time.
- **Throttling:** Configurable max online orders per 15min slot to prevent kitchen overwhelm

**Feature: Order Queue Management**
- **What:** Staff-facing queue showing incoming online orders. Accept → goes to KDS. Reject → customer notified with reason. Adjust prep time estimate.

#### 11C Files to CREATE

| # | File | Purpose |
|---|------|---------|
| 1 | `src/app/order/[slug]/page.tsx` | Public customer-facing ordering page |
| 2 | `src/app/order/[slug]/layout.tsx` | Public layout (no auth, restaurant branding) |
| 3 | `src/app/order/[slug]/cart/page.tsx` | Cart review and checkout |
| 4 | `src/app/order/[slug]/confirmation/page.tsx` | Order confirmation with tracking |
| 5 | `src/components/online-ordering/PublicMenuGrid.tsx` | Customer-facing menu grid |
| 6 | `src/components/online-ordering/PublicItemCard.tsx` | Menu item card with photo and modifiers |
| 7 | `src/components/online-ordering/CartSummary.tsx` | Sticky cart summary |
| 8 | `src/components/online-ordering/CheckoutForm.tsx` | Name, phone, time, payment |
| 9 | `src/components/online-ordering/QRCodeGenerator.tsx` | QR code creation for tables/takeout |
| 10 | `src/components/online-ordering/OrderQueuePanel.tsx` | Staff-facing incoming order queue |
| 11 | `src/app/api/online-ordering/public/menu/route.ts` | Public menu fetch (no auth) |
| 12 | `src/app/api/online-ordering/public/order/route.ts` | Public order submission (rate-limited) |
| 13 | `src/app/api/online-ordering/qr/route.ts` | QR code generation endpoint |
| 14 | `src/stores/online-ordering-store.ts` | Cart and ordering Zustand store |

#### 11C Files to MODIFY

| # | File | What changes |
|---|------|-------------|
| 1 | `src/app/(backoffice)/online-ordering/page.tsx` | Add QR code generator, order queue, scheduling config |
| 2 | `src/app/api/online-ordering/queue/route.ts` | Add throttling logic, scheduled order support |
| 3 | `src/app/api/online-ordering/queue/[id]/accept/route.ts` | Route accepted orders to KDS |
| 4 | `src/app/api/online-ordering/settings/route.ts` | Add throttle limits, scheduling windows, QR settings |

---

### SUB-PHASE 11D: MARKETING

**Page: Marketing Dashboard**
- **Who:** Manager, Owner
- **What:** Campaign list with status (Draft, Scheduled, Sent, Completed), total reach, open rate, click rate. Create Campaign button.

**Feature: Campaign Builder**
- **What:** Step-by-step: Select channel (SMS/Email/Both) → Select segment (all customers, loyalty members, lapsed 30d, custom filter) → Build content (template editor with merge fields: {first_name}, {points_balance}, {last_visit}) → Preview → Schedule or Send Now
- **Templates:** 6 pre-built templates: New Menu Item, Happy Hour Special, Holiday Hours, Loyalty Bonus, Feedback Request, Re-engagement

**Feature: Real Send Integration**
- **What:** SMS sends through Twilio. Email sends through SendGrid. Not mocked. Actual delivery with tracking.
- **Compliance:** Unsubscribe link in every email. STOP handling for SMS. Consent tracking per customer.

**Feature: Campaign Preview**
- **What:** Before sending, preview exactly what the SMS/email will look like with real customer data (pulls first matching customer from segment for preview)

#### 11D Files to CREATE

| # | File | Purpose |
|---|------|---------|
| 1 | `src/components/marketing/CampaignBuilder.tsx` | Multi-step campaign creation wizard |
| 2 | `src/components/marketing/TemplateEditor.tsx` | Content editor with merge fields |
| 3 | `src/components/marketing/CampaignPreview.tsx` | SMS/email preview with real data |
| 4 | `src/components/marketing/SegmentBuilder.tsx` | Customer segment filter builder |
| 5 | `src/components/marketing/CampaignList.tsx` | Campaign list with status and metrics |
| 6 | `src/app/api/marketing/campaigns/route.ts` | Campaign CRUD |
| 7 | `src/app/api/marketing/campaigns/[id]/preview/route.ts` | Campaign preview with real data |
| 8 | `src/app/api/marketing/templates/route.ts` | Pre-built template library |
| 9 | `src/lib/marketing/send-campaign.ts` | Twilio + SendGrid campaign dispatch |
| 10 | `src/lib/marketing/merge-fields.ts` | Merge field resolution for templates |

#### 11D Files to MODIFY

| # | File | What changes |
|---|------|-------------|
| 1 | `src/app/(backoffice)/marketing/page.tsx` | Replace CRUD with dashboard + campaign builder |
| 2 | `src/app/api/marketing/campaigns/[id]/send/route.ts` | Wire to real Twilio/SendGrid send |
| 3 | `src/app/api/marketing/segments/route.ts` | Add filter builder query support |
| 4 | `src/app/api/marketing/segments/count/route.ts` | Real count from customer filter |

---

### SUB-PHASE 11E: DELIVERY

**Page: Delivery Dashboard**
- **Who:** Manager, Owner
- **What:** Active deliveries map (GPS dots), delivery queue (pending, assigned, en route, delivered), driver list with status, KPIs (avg delivery time, on-time %, active deliveries)

**Feature: Real-Time GPS Tracking**
- **What:** Driver app (mobile web view) reports GPS coordinates every 30 seconds. Map updates in real-time. Customer can see "Your driver is X minutes away" on confirmation page.
- **Tech:** Supabase Realtime for GPS coordinate updates. Leaflet/Mapbox for map rendering.

**Feature: Proof of Delivery**
- **What:** Driver marks delivery complete → prompted to take photo → photo uploaded → attached to delivery record. Customer receives SMS "Your order has been delivered."

**Feature: Third-Party Integration Hooks**
- **What:** Webhook endpoints for DoorDash Drive, Uber Direct, etc. Incoming order webhook → creates delivery in Sear. Status update webhook → updates delivery status.
- **Config:** Settings page to configure webhook URLs, API keys, auto-accept rules

#### 11E Files to CREATE

| # | File | Purpose |
|---|------|---------|
| 1 | `src/components/delivery/DeliveryMap.tsx` | Real-time GPS tracking map |
| 2 | `src/components/delivery/DeliveryQueue.tsx` | Pending/active delivery list |
| 3 | `src/components/delivery/DriverList.tsx` | Driver status and assignment |
| 4 | `src/components/delivery/ProofOfDelivery.tsx` | Photo capture and upload |
| 5 | `src/app/api/delivery/track/[id]/route.ts` | Public delivery tracking endpoint |
| 6 | `src/app/api/delivery/gps/route.ts` | GPS coordinate submission (driver app) |
| 7 | `src/app/api/delivery/webhooks/incoming/route.ts` | Third-party incoming order webhook |
| 8 | `src/app/api/delivery/webhooks/status/route.ts` | Third-party status update webhook |
| 9 | `src/app/api/delivery/proof/route.ts` | Proof of delivery photo upload |
| 10 | `src/stores/delivery-store.ts` | Delivery Zustand store |

#### 11E Files to MODIFY

| # | File | What changes |
|---|------|-------------|
| 1 | `src/app/(backoffice)/delivery/page.tsx` | Replace CRUD with map dashboard + queue + driver management |
| 2 | `src/app/api/delivery/deliveries/[id]/status/route.ts` | Add GPS tracking, proof of delivery, SMS notification |
| 3 | `src/app/api/delivery/deliveries/[id]/assign/route.ts` | Add driver notification on assignment |

---

### SUB-PHASE 11F: CATERING

**Page: Catering Dashboard**
- **Who:** Manager, Owner
- **What:** Calendar view of upcoming events, pipeline (inquiry → proposal → confirmed → completed), revenue KPIs

**Feature: BEO (Banquet Event Order) Generation**
- **What:** Complete BEO document from event details: event name, date, time, guest count, menu selections, bar package, room setup, AV needs, special instructions, staff assignments, timeline
- **Output:** Formatted PDF matching industry-standard BEO layout. Printable. Emailable.

**Feature: PDF Proposals**
- **What:** Customer-facing proposal document: cover page with restaurant branding, event details, menu with pricing, package options, terms and conditions, total with tax, signature line
- **Send:** Email proposal to customer via SendGrid. Track if opened.

**Feature: Deposit Collection**
- **What:** Collect deposit (configurable % of total, default 50%) via Valor payment integration. Track deposit status. Auto-reminder for balance due 7 days before event.

**Feature: Invoice Generation**
- **What:** Post-event invoice with actual items served, adjustments, deposit applied, balance due. PDF generation. Email delivery. Payment tracking.

#### 11F Files to CREATE

| # | File | Purpose |
|---|------|---------|
| 1 | `src/components/catering/CateringCalendar.tsx` | Calendar view of events |
| 2 | `src/components/catering/EventEditor.tsx` | Full event detail form |
| 3 | `src/components/catering/BEOGenerator.tsx` | BEO creation and preview |
| 4 | `src/components/catering/ProposalBuilder.tsx` | Customer-facing proposal builder |
| 5 | `src/components/catering/InvoiceView.tsx` | Post-event invoice |
| 6 | `src/components/catering/DepositTracker.tsx` | Deposit collection and tracking |
| 7 | `src/app/api/catering/events/[id]/beo/route.ts` | BEO PDF generation |
| 8 | `src/app/api/catering/events/[id]/proposal/route.ts` | Proposal PDF generation + email |
| 9 | `src/app/api/catering/events/[id]/invoice/route.ts` | Invoice PDF generation |
| 10 | `src/app/api/catering/events/[id]/deposit/route.ts` | Deposit collection endpoint |
| 11 | `src/lib/catering/beo-template.ts` | BEO PDF layout template |
| 12 | `src/lib/catering/proposal-template.ts` | Proposal PDF layout template |
| 13 | `src/lib/catering/invoice-template.ts` | Invoice PDF layout template |

#### 11F Files to MODIFY

| # | File | What changes |
|---|------|-------------|
| 1 | `src/app/(backoffice)/catering/page.tsx` | Replace CRUD with calendar dashboard + pipeline view |
| 2 | `src/app/api/catering/events/route.ts` | Add pipeline status, deposit tracking, BEO link |
| 3 | `src/app/api/catering/events/[id]/route.ts` | Add BEO fields, proposal status, payment tracking |

---

### SUB-PHASE 11G: SCHEDULING

**Page: Schedule View**
- **Who:** Manager, Owner, Staff (read-only for their own schedule)
- **What:** Weekly calendar grid with shifts as colored blocks. Rows = staff members, columns = days. Drag to create/resize shifts. Click to edit.

**Feature: Labor Cost Forecasting**
- **What:** As manager builds schedule, running labor cost total updates in real-time. Shows projected labor % based on forecasted sales (historical same-day-of-week average). Red warning if labor % exceeds target (configurable, default 30%).
- **Display:** Sidebar panel: total scheduled hours, total projected labor cost ($), projected sales, projected labor %, target labor %

**Feature: Shift Marketplace**
- **What:** Staff can post shifts they want to give up. Other qualified staff (same role, availability matches) can pick them up. Manager approves or auto-approves based on settings.
- **UI:** "Available Shifts" tab visible to all staff. "My Requests" tab for swap tracking.

**Feature: Mobile Schedule View**
- **What:** Staff access their schedule on phone. Shows upcoming shifts, swap requests, availability settings. Push notification for schedule changes.
- **Route:** Responsive design of scheduling page works on mobile — not a separate page.

#### 11G Files to CREATE

| # | File | Purpose |
|---|------|---------|
| 1 | `src/components/scheduling/WeeklyGrid.tsx` | Drag-and-drop weekly schedule grid |
| 2 | `src/components/scheduling/ShiftBlock.tsx` | Individual shift block component |
| 3 | `src/components/scheduling/LaborForecast.tsx` | Real-time labor cost sidebar |
| 4 | `src/components/scheduling/ShiftMarketplace.tsx` | Available shifts board |
| 5 | `src/components/scheduling/AvailabilityEditor.tsx` | Staff availability input |
| 6 | `src/components/scheduling/ScheduleConflicts.tsx` | Conflict detection and warnings |
| 7 | `src/app/api/scheduling/labor-forecast/route.ts` | Labor cost projection endpoint |
| 8 | `src/app/api/scheduling/marketplace/route.ts` | Shift marketplace listings |
| 9 | `src/app/api/scheduling/marketplace/[id]/claim/route.ts` | Claim available shift |
| 10 | `src/stores/scheduling-store.ts` | Scheduling Zustand store |

#### 11G Files to MODIFY

| # | File | What changes |
|---|------|-------------|
| 1 | `src/app/(backoffice)/scheduling/page.tsx` | Replace CRUD with weekly grid + tabs (Schedule, Marketplace, Availability) |
| 2 | `src/app/api/scheduling/shifts/route.ts` | Add drag-drop create, conflict detection, labor cost impact |
| 3 | `src/app/api/scheduling/swap-requests/route.ts` | Add marketplace integration, auto-approve logic |

---

### SUB-PHASE 11H: DRIVE-THRU

**Page: Drive-Thru Dashboard**
- **Who:** Manager, Owner
- **What:** Lane status display, real-time car count per lane, speed metrics (avg order time, avg window time, cars per hour), active orders by lane position

**Feature: Dual-Lane Ordering**
- **What:** Support for 2 drive-thru lanes with independent order queues. Each lane shows car position (ordering → payment → pickup). Visual lane diagram with car icons.

**Feature: Car Tracking**
- **What:** Track car progress through drive-thru: enter lane → order placed → payment window → pickup window → exit. Timestamp each stage for speed metrics.

**Feature: Speed Metrics Dashboard**
- **What:** Real-time and historical speed metrics: avg total time, avg menu board time, avg payment time, avg pickup time, cars per hour, by daypart, by lane
- **Benchmark:** Configurable targets (e.g., total time < 3:30). Color-coded vs target.

#### 11H Files to CREATE

| # | File | Purpose |
|---|------|---------|
| 1 | `src/components/drive-thru/LaneDisplay.tsx` | Visual lane diagram with car positions |
| 2 | `src/components/drive-thru/SpeedDashboard.tsx` | Real-time speed metrics |
| 3 | `src/components/drive-thru/CarTracker.tsx` | Car position tracking interface |
| 4 | `src/components/drive-thru/DriveThruOrderPanel.tsx` | Lane-specific order entry |
| 5 | `src/app/api/drive-thru/lanes/route.ts` | Lane status and car tracking |
| 6 | `src/app/api/drive-thru/lanes/[id]/cars/route.ts` | Car position updates per lane |
| 7 | `src/app/api/drive-thru/speed-metrics/route.ts` | Speed metrics aggregation |
| 8 | `src/stores/drive-thru-store.ts` | Drive-thru Zustand store |

#### 11H Files to MODIFY

| # | File | What changes |
|---|------|-------------|
| 1 | `src/app/(backoffice)/drive-thru/page.tsx` | Replace CRUD with lane display + speed dashboard |
| 2 | `src/app/api/drive-thru/orders/route.ts` | Add lane assignment, car tracking, timestamps |
| 3 | `src/app/api/drive-thru/orders/metrics/route.ts` | Real speed metrics from actual timestamps |

---

### SUB-PHASE 11I: HOUSE ACCOUNTS

**Page: House Accounts Dashboard**
- **Who:** Manager, Owner
- **What:** Account list with balance, credit limit, last activity, status (active/suspended/closed). KPIs: total outstanding, accounts receivable aging (30/60/90 day)

**Feature: Statement PDF Generation**
- **What:** Monthly statement for each account: account holder info, period, all charges with dates/descriptions/amounts, payments received, balance forward, current balance, payment terms
- **Output:** Professional PDF. Auto-generate monthly via BullMQ. Email via SendGrid.

**Feature: Auto-Billing**
- **What:** Configurable billing cycle (weekly, bi-weekly, monthly). On billing date, system generates invoice, emails statement, optionally charges card on file via Valor.
- **Settings:** Per-account: billing cycle, payment method, auto-charge on/off, email on/off

**Feature: Credit Limit Alerts**
- **What:** When account reaches 80% of credit limit, alert manager. At 100%, block new charges unless manager override (PIN required).
- **Visual:** Balance bar on account card shows green/yellow/red based on utilization

#### 11I Files to CREATE

| # | File | Purpose |
|---|------|---------|
| 1 | `src/components/house-accounts/AccountDashboard.tsx` | Account list with KPIs and aging |
| 2 | `src/components/house-accounts/StatementView.tsx` | Statement preview and PDF trigger |
| 3 | `src/components/house-accounts/BillingConfig.tsx` | Per-account billing cycle settings |
| 4 | `src/components/house-accounts/CreditLimitBar.tsx` | Visual credit utilization indicator |
| 5 | `src/components/house-accounts/AccountDetail.tsx` | Full account detail with transaction history |
| 6 | `src/app/api/house-accounts/[id]/statement/route.ts` | Statement PDF generation |
| 7 | `src/app/api/house-accounts/[id]/bill/route.ts` | Auto-billing trigger |
| 8 | `src/app/api/house-accounts/aging/route.ts` | AR aging report |
| 9 | `src/lib/house-accounts/statement-template.ts` | Statement PDF layout template |
| 10 | `src/lib/house-accounts/billing-cycle.ts` | Billing cycle calculation utilities |

#### 11I Files to MODIFY

| # | File | What changes |
|---|------|-------------|
| 1 | `src/app/(backoffice)/house-accounts/page.tsx` | Replace CRUD with dashboard + detail views |
| 2 | `src/app/api/house-accounts/[id]/route.ts` | Add credit limit checks, auto-billing config |
| 3 | `src/app/api/house-accounts/route.ts` | Add aging summary, credit utilization |
| 4 | `src/components/payments/HouseAccountFlow.tsx` | Add credit limit warning/block during payment |

---

### SUB-PHASE 11J: FRANCHISE

**Page: Franchise Dashboard**
- **Who:** Owner (franchisor)
- **What:** Multi-location overview: each location as a card with today's sales, labor %, food cost %, compliance status. Consolidated P&L summary. Royalty collection status.

**Feature: Centralized Menu Push**
- **What:** Franchisor creates/modifies menu items at the corporate level → pushes to all locations or selected locations → locations receive menu update → can optionally customize pricing (if allowed by franchise agreement)
- **UI:** Menu diff view: "These changes will be applied to 12 locations" → confirm → push

**Feature: Consolidated P&L**
- **What:** Aggregated profit & loss across all franchise locations. Drill down by location. Compare locations side by side. Exportable to CSV/PDF.
- **Period:** Daily, weekly, monthly, quarterly, yearly

**Feature: Royalty Auto-Calculation**
- **What:** Based on franchise agreement terms (% of gross sales, flat monthly fee, or tiered), system auto-calculates royalties owed per location per period. Generates invoice. Tracks payment status.
- **Settings:** Per-location royalty terms configurable by franchisor

#### 11J Files to CREATE

| # | File | Purpose |
|---|------|---------|
| 1 | `src/components/franchise/FranchiseDashboard.tsx` | Multi-location overview with KPIs |
| 2 | `src/components/franchise/LocationCompare.tsx` | Side-by-side location comparison |
| 3 | `src/components/franchise/MenuPush.tsx` | Centralized menu push with diff view |
| 4 | `src/components/franchise/ConsolidatedPL.tsx` | Aggregated P&L report |
| 5 | `src/components/franchise/RoyaltyTracker.tsx` | Royalty calculation and tracking |
| 6 | `src/app/api/franchise/menu-push/route.ts` | Menu push to locations |
| 7 | `src/app/api/franchise/consolidated-pl/route.ts` | Consolidated P&L endpoint |
| 8 | `src/app/api/franchise/royalties/invoice/route.ts` | Royalty invoice generation |
| 9 | `src/lib/franchise/royalty-calc.ts` | Royalty calculation utilities |
| 10 | `src/lib/franchise/menu-diff.ts` | Menu diff computation |

#### 11J Files to MODIFY

| # | File | What changes |
|---|------|-------------|
| 1 | `src/app/(backoffice)/franchise/page.tsx` | Replace CRUD with dashboard + tabs (Overview, Menu, P&L, Royalties, Locations) |
| 2 | `src/app/api/franchise/royalties/calculate/route.ts` | Real calculation from sales data + agreement terms |
| 3 | `src/app/api/franchise/locations/sync/route.ts` | Menu sync execution logic |
| 4 | `src/app/api/franchise/reports/route.ts` | Consolidated reporting from all locations |

---

## 1.5 Look and feel

- All module pages follow the same design system: warm off-white background, ember orange accents, 48px touch targets
- Each module dashboard follows the pattern: KPI cards at top → primary content area → secondary panels
- PDF documents (BEOs, proposals, invoices, statements) use clean professional layout with restaurant logo, consistent typography, and proper spacing
- Maps (delivery) use a clean, minimal map style — not default Google Maps blue
- Calendar views (catering, scheduling) follow Apple Calendar visual conventions
- Mobile views maintain full functionality at 375px width

---

## 1.6 Business rules

- **Inventory:** Food cost targets configurable per category (proteins 28-32%, produce 8-12%, etc.)
- **Loyalty:** Points never expire (California law). Org-level balances for multi-location.
- **Online Ordering:** Commission-free (Sear's competitive advantage). Throttle prevents kitchen overwhelm.
- **Marketing:** CAN-SPAM and TCPA compliance required. Unsubscribe must work immediately.
- **Delivery:** Delivery fee configurable per zone. Minimum order amount per zone.
- **Catering:** Deposits are non-refundable within 48 hours of event (configurable).
- **Scheduling:** Cannot schedule staff outside their availability. Overtime alert at 35 hours (configurable).
- **Drive-Thru:** Industry benchmark: total time < 3:30. Payment window < 0:30.
- **House Accounts:** Credit limit hard stop at 100% requires manager PIN to override.
- **Franchise:** Menu push requires franchisor confirmation. Royalties calculated on gross sales before discounts.

---

## 1.7 Integrations

- **Twilio:** Marketing SMS, loyalty enrollment SMS, delivery notifications
- **SendGrid:** Marketing email, catering proposals, house account statements, franchise reports
- **Valor PayTech:** Catering deposits, house account auto-billing
- **BullMQ:** Prep list generation (daily), marketing campaign sends, statement generation (monthly), royalty calculation (monthly), stale delivery cleanup
- **Supabase Realtime:** Delivery GPS tracking, online order queue updates, inventory count changes

---

## 1.8 Modules planned but not for this build

None — this phase covers all remaining optional modules.

---

## 1.9 Acceptance criteria and workflow tests

### Acceptance Criteria (ALL MODULES)

**Inventory (11A)**
- [ ] **AC-01:** Inventory dashboard shows 4 KPI cards (Total SKUs, Low Stock count, Open POs count, Food Cost %) with real data
- [ ] **AC-02:** Waste log form allows selecting item, quantity, reason code (5 options), and optional notes — saves to database
- [ ] **AC-03:** Food cost report shows theoretical vs actual food cost per category with variance percentage and color coding (green <3% variance, red >3%)
- [ ] **AC-04:** Prep list generates automatically based on par levels minus current count, factoring historical demand for the day of week
- [ ] **AC-05:** When inventory item count reaches zero and auto-86 is enabled, the menu item is 86'd within 3 seconds across all POS terminals

**Loyalty (11B)**
- [ ] **AC-06:** Server taps "Loyalty" during payment → enters phone → existing member's points balance and available rewards display
- [ ] **AC-07:** New phone number entered → auto-enrolls customer → earns points on current transaction → confirmation shown
- [ ] **AC-08:** Customer earns points at Location A → checks balance at Location B → balance is correct (org-level)
- [ ] **AC-09:** Tier editor allows setting 4 tier thresholds with name, point requirement, earn multiplier, and benefits
- [ ] **AC-10:** Reward redemption deducts points from balance and applies discount to current check

**Online Ordering (11C)**
- [ ] **AC-11:** Customer visits `/order/[slug]` → sees full menu with categories, items, prices, and photos → can add items with modifiers to cart
- [ ] **AC-12:** Customer completes checkout → order appears in staff queue within 5 seconds → staff accepts → order goes to KDS
- [ ] **AC-13:** QR code generated in settings → scanning opens ordering page for correct location
- [ ] **AC-14:** Scheduled order for 6:30 PM created at 2:00 PM → enters kitchen queue at configured lead time (default 30min before)
- [ ] **AC-15:** Throttle setting of 5 orders per 15 minutes → 6th order in window sees "We're busy — please try again in X minutes"

**Marketing (11D)**
- [ ] **AC-16:** Campaign builder creates SMS campaign → selects segment → previews with real customer data → sends via Twilio → delivery tracked
- [ ] **AC-17:** Campaign builder creates email campaign → uses template with merge fields → previews rendered email → sends via SendGrid
- [ ] **AC-18:** Every marketing email includes working unsubscribe link. Every SMS includes STOP instructions.
- [ ] **AC-19:** Segment builder filters customers by last visit date, total spend, loyalty tier, and location — count updates live

**Delivery (11E)**
- [ ] **AC-20:** Delivery map shows real-time GPS dots for all active drivers, updating every 30 seconds
- [ ] **AC-21:** Driver marks delivery complete → prompted for photo → photo uploads → customer receives "Delivered" SMS
- [ ] **AC-22:** Third-party webhook receives incoming order → delivery record created in Sear → appears in queue

**Catering (11F)**
- [ ] **AC-23:** BEO generates as formatted PDF with all event details, menu selections, staff assignments, and timeline
- [ ] **AC-24:** Proposal PDF generates with restaurant branding, itemized pricing, terms, and total → emails to customer via SendGrid
- [ ] **AC-25:** Deposit collection processes payment via Valor → records deposit against event → remaining balance updates
- [ ] **AC-26:** Post-event invoice generates with actuals, deposit applied, and balance due → PDF + email

**Scheduling (11G)**
- [ ] **AC-27:** Manager drags to create shift on weekly grid → labor cost sidebar updates in real-time → shows projected labor % vs target
- [ ] **AC-28:** Staff posts shift to marketplace → qualified staff see it → staff claims it → manager approves/auto-approves → schedule updates
- [ ] **AC-29:** Schedule displays correctly on mobile phone viewport (375px) with all shifts readable

**Drive-Thru (11H)**
- [ ] **AC-30:** Lane display shows car positions progressing through ordering → payment → pickup stages in real-time
- [ ] **AC-31:** Speed metrics dashboard shows avg total time, avg per-stage time, cars/hour — by daypart, with benchmark comparison

**House Accounts (11I)**
- [ ] **AC-32:** Monthly statement PDF generates with all charges, payments, and balance — auto-emails to account holder
- [ ] **AC-33:** Account at 100% credit utilization blocks new charges at POS — manager PIN override allows it
- [ ] **AC-34:** Auto-billing processes charges on billing cycle date → generates invoice → emails statement → charges card on file if configured

**Franchise (11J)**
- [ ] **AC-35:** Menu push shows diff of changes → franchisor confirms → menu updates propagate to selected locations
- [ ] **AC-36:** Consolidated P&L aggregates all location data → shows revenue, COGS, labor, overhead, profit per location and total
- [ ] **AC-37:** Royalty auto-calc runs monthly → applies franchise agreement terms → generates invoice per location → tracks payment

### Workflow Tests

**Workflow 1: Inventory — Waste to Food Cost**
1. Kitchen staff opens waste log → selects "Salmon Fillet" → enters 3 lbs → reason: "Expired" → saves
2. Inventory count for salmon decreases by 3 lbs
3. Salmon is now below par level → low stock alert appears on dashboard
4. Manager opens food cost report → sees protein category actual cost exceeds theoretical by 4.2% → variance flagged red
5. Manager generates prep list → salmon appears with high prep quantity needed

**Workflow 2: Loyalty — Enrollment to Redemption**
1. New customer orders. Server taps "Loyalty" in payment flow.
2. Server enters customer's phone number → "Not found — enroll?" → taps "Enroll"
3. Customer name entered. Account created. Points earned on this $45 check (45 points at 1pt/$1).
4. Customer returns next week at different location → server enters phone → balance shows 45 points
5. Customer has enough for "Free Dessert" reward → server applies it → dessert price becomes $0 → points deducted

**Workflow 3: Online Ordering — Full Customer Journey**
1. Customer scans QR code on table tent → opens `/order/downtown-bistro`
2. Browses menu → adds Wagyu Burger with modifications → adds side salad → cart total $23.50
3. Enters name, phone → selects "ASAP" pickup → submits order
4. Staff sees order in queue → taps "Accept" → order routes to KDS → kitchen prepares
5. Order ready → customer receives SMS "Your order is ready for pickup!"

**Workflow 4: Catering — Inquiry to Invoice**
1. Catering coordinator creates new event: "Johnson Wedding Reception, July 15, 120 guests"
2. Builds menu: cocktail hour + 3-course dinner + bar package → total $8,400
3. Generates proposal PDF → emails to customer → customer approves
4. Collects 50% deposit ($4,200) via Valor → deposit recorded against event
5. Event occurs → coordinator enters actual counts → generates invoice for remaining $4,200 + adjustments
6. Invoice PDF emailed → customer pays → event marked complete

**Workflow 5: Scheduling — Build to Marketplace**
1. Manager opens weekly grid → drags to create shifts for Monday
2. Labor forecast sidebar shows: 120 hours scheduled, $2,160 projected cost, $7,200 projected sales, 30% labor (at target, green)
3. Manager adds another shift → labor jumps to 33% → sidebar turns yellow
4. Server Sarah can't work her Wednesday shift → posts to marketplace
5. Server Mike (same role, available Wednesday) sees it → claims it → manager auto-approves
6. Schedule updates for both Sarah and Mike

**Workflow 6: Delivery — Order to Proof**
1. Online order comes in with delivery address in Zone A
2. Manager assigns to Driver Tom → Tom receives notification
3. Tom picks up order → taps "En Route" → GPS tracking starts
4. Customer checks tracking page → sees Tom's position on map → "5 minutes away"
5. Tom arrives → taps "Delivered" → takes photo of food at door → uploads
6. Customer receives "Your order has been delivered" SMS with photo link

**Workflow 7: House Account — Charge to Statement**
1. Corporate account "Acme Corp" has $5,000 credit limit, current balance $3,800 (76%)
2. Server charges $400 lunch to Acme Corp → balance now $4,200 (84%) → "Approaching limit" alert appears for manager
3. Another $900 charge attempted → total would be $5,100 (102%) → blocked → manager enters PIN → override approved
4. End of month → system generates statement PDF → emails to Acme Corp billing contact
5. Acme Corp card on file charged for full balance → payment recorded → balance reset to $0

**Workflow 8: Franchise — Menu Push and Royalties**
1. Franchisor adds "Summer BBQ Brisket" to corporate menu → price $24.99
2. Taps "Push to All Locations" → diff view shows addition → confirms
3. All 12 locations receive menu update → item appears on their POS
4. End of month → royalty calculator runs → Location #7 had $180,000 gross sales → 5% royalty = $9,000
5. Royalty invoice generated → sent to Location #7 → tracked in consolidated report

**Workflow 9: Marketing — Campaign Send**
1. Manager creates email campaign: "Happy Hour is Back!"
2. Selects segment: "Customers who visited in last 90 days AND are loyalty members" → 847 customers match
3. Uses "Happy Hour Special" template → customizes with this week's specials → inserts {first_name} merge field
4. Previews email with real customer data → looks good → schedules for Tuesday 4 PM
5. Tuesday 4 PM → BullMQ fires → 847 emails sent via SendGrid → open tracking begins
6. Dashboard shows: 847 sent, 412 opened (48.6%), 89 clicked (10.5%)

**Workflow 10: Drive-Thru — Dinner Rush**
1. 6:00 PM dinner rush → both lanes active → 8 cars total
2. Lane 1: 3 cars (ordering, payment, pickup). Lane 2: 5 cars (2 ordering, payment, 2 pickup)
3. Car at Lane 1 payment window → payment processed → moves to pickup → new car enters
4. Speed dashboard: avg total time 3:15 (green, under 3:30 target), Lane 2 payment avg 0:42 (red, over 0:30 target)
5. Manager sees Lane 2 payment bottleneck → adjusts staffing

---

## Summary

This phase covers 10 module sub-phases with:
- **108 new files** to create across all sub-phases
- **34 existing files** to modify
- **37 acceptance criteria**
- **10 end-to-end workflow tests**

Build order by value: 11A (Inventory) → 11B (Loyalty) → 11C (Online Ordering) → 11D (Marketing) → 11F (Catering) → 11G (Scheduling) → 11I (House Accounts) → 11E (Delivery) → 11J (Franchise) → 11H (Drive-Thru)
