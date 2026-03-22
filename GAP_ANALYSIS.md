# Sear POS v2 — Brutally Honest Gap Analysis

**Date:** 2026-03-22
**Reviewed by:** Claude Opus 4.6 (independent analysis)
**Files reviewed:** 50+ source files, all spec documents, all module specs

---

## SECTION 1: HONEST ASSESSMENT — What We Actually Built vs. What a Real POS Needs

### The Headline

We built a **well-structured prototype** with good UI bones and real API routes that talk to Supabase. The architecture is sound: Next.js App Router, Zustand stores, shadcn/ui components with a custom design system, Zod validation on API routes. The visual quality is above average for an AI-generated build.

But here is the truth: **no restaurant can run on this software today**. Not even for a single lunch service.

### What Actually Works (End-to-End)

1. **Order Entry (partial):** You can open a draft order, tap menu items, select modifiers, see a running total, and hit "Send to Kitchen." The modifier sheet validates required selections. Items display with prices and quantities. This is the single most complete workflow in the system.

2. **Menu Manager (mostly):** You can create categories, create items with prices, assign modifier groups, toggle 86 status, reorder items via drag-and-drop. The 3-panel layout works. This is close to production quality.

3. **Payment Flow (surface level):** The payment page has a real state machine: method_select -> processing_card/cash -> tip_prompt -> receipt_prompt -> complete. The CashTender component calculates change. The CardProcessing component simulates card processing. But it does NOT actually call Valor APIs.

4. **Module Toggle:** The modules page lets you enable/disable modules with dependency checking. The switches work. But the "Configure" buttons mostly just navigate to pages that may or may not exist.

5. **Online Ordering (UI complete):** Order queue with accept/reject, menu configuration, throttle settings. API routes exist. One of the most complete module implementations.

6. **Reports — Sales (presentable):** Chart rendering with Recharts, date range picker, summary cards, data table with totals. Uses mock data fallback when API has no real data. Looks professional.

### What Does NOT Work

1. **Payments do not process.** The CardProcessing component simulates a card approval after a timeout. No Valor API integration exists. No real money can flow through this system. The `handleCardApproved` callback receives fake data. Cash handling calculates change but does not kick a cash drawer. Gift card support is a stub that jumps straight to receipt.

2. **Orders do not persist correctly.** The `handleSendToKitchen` function in `orders/page.tsx` creates the order on the server and then adds items one-by-one in a sequential loop (`for...of`). No transaction wrapping. No error handling for partial failures. If the 3rd of 5 items fails, you have a corrupted order.

3. **Check splitting does not function.** The checks page (`/checks`) displays open orders and shows split option buttons (Equal Split, By Seat, Custom). But the buttons do nothing. The "Split by Seat" button and "Start Custom Split" button have no click handlers that perform any actual splitting logic. The "Process Payment" button has no `onClick`. This is a wireframe with interactive-looking buttons.

4. **No KDS routing.** When an order is "sent to kitchen," the API marks items as `is_sent = true` in the database. But there is no mechanism to route items to specific kitchen stations. The KDS page exists with ticket components and station tabs, but items are not routed by `prep_station`. A real kitchen needs items to go to the correct station automatically.

5. **No real-time updates.** The spec calls for Supabase Realtime for KDS, order status, table changes, and 86 propagation. None of this is implemented. There are no Supabase Realtime subscriptions anywhere in the client code. The KDS page, the table floor plan, and the POS order list all load data once on mount and never update.

6. **No offline capability.** The architecture spec describes offline-first as a core principle with local SQLite on iPads, store-and-forward for payments, and bidirectional sync. Zero offline support exists. The app requires a live internet connection for every action.

7. **No receipt printing.** No ESC/POS command generation. No printer discovery. No WebSocket or Bluetooth connection to Star Micronics or Epson printers. The "Print" button in QuickActions shows a toast: "Print — coming soon."

8. **No bar tab lifecycle.** The business rules spec describes a complete bar tab flow: open with pre-auth, incremental auth, close with tip, walkout auto-gratuity, stale tab auto-close after 4 hours. None of this exists. You can set order_type to "bar" but that is cosmetic.

9. **No discount application.** The "Discount" button in QuickActions shows a toast: "Discount — coming soon." The order discount API route (`/api/orders/[id]/discount`) exists but there is no UI to apply discounts, select discount types, or trigger manager approval.

10. **No void/comp workflow for sent items.** Voiding a sent item requires manager PIN verification per the spec. The void handler in the orders page just calls DELETE on the order. There is no manager PIN prompt, no void reason selection dialog, no per-item void capability from the UI.

---

## SECTION 2: FEATURE GAP LIST — Every Feature Specified But Not Implemented or Only Scaffolded

### Order Management (03_orders.md — 22 routes specified)

| Feature | Status | Detail |
|---------|--------|--------|
| Create order (draft) | Partial | Works client-side in Zustand; server creation happens only on send |
| Add items to order | Works | Tapping menu items adds to local order |
| Modifier selection with validation | Works | ModifierSheet enforces min/max selections |
| Send to kitchen | Partial | Marks items as sent in DB, but no KDS routing by station |
| Item quantity adjustment | Works | +/- stepper in OrderPanel |
| Seat assignment | Partial | SeatSelector UI exists, items can be tagged with seat, but no per-seat check split |
| Course assignment | Not implemented | No UI to assign courses to items |
| Course firing | Stub | API route exists, button exists, but no course management UI |
| Item-level void (pre-send) | Partial | Decrementing to 0 removes item |
| Item-level void (post-send) | Not implemented | No manager PIN prompt, no void reason dialog |
| Item-level comp | Not implemented | No comp UI, no comp reason dialog, no manager approval |
| Order-level void | Partial | API works but no manager PIN verification for sent orders in UI |
| Split checks (equal) | Not implemented | Buttons exist, no logic |
| Split checks (by seat) | Not implemented | Button exists, no logic |
| Split checks (custom/drag) | Not implemented | Button exists, no logic |
| Merge checks | Not implemented | No UI at all |
| Transfer order to server | Not implemented | No UI, API route not found |
| Move order to table | Not implemented | No UI for table move |
| Reopen closed order | Not implemented | API route not found for reopen |
| Apply discount (order-level) | Not implemented | Toast says "coming soon" |
| Apply discount (item-level) | Not implemented | No UI |
| Order number generation (sequential per-location per-day) | Not verified | Server-side, but the `next_order_number()` database function was not confirmed |
| Order modifications audit trail | Not implemented | `order_modifications` table may exist but no records are created on changes |
| Allergen check on item add | Not implemented | No allergen warning when adding items with allergens to a table with allergy flags |
| Item snapshotting at order time | Partial | Items added with name/price from menu, but no explicit snapshot mechanism |
| Tax calculation per-item | Not implemented | Tax shown in OrderPanel totals but calculated client-side, not per-item with tax rates |
| Financial recalculation on every change | Partial | Client-side only via Zustand reducer, not server-authoritative |
| 9 order types | Partial | OrderTypeChips shows 4 types (dine_in, takeout, delivery, bar), not 9 |

### Payment Processing (04_payments — 10 routes specified)

| Feature | Status | Detail |
|---------|--------|--------|
| Card payment via Valor terminal | Not implemented | Simulated with timeout, no MQTT/REST integration |
| Cash tendering with change calc | Partial | CashTender component calculates change, but no cash drawer kick |
| Cash denomination breakdown | Not implemented | Spec requires showing "2x $5, 1x $2, etc." for change |
| Gift card redemption | Stub | Jumps straight to receipt, no balance check, no card scan |
| Gift card activation/reload | Not implemented | No UI |
| House account payment | Stub | processGenericPayment just sets receipt state |
| Bar tab pre-authorization | Not implemented | No Valor pre-auth call |
| Bar tab incremental auth | Not implemented | |
| Bar tab close with tip | Not implemented | |
| Tip adjustment post-close | Partial | API call exists in payment flow but uses fake paymentId |
| Split payment (mixed tender) | Not implemented | "Split" option redirects to /checks which is also incomplete |
| Refund (full) | API only | Route exists at /api/payments/refund but no UI |
| Refund (partial) | Not implemented | |
| Void pre-settlement | API only | Route exists at /api/payments/void but no UI |
| Settlement/close-day report | API only | Route exists but no UI workflow |
| Dual Pricing display | Not implemented | No cash vs card price display anywhere |
| Pre-auth hold amount configurable | Not implemented | |
| Stale tab auto-close (4 hours) | Not implemented | No background job |
| Walkout auto-gratuity | Not implemented | |

### Menu Management (02_menu.md — 24+ routes specified)

| Feature | Status | Detail |
|---------|--------|--------|
| Category CRUD | Works | Create, list, soft-delete, reorder all functional |
| Item CRUD | Works | Create, edit, delete, reorder functional |
| Modifier group CRUD | Works | ModifierGroupManager component exists |
| 86 toggle with SSE broadcast | Partial | Toggle works in DB, no SSE/Realtime broadcast |
| Price levels (up to 9) | Not implemented | No UI, no API routes visible |
| Daypart scheduling | Not implemented | No UI, no API routes visible |
| Allergen checkboxes on items | Not verified | Field exists on items but ItemDetailSheet may not have allergen UI |
| Dietary tags | Not verified | Same as above |
| Nutrition info | Not implemented | |
| Image upload | Not implemented | No file upload capability |
| Bulk actions (multi-select) | Not implemented | |
| Category color picker | Partial | Color field passed on create but no color picker UI verified |
| PLU/barcode support | Not implemented | |
| Org-wide vs location-specific menus | Not implemented | |
| Menu cache in Redis | Not implemented | No Redis integration visible in Next.js codebase |

### Table Management (05_tables — 14 routes specified)

| Feature | Status | Detail |
|---------|--------|--------|
| Floor plan display | Partial | FloorPlanCanvas component and TableShape exist |
| Floor plan editor (drag to position) | Not verified | Components exist but edit mode unclear |
| Table status colors | Partial | CSS variables defined for 8 statuses |
| Table seat/clear/history | API only | Routes exist but UI integration unclear |
| Section filtering | Partial | SectionFilter component exists |
| Status summary | Partial | StatusSummary component exists |
| Table detail popover | Exists | TablePopover component exists |
| Table assignment from POS | Not implemented | No table picker in order entry flow |
| Drag-assign sections | Not implemented | |

### KDS (06_kds — 7 routes specified)

| Feature | Status | Detail |
|---------|--------|--------|
| KDS fullscreen display | Partial | Page exists with dark theme at /kds |
| KDS tickets with aging colors | Partial | KdsTicket and KdsTimer components exist |
| Station tabs | Partial | KdsStationTabs component exists |
| Bump ticket | Not verified | Functionality unclear |
| Recall bumped ticket | Partial | KdsRecallDrawer component exists |
| All-day counts | Partial | KdsAllDay component exists |
| Real-time ticket updates | Not implemented | No Supabase Realtime subscription |
| Audio alerts on new ticket | Not implemented | |
| Expo mode | Not implemented | |
| Item routing by prep_station | Not implemented | Send just marks is_sent, no station routing |

### Staff Management (07_staff — 15 routes specified)

| Feature | Status | Detail |
|---------|--------|--------|
| Staff CRUD | Works | API routes and staff page exist |
| Clock in/out | API exists | Routes for clock-in/clock-out exist |
| Breaks | API exists | Routes exist |
| Time entries + edit + approve | API exists | Routes exist |
| Tip management | API exists | Routes exist |
| Tip pool distribution | API exists | Route exists |
| Clock-in PIN UI | Partial | Pin login page exists |
| Shift notes | Not implemented | |
| Overtime calculation | Not implemented | |
| Cash-out flow for servers | Not implemented | |

### Customer CRM (08_customers — 9 routes specified)

| Feature | Status | Detail |
|---------|--------|--------|
| Customer CRUD | Works | Routes and page exist |
| Customer lookup | Works | Lookup route exists |
| Customer merge | API only | Route exists |
| Order history | API only | Route exists |
| Loyalty integration | API only | Route exists |
| VIP flagging | Not verified | |
| Allergen storage on profile | Not verified | |
| Auto-populate allergy on seat | Not implemented | |

### Reports (09_reports — 13 routes specified)

| Feature | Status | Detail |
|---------|--------|--------|
| Sales report | Works | Chart + table with date range picker. Uses mock data fallback. |
| Labor report | Exists | Page at /reports/labor |
| Product mix (PMIX) | Exists | Page at /reports/product-mix |
| Server performance | Exists | Page at /reports/server-performance |
| Speed of service | Not found | No page |
| Cash report | Not found | No page |
| Voids/comps report | Not found | No page |
| Tax report | Not found | No page |
| Custom date range | Works | DateRangePicker component exists |
| CSV export | Partial | Export button exists, route unclear |
| Hourly sales chart | Component exists | HourlySalesChart component |
| Category mix chart | Component exists | CategoryMixChart component |
| Payment mix chart | Component exists | PaymentMixChart component |

### Settings (10_settings — 18 routes specified)

| Feature | Status | Detail |
|---------|--------|--------|
| Organization settings | Works | Page + API route |
| Location management | Works | Page + API route |
| Tax rates CRUD | Works | Page + API route |
| Terminal management | Exists | Page + API route |
| Role/permission management | Exists | Page + API route |
| Module enable/disable | Works | Page works with dependency checking |
| Printer management | Not implemented | |
| Accounting integration | Exists | Page at /settings/accounting |
| Module configuration (per-module settings) | Not implemented | Configure buttons navigate away but no settings panels |

### Modules 11-21 (Online Ordering, Loyalty, Reservations, Inventory, Scheduling, Marketing, Delivery, Catering, Drive-Thru, Franchise, House Accounts)

| Module | Page | API Routes | Assessment |
|--------|------|------------|------------|
| Online Ordering | Full page | 6+ routes | Most complete add-on module. Queue, menus, settings all functional UI. |
| Loyalty | Page exists | 5+ routes | Program management, accounts, earn/redeem. Likely thin. |
| Reservations | Page exists | 7+ routes | CRUD, confirm, seat, waitlist. Likely functional UI. |
| Inventory | Page exists | 7+ routes | Items, POs, recipes, count. Likely data-display focused. |
| Scheduling | Page exists | 3+ routes | Templates, shifts. Likely thin. |
| Marketing | Page exists | 4+ routes | Campaigns, segments, analytics. Likely display-only. |
| Delivery | Full page | 5+ routes | Active deliveries + zones. UI is complete with status progression. |
| Catering | Page exists | Unknown | Likely thin/scaffold. |
| Drive-Thru | Page exists | Unknown | Likely thin/scaffold. |
| Franchise | Page exists | Unknown | Likely thin/scaffold. |
| House Accounts | Page exists | 2+ routes | CRUD. Likely basic. |

---

## SECTION 3: UI/UX GAP LIST — Every Visual/Interaction Issue

### Design System Compliance

1. **Design tokens are mostly followed.** The CSS custom properties from UI_DESIGN.md are used throughout (--primary, --border, --shadow-warm-sm, etc.). This is one of the stronger aspects of the build.

2. **Typography scale partially followed.** Monospace tabular-nums used for prices. Font sizes generally reasonable. However, no evidence of Inter or JetBrains Mono being explicitly loaded — the font stack may fall back to system fonts.

3. **Touch targets mostly correct.** The `touch-target` and `touch-target-lg` classes are used. The Send to Kitchen button is h-14 (56px). Menu grid items have adequate padding. But some back-office form inputs may be standard size, not 44px minimum.

### POS Order Entry (The Most Critical Screen)

4. **Missing "Pay" button.** The OrderPanel has "Send to Kitchen" but no "Pay" or "Close" button to initiate payment. A server finishing an order has no obvious path to payment from the order screen.

5. **No table selection.** When creating a dine-in order, there is no table picker. The order auto-creates with `table_id: undefined`. A server cannot assign a table from the POS screen.

6. **No existing order selection.** The page always creates a new draft order. There is no way to select an existing open order to add items to it. In a real restaurant, servers frequently return to add courses, drinks, or desserts.

7. **Order type limited.** OrderTypeChips likely shows 4 types. The spec requires 9 (dine_in, takeout, delivery, bar, catering, online, kiosk, drive_thru, qr).

8. **No "Rush" functionality.** The Rush button shows a toast saying "Rush flag set" but does not actually set any flag on the order or notify the kitchen.

9. **No open item (custom price/name).** The spec calls for an "open item" button for items not on the menu (e.g., special requests). Not implemented.

10. **No repeat last order.** Spec calls for a "Repeat Last" quick action. Not implemented.

### Modifier Sheet

11. **Modifier sheet works well.** This is one of the best-implemented components. Required group validation, price adjustments, running total, special instructions. Close to production quality.

12. **No default modifiers pre-selected.** The spec says `is_default` modifiers should be pre-selected. The sheet starts with empty selections.

### Menu Grid

13. **No item images.** Items display as text buttons only. No food photography, no color coding by category on the button itself.

14. **No allergen icons on items.** The spec requires allergen badges visible on POS grid item buttons. Not present.

15. **No PLU/barcode search.** Search only filters by name. No barcode scanner input support.

16. **No configurable grid columns.** Spec says 3, 4, 5, or 6 columns configurable. Fixed at 3-4 via responsive breakpoint.

### Payment Flow

17. **Payment flow is visually polished** but functionally hollow. The state machine transitions look smooth. The method grid, cash tender, tip selector, and receipt options all render. But no real payment processing occurs.

18. **No Dual Pricing display.** The entire business model is built on showing cash vs. card prices. This is not implemented anywhere — not in the menu grid, not in the order panel, not in the payment screen.

19. **No signature capture.** Required for some card transactions.

20. **No receipt display.** The receipt options screen offers Print/Email/SMS/No Receipt but does not show a receipt preview.

### Check Management

21. **Check management is a wireframe.** The page displays order cards and split option tabs. The split buttons have no functionality. "Print Check" and "Process Payment" buttons have no click handlers. This page would be immediately obvious as non-functional to any user.

### Floor Plan / Tables

22. **Floor plan components exist** (FloorPlanCanvas, TableShape, TablePopover) but were not deeply verified. If they render positioned table shapes with status colors, this could be one of the better screens.

23. **No drag-to-seat interaction.** The spec describes dragging guests from waitlist to tables. Not implemented.

### KDS

24. **KDS has components** (KdsTicket, KdsTimer, KdsAllDay, KdsStationTabs, KdsRecallDrawer) suggesting a mostly built-out screen. However, without real-time data push, the KDS is non-functional in production — it would show stale data.

25. **No audio alerts.** KDS must beep on new tickets. Not implemented.

26. **No bump interaction verified.** The KDS bump-to-clear workflow is the core interaction. Its functionality was not confirmed.

### Reports

27. **Sales report is the strongest report.** Real charts, date picker, data table, export button. Uses mock data intelligently as fallback. This is demo-ready.

28. **Missing 4 of 8 report sub-pages.** No speed of service, cash, voids/comps, or tax reports found.

### Back-Office Screens

29. **Menu Manager is solid.** 3-panel layout, category tree, item grid, detail sheet. Modifier group management in separate tab. This is close to a shippable feature.

30. **Staff, Customer, Settings pages exist** but depth was not fully verified. API routes suggest basic CRUD works.

### General UI Issues

31. **No loading.tsx or error.tsx per route group.** The CLAUDE.md coding rules mandate these. Not verified to exist.

32. **No error boundaries.** Coding rules require error boundaries on every route segment.

33. **No skeleton loaders on all async loads.** Some pages use Skeleton components (modules page, menu manager) but others use a simple spinner (checks page, KDS).

34. **No connection status indicator.** The `ConnectionStatus` component exists but its integration into layouts was not verified. Critical for a system that claims offline support.

35. **No keyboard shortcuts.** The spec says back-office screens should have keyboard shortcuts for power users. None implemented.

36. **No haptic feedback.** Touch targets claim `btn-press` class but no actual haptic feedback via the Vibration API.

37. **eslint-disable scattered through API routes.** Every Supabase query in API routes has `// eslint-disable-next-line @typescript-eslint/no-explicit-any` and casts `supabase.from('table') as any`. This suggests the Supabase types are not generated or integrated, meaning zero type safety on database queries.

---

## Summary Verdict

**What we have:** A well-architected Next.js application with ~37 pages, ~95+ API routes, a coherent design system, and working UI for order entry, menu management, and several module pages. The code quality is reasonable. The component decomposition is good. The visual design follows the spec's warm palette.

**What we do not have:** A functional POS system. The two things a POS must do above all else — take orders and take money — are both incomplete. Orders can be built and sent, but the kitchen routing, coursing, splitting, voiding, comping, and discount features are not functional. Payments are entirely simulated. Real-time updates do not exist. Offline mode does not exist. Receipt printing does not exist.

**Severity:** If this were scored as a percentage of the spec that is truly production-ready (not just "code exists" but "a restaurant server could use this feature during a rush"):

- **Order entry core flow:** 40% (build order and send — yes. Everything else — no.)
- **Payment processing:** 5% (UI exists, no real processing)
- **Menu management:** 75% (strongest feature, missing price levels/dayparts/images/allergens)
- **KDS:** 25% (components exist, no real-time, no routing)
- **Tables:** 30% (components exist, no POS integration)
- **Check management:** 10% (display only, no split/merge)
- **Reports:** 40% (sales report works, 4 of 8 sub-reports missing)
- **Staff:** 35% (CRUD + clock API exists, no cash-out, no shift notes)
- **Settings:** 50% (org/location/tax/modules work, no printers)
- **Module pages (11-21):** 30% average (pages and routes exist, thin implementations)
- **Real-time:** 0%
- **Offline:** 0%
- **Printing:** 0%
- **Valor integration:** 0%

**Overall production readiness: approximately 20-25%.**

The gap between "code exists" and "a restaurant can operate on this" is enormous. What was built is a strong foundation — but calling it "code complete" was wrong. It is "scaffold complete."
