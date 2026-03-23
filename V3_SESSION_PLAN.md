# V3 Session Plan — How to Actually Build This

## The Problem

SEAR_POS_ARCHITECTURE.md is 17,935 lines. No AI agent reads it fully. Every session, it gets sampled and critical details are missed. The solution is to break it into focused session briefs that an agent CAN read fully.

## Pre-Work: Session 0 (Prep)

**Goal:** Break SEAR_POS_ARCHITECTURE.md into per-session reference docs.

**Prompt:**
```
Read SEAR_POS_ARCHITECTURE.md in full. Extract it into these separate files:

1. ARCH_UI_LAYOUT.md — Every section about UI layout, navigation, sidebar,
   topbar, screen structure, touch targets, iPad patterns. Include EXACT
   dimensions, colors, fonts from POS_UI_RESEARCH.md.

2. ARCH_ORDER_WORKFLOW.md — The complete order lifecycle. Every status
   transition, every edge case, coursing rules, rush logic, void/comp/discount
   flows, split/merge. Include the state machine diagram.

3. ARCH_PAYMENT_WORKFLOW.md — Card flow (auth→capture→settle), cash handling,
   gift cards, house accounts, bar tabs (open→add→close→walkout), tip handling,
   split payments, refunds. Include the payment state machine.

4. ARCH_KDS_WORKFLOW.md — Station routing, prep vs expo, course hold/fire,
   bump/recall, all-day counts, aging thresholds, ticket display specs,
   multi-station items, voided item display, speed tracking.

5. ARCH_TABLE_WORKFLOW.md — Table status state machine, auto-transitions,
   stale alerts, floor plans, sections, reservation integration.

6. ARCH_MENU_SYSTEM.md — Categories, items, modifier groups, modifier pricing
   models, allergens, 86 propagation, price levels, dynamic pricing.

7. ARCH_STAFF_SYSTEM.md — Clock in/out, breaks, tips, tip pools, overtime,
   scheduling, permissions, manager overrides.

8. ARCH_REALTIME.md — Every Supabase Realtime subscription needed, what
   tables to watch, what events trigger what UI updates.

9. ARCH_MODULES.md — Each of the remaining modules (online ordering, loyalty,
   reservations, inventory, scheduling, marketing, delivery, catering,
   drive-thru, franchise, house accounts) with their key workflows.

Each file should be self-contained — an agent reading ONLY that file should
have everything it needs to build that feature perfectly. Include exact specs,
dimensions, colors, state machines, and business rules. No "see above" or
"refer to main doc" references.
```

This is the MOST IMPORTANT session. It takes the 18K-line doc and makes it usable.

---

## Build Sessions (in order)

### Session 1: Design System + Layout Shell
**Read:** ARCH_UI_LAYOUT.md, POS_UI_RESEARCH.md, UI_DESIGN.md
**Build:**
- globals.css rewrite with iOS-native design tokens
- System font stack, shadows, animations, touch targets
- Sidebar component (open/close, Apple-style nav items, dark theme)
- Topbar component (live clock with seconds, connection status, user info)
- POS layout (2-panel with toggle sidebar)
- Backoffice layout (expanded sidebar)
- Safe area insets, no-overscroll, PWA meta tags

**Gate:** Open the app on iPad viewport. Sidebar opens and closes smoothly. Nav items have icons with labels below. Touch targets are 48px+. It feels like an iPad app.

**Prompt to paste:**
```
Read V3_BUILD_BRIEF.md and ARCH_UI_LAYOUT.md completely.

Follow MASTER_TEMPLATE.md Phase 3 — invoke /frontend-design and /ui-ux-pro-max
skills to produce the design system. Show me component previews before coding.

Then build ONLY the layout shell: sidebar (must open/close), topbar, POS layout,
backoffice layout, and globals.css. Nothing else.

Every nav item must have an icon on top and a label below (like Apple's tab bar).
The sidebar background must be dark (charcoal/slate). Touch targets 48px minimum.
No glassmorphism. Real Apple, not fake Apple.

Show me the result before moving on.
```

---

### Session 2: Menu Grid + Order Panel (the main POS screen)
**Read:** ARCH_UI_LAYOUT.md, ARCH_ORDER_WORKFLOW.md, ARCH_MENU_SYSTEM.md
**Build:**
- MenuGrid: colored tiles (120-140px), category pills, search, 86 overlay
- OrderPanel: item list with quantity badges, modifiers, course/seat badges, totals
- ModifierSheet: bottom sheet with iOS spring animation
- Course selector, seat selector, guest count picker
- Order type chips
- Send to Kitchen flow (creates order, adds items, sends)
- All wired to existing API routes

**Gate:** Create an order with 3 items including modifiers. See items in the order panel with correct totals. Send to kitchen. Verify it works end-to-end.

**Prompt to paste:**
```
Read V3_BUILD_BRIEF.md, ARCH_UI_LAYOUT.md, ARCH_ORDER_WORKFLOW.md, and
ARCH_MENU_SYSTEM.md completely.

Build the main POS screen: MenuGrid (left 70%) and OrderPanel (right 30%).
Menu items must be 120-140px colored tiles. Category pills must be colored
and horizontally scrollable. The order panel must show items with quantity
badges, modifiers indented, course/seat badges, and correct totals.

Wire the Send to Kitchen button to the real API. Test the full flow:
add items → see them in order panel → send to kitchen.

Use the design system from Session 1. Every element must match the specs
in ARCH_UI_LAYOUT.md. Show me the result.
```

---

### Session 3: KDS (Kitchen Display)
**Read:** ARCH_KDS_WORKFLOW.md, ARCH_REALTIME.md
**Build:**
- KDS page with station tabs, ticket cards, aging colors
- Course hold/fire display (HOLD badge for unfired courses)
- Bump with slide animation, recall drawer
- All-day counts panel
- Real-time subscriptions (new orders appear instantly)
- Dark theme with proper KDS colors
- Sound alerts for new tickets

**Gate:** Send an order from POS. See it appear on KDS within 2 seconds. Bump it. See it disappear. Recall it. Verify course holding works.

---

### Session 4: Payment Flow + Check Management
**Read:** ARCH_PAYMENT_WORKFLOW.md, ARCH_ORDER_WORKFLOW.md (split section)
**Build:**
- Payment page: full state machine (method → process → tip → receipt → done)
- Card processing with Valor mock
- Cash tender with numpad + change calculation
- Gift card: balance check → redeem
- House account: search → charge
- Tip selector: 18/20/25% + custom + no tip
- Receipt options: print/email/text/none
- Check management: equal split, seat split, print check
- Manager PIN dialog for voids/comps/discounts

**Gate:** Complete a full payment for a card, cash, and gift card. Split a check equally. Print a check.

---

### Session 5: Tables + Real-Time
**Read:** ARCH_TABLE_WORKFLOW.md, ARCH_REALTIME.md
**Build:**
- Floor plan with draggable tables
- Color-coded status (available/seated/ordered/served/dirty)
- Tap table → see order / seat guests
- Auto-status transitions when orders are created/paid
- Stale table alerts
- 86 propagation to all POS terminals
- Order status sync across terminals

**Gate:** Two browser tabs open. Seat guests on one tab, see the table change color on the other within 2 seconds. 86 an item, see it grey out on all terminals.

---

### Session 6: Staff + Allergens + Manager Overrides
**Read:** ARCH_STAFF_SYSTEM.md, ARCH_MENU_SYSTEM.md (allergens section)
**Build:**
- Clock in/out from POS (PIN entry)
- Break start/end
- Manager PIN verification dialog (global)
- Void with reason + manager PIN for sent items
- Comp with reason + always manager PIN
- Discount dialog (% or $) + manager PIN for >10%
- Allergen warning when adding conflicting items
- Audit trail for all manager overrides

**Gate:** Clock in. Add an item that conflicts with a guest allergy — see red warning. Void a sent item — manager PIN required. Apply 20% discount — manager PIN required.

---

### Session 7: Management Pages Polish
**Read:** ARCH_MODULES.md
**Build:**
- Polish Menu management (categories, items, modifiers, allergens)
- Polish Staff management (CRUD, shifts, tips)
- Polish Customer CRM
- Polish Reports (daily, labor, PMIX, server performance)
- Polish Settings (org, location, tax, terminals, printers)
- All matching the design system from Session 1

**Gate:** Every management page uses the design system consistently. No default shadcn/ui. All CRUD operations work.

---

### Session 8: Module Pages + Final QA
**Read:** ARCH_MODULES.md
**Build:**
- Polish all remaining module pages (online ordering, loyalty, reservations, etc.)
- Run MASTER_TEMPLATE Phase 8 (adversarial review)
- Run MASTER_TEMPLATE Phase 9 (visual QA)
- Fix everything found
- Final delivery report

**Gate:** Every page in the app matches the design system. Every workflow works end-to-end. The app feels like a native iPad POS.

---

## Rules for Every Session

1. Read the session-specific ARCH_*.md file COMPLETELY before planning
2. Invoke /frontend-design or /ui-ux-pro-max for every screen
3. Show the user a preview before coding
4. Fix the most VISIBLE thing first
5. Run `next build` after every major change
6. Test on iPad viewport (1194x834) in Chrome DevTools
7. Get user approval before moving to the next component
8. If a session runs out of context, output a handoff doc with exact state

## Time Estimate

- Session 0 (prep): 30 min
- Sessions 1-8: ~2-3 hours each
- Total: ~20 hours of AI build time across 8-9 sessions

This is a real product build, not a demo. It takes multiple focused sessions, not one marathon.
