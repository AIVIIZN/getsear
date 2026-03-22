# Visual QA Audit Report -- Sear POS v2

**Audit Date:** 2026-03-22
**Auditor:** Claude Opus 4.6 (automated code review)
**Scope:** All 33 page files in `src/app/`

---

## Summary

| # | Page | Status | Issues Found |
|---|------|--------|-------------|
| 1 | `(auth)/login/page.tsx` | PASS | Minor: no loading skeleton on initial render |
| 2 | `(auth)/pin-login/page.tsx` | ISSUES | Hardcoded hex colors in `avatarColor()` array |
| 3 | `(auth)/register/page.tsx` | PASS | Clean implementation |
| 4 | `(pos)/orders/page.tsx` | ISSUES | No page-level loading state; no empty state for menu |
| 5 | `(pos)/tables/page.tsx` | ISSUES | Silent error swallowing in 6+ catch blocks; no error toasts |
| 6 | `(pos)/checks/page.tsx` | PASS | Good loading, empty states, and component usage |
| 7 | `(pos)/payments/page.tsx` | PASS | Clean state machine; proper Suspense boundary |
| 8 | `(fullscreen)/kds/page.tsx` | ISSUES | Hardcoded Tailwind colors (`bg-red-600`, `text-red-400`); `console.log` calls |
| 9 | `(backoffice)/menu/page.tsx` | ISSUES | No error handling in `fetchCategories`/`fetchItems` (empty catch or missing) |
| 10 | `(backoffice)/staff/page.tsx` | ISSUES | Extensive hardcoded Tailwind colors for role badges, status indicators |
| 11 | `(backoffice)/customers/page.tsx` | ISSUES | Hardcoded Tailwind colors for tags and status badges |
| 12 | `(backoffice)/reports/page.tsx` | ISSUES | Static placeholder data; unused import; no data fetching; charts are placeholders |
| 13 | `(backoffice)/settings/organization/page.tsx` | PASS | Proper skeleton, error toasts, form validation |
| 14 | `(backoffice)/settings/locations/page.tsx` | PASS | Proper skeleton, empty state with CTA, error handling |
| 15 | `(backoffice)/settings/tax-rates/page.tsx` | PASS | Proper skeleton, empty state, error handling |
| 16 | `(backoffice)/settings/terminals/page.tsx` | PASS | Proper skeleton, empty state, error handling |
| 17 | `(backoffice)/settings/modules/page.tsx` | PASS | Proper skeleton, error handling, dependency validation |
| 18 | `(backoffice)/settings/roles/page.tsx` | PASS | Proper skeleton, empty state, error handling |
| 19 | `(backoffice)/settings/accounting/page.tsx` | ISSUES | Hardcoded hex color `#2CA01C` for QBO branding |
| 20 | `(backoffice)/online-ordering/page.tsx` | PASS | Loading states, empty states, error handling per tab |
| 21 | `(backoffice)/loyalty/page.tsx` | ISSUES | Hardcoded Tailwind colors (`bg-amber-600/10`, `bg-gray-400/10`) |
| 22 | `(backoffice)/reservations/page.tsx` | ISSUES | Hardcoded Tailwind colors for all status badges |
| 23 | `(backoffice)/house-accounts/page.tsx` | ISSUES | Hardcoded Tailwind colors for balance utilization and transaction types |
| 24 | `(backoffice)/inventory/page.tsx` | ISSUES | Hardcoded Tailwind colors for stock level badges |
| 25 | `(backoffice)/scheduling/page.tsx` | ISSUES | Hardcoded Tailwind colors for role badges and availability |
| 26 | `(backoffice)/delivery/page.tsx` | ISSUES | Hardcoded Tailwind colors for status badges |
| 27 | `(backoffice)/marketing/page.tsx` | ISSUES | Hardcoded Tailwind colors for campaign status badges |
| 28 | `(backoffice)/catering/page.tsx` | ISSUES | Hardcoded Tailwind colors for event status badges |
| 29 | `(backoffice)/drive-thru/page.tsx` | ISSUES | Hardcoded hex colors in inline styles; hardcoded Tailwind colors |
| 30 | `(backoffice)/franchise/page.tsx` | ISSUES | Hardcoded Tailwind colors for royalty status and metrics |

---

## Critical Issues

### 1. Reports Dashboard is a static placeholder (reports/page.tsx)
- **File:** `src/app/(backoffice)/reports/page.tsx`
- All KPI values are hardcoded as `$0.00`, `0`, `0%`
- No `useEffect` or data fetching -- the page never loads real data
- Chart areas are placeholder text ("Chart will render here with Recharts")
- `KPICardSkeleton` is imported but never used -- dead import
- No loading state, no error handling, no date range picker
- **Impact:** Page is non-functional; users see static zeros

### 2. Orders page has no page-level loading state (orders/page.tsx)
- **File:** `src/app/(pos)/orders/page.tsx`
- Menu data loads in a `useEffect` but the page renders the 3-panel layout immediately
- If menu API is slow, the `MenuGrid` component renders with no visual feedback at the page level (loading is delegated to the store, but the page itself shows no skeleton)
- No page-level error boundary if both API calls fail
- **Impact:** Users may see a blank menu grid during slow network conditions

### 3. Tables page silently swallows all errors (tables/page.tsx)
- **File:** `src/app/(pos)/tables/page.tsx`
- Six `catch` blocks contain only `// silently fail` comments with no toast or user feedback
- Failed floor plan loads, table seats, clears, position saves, and adds all fail silently
- No error state shown to the user for any operation
- **Impact:** Users perform actions that fail with no indication of failure

### 4. Menu manager swallows errors on category/item fetch (menu/page.tsx)
- **File:** `src/app/(backoffice)/menu/page.tsx`
- `fetchCategories` and `fetchItems` have empty `catch` blocks (via `finally` only)
- `fetchModifierGroups` has `// silently fail`
- Category create/delete/reorder, item save/delete have no error handling
- **Impact:** Menu management operations can fail without user awareness

### 5. KDS page has `console.log` statements in production code (kds/page.tsx)
- **File:** `src/app/(fullscreen)/kds/page.tsx`
- Lines 115, 129, 161, 167: `console.log('[KDS] Sound: ...')` and `console.error`
- These are debug statements that should be replaced with actual audio playback or removed
- **Impact:** Console noise in production; sound feature is non-functional

---

## Major Issues

### 6. Widespread hardcoded Tailwind colors instead of design system tokens
The following pages use raw Tailwind color classes (e.g., `bg-green-50`, `text-red-600`, `bg-blue-100`) instead of CSS variables from the Sear design system (`var(--success)`, `var(--error)`, `var(--warning)`, etc.):

| Page | Examples |
|------|----------|
| `pin-login/page.tsx` | 15 hardcoded hex colors in `avatarColor()` array |
| `kds/page.tsx` | `bg-red-600`, `hover:bg-red-500`, `text-red-400` |
| `staff/page.tsx` | `bg-green-500`, `bg-purple-500`, `text-green-600`, `bg-green-50`, `bg-blue-50`, `bg-amber-50` and many more for role badges |
| `customers/page.tsx` | `bg-amber-100`, `bg-blue-100`, `bg-red-100`, `bg-green-100`, `text-amber-400`, `text-red-500` |
| `reservations/page.tsx` | Full status color maps using raw Tailwind: `bg-amber-100`, `bg-blue-100`, `bg-green-100`, `bg-red-100` |
| `house-accounts/page.tsx` | `bg-red-100`, `bg-amber-100`, `bg-green-100`, `bg-blue-100`, `bg-gray-100` for balance and transaction types |
| `inventory/page.tsx` | `bg-red-50`, `bg-amber-50`, `bg-green-50` for stock levels |
| `scheduling/page.tsx` | `bg-blue-100`, `bg-purple-100`, `bg-green-100`, `bg-red-50`, `text-green-600`, `text-red-600` |
| `delivery/page.tsx` | `bg-gray-100`, `bg-blue-50`, `bg-green-50`, `bg-red-50`, `text-green-600` |
| `marketing/page.tsx` | `bg-gray-100`, `bg-blue-50`, `bg-amber-50`, `bg-green-50`, `bg-red-50`, `text-blue-600`, `text-green-600`, `text-purple-600` |
| `catering/page.tsx` | `bg-gray-100`, `bg-blue-50`, `bg-green-50`, `bg-amber-50`, `bg-purple-50`, `bg-red-50` |
| `drive-thru/page.tsx` | `text-green-600`, `text-amber-600`, `text-red-600`, `bg-green-50`, `bg-red-50`, `bg-purple-50`, plus hardcoded hex in inline styles (`#bbf7d0`, `#fde68a`, `#fecaca`) |
| `franchise/page.tsx` | `bg-blue-50`, `bg-amber-50`, `bg-green-50`, `text-blue-600`, `text-green-600`, `text-amber-600`, `text-purple-600`, `bg-gray-100` |
| `loyalty/page.tsx` | `bg-amber-600/10`, `text-amber-700`, `bg-gray-400/10`, `text-gray-600` |
| `accounting/page.tsx` | Hardcoded `#2CA01C` hex for QuickBooks branding (acceptable for brand compliance) |
| `online-ordering/page.tsx` | `bg-purple-500/10`, `text-purple-600` |

**Impact:** These pages will not respect theme changes. If the design system's semantic colors are updated, these pages will be visually inconsistent.

**Note:** The auth pages (login, register) and core settings pages (organization, locations, tax-rates, terminals, modules, roles) correctly use `var(--*)` CSS variables or shadcn semantic classes.

### 7. Accounting page uses non-standard DialogTrigger pattern (accounting/page.tsx)
- **File:** `src/app/(backoffice)/settings/accounting/page.tsx` (line 363-369)
- Uses `<DialogTrigger render={<Button ... />}>` with children as content
- While `@base-ui/react` Dialog supports `render`, the pattern here places `<Unplug>` and `"Disconnect"` as children of `DialogTrigger` while `render` provides the container element
- This is fragile and may not compose correctly with the Button variant/style props
- **Impact:** Potential runtime rendering issue where button content is duplicated or not rendered

---

## Minor Issues

### 8. Pin-login avatar colors are intentionally hardcoded (pin-login/page.tsx)
- The `avatarColor()` function uses 15 hardcoded hex colors for deterministic avatar generation
- This is by design (user-distinguishing colors), but they could be sourced from a design token array
- **Impact:** Low -- functional purpose, but not theme-aware

### 9. Reports page has unused import (reports/page.tsx)
- `KPICardSkeleton` is imported from `@/components/shared/LoadingSkeleton` but never called
- **Impact:** Dead code / bundle size (minor, tree-shaken in production)

### 10. Orders page auto-creates draft orders on every mount (orders/page.tsx)
- The `useEffect` on line 122 calls `newOrder()` every time `currentOrder` is null
- If a user navigates away and back, this creates a new draft each time
- **Impact:** Potential orphaned draft orders in state

### 11. Tables page loading state uses plain text instead of skeleton (tables/page.tsx)
- Line 479: Shows "Loading floor plan..." as plain text instead of a proper skeleton
- Other pages in the app use proper `<Skeleton>` components
- **Impact:** Inconsistent loading UX

### 12. Checks page loading spinner uses raw border styling (checks/page.tsx)
- Line 54: `border-2 border-[var(--primary)] border-t-transparent rounded-full` -- hand-rolled spinner
- Other pages use `<Loader2>` from lucide-react with `animate-spin`
- **Impact:** Inconsistent spinner appearance across pages

### 13. KDS "Bump All" button uses raw `bg-red-600` (kds/page.tsx)
- Line 285: Should use `variant="destructive"` on a `<Button>` component instead of a raw `<button>`
- **Impact:** Does not inherit Button component's focus states, disabled states, or touch target classes

### 14. Tables page uses `confirm()` for delete (tables/page.tsx)
- Line 370: `if (!confirm('Delete this table?'))` -- native browser confirm dialog
- Rest of the app uses shadcn `<Dialog>` components for confirmations
- **Impact:** Inconsistent UX; native dialogs look out of place on iPad

### 15. Several pages lack `btn-press` class on interactive cards
- `tables/page.tsx` floor plan tab buttons: have `touch-target` but no `btn-press`
- `menu/page.tsx` tab triggers: no `btn-press` or explicit `touch-target`
- **Impact:** Missing tactile feedback on touch devices

### 16. Organization settings page allows dual-binding of `primary_color` (organization/page.tsx)
- Lines 258-268: Both a `<input type="color">` and a text `<Input>` are bound to the same `primary_color` field via `{...register("primary_color")}`
- Both inputs register to the same form field, which can cause the color picker to not sync with text input
- **Impact:** Color picker and text input may fight for control

### 17. Tables page `handleRealtimeUpdate` has stale closure over `tables` (tables/page.tsx)
- Line 199: `const oldTable = tables.find(...)` reads from the `tables` state captured in the closure
- But `tables` is in the dependency array, so `handleRealtimeUpdate` recreates on every table change, which could cause excessive re-subscriptions
- **Impact:** Potential performance issue with rapid real-time updates

### 18. Payments page `handleMethodSelect` has exhaustive deps warning (payments/page.tsx)
- Line 91: `useCallback` depends on `[orderTotalCents, orderId, locationId, router]` but calls `processGiftCard` and `processGenericPayment` which are separate callbacks
- These dependent functions are not in the dependency array
- **Impact:** Stale closure bug possible if orderTotalCents changes between renders

---

## Design System Compliance Summary

### Pages using design system correctly (var(--*) or semantic classes)
- login, register, pin-login (mostly), orders, payments, checks, tables, kds (mostly)
- settings/organization, settings/locations, settings/tax-rates, settings/terminals
- settings/modules, settings/roles, online-ordering (mostly)

### Pages with significant design system violations (raw Tailwind colors)
- staff, customers, reservations, house-accounts, inventory, scheduling
- delivery, marketing, catering, drive-thru, franchise, loyalty

### Component usage
- All pages correctly import from `@/components/ui/*` (shadcn components)
- All shared components (`EmptyState`, `MoneyDisplay`, `StatusBadge`, `LoadingSkeleton`) exist and are importable
- All stores (`auth-store`, `order-store`, `menu-store`, `table-store`, `kds-store`) exist
- All hooks (`use-realtime`) exist
- All type imports (`@/types/database`) resolve correctly
- All constant imports (`@/lib/constants`) resolve correctly

### Touch Targets
- Most pages use `touch-target` or `touch-target-lg` classes on interactive elements
- Buttons use `btn-press` class for tactile feedback in most cases
- Tables page's floor plan tab buttons and menu manager tab triggers are missing these classes

---

## Recommendations (Priority Order)

1. **Fix reports dashboard** -- connect to real API endpoints or show "Coming Soon" state
2. **Add error toasts to tables page** -- replace `// silently fail` with `toast.error()`
3. **Add error handling to menu manager** -- surface API failures to users
4. **Remove console.log from KDS** -- implement actual audio or remove debug logging
5. **Standardize colors** -- migrate hardcoded Tailwind colors in backoffice pages to design system tokens
6. **Standardize loading spinners** -- use `<Loader2 className="animate-spin" />` consistently
7. **Replace native `confirm()` in tables** -- use Dialog component for consistency
8. **Add `btn-press` to all interactive elements** -- especially card-style buttons and tabs
