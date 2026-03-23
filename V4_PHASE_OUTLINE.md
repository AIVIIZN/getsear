# Sear POS v4 — Phase Outline

**Date:** 2026-03-23
**Purpose:** Plan to take every module from prototype to Toast/R Power production depth
**Method:** Each phase gets its own MD build brief per MASTER_TEMPLATE.md rules
**Approach:** Depth-first. One phase fully complete before the next begins.

---

## The Problem

We have 264 API endpoints, 37 pages, and 60+ database tables. But most are CRUD scaffolding — they insert rows and render tables. A real POS system needs:

- Every button performs a real action through the full stack
- Every workflow handles edge cases (network failure, concurrent users, invalid data)
- Every screen is as polished and workflow-optimized as Toast
- Hardware actually connects (printers, payment terminals, cash drawers)
- Real integrations fire (Valor payments, Twilio SMS, SendGrid email)

---

## Phase Structure

Each phase gets its own build brief document (filled-in MASTER_TEMPLATE Part 1). Each brief defines:
- Exact files to create/modify
- Exact acceptance criteria (testable checkboxes)
- Exact workflows to verify end-to-end
- Design requirements (specific screens with pixel-level specs)

Phases are ordered by **restaurant operational priority** — what does a restaurant need on day 1 to open for business?

---

## PHASE 1: Order Entry — Production Depth
**File:** `V4_PHASE_01_ORDERS.md`
**Goal:** The main POS screen works like Toast's order entry

### What Gets Built:
- Modifier sheet rebuilt as proper iOS page sheet (drag indicator, grouped radio/checkbox, forced modifiers auto-pop)
- Combo/meal deal builder (burger + fries + drink = $12.99)
- Open price items (market price, server enters amount)
- Quick-add favorites bar (configurable speed buttons per server)
- Item edit popover (tap item in order → change qty, modifiers, instructions, void, comp)
- Seat color coding (each seat gets a color, items visually grouped)
- Course timing controls inline (fire/hold per course with visual indicator)
- Re-fire button with reason codes
- Split check drag-and-drop (drag items between checks using @dnd-kit)
- Multi-tender payment (pay $20 cash + remainder on card)
- Auto-gratuity for parties ≥ 6 (configurable threshold + percentage)
- For Here / To Go toggle affecting tax calculation
- Order templates for regulars ("The usual for Table 12")
- Walkout handling (status, house loss tracking, manager PIN)
- Kitchen close function (disable food orders, drinks only)
- Tax calculation from location settings (kill the hardcoded 8.5%)

### Acceptance Criteria (examples):
- [ ] Server creates order → adds combo (burger+fries+drink) → combo price applies → modifiers work on combo items
- [ ] Server taps item → edit popover opens → changes modifier → price updates → sends correction to kitchen
- [ ] Server drags item from Check A to Check B → totals update on both → tax recalculates
- [ ] Server processes $20 cash + $15.50 card on a $35.50 check → both payments recorded → check closes
- [ ] Party of 8 seated → auto-gratuity of 20% added → shows on check → can be removed by manager

---

## PHASE 2: Payment Processing — Real Valor Integration
**File:** `V4_PHASE_02_PAYMENTS.md`
**Goal:** Real card payments flow through Valor PayTech hardware

### What Gets Built:
- Valor PayTech REST API integration (replace mock CardProcessing)
- Valor Connect MQTT for terminal communication
- EMV chip, NFC contactless, swipe, manual entry support
- Pre-auth lifecycle for bar tabs (open → add items → incremental auth → close with tip)
- Tip-on-screen flow (customer selects tip on Valor terminal before charge)
- Tip-on-receipt flow (auth, then capture with written tip)
- Batch settlement (auto at 2 AM or manual trigger)
- Void before settlement
- Refund after settlement (full and partial)
- Dual Pricing engine (4% card price display, cash discount)
- Store-and-forward for offline card payments
- Daily reconciliation report (Valor settlement vs Sear records)
- Chargeback management UI (view disputes, upload evidence)
- Cash drawer integration (open drawer on cash payment)
- Cash management (opening count, closing count, over/short)

### Acceptance Criteria (examples):
- [ ] Server processes card → Valor terminal prompts for card → EMV chip read → approved → tip prompt → receipt options → check closes
- [ ] Bartender opens bar tab → pre-auth $50 → adds $60 of drinks → incremental auth fires → closes tab with tip → batch settles at 2 AM
- [ ] Internet drops → server processes card → store-and-forward queues payment → internet returns → payment settles
- [ ] End of day → manager runs settlement → Valor batch total matches Sear total → discrepancies flagged

---

## PHASE 3: Kitchen Display System — Production Depth
**File:** `V4_PHASE_03_KDS.md`
**Goal:** KDS handles a real dinner rush with multiple stations

### What Gets Built:
- Expo screen (sees all stations, coordinates plating)
- Multi-station coordination (steak on grill + fries on fry → expo holds until both ready)
- Individual item bumping within a ticket (not just whole-ticket bump)
- Re-fire workflow with reason codes and priority escalation
- Allergen alerts on KDS tickets (red banner, cannot dismiss)
- Configurable time thresholds per item category (appetizers 8min, entrees 15min)
- Kitchen capacity indicator (% utilization, ticket backlog count)
- Printer failover (if KDS goes down, auto-print to backup kitchen printer)
- Kitchen close function (synced with POS)
- Station-to-expo messaging ("86 salmon in 10 minutes")
- Ticket priority system: RE-FIRE → RUSH → VIP → Normal (visual sort)
- Escalating audio alerts (louder/more urgent for late tickets)

### Acceptance Criteria (examples):
- [ ] Order with grill item + fry item → tickets appear at both stations → fry bumps first → expo holds → grill bumps → expo shows "ready to run"
- [ ] Item has allergen conflict with guest → KDS shows full-width red ALLERGY banner → cannot be dismissed
- [ ] Ticket goes critical (15+ min) → audio alert escalates → flashes red → appears at top of queue

---

## PHASE 4: Menu Management — Full Feature Depth
**File:** `V4_PHASE_04_MENU.md`
**Goal:** Menu system as powerful as Toast's menu builder

### What Gets Built:
- Visual menu builder (3-panel: nav tree, item grid, detail editor)
- Drag-and-drop item/category reordering with visual feedback
- Photo upload and management (crop, resize, CDN storage)
- Modifier nesting (modifier group → modifier → sub-modifier)
- Modifier pricing types (included, upcharge, replacement, quantity-based)
- Daypart pricing engine (lunch price, happy hour price, dinner price with auto-switchover)
- Seasonal menu rotation (start/end dates, auto-activate/deactivate)
- Ingredient-level 86 with cascade (86 salmon → all dishes with salmon affected)
- Auto-86 from inventory countdown
- "Running Low" pre-86 status with kitchen alert
- Allergen tagging (14 EU + US common) with visual badges
- Dietary tags (V, VG, GF, DF, etc.) with filter
- Price levels (9 configured: regular, happy hour, employee, etc.)
- PLU/barcode assignment for scanner support
- Quick-add special (4 fields, under 30 seconds to create)
- Menu import/export (CSV)

### Acceptance Criteria (examples):
- [ ] Manager drags "Wagyu Burger" from "Specials" to "Entrees" → sort order updates → POS reflects immediately
- [ ] 5 PM hits → happy hour prices auto-activate at bar → dining room stays dinner prices
- [ ] Kitchen 86s salmon ingredient → all 4 dishes with salmon grey out on POS → servers get toast notification

---

## PHASE 5: Printing & Hardware
**File:** `V4_PHASE_05_HARDWARE.md`
**Goal:** Receipt printers, kitchen printers, cash drawers, and barcode scanners work

### What Gets Built:
- ESC/POS receipt printer driver (Star Micronics + Epson support)
- Kitchen ticket printing (backup for KDS, formatted for kitchen)
- Receipt printing (itemized check with tip line, dual pricing display)
- Cash drawer trigger (RJ-11 via printer)
- Barcode scanner support (USB HID, reads PLU codes)
- Printer configuration UI (add printer, test print, assign to station)
- Print queue with retry on failure
- Kitchen printer routing (grill printer, bar printer, etc.)

---

## PHASE 6: Staff & Labor — Production Depth
**File:** `V4_PHASE_06_STAFF.md`
**Goal:** Full labor management like Toast's team management

### What Gets Built:
- Per-user permission configuration UI (grant/deny overrides)
- Overtime calculation and alerts (configurable thresholds)
- Server checkout reports (sales, tips, cash owed)
- Tip pooling configuration (direct, pool by hours, pool by points, hybrid)
- Cash drawer count UI (denomination counter at shift start/end)
- Break compliance tracking (auto-alert if break not taken)
- Payroll export (CSV for ADP/Gusto/Paychex)
- Labor cost forecasting (schedule → projected labor %)
- Employee scheduling deep integration (shift marketplace, swap requests with push notifications)

---

## PHASE 7: Reports — Production Depth
**File:** `V4_PHASE_07_REPORTS.md`
**Goal:** Every report a restaurant owner needs, automated

### What Gets Built:
- Cash report (opening/closing counts, over/short by employee)
- Speed of service report (avg ticket time by station, by daypart, outliers)
- Food cost report (theoretical vs actual, variance by item)
- Void/comp/discount report (patterns, by employee, by reason)
- P&L summary (monthly, auto-calculated)
- 13-week trend analysis (rolling comparison)
- Owner mobile dashboard (today's sales, labor %, alerts, open checks)
- Auto-email daily summary to owner (SendGrid)
- PDF export for all reports
- Daily metrics aggregation job (BullMQ, runs at 4 AM)
- Real-time dashboard (not mock data — queries live orders/payments)

---

## PHASE 8: Integrations
**File:** `V4_PHASE_08_INTEGRATIONS.md`
**Goal:** Twilio, SendGrid, QuickBooks actually connected and working

### What Gets Built:
- Twilio SMS: order ready notifications, reservation reminders, waitlist alerts, marketing campaigns
- SendGrid email: receipts, daily reports, marketing campaigns, password reset
- QuickBooks Online: real OAuth flow, daily sales journal entry export, chart of accounts mapping
- Webhook system for third-party integrations (generic outbound webhooks)

---

## PHASE 9: Offline Mode
**File:** `V4_PHASE_09_OFFLINE.md`
**Goal:** POS works when internet goes down

### What Gets Built:
- Service Worker for PWA offline shell
- IndexedDB cache for menu, tables, staff, settings
- Offline order entry (queued for sync)
- Offline cash payments (queued for sync)
- Store-and-forward card payments (queued for Valor)
- Offline clock in/out
- Sync queue with conflict resolution on reconnect
- Offline mode banner/indicator
- Automatic reconnection and sync

---

## PHASE 10: Table Management & Reservations — Deep Integration
**File:** `V4_PHASE_10_TABLES.md`
**Goal:** Floor plan, reservations, and waitlist work together seamlessly

### What Gets Built:
- Table list view (alternative to floor plan)
- Server section assignment UI with color coding
- Table turn time tracking with reporting
- Reservation → table assignment → auto-status change
- Waitlist → SMS notification → table assignment
- Capacity dashboard (occupied/total, estimated wait times)
- Reservation widget for restaurant website (embeddable)

---

## PHASE 11: Optional Modules — Deep Pass
**File:** `V4_PHASE_11_MODULES.md`
**Goal:** Every optional module works like a real product, not a CRUD form

### What Gets Built (one subphase per module):
- **Inventory:** waste tracking, food cost calculation, low stock alerts, prep list generation
- **Loyalty:** phone enrollment at checkout, tier management UI, cross-location earn/redeem
- **Online Ordering:** customer-facing ordering page, QR code flow, scheduled orders
- **Marketing:** real Twilio/SendGrid integration, campaign preview, A/B testing
- **Delivery:** real-time GPS tracking, proof of delivery, third-party integration hooks
- **Catering:** BEO generation, PDF proposals, deposit collection, invoice generation
- **Scheduling:** labor cost forecasting, shift marketplace, mobile schedule view

---

## PHASE 12: Security & Performance Hardening
**File:** `V4_PHASE_12_SECURITY.md`
**Goal:** Production-ready security and performance

### What Gets Built:
- Zod validation on ALL remaining API routes
- Redis-backed rate limiting (replace in-memory)
- Location-level authorization checks
- MFA for owner/admin roles
- Password reset flow
- Supabase typed client (replace `as any` casts)
- Performance optimization (query indexes, connection pooling)
- Load testing (simulate dinner rush — 50 concurrent users)

---

## PHASE 13: Visual QA & Final Polish
**File:** `V4_PHASE_13_POLISH.md`
**Goal:** Every screen looks like it belongs in a $50M product

### What Gets Built:
- Full visual QA pass on every page (iPad viewport)
- Apple Design Resources reference check on every component
- Animation polish (spring physics on every transition)
- Empty state design for every list/grid/table
- Loading skeleton for every async load
- Error state design for every failure mode
- Accessibility audit (screen reader, keyboard nav, contrast)
- Cross-browser testing (Safari iPad, Chrome Android, desktop)

---

## PHASE 14: AI Intelligence Layer — Beat ToastIQ
**File:** `V4_PHASE_14_AI.md`
**Goal:** Holistic AI that connects sales + labor + food cost + waste — what Toast can't do

### What Gets Built:
- **Sear Ask** — Natural-language conversational interface ("How did we do last Saturday?", "Who's my best server on Fridays?", "Am I overstaffed on Tuesdays?")
- Claude API with tool_use for structured database queries (10 query tools: sales, labor, menu performance, food cost, speed of service, voids/comps, customers, inventory, tips, period comparison)
- Proactive AI insights pushed to dashboard daily (menu profitability, labor optimization, waste reduction, sales trend alerts, void/comp anomalies)
- Demand forecasting for labor scheduling, inventory prep, and revenue projections
- Inline Recharts visualizations in AI responses
- Redis caching, rate limiting, cost tracking, privacy controls (no customer PII sent to LLM)

### Acceptance Criteria (examples):
- [ ] Owner types "How did we do last Saturday?" → AI responds with sales total, comparison to prior Saturday, covers, avg check — with chart
- [ ] Dashboard shows 3 AI insight cards after daily job runs at 5 AM
- [ ] Scheduling page shows predicted staff levels based on 13-week historical demand
- [ ] GM at Location A cannot query Location B data — response scoped by role

---

## PHASE 15: Public Website & Transparent Pricing
**File:** `V4_PHASE_15_PRICING.md`
**Goal:** The pricing page that every competitor is afraid to publish

### What Gets Built:
- Public landing page — Hero, features, social proof, CTAs
- **Transparent pricing page** — Every cost published. No hidden fees. No "call for quote." Toast comparison math.
- Interactive ROI calculator — "How much will you save switching from Toast?" with real Valor rates
- Feature comparison page — Side-by-side vs Toast, Square, SpotOn, Clover with source links
- Demo request flow — Calendly booking + self-serve trial signup
- Mobile responsive marketing pages (restaurant owners browse on mobile)

### Acceptance Criteria (examples):
- [ ] Pricing page publishes all plan costs, processing rates, and hardware costs — zero hidden fees
- [ ] ROI calculator: owner enters $50K card volume → sees monthly and annual savings vs Toast
- [ ] Compare page shows 12+ dimensions across 5 competitors with source citations
- [ ] Demo request stores lead + sends confirmation email within 30 seconds

---

## PHASE 16: Self-Service Onboarding & Owner Empowerment
**File:** `V4_PHASE_16_SELF_SERVICE.md`
**Goal:** Restaurant goes from signup to first order without calling support

### What Gets Built:
- **Setup wizard** — 8-step guided setup (restaurant details, location, tax rates, menu, floor plan, staff, hardware, done) completable in under 15 minutes
- **Menu from photo** — Upload a photo of a paper menu → Claude Vision extracts items/prices/categories → review/edit → save
- Interactive first-time tutorials on every major page (spotlight tooltips, skip/replay)
- Demo data seeding — one-click sample restaurant with 50 items, 24 tables, 8 staff
- Hardware setup sub-wizard — printer auto-discovery, test print, terminal pairing
- In-app help center with searchable articles

### Acceptance Criteria (examples):
- [ ] New owner completes full setup wizard in under 15 minutes
- [ ] Photo of paper menu → Claude Vision extracts items → user reviews → items appear on POS
- [ ] First visit to POS → tutorial highlights key elements → completes in 4 steps
- [ ] "Load sample menu" seeds 50 items in under 5 seconds

---

## Summary

| Phase | Focus | Est. Sessions | Priority |
|-------|-------|--------------|----------|
| 1 | Order Entry depth | 3-4 | CRITICAL — day 1 |
| 2 | Valor Payment integration | 3-4 | CRITICAL — day 1 |
| 3 | KDS depth | 2-3 | CRITICAL — day 1 |
| 4 | Menu Management depth | 2-3 | HIGH — week 1 |
| 5 | Printing & Hardware | 2-3 | HIGH — week 1 |
| 6 | Staff & Labor depth | 2-3 | HIGH — week 1 |
| 7 | Reports depth | 2-3 | MEDIUM — week 2 |
| 8 | Integrations (Twilio, SendGrid, QB) | 2 | MEDIUM — week 2 |
| 9 | Offline Mode | 3-4 | MEDIUM — week 3 |
| 10 | Tables & Reservations depth | 2 | MEDIUM — week 3 |
| 11 | Optional Modules depth | 4-6 | LOWER — weeks 3-4 |
| 12 | Security & Performance | 2 | HIGH — before launch |
| 13 | Visual QA & Polish | 2-3 | HIGH — before launch |
| 14 | AI Intelligence Layer | 3-4 | HIGH — competitive differentiator |
| 15 | Public Website & Pricing | 2-3 | HIGH — sales enablement |
| 16 | Self-Service Onboarding | 2 | MEDIUM — reduces support cost |
| **TOTAL** | | **~47-55 sessions** | |

---

## How Each Phase Runs

Per MASTER_TEMPLATE.md rules:

1. Read the phase build brief (the MD file)
2. Phase 2: Generate technical plan + acceptance criteria → get approval
3. Phase 3: Design system for that module's screens → get approval
4. Phase 5: Task decomposition into parallelizable batches
5. Phase 6: Implementation (parallel agents per batch)
6. Phase 6.5: Workflow verification (end-to-end test every user journey)
7. Phase 8-11: Adversarial review → fix issues → final delivery

Each phase is self-contained. You approve before the next begins.

---

## Next Step

Pick a phase. I'll write the full build brief (V4_PHASE_XX_*.md) with every file, every acceptance criterion, every workflow test, and every design spec. Then we execute it per the MASTER_TEMPLATE.
