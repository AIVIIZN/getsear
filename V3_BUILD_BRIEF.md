# Sear POS v3 — Build Brief (MASTER_TEMPLATE Part 1)

Paste this ENTIRE file + MASTER_TEMPLATE.md into a fresh Claude Code session.
Then say: "Follow the MASTER_TEMPLATE. Start at Phase 1."

---

## 1.1 What is this?

A depth-first rebuild of the Sear POS visual layer and core workflows. The backend API routes (267 routes) already work. The database (80+ tables) already exists. The code compiles and the server runs. What's broken is: the UI looks like a generic web admin dashboard, not an iPad POS app. Core workflows (order → kitchen → payment) have gaps. The sidebar doesn't open/close. Buttons are generic icons without labels. Everything is too small for iPad touch.

This is NOT a greenfield build. This is a visual overhaul + workflow completion of an existing Next.js 15 + Supabase + Tailwind v4 + shadcn/ui application at /Users/ianrakow/Desktop/getsear.

**Read these files BEFORE planning:**
- CLAUDE.md — project config, tech stack, all 21 modules
- SEAR_POS_ARCHITECTURE.md — the full 17,935-line specification (READ RELEVANT SECTIONS FULLY)
- POS_UI_RESEARCH.md — how real iPad POS systems look (EXACT specs, dimensions, colors)
- UI_DESIGN.md — the design system tokens
- BUSINESS_RULES.md — operational logic
- V3_REMEDIATION_PLAN.md — what's broken and what needs fixing
- GAP_ANALYSIS.md — honest assessment of current state
- BROKEN_FEATURES.md — every button audited


## 1.2 Tech stack

Already built. Do not change:
- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- **Components:** shadcn/ui (but MUST be heavily customized — not default)
- **State:** Zustand v5 + Immer
- **Database:** Supabase (PostgreSQL) — already has 80+ tables
- **Auth:** Supabase Auth + cookie-based SSR
- **Hosting:** GCP VM (standalone Next.js + PM2 + Nginx)
- **Icons:** Lucide React (but every icon MUST have a text label below it)


## 1.3 User roles

Already implemented in database. Key roles:
- **Owner** (Marcus Rivera, demo@getsear.com / demo1234): full access
- **Manager**: approve voids/comps/discounts via 4-digit PIN
- **Server**: create orders, process payments, manage tables
- **Bartender**: bar tab management, drink orders
- **Host**: reservations, waitlist, table assignments
- **Kitchen**: KDS view only


## 1.4 Pages and features (PRIORITY ORDER — build in this order)

### TIER 1: What I see first (build these before ANYTHING else)

**Sidebar Navigation**
- Who: All roles
- What: Dark background sidebar that opens (240px) and closes (64px) with smooth spring animation
- Toggle: Hamburger button in top-left corner of topbar
- POS mode: Collapsed by default, expandable on demand
- Back-office mode: Expanded by default, collapsible on demand
- Nav items: Apple-style — icon centered on top, short label below (like iOS tab bar items)
- Active state: Highlighted with primary color fill + white icon/text
- Sections: POS (5 items), Management (4 items), Modules (11 items), Admin (1 item)
- Sections collapsible with chevron
- Logo: "SEAR" at top, collapses to "S" icon
- Bottom: Staff clock-in status indicator

**Topbar**
- Who: All roles
- What: 56px header with location name, live clock (updates every second, shows seconds), connection status (larger dot with pulse), user name + avatar, settings gear
- Staff clock button: Shows green/red/amber status, dropdown for clock in/out/break

**Page: Orders (Main POS Screen)**
- Who: Server, Bartender, Manager, Owner
- Layout: 2-panel split — Order panel (30% left), Menu grid (70% right)
- NO quick actions strip on the right — move those into the order panel as contextual buttons
- Order Panel: Header with order info, scrollable item list, totals, Send + Pay buttons
- Menu Grid: Colored category pills (horizontally scrollable), search bar, grid of item tiles
- Item tiles: 120-140px squares, colored background matching category, item name (16px bold), price (14px), category color bar at top
- 86'd items: Desaturated with red "86" badge, not tappable
- Empty state: "Tap a menu item to start your order" with arrow illustration

**Page: KDS (Kitchen Display)**
- Who: Kitchen staff
- Dark theme ONLY
- Station tabs across top
- Ticket cards in columns (2-4 configurable)
- Each ticket: order number (large), order type badge, server name, table, items with modifiers, aging timer
- Aging colors: Green → Yellow → Orange → Red (flashing)
- Course headers with HOLD badge for unfired courses
- BUMP button at bottom of each ticket (large, green, 56px tall)
- All-Day counts panel (slide-out)
- Recall drawer (slide-out)

### TIER 2: Core workflow completion

**Page: Checks**
- Split check: Equal (tap a number), By Seat (one button), Custom (drag items)
- Order detail view with all items, modifiers, totals
- Print Check button (wired to API)
- Process Payment button (navigates to payment flow)

**Page: Payments**
- Full-screen state machine: Method Select → Processing → Tip → Receipt → Complete
- Payment tiles: Card, Cash, Gift Card, House Account, Split (120x100px each)
- Card: Shows "Present Card on Terminal" → Processing spinner → Approved/Declined
- Cash: Numpad for tendered amount, quick buttons ($20, $50, $100, Exact), change calculation
- Gift Card: Enter card number → Check balance → Show balance → Apply payment
- House Account: Search accounts → Show credit limit → Charge
- Tip: 18%, 20%, 25% preset buttons (80x80px) + Custom + No Tip
- Receipt: Print, Email, Text, No Receipt (4 tiles)
- Complete: Animated checkmark, payment summary, auto-redirect 3s

**Page: Tables**
- Floor plan view with draggable table icons
- Color-coded by status (available/seated/ordered/served/dirty)
- Tap table → see order details or seat guests

### TIER 3: Management pages (after Tier 1+2 are perfect)

**Menu Management, Staff, Customers, Reports, Settings** — these already have basic CRUD pages. Polish them to match the design system but don't rebuild from scratch.

### TIER 4: Module pages (only after Tier 1-3 done)

Online Ordering, Reservations, Loyalty, Inventory, Scheduling, Marketing, Delivery, Catering, House Accounts, Drive-Thru, Franchise — these are lower priority. Make their existing pages match the design system.


## 1.5 Look and feel

- **Mode:** Light-first (KDS is dark-only)
- **Vibe:** Native iPad, professional, fast, premium, restaurant-grade
- **Reference products:** Square POS on iPad, Toast POS, Apple's own iPad apps (Settings, Files)
- **Color direction:** Warm off-white background (#FDFBF7), ember orange (#F06B18) as primary accent, iOS system colors for status (green success, red error, blue info, amber warning)
- **Typography:** System font stack (-apple-system, BlinkMacSystemFont, SF Pro). Body text 17px. Prices in tabular monospace.
- **Animation quality:** iOS spring physics. Button press: scale 0.97, 100ms. Sheet slide: 350ms spring. NO glassmorphism. NO frosted glass. NO gradient backgrounds. REAL Apple, not fake Apple.
- **Quality bar:** Must be indistinguishable from a native iPad app. If you put it next to Square POS, it should look like it belongs.
- **Device target:** iPad landscape PRIMARY (1194x834pt). Desktop secondary.
- **Touch targets:** 48px minimum everywhere. 56px for primary actions.
- **Specific visual elements:**
  - Category pills: colored, rounded-full, 80-120px wide, 36px tall
  - Menu tiles: 120-140px square, colored background, category color bar at top
  - Apple-style nav: icon on top, label below (like iOS tab bar)
  - Hairline separators (0.5px, rgba(60,60,67,0.29))
  - Two-layer shadows for depth
  - 8px spacing grid
  - Squircle corners (16px for cards, 12px for buttons)
- **Things I do NOT want:**
  - NO glassmorphism
  - NO backdrop-blur on anything except modals
  - NO gradient backgrounds
  - NO frosted glass effects
  - NO generic shadcn/ui with just a color change
  - NO icons without text labels
  - NO elements smaller than 44px
  - NO hardcoded colors (use design tokens)
  - NO default Tailwind shadows (use warm-tinted shadows from UI_DESIGN.md)


## 1.6 Business rules

Read BUSINESS_RULES.md for complete rules. Key ones:
- Manager PIN (4-digit) required for: void sent items, comp, discount >10%, price override
- Allergen warnings: RED modal when item allergens conflict with guest allergies
- 86 propagation: <3 seconds to all terminals via Supabase Realtime
- Order numbers reset daily per location
- All money stored as numeric(10,2) in DB, integer cents in TypeScript
- Tax calculated per location settings (not hardcoded 8.5%)


## 1.7 Integrations

All already configured:
- Valor PayTech (payment processing, mocked in dev)
- Supabase Realtime (WebSocket for KDS, orders, tables, 86)
- Twilio (SMS — order ready, reservations)
- SendGrid (email — receipts, reports)
- BullMQ + Redis (background jobs)


## 1.8 Modules planned but not for this build

NONE — all 21 modules already have API routes. This build is about making them LOOK and WORK right, not adding new modules.


## 1.9 Anything else

- The backend is DONE. 267 API routes all work. Do not rewrite APIs unless they have bugs.
- Focus ALL effort on the visual layer and workflow completion.
- The #1 complaint is "it looks like a generic admin dashboard." Fix that FIRST.
- The sidebar must open and close. This is the first thing to build.
- Every button must have icon + label. No icon-only buttons (except in tight spaces like quantity steppers).
- Login credentials: demo@getsear.com / demo1234
- Read POS_UI_RESEARCH.md — it has EXACT pixel dimensions for every element. Use them.
- Test on an actual iPad viewport (1194x834) or Chrome device emulator for iPad.

**START BY SHOWING ME THE SIDEBAR OPENING AND CLOSING. THEN THE MENU GRID WITH BIG COLORFUL TILES. THEN THE ORDER PANEL. ONE SCREEN AT A TIME, WITH MY APPROVAL BETWEEN EACH.**
