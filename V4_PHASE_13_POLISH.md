# V4 Phase 13: Visual QA & Final Polish — Build Brief

**Date:** 2026-03-23
**Phase:** 13 of 13
**Goal:** Every screen looks like it belongs in a $50M product
**Format:** MASTER_TEMPLATE.md Part 1 (Sections 1.1-1.9)
**Est. Sessions:** 2-3

---

## 1.1 What is this?

A comprehensive visual QA and polish pass across the entire Sear POS application. This is not a feature build — it is a systematic audit and remediation of every page, every component, every transition, and every state (empty, loading, error) to reach shipping quality. The target is Apple HIG-level polish: consistent typography, 8px grid alignment, spring-physics animations, WCAG 2.1 AA accessibility, and pixel-perfect rendering at iPad 1194x834 as the primary viewport. When this phase is complete, every screen passes a side-by-side comparison with Toast/Square/Clover and wins.

---

## 1.2 Tech stack

No new dependencies. This phase works within the existing stack:

- **Framework:** Next.js 15 (App Router), TypeScript strict
- **Styling:** Tailwind CSS v4, CSS custom properties from UI_DESIGN.md
- **Components:** shadcn/ui (customized via design tokens)
- **Animations:** CSS transitions + Tailwind `transition-*` utilities (add `framer-motion` only if spring physics cannot be achieved with CSS alone)
- **Testing:** Playwright for visual regression, axe-core for accessibility
- **Design Reference:** Apple Design Resources Figma Kit (iPadOS), UI_DESIGN.md

---

## 1.3 User roles

This phase affects all roles equally. Every screen every role sees must pass QA:

- **Server/Bartender:** POS order entry, checks, payments, tables, KDS (fullscreen)
- **Manager:** All POS screens + back-office (reports, staff, menu, settings)
- **Owner/Admin:** All manager screens + franchise, house accounts, advanced settings
- **Kitchen Staff:** KDS fullscreen
- **Host:** Tables, reservations
- **Public/Unauthenticated:** Login, PIN login, register

---

## 1.4 Pages and features — Complete Audit Inventory

Every page listed below must pass ALL audit criteria (typography, color, spacing, touch targets, empty state, loading skeleton, error state, animation, accessibility).

### Auth Pages (3)
| # | Page | Route | Key Components |
|---|------|-------|----------------|
| 1 | Login | `/(auth)/login` | Email/password form, Sear branding, error states |
| 2 | PIN Login | `/(auth)/pin-login` | PIN pad, staff selector, quick-switch |
| 3 | Register | `/(auth)/register` | Multi-step org setup form |

### POS Pages (4)
| # | Page | Route | Key Components |
|---|------|-------|----------------|
| 4 | Order Entry | `/(pos)/orders` | MenuGrid, OrderPanel, ModifierSheet, SeatSelector, CourseSelector, QuickActions, AllergenWarningDialog, VoidReasonDialog, DiscountDialog, CompDialog, OrderTransferDialog, TableMoveDialog, ManagerPinDialog, StaffClockButton |
| 5 | Checks | `/(pos)/checks` | Check list, filters, status badges |
| 6 | Payments | `/(pos)/payments` | PaymentMethodGrid, CashTender, TipSelector, CardProcessing, ReceiptOptions, PaymentComplete, GiftCardFlow, HouseAccountFlow |
| 7 | Tables | `/(pos)/tables` | FloorPlanCanvas, TableShape, TablePopover, SectionFilter, StatusSummary |

### KDS Pages (1)
| # | Page | Route | Key Components |
|---|------|-------|----------------|
| 8 | Kitchen Display | `/(fullscreen)/kds` | KdsTicket, KdsTimer, KdsAllDay, KdsRecallDrawer, KdsStationTabs |

### Back-Office Pages (29)
| # | Page | Route | Key Components |
|---|------|-------|----------------|
| 9 | Dashboard | `/(backoffice)/backoffice` | KPI cards, quick links, alerts |
| 10 | Menu Management | `/(backoffice)/menu` | CategoryPanel, ItemGrid, ItemDetailSheet, ModifierGroupManager |
| 11 | Staff | `/(backoffice)/staff` | Staff table, detail sheets, clock history |
| 12 | Customers | `/(backoffice)/customers` | Customer table, detail view, merge, VIP |
| 13 | Reports Hub | `/(backoffice)/reports` | Report card grid, navigation |
| 14 | Sales Report | `/(backoffice)/reports/sales` | KPICard, HourlySalesChart, DateRangePicker |
| 15 | Labor Report | `/(backoffice)/reports/labor` | Labor charts, overtime alerts |
| 16 | Product Mix | `/(backoffice)/reports/product-mix` | PMIXScatter, CategoryMixChart, TopItemsChart |
| 17 | Server Perf | `/(backoffice)/reports/server-performance` | Server comparison, tip analysis |
| 18 | Online Ordering | `/(backoffice)/online-ordering` | Order queue, settings |
| 19 | Reservations | `/(backoffice)/reservations` | Calendar view, waitlist, SMS status |
| 20 | Inventory | `/(backoffice)/inventory` | Stock table, par levels, PO list |
| 21 | Loyalty | `/(backoffice)/loyalty` | Program config, member list, tiers |
| 22 | Scheduling | `/(backoffice)/scheduling` | Shift grid, availability, swaps |
| 23 | Marketing | `/(backoffice)/marketing` | Campaign list, builder, analytics |
| 24 | Delivery | `/(backoffice)/delivery` | Driver list, zone map, active deliveries |
| 25 | Catering | `/(backoffice)/catering` | Event list, BEO detail, invoices |
| 26 | House Accounts | `/(backoffice)/house-accounts` | Account list, statements, limits |
| 27 | Drive-Thru | `/(backoffice)/drive-thru` | Lane status, speed metrics |
| 28 | Franchise | `/(backoffice)/franchise` | Location grid, sync status, royalties |
| 29 | Settings Hub | `/(backoffice)/settings` | Settings card grid |
| 30 | Organization | `/(backoffice)/settings/organization` | Org detail form |
| 31 | Locations | `/(backoffice)/settings/locations` | Location list, detail form |
| 32 | Tax Rates | `/(backoffice)/settings/tax-rates` | Tax rate table, add/edit |
| 33 | Roles | `/(backoffice)/settings/roles` | Role list, permission matrix |
| 34 | Terminals | `/(backoffice)/settings/terminals` | Terminal list, pairing |
| 35 | Modules | `/(backoffice)/settings/modules` | Module toggle grid |
| 36 | Accounting | `/(backoffice)/settings/accounting` | Integration config |

### Root Page (1)
| # | Page | Route | Key Components |
|---|------|-------|----------------|
| 37 | Landing/Redirect | `/` | Auth check, redirect logic |

**Total: 37 pages, 75+ components**

---

### What gets audited and fixed on EVERY page:

**A. Typography Audit**
- All text uses the iOS type scale defined in UI_DESIGN.md (no arbitrary font sizes)
- Heading hierarchy is consistent (h1 > h2 > h3, never skipping levels)
- Line height and letter spacing match design tokens
- Font weights: 400 (body), 500 (labels/UI), 600 (subheadings), 700 (headings) — no other weights
- No orphaned single words on a line for headings
- Monospace font for monetary values and data fields

**B. Color Audit**
- Zero hardcoded hex/rgb/hsl values in any component — all reference CSS custom properties
- Every background uses `--background`, `--background-subtle`, or `--background-muted`
- Every text color uses `--text-primary`, `--text-secondary`, or `--text-muted`
- Brand color (`--primary`) used only for CTAs, active states, and key indicators — never decorative
- Semantic colors used correctly: `--success` for positive, `--warning` for caution, `--error` for destructive
- No blue (#3b82f6 or similar) anywhere — replaced with brand ember or appropriate semantic color

**C. Spacing Audit (8px Grid)**
- All padding and margin values are multiples of 4px (4, 8, 12, 16, 20, 24, 32, 40, 48, 64)
- Card padding: 16px (compact) or 24px (standard)
- Section gaps: 24px or 32px
- Page margins: 24px on iPad
- No arbitrary spacing values (e.g., 13px, 17px, 22px, 37px)
- Consistent spacing between related elements across all pages

**D. Touch Target Audit**
- Every tappable element is minimum 44x44px (per Apple HIG)
- Primary action buttons are 48px height minimum
- Icon buttons have 44px tap area (even if icon is 20px, pad to 44px)
- Table rows with tap actions are minimum 48px height
- Dropdown triggers, checkboxes, radio buttons, switches all meet 44px
- No elements where tapping requires precision (e.g., tiny X close buttons)

**E. Empty State Design**
- Every list, grid, table, and data view has a designed empty state
- Empty states include: relevant illustration/icon (Lucide), descriptive headline, helpful subtext, and a primary CTA
- Empty states are centered vertically and horizontally in the available space
- No blank white screens anywhere in the app
- The `EmptyState` shared component is used consistently (no ad-hoc empty states)
- Empty state copy is specific to context (not generic "No data found")

Pages requiring empty state audit:
1. Orders page — no open orders
2. Checks page — no checks
3. Payments page — no pending payments
4. Tables page — no tables configured
5. KDS page — no tickets
6. Menu page — no categories, no items in category
7. Staff page — no staff members
8. Customers page — no customers
9. Reports (all 4) — no data for date range
10. Online Ordering — no online orders
11. Reservations — no reservations, no waitlist entries
12. Inventory — no inventory items, no purchase orders
13. Loyalty — no loyalty members, no rewards configured
14. Scheduling — no shifts, no availability
15. Marketing — no campaigns
16. Delivery — no active deliveries, no drivers
17. Catering — no events
18. House Accounts — no accounts
19. Drive-Thru — no lanes configured
20. Franchise — no locations
21. Settings: Locations — no locations
22. Settings: Tax Rates — no tax rates
23. Settings: Roles — no custom roles
24. Settings: Terminals — no terminals paired
25. Settings: Modules — (always has data, but disabled module state)

**F. Loading Skeleton Design**
- Every async data fetch shows a skeleton loader (not a spinner, not a blank screen)
- Skeletons match the shape and layout of the real content (card skeleton, table skeleton, chart skeleton)
- The `LoadingSkeleton` shared component is used with appropriate variants
- Skeleton pulse animation is consistent (same timing, same easing)
- Suspense boundaries wrap every async component in every route
- `loading.tsx` exists for every route group: `(auth)`, `(pos)`, `(backoffice)`, `(fullscreen)`

**G. Error State Design**
- Every API call has error handling with a user-facing error state
- Error states include: error icon, descriptive message (not technical), and a "Try Again" button
- Network errors show a distinct offline/connection-lost state
- 404 states for invalid routes show a branded "not found" page
- Form validation errors appear inline below the field, with `--error` color
- Toast notifications for transient errors use consistent styling via Sonner
- `error.tsx` exists for every route group

**H. Animation Polish**
- Page transitions: subtle fade-in (150ms ease-out)
- Sheet/drawer open: slide up with spring physics (damping 0.8, stiffness 300)
- Dialog open: scale from 0.95 to 1.0 + fade (200ms ease-out)
- Button press: scale to 0.97 on `:active` (100ms), return on release (150ms spring)
- Card hover (desktop): subtle lift via shadow increase (200ms ease-out)
- Tab switch: content cross-fade (150ms)
- List item add/remove: height animate in/out (200ms ease-in-out)
- KDS ticket bump: satisfying slide-off-right (300ms spring)
- Badge count change: number scale bounce (200ms)
- Skeleton shimmer: consistent 1.5s infinite linear gradient sweep
- No animation on `prefers-reduced-motion: reduce`
- No janky/interrupted animations (every animation has proper `will-change` or transforms)

**I. Apple Design Resources Reference Check**
- Download and reference the Apple Design Resources Figma kit for iPadOS
- Compare every component against Apple HIG equivalents:
  - Navigation bars vs Topbar
  - Tab bars vs bottom navigation
  - Sheets/drawers vs iOS page sheets
  - Alerts/dialogs vs iOS alert style
  - Lists/tables vs iOS grouped list style
  - Segmented controls vs tab components
  - Toggle switches vs iOS switch
  - Text fields vs iOS text input
  - Buttons vs iOS button styles
- Not pixel-matching Apple — but matching the QUALITY and FEEL
- Corner radii: buttons 10px, cards 12px, modals 16px, sheets 16px top (matching iOS 17)
- Blur effects on overlays: `backdrop-filter: blur(20px)` for sheets and popovers

**J. Accessibility Audit (WCAG 2.1 AA)**
- Contrast ratios: all text meets 4.5:1 (normal) or 3:1 (large text, 18px+ or 14px+ bold)
- All images and icons have appropriate `alt` text or `aria-label`
- All form inputs have associated `<label>` elements (not just placeholder text)
- Focus indicators: visible 2px outline on every focusable element (keyboard navigation)
- Focus order follows visual order (no tab-index jumps)
- All interactive elements reachable via keyboard (Tab, Enter, Space, Escape)
- Escape closes all modals, sheets, drawers, popovers
- Screen reader landmarks: `<main>`, `<nav>`, `<aside>`, `<header>` used correctly
- `aria-live` regions for dynamic content (order totals, KDS ticket counts, toast notifications)
- Color is never the ONLY indicator of state (always paired with icon, text, or shape)
- No auto-playing audio without user interaction
- `role` attributes on custom interactive components (combobox, tablist, etc.)

**K. Cross-Browser Testing Matrix**

| Browser | Device | Viewport | Priority |
|---------|--------|----------|----------|
| Safari 17+ | iPad (10th gen) | 1194x834 | PRIMARY — this is the main target |
| Safari 17+ | iPad Pro 12.9" | 1366x1024 | HIGH |
| Safari 17+ | iPad Mini 6 | 1133x744 | HIGH |
| Chrome 120+ | Android tablet (Samsung Tab S9) | 1200x800 | HIGH |
| Safari 17+ | macOS Sonoma | 1440x900 | MEDIUM |
| Chrome 120+ | macOS/Windows | 1440x900 | MEDIUM |
| Firefox 120+ | macOS/Windows | 1440x900 | LOW |

Testing focus per browser:
- Safari iPad: all POS workflows, touch interactions, PWA behavior, safe area insets
- Chrome Android: layout consistency, font rendering, touch behavior
- Desktop browsers: back-office pages, keyboard shortcuts, hover states

---

## 1.5 Look and feel

All specifications come from UI_DESIGN.md. This phase enforces them — it does not change them.

- **Mode:** Light only (no dark mode)
- **Vibe:** Premium, warm, fast, confident, professional
- **Reference products:** Stripe Dashboard (clarity), Linear (precision), Square POS (touch), Toast (functionality to beat)
- **Color direction:** Warm off-white base (`#FDFBF7`), ember orange accent (`#F06B18`), warm gray text hierarchy
- **Typography:** System font stack (SF Pro on Apple, Inter fallback), iOS type scale
- **Animation quality:** Fluid native-iOS feel with spring physics on every transition
- **Quality bar:** Must feel like a $50M startup's shipped product — side-by-side with Toast/Square and it wins
- **Device target:** iPad landscape primary (1194x834), desktop secondary
- **Specific visual elements required:** Warm-tinted shadows (not blue-gray), skeleton loading states on every async load, `backdrop-filter: blur(20px)` on all overlays, 12px card radius, spring-physics on sheets and drawers
- **Things explicitly forbidden:** Pure white (`#FFFFFF`) as page background, cold gray text, blue accent colors, generic Bootstrap/Tailwind default look, spinners instead of skeletons, borders instead of shadows for card elevation, any hardcoded color values

---

## 1.6 Business rules and special behavior

- **No visual regressions.** Every fix must be verified against all affected pages. Changing a shared component (Button, Card, Table) requires re-checking every page that uses it.
- **Performance budget.** No animation may cause frame drops below 60fps on iPad 10th gen. All `will-change` properties must be cleaned up after animation completes. No layout thrashing (forced synchronous layouts).
- **Reduced motion.** All animations must respect `prefers-reduced-motion: reduce`. When active, animations are replaced with instant state changes (no motion, but opacity fades are OK).
- **Touch feedback is mandatory.** Every tappable element must provide immediate visual feedback (scale, color change, or opacity shift) within 100ms of touch start. Users must never wonder "did I tap that?"
- **Skeleton fidelity.** Skeletons must match the real content layout closely enough that there is no visible layout shift when real data loads. CLS (Cumulative Layout Shift) target: < 0.1.
- **Empty states drive action.** Every empty state must include a CTA that starts the relevant workflow (e.g., "Add your first menu item" button on empty menu page).
- **Error recovery.** Every error state must include a recovery action. No dead ends.

---

## 1.7 Integrations

No new external integrations. This phase audits the visual presentation of existing integrations:

- **Valor PayTech:** Card processing animation (waiting for terminal), success/failure states
- **Supabase Realtime:** Connection status indicator, reconnection animation
- **Twilio/SendGrid:** SMS/email send confirmation toasts, failure states
- **Printer:** Print job status toasts, printer offline warning

---

## 1.8 Modules and features planned but not for this phase

This phase does NOT add new functionality. It only polishes existing functionality:

- No new API routes
- No new database tables or columns
- No new business logic
- No new pages or features
- No refactoring of data layer or state management

If a component is broken (not just ugly), file it as a separate bug — do not fix logic bugs in this phase unless they are purely visual (e.g., wrong color for a status badge).

---

## 1.9 Anything else

### Audit Process (Systematic, Not Ad-Hoc)

The audit must follow a repeatable process for each of the 37 pages:

1. **Screenshot at 1194x834** — capture current state
2. **Checklist pass** — run every audit (A through K) against the page, noting failures
3. **Fix batch** — group fixes by type (all typography fixes together, all spacing fixes together, etc.) for efficiency
4. **Re-screenshot** — verify fixes, compare before/after
5. **Cross-browser spot check** — verify the page in Safari iPad, Chrome Android, desktop Safari

### Files to Create or Modify

**New shared components (if not already adequate):**
- `src/components/shared/EmptyState.tsx` — audit and enhance with per-context variants
- `src/components/shared/LoadingSkeleton.tsx` — audit and add variants for every content type (card, table, chart, list, grid)
- `src/components/shared/ErrorState.tsx` — create if missing (error icon + message + retry)
- `src/components/shared/PageTransition.tsx` — create if spring-physics wrapper needed

**Route-level files to verify/create:**
- `src/app/(auth)/loading.tsx`
- `src/app/(auth)/error.tsx`
- `src/app/(pos)/loading.tsx`
- `src/app/(pos)/error.tsx`
- `src/app/(backoffice)/loading.tsx`
- `src/app/(backoffice)/error.tsx`
- `src/app/(fullscreen)/loading.tsx`
- `src/app/(fullscreen)/error.tsx`
- `src/app/not-found.tsx` — branded 404 page

**Global CSS:**
- `src/app/globals.css` — verify all design tokens present, add animation keyframes, add `prefers-reduced-motion` media query

**Every component in `src/components/`** — audit for hardcoded colors, incorrect spacing, missing aria attributes, missing press feedback.

### Design Token Enforcement Script

Create a one-time audit script (`src/scripts/audit-design-tokens.ts`) that scans all `.tsx` files for:
- Hardcoded hex colors (e.g., `#3b82f6`, `#ffffff`, `#000000`)
- Hardcoded rgb/hsl values not matching design tokens
- Tailwind color classes that bypass the design system (e.g., `bg-blue-500`, `text-gray-400`)
- Spacing values not on the 4px grid (e.g., `p-[13px]`, `gap-[7px]`)
- Font sizes not in the type scale (e.g., `text-[15px]` without a design token)
- Missing `aria-label` on icon-only buttons

Output: a violations report grouped by file, with line numbers and suggested fixes.

### Priority Order for Fixes

1. **POS pages first** (orders, checks, payments, tables) — these are used during service, most visible
2. **KDS** — used during service, fullscreen
3. **Auth pages** — first impression
4. **Back-office dashboard + reports** — high-value owner-facing pages
5. **Menu management + staff** — high-traffic back-office
6. **Settings** — less visible but must be consistent
7. **Optional modules** (online ordering, loyalty, scheduling, etc.) — least urgent but must not look unfinished

### Component-Level Audit Checklist

For each of the 75+ components, verify:

| Check | Description |
|-------|-------------|
| Colors | Zero hardcoded values — all use `var(--token)` or Tailwind design-token classes |
| Spacing | All padding/margin/gap on 4px grid |
| Typography | Font size, weight, color from design tokens |
| Touch | Tappable areas >= 44px in both dimensions |
| Press | `:active` state with scale/opacity feedback |
| Focus | Visible focus ring for keyboard navigation |
| ARIA | Labels on icon buttons, roles on custom widgets, live regions on dynamic content |
| Radius | Correct corner radius per component type (buttons 10px, cards 12px, modals 16px) |
| Shadow | Warm-tinted shadows, no default Tailwind gray shadows |
| Animation | Transitions use spring physics where appropriate, respect reduced motion |

---

## Acceptance Criteria

Every checkbox must pass before this phase is considered complete.

### Typography (5)
- [ ] All 37 pages use only design-token font sizes — zero arbitrary `text-[Xpx]` values that do not map to the type scale
- [ ] Heading hierarchy is correct on every page (h1 for page title, h2 for sections, h3 for subsections — no skipped levels)
- [ ] Font weight usage is consistent: 400 body, 500 UI/labels, 600 subheadings, 700 headings — no other weights
- [ ] Monetary values use tabular-nums (monospace figures) for column alignment in all tables and reports
- [ ] All text passes WCAG 2.1 AA contrast ratio (4.5:1 normal, 3:1 large)

### Color (4)
- [ ] Design token audit script finds ZERO hardcoded color values in any `.tsx` file
- [ ] No Tailwind default color classes used (no `blue-500`, `gray-400`, `green-600`, etc.) — all mapped to design tokens
- [ ] Semantic colors used correctly everywhere: success=green, warning=amber, error=red, info=brand
- [ ] Brand ember orange appears only on primary CTAs, active nav items, and key indicators — never as decoration

### Spacing (3)
- [ ] Design token audit script finds ZERO spacing values that are not multiples of 4px
- [ ] All cards use consistent padding (16px compact, 24px standard) — no mixed padding on the same page
- [ ] Page margins are 24px on iPad across all 37 pages

### Touch Targets (3)
- [ ] Every tappable element on POS pages (orders, checks, payments, tables) measures at least 44x44px
- [ ] Every tappable element on KDS page measures at least 44x44px
- [ ] Icon-only buttons across the entire app have at least 44x44px tap area with visible focus ring

### Empty States (3)
- [ ] All 25 identified empty-state locations render a designed empty state (icon + headline + subtext + CTA)
- [ ] Every empty state CTA navigates to or opens the relevant creation workflow
- [ ] No page in the app shows a blank white area when data is absent

### Loading States (3)
- [ ] Every route group has a `loading.tsx` file with a content-matched skeleton
- [ ] Skeleton loaders match the layout of real content closely enough that CLS < 0.1 on data load
- [ ] Skeleton shimmer animation is identical across all instances (same timing, same gradient)

### Error States (3)
- [ ] Every route group has an `error.tsx` file with a branded error screen and "Try Again" action
- [ ] Network/API errors show a user-friendly message (not raw error text or stack traces)
- [ ] All form validation errors appear inline below the field with `--error` color and a clear message

### Animations (4)
- [ ] Button press feedback (scale 0.97) is present on EVERY button and tappable card in the app
- [ ] Sheet/drawer open animations use spring physics (not linear or ease-in-out)
- [ ] All animations respect `prefers-reduced-motion: reduce` (verified by toggling OS setting)
- [ ] No animation causes frame drops below 60fps on iPad 10th gen (verified via Safari Web Inspector)

### Accessibility (4)
- [ ] axe-core automated scan reports ZERO violations on all 37 pages
- [ ] All 37 pages are fully navigable via keyboard only (Tab, Enter, Space, Escape, Arrow keys)
- [ ] All form inputs have visible associated labels (not placeholder-only)
- [ ] Screen reader reads correct content order and announces all interactive elements on POS order entry page

### Cross-Browser (3)
- [ ] All POS pages render correctly on Safari iPad (1194x834) with no layout breaks or overflow
- [ ] All POS pages render correctly on Chrome Android tablet (1200x800) with no layout breaks
- [ ] All back-office pages render correctly on desktop Safari and Chrome (1440x900) with no layout breaks

### Polish (3)
- [ ] Side-by-side comparison: POS order entry screen vs Toast order entry screen — Sear is visually superior (cleaner hierarchy, better touch targets, more modern feel)
- [ ] Side-by-side comparison: KDS screen vs Toast KDS — Sear is visually superior
- [ ] No visible layout shift, flash of unstyled content, or white flash on any page load or navigation

**Total acceptance criteria: 38**

---

## QA Workflows

These are end-to-end visual verification workflows. Each must be performed at iPad 1194x834 viewport.

### QA Workflow 1: New Restaurant First Run (Empty State Tour)
1. Log in as a new org owner with zero data
2. Navigate to every back-office page in order: Dashboard, Menu, Staff, Customers, Reports (all 4), Online Ordering, Reservations, Inventory, Loyalty, Scheduling, Marketing, Delivery, Catering, House Accounts, Drive-Thru, Franchise
3. Verify each page shows a designed empty state (not blank)
4. Verify each empty state has a CTA that initiates the relevant workflow
5. Navigate to Settings > each sub-page — verify empty states
6. Navigate to POS > Orders — verify empty menu grid state
7. Navigate to POS > Checks — verify empty check list
8. Navigate to POS > Tables — verify empty floor plan state
9. Navigate to KDS — verify empty ticket board
10. **Pass criteria:** Zero blank screens encountered across all 37 pages

### QA Workflow 2: Full POS Shift (Animation & Touch Polish)
1. Log in via PIN pad — verify PIN button press feedback (scale + color)
2. Open order entry — verify menu grid loads with skeleton then populates (no layout shift)
3. Tap a category — verify category switch animation (cross-fade, no flicker)
4. Tap a menu item — verify press feedback (scale 0.97)
5. Modifier sheet opens — verify spring-physics slide-up animation
6. Select modifiers, close sheet — verify spring-physics slide-down
7. Add 5 items to order — verify each item animates into the order panel (height expand)
8. Tap an item in order panel — verify edit popover animation (scale + fade)
9. Open discount dialog — verify dialog scale-in animation
10. Process payment — tap payment method — verify press feedback
11. Cash tender — verify numpad button press feedback
12. Payment complete — verify success animation (checkmark + fade)
13. **Pass criteria:** Every interaction has immediate visual feedback; no janky transitions

### QA Workflow 3: KDS Dinner Rush (Performance & Readability)
1. Open KDS at fullscreen iPad viewport
2. Load 12+ tickets across multiple stations
3. Verify ticket typography is readable at arm's length (kitchen distance)
4. Verify time badges update and color-code correctly (green -> yellow -> red)
5. Bump a ticket — verify satisfying slide-off animation at 60fps
6. Recall a ticket — verify recall drawer spring-physics animation
7. Switch stations via tabs — verify tab switch animation
8. Verify all-day count updates animate (number scale bounce)
9. Let tickets age past critical threshold — verify visual escalation (flash, color change)
10. **Pass criteria:** All animations at 60fps; text readable at 1 meter; no visual jank with 12+ tickets

### QA Workflow 4: Back-Office Report Deep Dive (Data Visualization Polish)
1. Navigate to Reports > Sales — verify skeleton loaders for all chart areas
2. Change date range — verify charts animate data transition (not instant swap)
3. Verify KPI cards have consistent typography and spacing
4. Verify chart colors use design tokens (no default Recharts blue/green/red)
5. Navigate to Product Mix — verify scatter plot is legible and interactive
6. Navigate to Labor — verify labor charts use semantic colors
7. Navigate to Server Performance — verify table has proper row hover states
8. Resize browser window from 1440px to 1194px — verify responsive layout
9. **Pass criteria:** All charts use design tokens; all data transitions are animated; no layout breaks on resize

### QA Workflow 5: Accessibility Full Pass
1. Enable VoiceOver on iPad (or screen reader on desktop)
2. Navigate from Login through to Order Entry using only keyboard (Tab/Enter/Space/Escape)
3. Verify every form field is announced with its label
4. Verify every button is announced with its action
5. Tab through order entry — verify focus order matches visual order (left to right, top to bottom)
6. Open a modal/sheet — verify focus is trapped inside (Tab does not escape)
7. Press Escape — verify modal closes and focus returns to trigger element
8. Navigate to a report page — verify charts have text alternatives or aria descriptions
9. Enable `prefers-reduced-motion: reduce` in OS settings
10. Repeat workflow 2 — verify all animations are replaced with instant transitions (no motion)
11. **Pass criteria:** Full keyboard navigation works; screen reader reads all content correctly; reduced motion is respected

### QA Workflow 6: Cross-Browser Visual Comparison
1. Open POS order entry on Safari iPad (1194x834) — screenshot
2. Open same page on Chrome Android tablet (1200x800) — screenshot
3. Open same page on desktop Chrome (1440x900) — screenshot
4. Compare all three: layout, typography, spacing, colors, shadows must be visually consistent
5. Repeat for: Payments page, KDS page, Reports/Sales page, Menu management page
6. Check for Safari-specific issues: `-webkit-backdrop-filter`, safe area insets, rubber-band scroll
7. Check for Chrome Android issues: font rendering differences, touch behavior, scrollbar styling
8. **Pass criteria:** No layout breaks, missing elements, or significant rendering differences across browsers

### QA Workflow 7: Loading & Error State Verification
1. Throttle network to Slow 3G in browser dev tools
2. Navigate to every POS page — verify skeleton loaders appear (not white screens or spinners)
3. Navigate to every back-office page — verify skeleton loaders appear
4. Block API requests entirely (simulate full offline)
5. Navigate to POS order entry — verify error state appears with retry button
6. Tap retry — verify it attempts to reload
7. Enter invalid data in a form (staff creation, menu item) — verify inline validation errors below each field
8. Trigger a server error (invalid API call) — verify toast notification with user-friendly message
9. Navigate to a non-existent route — verify branded 404 page
10. **Pass criteria:** Every async load shows a skeleton; every error shows a recovery action; no raw error text visible

---

## Definition of Done

This phase is complete when:

1. All 38 acceptance criteria checkboxes are checked
2. All 7 QA workflows pass without issues
3. The design token audit script (`src/scripts/audit-design-tokens.ts`) reports zero violations
4. Before/after screenshots exist for every page that received fixes
5. No visual regressions introduced (every fix verified against related pages that share the modified component)
6. The application passes an axe-core automated accessibility scan with zero violations on all 37 pages
7. A non-technical person (Ian) can navigate every page on an iPad and say "this looks like a real product"
