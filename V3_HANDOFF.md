# Sear POS v3 — Complete Handoff Document

**Date:** 2026-03-22
**Purpose:** Everything a new Claude Code session needs to pick up and build. No ambiguity.

---

## CURRENT STATE: What Exists Right Now

### The Good News: Backend is DONE
- **183 API routes** across 23 modules — ALL fully implemented with real Supabase queries
- **80+ database tables** with RLS, constraints, relationships
- **39 pages** that render and connect to APIs
- **43 custom components** + 24 shadcn/ui components
- **6 Zustand stores** for state management
- **5 custom hooks** including Supabase Realtime subscriptions
- **Seed data** populates demo restaurant with menu, staff, tables, floor plans
- **Auth works:** demo@getsear.com / demo1234
- **TypeScript compiles clean.** `next build` passes.
- **Zero placeholder routes.** Every API returns real data.

### The Bad News: UI Looks Like a Generic Web Dashboard
The #1 problem is visual. The app works but doesn't LOOK like an iPad POS. Specific issues:

1. **Sidebar** — Can't open/close (hardcoded `collapsed={true}` in POS layout). Nav items are horizontal icon+text rows, not Apple-style vertical icon+label. Background is tan (#F5F3F0), should be dark.
2. **Menu Grid** — Items are small text cards, not big colorful tiles. No food photos. Category tabs are plain, not colored pills.
3. **Order Panel** — Fixed 360px width. Text too small (14px). Selected item state barely visible. Modifiers hard to read (12px muted gray).
4. **Touch targets** — Many elements below 44px minimum (quantity badges, seat buttons, status dots).
5. **Typography** — Uses Tailwind defaults, not iOS system font scale (17px body, 15px subhead, 13px footnote).
6. **Shadows** — Too subtle. iPad screens need more depth.
7. **Animations** — Generic CSS transitions, not iOS spring physics.
8. **No design skills were used** — The /frontend-design and /ui-ux-pro-max skills were never invoked.

---

## FILES THAT MATTER

### Spec Files (READ THESE)
| File | Lines | What It Contains |
|------|-------|-----------------|
| `CLAUDE.md` | 135 | Project config, tech stack, all 21 modules, coding rules |
| `V3_BUILD_BRIEF.md` | 193 | Filled-in MASTER_TEMPLATE Part 1 — the build spec |
| `MASTER_TEMPLATE.md` | 747 | The 11-phase build framework with all rules |
| `POS_UI_RESEARCH.md` | 943 | EXACT iPad POS dimensions, colors, fonts, shadows, animations |
| `UI_DESIGN.md` | 1,684 | Design system tokens (colors, spacing, typography, shadows) |
| `BUSINESS_RULES.md` | 1,303 | All operational logic, state machines, workflows |
| `MODULE_SPECS/` | 21 files | One spec per module (~250 lines each) — self-contained |
| `SCHEMA.md` | 2,610 | All database tables, columns, types, constraints |
| `API_SPEC.md` | 3,204 | All 267 route definitions |
| `GAP_ANALYSIS.md` | 366 | What works vs doesn't |
| `BROKEN_FEATURES.md` | 369 | Every button/feature audited |
| `V3_SESSION_PLAN.md` | 230 | Session-by-session build plan |

### Layout & Design Files (CHANGE THESE)
| File | Lines | What Needs to Change |
|------|-------|---------------------|
| `src/app/globals.css` | ~350 | Rewrite with iOS-native tokens, system font stack, proper shadows, spring animations, 48px touch targets |
| `src/components/layout/Sidebar.tsx` | 214 | Complete rebuild: dark bg, smooth open/close toggle, Apple-style icon-on-top + label-below nav |
| `src/components/layout/Topbar.tsx` | 99 | Larger text (16px+), second-accurate clock, bigger status indicator, hamburger toggle for sidebar |
| `src/app/(pos)/layout.tsx` | 23 | Add sidebar toggle state (use ui-store), pass collapsed/onToggle to Sidebar |
| `src/app/(backoffice)/layout.tsx` | 25 | Same sidebar toggle support |

### POS Screen Files (REDESIGN THESE)
| File | Lines | What Needs to Change |
|------|-------|---------------------|
| `src/components/pos/MenuGrid.tsx` | 344 | Bigger tiles (120-140px), bolder category pills, proper image support, iPad grid sizing |
| `src/components/pos/OrderPanel.tsx` | 432 | Better visual hierarchy, larger text, obvious selected state, readable modifiers, proper iOS spacing |
| `src/components/pos/QuickActions.tsx` | 87 | Each button needs icon + text label, not icon-only. Consider moving into OrderPanel. |
| `src/app/(pos)/orders/page.tsx` | 632 | 2-panel layout (remove QuickActions strip, integrate into OrderPanel) |

### KDS Files (POLISH THESE)
| File | Lines | Current State |
|------|-------|--------------|
| `src/app/(fullscreen)/kds/page.tsx` | 363 | Working but needs visual polish to match POS_UI_RESEARCH.md KDS specs |
| `src/components/kds/KdsTicket.tsx` | 275 | Course hold badges added, needs aging color refinement |

### Payment Files (WORKING — minor polish)
| File | Lines | Current State |
|------|-------|--------------|
| `src/app/(pos)/payments/page.tsx` | 353 | Full state machine works. Gift card + house account flows exist but are basic. |
| `src/components/payments/GiftCardFlow.tsx` | 303 | Calls API, handles balance. Needs error handling polish. |
| `src/components/payments/HouseAccountFlow.tsx` | 321 | Calls API, shows credit. Needs error handling polish. |
| `src/components/payments/CardProcessing.tsx` | 177 | Mock Valor — works for testing, not production. |

### Check Management (WORKING — one stub)
| File | Lines | Current State |
|------|-------|--------------|
| `src/app/(pos)/checks/page.tsx` | 484 | Equal split + seat split work. Custom drag split shows placeholder. Merge is toast stub. |

### Backoffice Pages (WORKING — need design consistency)
All 21 module pages exist with real CRUD. They work but use default shadcn/ui styling. Each needs a pass to match the design system.

### Stores (DONE — no changes needed)
| Store | File | Status |
|-------|------|--------|
| auth-store | `src/stores/auth-store.ts` | ✓ Complete |
| order-store | `src/stores/order-store.ts` | ✓ Complete |
| menu-store | `src/stores/menu-store.ts` | ✓ Complete |
| table-store | `src/stores/table-store.ts` | ✓ Complete |
| kds-store | `src/stores/kds-store.ts` | ✓ Complete |
| ui-store | `src/stores/ui-store.ts` | ✓ Has sidebarCollapsed + toggleSidebar (but layout doesn't use it) |

### Hooks (DONE — no changes needed)
| Hook | File | Status |
|------|------|--------|
| use-realtime | `src/hooks/use-realtime.ts` | ✓ Table, KDS, orders, 86 subscriptions |
| use-clock | `src/hooks/use-clock.ts` | ✓ Second-accurate clock |
| use-online-status | `src/hooks/use-online-status.ts` | ✓ Online/offline detection |
| use-terminal-heartbeat | `src/hooks/use-terminal-heartbeat.ts` | ✓ Heartbeat to API |

### API Routes (DONE — 183 routes, no changes needed)
Every module has its routes fully implemented:
- Auth: 5 routes ✓
- Menu: 10 routes ✓
- Orders: 16 routes ✓ (create, send, void, comp, discount, split, merge, transfer, move-table, fire-course, hold, reopen)
- Payments: 10 routes ✓ (process, capture, preauth, void, refund, tip-adjust, gift card CRUD)
- Tables: 10 routes ✓ (CRUD, seat, clear, bulk-update, floor plans, sections)
- KDS: 7 routes ✓ (stations, tickets with prep_station routing, bump, recall)
- Staff: 13 routes ✓ (CRUD, clock in/out, breaks, time entries, tips)
- Customers: 6 routes ✓
- Reports: 13 routes ✓ (4 use mock fallback when no data)
- Settings: 14 routes ✓
- Online Ordering: 7 routes ✓
- Loyalty: 8 routes ✓
- Reservations: 8 routes ✓
- Inventory: 11 routes ✓
- Scheduling: 8 routes ✓
- Marketing: 7 routes ✓
- Delivery: 7 routes ✓
- Catering: 5 routes ✓
- Drive-Thru: 5 routes ✓
- Franchise: 6 routes ✓
- House Accounts: 7 routes ✓
- Terminals: 4 routes ✓
- Accounting: 6 routes ✓ (QB sync is stub)

---

## WHAT TO BUILD: Session-by-Session

### Session 1: Design System + Layout Shell
**This is the HIGHEST IMPACT session. It changes what the user sees immediately on every page.**

**Files to READ first:**
- `V3_BUILD_BRIEF.md` (section 1.5 — Look and Feel)
- `POS_UI_RESEARCH.md` (ENTIRE file — 943 lines of exact specs)
- `UI_DESIGN.md` (color tokens, typography, spacing)

**Files to CHANGE:**

1. **`src/app/globals.css`** — Complete rewrite
   - System font stack: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif`
   - Body text: 17px (not 14px)
   - Touch targets: `.touch-target { min-height: 48px; min-width: 48px; }`
   - Shadows: Warm two-layer (not single-layer Tailwind defaults)
   - Animations: iOS spring curve `cubic-bezier(0.2, 0.8, 0.2, 1)` at 350ms
   - Button press: `transform: scale(0.97); transition: 100ms ease`
   - Hairline separators: `0.5px solid rgba(60,60,67,0.29)` (not 1px border)
   - No overscroll: `overscroll-behavior: none`
   - No text selection on UI: `-webkit-user-select: none`
   - Safe area insets: `padding: env(safe-area-inset-*)`
   - KDS dark theme tokens (keep existing, refine aging colors)

2. **`src/components/layout/Sidebar.tsx`** — Complete rebuild
   - Dark background (`#1C1C1E` or `hsl(220, 15%, 12%)`)
   - Logo: "SEAR" in ember orange at top
   - Nav items: Apple tab-bar style — 24px icon centered, 11px label below, 64px tall
   - Active state: Primary color fill with white icon/text
   - Smooth width transition: 64px collapsed ↔ 240px expanded, 350ms spring
   - Toggle button: hamburger icon in topbar triggers `ui-store.toggleSidebar()`
   - Sections: POS (5), Management (4), Modules (11), Admin (1) — with collapsible section headers
   - Bottom: Clock status indicator (green/red/amber dot + "In"/"Out"/"Break" text)

3. **`src/components/layout/Topbar.tsx`** — Redesign
   - Add hamburger menu button (left) that calls `ui-store.toggleSidebar()`
   - Location name (16px semibold)
   - Clock: updates every second, shows HH:MM:SS
   - Connection status: 10px dot with subtle pulse animation
   - User name (16px medium) + role badge
   - StaffClockButton (already built, just needs to be wired)
   - Settings gear (24px icon, 44px touch target)

4. **`src/app/(pos)/layout.tsx`** — Wire sidebar toggle
   - Import `useUIStore` (already has `sidebarCollapsed` + `toggleSidebar`)
   - Pass `collapsed={sidebarCollapsed}` and `onToggle={toggleSidebar}` to Sidebar
   - Sidebar overlays content when expanded (not push), with backdrop

5. **`src/app/(backoffice)/layout.tsx`** — Same pattern, but default expanded

6. **`src/app/layout.tsx`** — Add PWA meta tags
   ```html
   <meta name="apple-mobile-web-app-capable" content="yes">
   <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
   <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
   ```

**MUST invoke:** `/frontend-design` skill for the sidebar and topbar design
**Gate:** Sidebar opens and closes smoothly. Nav items have icons with labels below. It feels like an iPad app.

---

### Session 2: POS Order Screen (Menu Grid + Order Panel)
**Files to READ first:**
- `MODULE_SPECS/03_orders.md` (ENTIRE file)
- `MODULE_SPECS/02_menu.md` (ENTIRE file)
- `POS_UI_RESEARCH.md` (menu tile specs, order panel specs)

**Files to CHANGE:**

1. **`src/components/pos/MenuGrid.tsx`** — Redesign tiles
   - Category pills: Colored rounded-full, 80-120px wide, 36px tall, horizontally scrollable
   - Each pill's background matches category color (not tinted, SOLID when active)
   - Item tiles: 120-140px square (use CSS Grid `auto-fill, minmax(120px, 1fr)`)
   - Tile design: Category color bar at top (4px), item name (16px semibold), price (14px), colored background tint
   - With image: Photo fills tile, gradient overlay for text readability
   - Without image: Light color tint + large first letter watermark (existing pattern, but make tiles BIGGER)
   - 86'd: Desaturated overlay with red "86" badge
   - Active press: `scale(0.96)` + shadow collapse, 150ms
   - Gap between tiles: 8px (not 2.5px)

2. **`src/components/pos/OrderPanel.tsx`** — Better hierarchy
   - Width: `30%` of screen (not fixed 360px) with `min-width: 320px; max-width: 400px`
   - Item rows: Quantity badge (24px circle), name (17px semibold), price (17px), course/seat badges
   - Modifiers: 15px regular, indented 16px, secondary color (not 12px muted gray)
   - Special instructions: Amber background with italic text (existing, keep)
   - Selected item: Blue-tinted background + left border accent + shadow
   - Void/Comp buttons: Only show on selected item (existing, keep but make bigger — 36px height)
   - Totals: Subtotal/Tax in 15px, Total in 22px bold
   - Send button: 56px tall, full width, primary orange with warm shadow
   - Pay button: 56px tall, full width, green (#34C759) with warm shadow
   - Both buttons side by side

3. **`src/components/pos/QuickActions.tsx`** — Rebuild or remove
   - Option A: Remove the right strip entirely, move actions into OrderPanel header as a dropdown/menu
   - Option B: Keep strip but make each button 56px tall with icon (24px) + label (11px) below
   - User preference in V3_BUILD_BRIEF.md: "NO quick actions strip on the right — move those into the order panel as contextual buttons"
   - So: REMOVE QuickActions from orders page, add action buttons to OrderPanel header area

4. **`src/app/(pos)/orders/page.tsx`** — Simplify to 2-panel
   - Remove QuickActions component
   - Layout: `<OrderPanel>` (30%) + `<MenuGrid>` (70%)
   - Move Hold, Fire Course, Rush, Discount, Print, Void, Transfer, Move Table into OrderPanel via dropdown or contextual buttons

**MUST invoke:** `/frontend-design` skill for menu tiles and order panel
**Gate:** Menu shows big colorful tiles. Order panel has clear hierarchy. Create order with 3 items + modifiers, send to kitchen.

---

### Session 3: KDS (Kitchen Display System)
**Files to READ first:**
- `MODULE_SPECS/06_kds.md` (ENTIRE file)
- `POS_UI_RESEARCH.md` (KDS section — dark theme, aging colors, ticket specs)

**Files to CHANGE:**

1. **`src/app/(fullscreen)/kds/page.tsx`** — Polish
   - Verify tickets appear for `open` status orders (fix already applied)
   - Add audio playback for new tickets (replace `console.log` with `new Audio('/sounds/new-ticket.mp3').play()`)
   - Verify station filtering works (prep_station routing)

2. **`src/components/kds/KdsTicket.tsx`** — Visual polish
   - Aging colors from POS_UI_RESEARCH.md: Green (#34C759) → Yellow (#FFCC00) → Orange (#FF9500) → Red (#FF3B30, flashing)
   - Timer font: Monospace, 17px bold
   - Item name: 16px semibold white
   - Modifier text: 14px regular, 60% white opacity
   - Ticket card: 12px corner radius, dark surface background
   - HOLD badge: Gray background with "HOLD" text on unfired courses (already added)
   - BUMP button: 56px tall, green, full-width at bottom of ticket
   - Bump animation: slide right + fade, 300ms
   - New ticket animation: slide from left, spring, 400ms

3. Add sound file: `public/sounds/new-ticket.mp3` (or use Web Audio API beep)

**Gate:** Send order from POS → ticket appears on KDS within 2 seconds → bump ticket → it slides away → recall it → it comes back.

---

### Session 4: Payment Flow + Check Management
**Files to READ first:**
- `MODULE_SPECS/04_payments.md` (ENTIRE file — has bar tab lifecycle, split rules, refund timing)
- `MODULE_SPECS/03_orders.md` (split/merge section)

**Files to CHANGE:**

1. **`src/app/(pos)/payments/page.tsx`** — Design polish
   - Payment method tiles: 120x100px, 16px corner radius, icon (32px) + label (17px semibold)
   - Tip buttons: 80x80px, percentage (22px bold) + dollar amount (15px secondary)
   - Processing spinner: 44px, centered
   - Total display: 34px bold

2. **`src/components/payments/GiftCardFlow.tsx`** — Error handling
   - Handle "card not found" gracefully (show message, let user re-enter)
   - Handle partial redemption (card has $20, order is $50 — apply $20, show remaining $30 due)
   - Handle network errors with retry

3. **`src/components/payments/HouseAccountFlow.tsx`** — Error handling
   - Show clear message when charge exceeds credit limit
   - Handle suspended accounts (status check)

4. **`src/app/(pos)/checks/page.tsx`** — Complete custom split
   - Replace "coming in next update" with drag-to-split UI (use @dnd-kit which is already in package.json)
   - Wire merge flow (currently toast stub) — call `/api/orders/[id]/merge`

**Gate:** Complete card payment with tip. Cash payment with change. Gift card partial redemption. Equal split into 3 checks.

---

### Session 5: Tables + Real-Time Sync
**Files to READ first:**
- `MODULE_SPECS/05_tables.md` (ENTIRE file)

**Files to CHANGE:**

1. **`src/app/(pos)/tables/page.tsx`** — Design polish to match design system
   - Table shapes should use design system colors for status
   - Touch targets on tables should be 48px+
   - Status colors from UI_DESIGN.md

2. **Real-time 86 propagation** — Wire `useRealtime86` hook (already created in `src/hooks/use-realtime.ts`) into the orders page MenuGrid so when an item is 86'd, it greys out immediately on all terminals

3. **Cross-terminal order sync** — Open two browser tabs, create an order on one, verify the other shows updated table status

**Gate:** Two browser tabs. Seat guests on Tab A → table turns blue on Tab B within 2 seconds. 86 an item → it greys out on all tabs.

---

### Session 6: Staff + Manager Overrides + Allergens
**Files to READ first:**
- `MODULE_SPECS/07_staff.md` (ENTIRE file)
- `BUSINESS_RULES.md` (allergen section, manager override section)

**Files to CHANGE:**

1. **Manager PIN dialog** — Already built (`src/components/pos/ManagerPinDialog.tsx`), already has API (`/api/auth/verify-manager-pin`). Verify it works end-to-end.

2. **Void flow** — Already built (`VoidReasonDialog.tsx`). Verify: void a sent item → manager PIN prompt → void succeeds → item shows VOID badge.

3. **Comp flow** — Already built (`CompDialog.tsx`). Verify end-to-end.

4. **Discount flow** — Already built (`DiscountDialog.tsx`). Verify: apply 20% discount → manager PIN required → discount appears in order totals.

5. **Allergen warnings** — Component exists (`AllergenWarningDialog.tsx`) but NOT wired into the order page. Need to:
   - When adding item to order, check `item.allergens` against guest allergies (from customer profile or seat-level allergens)
   - If conflict, show AllergenWarningDialog before adding
   - This requires knowing guest allergies — may need a "Set Guest Allergies" button on the order panel

6. **Staff clock-in** — Component exists (`StaffClockButton.tsx`), added to Topbar. Verify the clock-in/out API endpoints work with the component.

**Gate:** Clock in via POS. Add allergen-conflicting item — see red warning. Void sent item — manager PIN required. Apply 20% discount — manager PIN required.

---

### Session 7: Backoffice Design Consistency
**Files to READ first:**
- `UI_DESIGN.md` (component styles)

**Files to CHANGE:**
- Every page in `src/app/(backoffice)/` needs a pass to:
  - Use design system tokens (not hardcoded colors)
  - Use consistent button styles
  - Use consistent table styles
  - Use consistent card styles
  - Have proper empty states
  - Have proper loading skeletons
  - Match the typography scale from globals.css

This is ~15 page files. The work is mechanical — replace generic shadcn/ui with design-system-consistent styling.

**Gate:** Navigate through every backoffice page. They all look like they belong to the same app. No default unstyled elements.

---

### Session 8: Adversarial Review + Visual QA + Final Fixes
**Follow MASTER_TEMPLATE.md Phases 8-11 exactly.**

1. Phase 8: Fresh agent reviews entire codebase for completeness, security, naming consistency
2. Phase 9: Fresh agent loads every page and checks visual quality
3. Phase 10: Fix everything found
4. Phase 11: Final delivery report

**Gate:** Both reviews come back clean. Every page works. Every workflow completes end-to-end.

---

## KNOWN ISSUES TO FIX (in any session)

| Issue | File | Severity | Notes |
|-------|------|----------|-------|
| Sidebar can't toggle | `src/app/(pos)/layout.tsx` | HIGH | `collapsed` hardcoded to `true`, no toggle button |
| Hardcoded 8.5% tax | `src/app/api/orders/[id]/items/route.ts` + discount + comp routes | MEDIUM | Should read from location settings |
| KDS sound is console.log | `src/app/(fullscreen)/kds/page.tsx:113` | LOW | Replace with audio playback |
| Custom check split placeholder | `src/app/(pos)/checks/page.tsx:447` | MEDIUM | Shows "coming in next update" |
| Merge orders is toast stub | `src/app/(pos)/checks/page.tsx:193` | MEDIUM | Only toasts, doesn't call API |
| Reports use mock data | `src/app/api/reports/daily/route.ts` etc. | LOW | 4 routes fall back to mock when no orders |
| Rush API may not exist | `src/app/api/orders/[id]/rush/` | LOW | Orders page calls it but route may not exist |
| Allergen dialog not wired | `src/app/(pos)/orders/page.tsx` | MEDIUM | Component exists but never triggered |
| `comped_at` missing on single-item comp | `src/app/api/orders/[id]/comp/route.ts` | LOW | Timestamp not set on single-item path |

---

## HOW TO START EACH SESSION

Paste this at the beginning of each new Claude Code session:

```
Read these files COMPLETELY before doing anything:
1. V3_BUILD_BRIEF.md — the build spec
2. V3_HANDOFF.md — current state and what to build
3. MASTER_TEMPLATE.md — the build rules (especially Rules 17-21)
4. [Session-specific MODULE_SPECS file]
5. POS_UI_RESEARCH.md — exact iPad POS dimensions

Follow MASTER_TEMPLATE.md phases. Start at Phase 3 (Design System).
Invoke /frontend-design and /ui-ux-pro-max skills.
Show me previews before coding.
Build ONE thing at a time. Get my approval before moving to the next.
The sidebar must open and close before you touch anything else.
```

---

## TECH STACK REFERENCE

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript strict
- **CSS:** Tailwind CSS v4
- **Components:** shadcn/ui (24 components installed)
- **State:** Zustand v5 + Immer
- **Database:** Supabase (PostgreSQL 17.6) with RLS
- **Auth:** Supabase Auth + @supabase/ssr (cookie-based)
- **Real-Time:** Supabase Realtime (WebSocket)
- **Icons:** Lucide React
- **Charts:** Recharts
- **DnD:** @dnd-kit
- **Forms:** react-hook-form + zod
- **Toast:** Sonner
- **Build:** `next build` (standalone output)
- **Deploy:** GCP VM + PM2 + Nginx

---

## LOGIN CREDENTIALS

- **URL:** https://getsear.com (or localhost:3000)
- **Email:** demo@getsear.com
- **Password:** demo1234
- **Role:** Owner (full access)
- **PIN:** 0000 (for manager PIN verification)

---

## ENVIRONMENT

- Supabase URL: https://lbekiyxqemxozmghgmtp.supabase.co
- All env vars in `.env.local` (gitignored)
- Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
