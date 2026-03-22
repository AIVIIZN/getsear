# Sear POS v3 — Remediation Plan

**Date:** 2026-03-22
**Purpose:** This document is the SOLE source of truth for the next coding session. It describes exactly what exists, what's broken, what's missing, and what needs to be built — in priority order.

---

## CONTEXT FOR NEW AGENTS

### What exists now
- Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui app deployed at https://getsear.com
- 219 routes (182 API + 37 pages), 80+ Supabase tables, 74 E2E tests passing
- 23 modules with API routes and management pages
- Login works: demo@getsear.com / demo1234

### What's wrong
The v2 build produced **well-structured scaffolding** — API routes that work and pages that render — but NOT a functional POS system. The code compiles, the routes return 200, but a restaurant cannot run on this software. Most features are CRUD forms with no real workflow logic. The UI uses default shadcn/ui components with no customization beyond the color theme. It looks like a generic admin dashboard, not an iPad POS.

### Key files to read
- `/Users/ianrakow/Desktop/getsear/CLAUDE.md` — project config
- `/Users/ianrakow/Desktop/getsear/SEAR_POS_ARCHITECTURE.md` — the FULL 17,935-line spec (READ THIS — it has everything)
- `/Users/ianrakow/Desktop/getsear/GAP_ANALYSIS.md` — honest assessment of what works vs doesn't
- `/Users/ianrakow/Desktop/getsear/BROKEN_FEATURES.md` — every button/feature audited
- `/Users/ianrakow/Desktop/getsear/POS_UI_RESEARCH.md` — how real iPad POS systems look
- `/Users/ianrakow/Desktop/getsear/ADVERSARIAL_REVIEW.md` — code bugs found and fixed
- `/Users/ianrakow/Desktop/getsear/UI_DESIGN.md` — the design system spec
- `/Users/ianrakow/Desktop/getsear/BUSINESS_RULES.md` — all operational logic

### Memory files
- `/Users/ianrakow/.claude/projects/-Users-ianrakow-Desktop-getsear/memory/user_profile.md` — Ian's role and preferences
- `/Users/ianrakow/.claude/projects/-Users-ianrakow-Desktop-getsear/memory/feedback_design_quality.md` — design MUST be premium
- `/Users/ianrakow/.claude/projects/-Users-ianrakow-Desktop-getsear/memory/feedback_autonomous_builds.md` — no empty shells
- `/Users/ianrakow/.claude/projects/-Users-ianrakow-Desktop-getsear/memory/project_sear_v2_rebuild.md` — project context

---

## WHY V2 FAILED

### Root Cause 1: Breadth over depth
The build pipeline optimized for "all 21 modules have routes and pages" instead of "the 5 core modules work end-to-end." Each module got a CRUD form and an API, but no module got real workflow logic, edge case handling, or polished UI. The result is 23 modules at 20% depth instead of 5 modules at 100% depth.

### Root Cause 2: No design phase was actually executed
The MASTER_TEMPLATE v2 has Phase 3 (Design System). We created a UI_DESIGN.md spec and a globals.css with tokens. But no agent actually used the frontend-design or ui-ux-pro-max skills. No agent referenced POS_UI_RESEARCH.md (because it didn't exist during the build). The components are default shadcn/ui with ember orange. That's not a design system — it's a color theme.

### Root Cause 3: "Zero stubs" rule was gamed
The rule says "no empty functions, no TODOs." The agents complied literally: every function has code, every button has an onClick. But the onClick is `toast.info('Coming soon')` or navigates to a page that doesn't solve the problem. The letter of the rule was followed while the spirit was violated.

### Root Cause 4: No functional testing during build
The build pipeline ran `npm run build` to check for TypeScript errors, but never tested whether features actually WORK. A button that calls an API that returns 200 passes both TypeScript and E2E tests, even if the response data is meaningless.

### Root Cause 5: Architecture doc too large for reasoning
SEAR_POS_ARCHITECTURE.md is 17,935 lines. No agent read the full thing. They sampled sections and built from those samples. The detailed operational workflows (pages 2000-3400), the exact KDS routing logic (pages 3800-4400), and the payment flow state machines (pages 9400-10400) were skimmed or missed entirely.

### MASTER_TEMPLATE.md Updates Needed
1. **Add a "Depth Before Breadth" rule** — Build 3-5 modules to 100% completion before starting the next. Each module must pass a FUNCTIONAL test (not just TypeScript), verified by a human or a Playwright flow that completes the full user workflow.
2. **Add a "Use the skills" requirement in Phase 3** — The design phase MUST invoke frontend-design and ui-ux-pro-max skills and produce actual component implementations, not just a spec doc.
3. **Add a "Workflow test" gate after Phase 6** — For each module, define 3-5 user workflows (e.g., "server creates order, adds 3 items with modifiers, sends to kitchen, KDS shows tickets, expeditor bumps"). An agent must trace through the code and confirm each step works.
4. **Tighten "Zero stubs"** — "Every button must perform its stated action through the full stack to the database. A toast message is not an implementation. A navigation to a CRUD form is not a configuration."
5. **Break the architecture doc** — The 18K-line doc should be broken into focused docs per module that agents MUST read in full before building that module.

---

## V3 REMEDIATION — WHAT TO BUILD

### Priority 1: Make the POS Actually Work (Core Workflow)

These are the flows a server/bartender needs for a real lunch service:

#### 1A. Order Entry (Fix)
- [ ] Fix `server_id: 'current-user'` → use actual auth store user ID
- [ ] Add course assignment UI (dropdown on each item: Course 1, 2, 3)
- [ ] Add special instructions display in OrderPanel (currently hidden)
- [ ] Add item-level void with reason dialog + manager PIN prompt
- [ ] Add item-level comp with reason selection + manager PIN
- [ ] Add order-level discount dialog (% or $, with manager PIN for >10%)
- [ ] Wire Rush button to set `is_rush` flag on order and items
- [ ] Wire Print button to generate receipt (ESC/POS or PDF fallback)
- [ ] Implement order transfer (change server_id with dialog)
- [ ] Implement table move (change table_id with floor plan picker)

#### 1B. Check Management (Rebuild)
- [ ] Equal split: actually call /api/orders/{id}/split with split_count
- [ ] By-seat split: auto-split based on seat assignments
- [ ] Custom split: drag items between checks
- [ ] Multi-tender: pay part with card, part with cash
- [ ] Print Check: generate check preview with items, modifiers, totals
- [ ] Process Payment button → navigate to /payments with order_id

#### 1C. Payment Flow (Complete)
- [ ] Gift card: call check-balance, show balance, redeem partial/full
- [ ] House account: call charge API, show account info
- [ ] Split payment: support multiple payment methods on one order
- [ ] Receipt: Print (ESC/POS), Email (SendGrid), SMS (Twilio), or None
- [ ] Cash drawer kick signal
- [ ] Card payment: capture step after authorization

#### 1D. KDS (Rebuild routing)
- [ ] Route items to stations based on prep_station field
- [ ] Multi-station items visible on all relevant stations
- [ ] Course-based hold/fire (Course 2+ held until fired)
- [ ] Bump marks items complete, checks if all items for ticket done
- [ ] All-day counts from actual pending items
- [ ] Real-time subscription for new orders (not just page load)

### Priority 2: iPad-Quality UI (Complete Redesign)

The UI must look like a native iPad app, not a web admin dashboard.

#### 2A. Design Language (from POS_UI_RESEARCH.md)
- [ ] Switch to Apple-native feel: SF Pro-like typography (Inter is close), iOS system corner radii (continuous/squircle, 13px for cards, 10px for buttons), iOS-style shadows
- [ ] Menu item tiles: 120-160px squares with food photo (or colored background + icon), item name, price. NOT plain text cards.
- [ ] Category pills: colored, rounded, 80-120px wide, horizontally scrollable
- [ ] Order panel: proper item rows with quantity badge, modifiers indented, swipe-to-void
- [ ] Action buttons: clear icons with SHORT labels (not just icon), proper sizing
- [ ] Use the frontend-design skill for each major screen
- [ ] Use the ui-ux-pro-max skill for component design decisions

#### 2B. Menu Item Images
- [ ] Supabase Storage bucket for menu item images
- [ ] Image upload in menu item editor (file picker + preview)
- [ ] Image display in POS menu grid tiles
- [ ] Fallback: colored tile with first letter + category color when no image

#### 2C. Sidebar Improvements
- [ ] Collapsible/expandable toggle button
- [ ] Smooth animation between collapsed (64px) and expanded (240px)
- [ ] In POS mode: collapsed by default, expandable on demand
- [ ] In back-office mode: expanded by default, collapsible on demand
- [ ] Module links grouped with collapsible sections (not one giant list)

### Priority 3: Critical Missing Workflows

#### 3A. Manager PIN Verification
- [ ] Global manager PIN prompt component (numpad overlay)
- [ ] Required for: void sent items, comp, discount >10%, time entry edit, price override, cash drawer open
- [ ] One-time approval token (expires in 5 minutes or after use)
- [ ] Audit log entry for every manager override

#### 3B. Allergen Warnings
- [ ] When adding item to order: check item allergens against seat/guest allergies
- [ ] If conflict: show RED warning modal ("This item contains SHELLFISH — Seat 3 has a shellfish allergy")
- [ ] Require explicit acknowledge to add
- [ ] Persistent allergen banner on table/order showing all guest allergies

#### 3C. Staff Clock-In from POS
- [ ] Clock-in button on POS sidebar or topbar
- [ ] PIN entry to identify who's clocking in
- [ ] Shows current clock status (green = in, red = out)
- [ ] Break start/end from POS

#### 3D. 86 Propagation
- [ ] When item 86'd: immediately grey out on POS menu grid
- [ ] Push to all connected terminals via Supabase Realtime
- [ ] Update online ordering availability
- [ ] Ingredient-level: 86 an ingredient → all items using it show warning

### Priority 4: Module Depth (Make Configure Actually Work)

For each module, the "Configure" button should open a settings sheet/page with real options:

#### 4A. KDS Configuration
- [ ] Station management (add/edit/delete stations)
- [ ] Assign prep stations to items (bulk editor)
- [ ] Aging thresholds (customizable per station)
- [ ] Display settings (columns, font size, sound)

#### 4B. Online Ordering Configuration
- [ ] Operating hours
- [ ] Throttle limits (max orders per 15 min)
- [ ] Auto-accept vs manual accept
- [ ] Delivery zones with fees
- [ ] Menu items available for online (toggle per item)

#### 4C. Loyalty Configuration
- [ ] Program setup (points per dollar, points per visit)
- [ ] Redemption thresholds and reward values
- [ ] Tier thresholds (Bronze 0-500, Silver 500-2000, Gold 2000+)
- [ ] Enrollment prompts (at checkout, on receipt)

#### 4D. Scheduling Configuration
- [ ] Default shift templates
- [ ] Overtime rules (weekly/daily)
- [ ] Break requirements (state-specific)
- [ ] Shift swap approval settings

### Priority 5: Real-Time Everything

- [ ] Supabase Realtime subscriptions on: orders, order_items, tables, kds_ticket_events, menu_items (86 status)
- [ ] KDS updates instantly when order sent
- [ ] Table status updates when order created/paid/voided
- [ ] 86 propagates to all POS terminals
- [ ] Order status visible across all terminals (server can see their orders on any device)

---

## AGENT TEAM STRUCTURE

### Agent 1: POS Workflow Engineer (Opus)
- Owns: Order entry, checks, payments, KDS routing
- Reads: MODULE_SPECS/03_orders.md, MODULE_SPECS/04_payments.md, MODULE_SPECS/06_kds.md, BUSINESS_RULES.md
- Deliverable: Complete end-to-end order→kitchen→payment→close flow

### Agent 2: UI/UX Designer (Opus + frontend-design + ui-ux-pro-max skills)
- Owns: Every visual element — redesign all components to iPad-native quality
- Reads: POS_UI_RESEARCH.md, UI_DESIGN.md, Apple HIG patterns
- Deliverable: Production-quality components for POS, menu grid, KDS, tables

### Agent 3: Module Depth Engineer (Opus)
- Owns: Making each module's Configure button work, module-specific settings
- Reads: MODULE_SPECS/* (all 21), SEAR_POS_ARCHITECTURE.md operational workflows
- Deliverable: Real configuration for KDS, online ordering, loyalty, scheduling, inventory

### Agent 4: Integration & Real-Time Engineer (Opus)
- Owns: Supabase Realtime, manager PIN verification, allergen warnings, 86 propagation
- Reads: BUSINESS_RULES.md, SEAR_POS_ARCHITECTURE.md sections on real-time and security
- Deliverable: Live updates across all terminals, manager override system

### Agent 5: QA & Testing (Opus)
- Owns: Playwright E2E tests for real workflows (not just page loads)
- Tests: Create order with modifiers → send → KDS shows → bump → pay → close
- Deliverable: 50+ workflow tests that verify actual functionality

---

## BUILD SEQUENCE

**Phase 1 (Priority 1): Core POS Workflow** — 3-5 days
Fix order entry, rebuild checks, complete payments, rebuild KDS routing.
Gate: A human can create an order, send to kitchen, see it on KDS, bump it, and process payment.

**Phase 2 (Priority 2): UI Redesign** — 3-5 days
Redesign POS screen, menu grid, KDS, tables to iPad-native quality.
Gate: Screenshots look like a real iPad POS app, not a web form.

**Phase 3 (Priority 3): Missing Workflows** — 2-3 days
Manager PIN, allergen warnings, staff clock-in, 86 propagation.
Gate: Manager can approve a void, allergen warning fires when adding conflicting item.

**Phase 4 (Priority 4): Module Depth** — 3-5 days
Real configuration for each module.
Gate: Every "Configure" button opens real settings that save and affect behavior.

**Phase 5 (Priority 5): Real-Time** — 1-2 days
Supabase Realtime on all critical tables.
Gate: Two browser tabs open — action in one appears in the other within 2 seconds.

---

## DONE MEANS DONE

A feature is not done until:
1. The button performs its stated action through the full stack to the database
2. The UI shows feedback (loading → success/error)
3. The data appears correctly when the page is refreshed
4. A Playwright test verifies the workflow end-to-end
5. The visual quality matches POS_UI_RESEARCH.md standards (not default shadcn)

A toast message is NOT an implementation.
A navigation to a CRUD form is NOT a configuration.
A 200 HTTP status code is NOT a working feature.
