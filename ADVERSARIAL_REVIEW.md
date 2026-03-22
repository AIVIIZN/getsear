# Adversarial Code Review -- Sear POS v2

**Reviewer:** Claude Opus 4.6 (fresh adversarial reviewer)
**Date:** 2026-03-22
**Scope:** Build verification, critical flow testing, DB column mismatches, missing functionality, frontend issues
**Method:** End-to-end code path reading cross-referenced against live Supabase schema

---

## Executive Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 12 |
| HIGH | 10 |
| MEDIUM | 11 |
| LOW | 6 |
| **Total** | **39** |

The build compiles with zero errors. However, **12 critical column-name mismatches** between the API route handlers and the actual database schema will cause runtime 500 errors on core flows including table seating, gift card payments, order splitting, order voiding, tip adjustment, and KDS station creation.

---

## 1. Build Verification

**Result: PASS (with warnings)**

`next build` completes successfully. Two non-blocking warnings:
- Turbopack workspace root inference warning (cosmetic)
- `NODE_TLS_REJECT_UNAUTHORIZED=0` warning in the environment (security concern but not a build failure)

---

## 2. Critical Column-Name Mismatches (DB vs Code)

These will cause immediate runtime failures (Supabase returns errors when referencing nonexistent columns).

### ISSUE 1: `tables.guest_count` does not exist

- **File:** `src/app/api/tables/[id]/seat/route.ts`, line 68
- **File:** `src/app/api/tables/[id]/clear/route.ts`, lines 36, 54, 78
- **File:** `src/app/api/tables/floor-plans/[id]/route.ts`, line 40
- **Severity:** CRITICAL
- **Description:** The `tables` table has no `guest_count` column. The actual columns are: `id, org_id, location_id, floor_plan_id, name, capacity, shape, pos_x, pos_y, width, height, rotation, status, current_order_id, current_server_id, seated_at, is_active, sort_order, section, created_at, updated_at`. Every seat, clear, and floor plan fetch that references `guest_count` will fail.
- **Impact:** Table seating flow is completely broken. Floor plan page will not load tables.
- **Fix:** Add `guest_count integer NOT NULL DEFAULT 0` column to `tables`, or remove all references and store guest count on the order instead.

### ISSUE 2: `gift_cards.balance` does not exist -- actual column is `current_balance`

- **File:** `src/app/api/payments/process/route.ts`, lines 117, 130, 140
- **File:** `src/app/api/payments/gift-card/check-balance/route.ts`, line 37
- **File:** `src/app/api/payments/gift-card/activate/route.ts`, line 56
- **File:** `src/app/api/payments/gift-card/reload/route.ts`, lines 40, 53, 58
- **Severity:** CRITICAL
- **Description:** Code uses `.select('id, balance, is_active, ...')` and `.update({ balance: ... })` but the actual column name is `current_balance`. The `initial_balance` column also exists and is separate. The activate route also writes `balance` instead of `current_balance` and `initial_balance`.
- **Impact:** All gift card operations (check balance, activate, reload, redeem) will fail with 500 errors.
- **Fix:** Replace all `balance` references with `current_balance`. In activate, also set `initial_balance`.

### ISSUE 3: `gift_card_transactions.type` does not exist -- actual column is `transaction_type`

- **File:** `src/app/api/payments/process/route.ts`, line 149
- **File:** `src/app/api/payments/gift-card/activate/route.ts`, line 73
- **File:** `src/app/api/payments/gift-card/reload/route.ts`, line 72
- **Severity:** CRITICAL
- **Description:** Code inserts `type: 'redeem'` / `type: 'activate'` / `type: 'reload'` but the DB column is `transaction_type`.
- **Impact:** All gift card transaction logging fails silently (insert errors are not checked in some cases).
- **Fix:** Replace `type` with `transaction_type` in all gift_card_transactions inserts.

### ISSUE 4: `orders.voided_at`, `orders.voided_by`, `orders.void_reason` do not exist

- **File:** `src/app/api/orders/[id]/route.ts`, lines 141-145
- **Severity:** CRITICAL
- **Description:** The DELETE handler (void order) writes `voided_at`, `voided_by`, and `void_reason` to the orders table, but none of these columns exist. The orders table only has `status` (which can be set to 'voided') but no void metadata columns.
- **Impact:** Order voiding will fail with a 500 error.
- **Fix:** Add these three columns to the orders table, or store void metadata in the `metadata` jsonb column.

### ISSUE 5: `orders.split_from_order_id` does not exist

- **File:** `src/app/api/orders/[id]/split/route.ts`, lines 112, 153
- **Severity:** CRITICAL
- **Description:** The split order handler inserts `split_from_order_id` when creating new split orders, but this column does not exist on the `orders` table.
- **Impact:** Order splitting (by seat and equal) will fail with 500 errors.
- **Fix:** Add `split_from_order_id uuid REFERENCES orders(id)` column to orders, or store in the `metadata` jsonb.

### ISSUE 6: `payments.location_id` does not exist

- **File:** `src/app/api/payments/process/route.ts`, line 61
- **Severity:** CRITICAL
- **Description:** The payment insert includes `location_id` but the `payments` table has no such column.
- **Impact:** All payment processing will fail.
- **Fix:** Add `location_id uuid REFERENCES locations(id)` to the payments table, or remove from the insert.

### ISSUE 7: `payments.reference_number` does not exist -- actual column is `auth_code`

- **File:** `src/app/api/payments/process/route.ts`, line 82
- **Severity:** CRITICAL
- **Description:** Code sets `paymentRecord.reference_number = authResult.auth_code` but the column is named `auth_code`, not `reference_number`.
- **Impact:** Payment inserts will fail or silently drop the auth code reference.
- **Fix:** Change `reference_number` to `auth_code`.

### ISSUE 8: `tip_adjustments.new_tip` does not exist -- actual column is `adjusted_tip`

- **File:** `src/app/api/payments/tip-adjust/route.ts`, line 62
- **Severity:** CRITICAL
- **Description:** Code inserts `new_tip: (new_tip_cents / 100).toFixed(2)` but the actual column is `adjusted_tip`. Also missing required columns `org_id`, `order_id`, and `server_id`.
- **Impact:** Tip adjustment logging fails.
- **Fix:** Use `adjusted_tip` instead of `new_tip`, and include `org_id`, `order_id`, and `server_id`.

### ISSUE 9: `order_items` insert missing required `org_id`

- **File:** `src/app/api/orders/[id]/items/route.ts`, lines 82-101
- **Severity:** CRITICAL
- **Description:** `order_items.org_id` is `NOT NULL` with no default, but the INSERT does not include `org_id`. The insert will fail with a NOT NULL constraint violation.
- **Impact:** Adding items to orders is completely broken.
- **Fix:** Add `org_id: user.org_id` to the order_items insert.

### ISSUE 10: KDS station create uses `type` but DB column is `station_type`

- **File:** `src/app/api/kds/stations/route.ts`, lines 8, 94-97
- **Severity:** CRITICAL
- **Description:** The zod schema validates `type: z.enum(['prep', 'expo'])` and the insert spreads `...parsed.data` which will insert a `type` field. But the DB column is `station_type`. The `settings` field in the zod schema also doesn't match -- DB has `display_settings` and `prep_stations` as separate columns, not a nested `settings` object.
- **Impact:** KDS station creation will fail.
- **Fix:** Rename zod field to `station_type`. Map `settings.prep_stations` to the `prep_stations` column and `settings.*` to `display_settings` jsonb.

### ISSUE 11: `order_items.comped_at` does not exist

- **File:** `src/app/api/orders/[id]/comp/route.ts`, lines 88, 108
- **Severity:** HIGH
- **Description:** The comp handler writes `comped_at: new Date().toISOString()` but this column does not exist on `order_items`.
- **Impact:** Comp operations will fail.
- **Fix:** Remove `comped_at` from the update or add the column to the schema.

### ISSUE 12: `gift_cards` activate missing `initial_balance` and `card_number`, has wrong column `activated_at`

- **File:** `src/app/api/payments/gift-card/activate/route.ts`, lines 52-59
- **Severity:** CRITICAL
- **Description:** The insert sets `balance` (should be `current_balance`), omits required `initial_balance` and `card_number` (NOT NULL), and sets `activated_at` which doesn't exist (column is `purchased_at`).
- **Impact:** Gift card activation will fail with NOT NULL violations.
- **Fix:** Include `card_number`, `initial_balance`, `current_balance`, and `purchased_at`.

---

## 3. Critical Flow Testing

### Login Flow: PASS (with minor issue)

The flow works: `login/page.tsx` -> `POST /api/auth/login` -> Supabase auth -> profile lookup -> set auth store -> redirect to `/orders`.

- **Minor:** Login page uses react-hook-form without zodResolver, so the zod schema defined at line 15 is decorative -- validation is done via register options only. Not a bug, just dead code.

### Order Creation Flow: FAIL

- **CRITICAL:** Item add will fail because `org_id` is missing from order_items insert (Issue 9 above).
- The flow otherwise is correct: page creates draft -> POST /api/orders -> loop POST /api/orders/[id]/items -> POST /api/orders/[id]/send.

### Payment Flow: FAIL

- **CRITICAL:** Payment insert references nonexistent columns `location_id` and `reference_number` (Issues 6, 7).
- Gift card payments use wrong column names (Issues 2, 3).
- Cash payment flow works structurally but will fail at DB insert.

### Table Seating Flow: FAIL

- **CRITICAL:** `guest_count` column doesn't exist on tables (Issue 1).
- Floor plan fetch also requests this nonexistent column (will return null or error).

---

## 4. Logic and Business Rule Issues

### ISSUE 13: Order number generation has race condition

- **File:** `src/app/api/orders/route.ts`, lines 92-101
- **Severity:** HIGH
- **Description:** Order number is generated by SELECT MAX + 1 without any locking. Under concurrent requests, two orders can get the same number. The spec (BUSINESS_RULES.md line 75) explicitly says to use advisory locks or `SELECT ... FOR UPDATE`. The code has no such protection.
- **Fix:** Use a Postgres function with advisory lock or a sequence, as specified in MODULE_SPECS/03_orders.md.

### ISSUE 14: `recalculateOrderTotals` overwrites balance_due, ignoring existing payments

- **File:** `src/app/api/orders/[id]/items/route.ts`, line 186
- **File:** `src/app/api/orders/[id]/items/[itemId]/route.ts`, line 184
- **File:** `src/app/api/orders/[id]/comp/route.ts`, line 133
- **Severity:** HIGH
- **Description:** When recalculating totals, `balance_due` is always set to the new `total`, ignoring any `amount_paid`. If a partial payment was made and then an item is modified, the balance_due will be wrong.
- **Fix:** Calculate `balance_due = total - amount_paid` by fetching `amount_paid` from the order.

### ISSUE 15: Payment flow never calls Valor `capture` -- goes straight to `captured` status

- **File:** `src/app/api/payments/process/route.ts`, lines 74-85
- **Severity:** HIGH
- **Description:** For card payments, `valorMock.authorize()` is called, but the status is immediately set to `captured` (line 85) without calling `valorMock.capture()`. In real payment processing, authorization and capture are separate steps.
- **Fix:** Either call `capture()` after `authorize()`, or set status to `authorized` and use the separate `/api/payments/capture` endpoint.

### ISSUE 16: Cash payment ignores tip for total comparison

- **File:** `src/app/api/payments/process/route.ts`, lines 101-108
- **Severity:** MEDIUM
- **Description:** `total_cents = amount_cents + tip_cents` is calculated, but cash tendered validation compares `tendered < total_cents` which includes tip. However, the frontend sends `tip_cents: 0` for cash. If a cash tip is ever included, the logic is correct. But the order's `tip_total` is never updated for cash tips.
- **Fix:** Add order tip_total update for cash tips, same as done for card tip adjust.

### ISSUE 17: `handleMethodSelect` lists `processGiftCard` and `processGenericPayment` in dependency array but they are defined after

- **File:** `src/app/(pos)/payments/page.tsx`, line 91
- **Severity:** MEDIUM
- **Description:** The `useCallback` dependency array for `handleMethodSelect` lists `[orderTotalCents, orderId, locationId, router]` but the function body calls `processGiftCard()` and `processGenericPayment()` which are not in the dependency array. Due to closure capture, stale references may be used.
- **Fix:** Add `processGiftCard` and `processGenericPayment` to the dependency array.

### ISSUE 18: Tip adjust sends `payment_id: orderId` instead of actual payment ID

- **File:** `src/app/(pos)/payments/page.tsx`, line 184
- **Severity:** HIGH
- **Description:** Comment says "In real flow, use actual payment_id" but code sends `payment_id: orderId`. The API expects a payment UUID. This will cause a 404 because no payment has the order's ID.
- **Fix:** Track the actual payment ID from the card processing result and use it.

### ISSUE 19: `order_modifications` insert missing `org_id`

- **File:** `src/app/api/orders/[id]/split/route.ts`, line 175
- **File:** `src/app/api/orders/[id]/comp/route.ts`, line 140
- **Severity:** HIGH
- **Description:** The `order_modifications` table likely has an `org_id` NOT NULL column, but the inserts don't include it.
- **Fix:** Add `org_id: user.org_id` to all order_modifications inserts.

### ISSUE 20: Equal split doesn't update original order's subtotal correctly

- **File:** `src/app/api/orders/[id]/split/route.ts`, lines 162-170
- **Severity:** HIGH
- **Description:** After equal split, the original order's `total` and `balance_due` are updated to the per-person share, but `subtotal`, `discount_total`, and `tax_total` are NOT updated. This means the order will show mismatched financial totals.
- **Fix:** Update all financial fields on the original order after split.

### ISSUE 21: `hasPermission` is a stub

- **File:** `src/stores/auth-store.ts`, lines 63-68
- **Severity:** MEDIUM
- **Description:** `hasPermission()` always returns `true` for owner/admin and `false` for everyone else. The TODO comment says to check against user's permission list. Any feature gated by specific permissions (not roles) will be broken for non-admin users.
- **Fix:** Load permissions from the `role_permissions` table and check against them.

### ISSUE 22: Void reason passed as string but `order_items.void_reason` is USER-DEFINED (enum)

- **File:** `src/app/api/orders/[id]/items/[itemId]/route.ts`, line 142
- **Severity:** HIGH
- **Description:** The DB schema shows `void_reason` is a USER-DEFINED type (enum), but the API passes a free-text string from the user. The insert will fail if the string doesn't match one of the enum values.
- **Fix:** Either change the DB column to `text`, or validate the API input against the enum values.

---

## 5. Frontend Issues

### ISSUE 23: Reports dashboard still uses mock data by default

- **File:** `src/app/(backoffice)/reports/page.tsx`, lines 35-40
- **Severity:** MEDIUM
- **Description:** State is initialized with `getMockKPIs()`, `getMockHourlySales()`, etc. While there is now a `fetchData` function, it's only called when the date range picker changes. On initial load, the page shows mock data, not real data.
- **Fix:** Call `fetchData` on mount with today's date.

### ISSUE 24: Tables page silently swallows all errors (7 catch blocks)

- **File:** `src/app/(pos)/tables/page.tsx`, lines 109, 141, 266, 294, 318, 361, 378
- **Severity:** MEDIUM
- **Description:** Every catch block has `// silently fail` with no toast, console.error, or user feedback. Failed operations (load, seat, clear, save, add, delete) give zero indication of failure.
- **Fix:** Add `toast.error()` calls to each catch block.

### ISSUE 25: Orders page auto-creates draft with placeholder `server_id: 'current-user'`

- **File:** `src/app/(pos)/orders/page.tsx`, lines 126-128
- **Severity:** MEDIUM
- **Description:** The draft order is created with `server_id: 'current-user'` (a string, not a UUID) and `server_name: 'Server'`. When this order is sent to the API, the server_id is replaced with the auth user's ID, but the local store still shows "Server" as the name. This is cosmetic but misleading.
- **Fix:** Use the auth store's actual user ID and display name.

### ISSUE 26: Menu manager has no error handling for category/item operations

- **File:** `src/app/(backoffice)/menu/page.tsx`
- **Severity:** MEDIUM (already in Visual QA report)
- **Description:** As noted in the Visual QA report, `fetchCategories`, `fetchItems`, and CRUD operations have empty catch blocks.

### ISSUE 27: KDS page has console.log statements in production code

- **File:** `src/app/(fullscreen)/kds/page.tsx`
- **Severity:** LOW (already in Visual QA report)
- **Description:** Debug console.log calls for sound events.

### ISSUE 28: `useRealtimeTables` creates a new channel on every render when `onTableChange` is unstable

- **File:** `src/hooks/use-realtime.ts`, line 172
- **File:** `src/app/(pos)/tables/page.tsx`, line 213
- **Severity:** HIGH
- **Description:** `useRealtimeTables` has `onTableChange` in its dependency array (line 172 of use-realtime.ts). The `handleRealtimeUpdate` callback in tables/page.tsx depends on `tables` state (line 210), which means it gets a new reference on every render. This creates an infinite loop: tables state changes -> new callback -> realtime resubscribes -> triggers update -> tables state changes.
- **Fix:** Use `useRef` for the callback or stabilize it with `useCallback` that doesn't depend on `tables` (use a ref for tables instead).

---

## 6. Security Issues (Beyond Security Audit)

### ISSUE 29: Admin Supabase client used everywhere -- no RLS enforcement

- **File:** `src/lib/supabase/admin.ts` (used in every API route)
- **Severity:** MEDIUM
- **Description:** Every API route uses `createAdminClient()` which bypasses Row Level Security. While routes manually check `org_id`, this means a single missed `.eq('org_id', ...)` filter leaks data across organizations. The `service_role` key is the only thing standing between tenants.
- **Fix:** Use the user's auth context with RLS for data queries where possible. Reserve admin client for operations that genuinely need to bypass RLS.

### ISSUE 30: No rate limiting on API routes

- **File:** All `src/app/api/**/*.ts` files
- **Severity:** MEDIUM
- **Description:** No rate limiting is implemented on any API route. Login has no brute-force protection (the middleware auth check only applies to non-public routes, and `/api/auth` is public). PIN login is particularly vulnerable.
- **Fix:** Add rate limiting middleware, especially for auth endpoints.

### ISSUE 31: `persist` middleware stores auth state in localStorage

- **File:** `src/stores/auth-store.ts`, line 73
- **Severity:** LOW
- **Description:** Auth store is persisted to `localStorage` with key `sear-auth`. This includes user role, org_id, and location_ids. While not a direct vulnerability (auth is cookie-based), it could be tampered with to show incorrect UI state.
- **Fix:** Consider not persisting sensitive auth state, or validating on page load against the server.

---

## 7. Data Integrity Issues

### ISSUE 32: Gift card balance updates are not atomic

- **File:** `src/app/api/payments/process/route.ts`, lines 130-142
- **File:** `src/app/api/payments/gift-card/reload/route.ts`, lines 53-64
- **Severity:** HIGH
- **Description:** Gift card balance is read, then updated in a separate query. Under concurrent requests, two redemptions could both read the same balance and both succeed, overdrawing the card. No transaction or row-level lock is used.
- **Fix:** Use a Postgres function with row-level locking, or use `UPDATE ... SET current_balance = current_balance - amount WHERE current_balance >= amount`.

### ISSUE 33: Order number 0 used for split orders

- **File:** `src/app/api/orders/[id]/split/route.ts`, lines 97, 137
- **Severity:** MEDIUM
- **Description:** Split orders are created with `order_number: 0`. If there's a unique constraint on (location_id, order_number), multiple splits will conflict. Display number is also potentially non-unique (`-S` suffix).
- **Fix:** Generate proper order numbers for split orders.

### ISSUE 34: `recalculateOrderTotals` uses hardcoded 8.5% tax rate

- **File:** `src/app/api/orders/[id]/items/route.ts`, line 174
- **File:** `src/app/api/orders/[id]/items/[itemId]/route.ts`, line 175
- **File:** `src/app/api/orders/[id]/discount/route.ts`, line 119
- **File:** `src/app/api/orders/[id]/comp/route.ts`, line 124
- **Severity:** MEDIUM
- **Description:** Tax is always calculated as 8.5% of the subtotal. The system has a `tax_rates` table and per-item `tax_rate_id`, but none of the recalculation logic uses them.
- **Fix:** Look up the location's tax rate from the `tax_rates` table instead of hardcoding.

---

## 8. Missing Functionality

### ISSUE 35: Discount feature on POS page is stubbed

- **File:** `src/app/(pos)/orders/page.tsx`, line 340
- **Severity:** MEDIUM
- **Description:** The "Discount" quick action shows `toast.info('Discount -- coming soon')`. The API endpoint exists and works, but the UI has no way to invoke it.
- **Fix:** Add a discount dialog/sheet that collects discount type, value, and calls the API.

### ISSUE 36: Print feature on POS page is stubbed

- **File:** `src/app/(pos)/orders/page.tsx`, line 344
- **Severity:** LOW
- **Description:** The "Print" quick action shows `toast.info('Print -- coming soon')`.

### ISSUE 37: Rush flag is cosmetic only

- **File:** `src/app/(pos)/orders/page.tsx`, lines 335-337
- **Severity:** LOW
- **Description:** "Rush" shows a toast but doesn't persist any flag to the order or notify the kitchen.
- **Fix:** Add a `is_rush` field to orders and propagate to KDS.

### ISSUE 38: Receipt flow is a no-op

- **File:** `src/app/(pos)/payments/page.tsx`, lines 197-199
- **Severity:** LOW
- **Description:** `handleReceiptChoice` receives the choice (print/email/SMS/none) but does nothing with it except advance to the complete screen.

### ISSUE 39: Login page does not use `redirect` query parameter after successful login

- **File:** `src/app/(auth)/login/page.tsx`, line 78
- **Severity:** LOW
- **Description:** The middleware sets `?redirect=` when redirecting to login, but the login page always redirects to `/orders` on success, ignoring the redirect parameter.
- **Fix:** Read `searchParams.get('redirect')` and navigate there instead of hardcoding `/orders`.

---

## Summary of Blocked Flows

| Flow | Status | Blocking Issues |
|------|--------|-----------------|
| Login | WORKS | -- |
| Order creation (add items) | BLOCKED | #9 (missing org_id) |
| Send to kitchen | WORKS (if items exist) | depends on #9 |
| Card payment | BLOCKED | #6, #7 (missing columns) |
| Cash payment | BLOCKED | #6 (missing location_id) |
| Gift card payment | BLOCKED | #2, #3, #12 (wrong column names) |
| Table seating | BLOCKED | #1 (no guest_count) |
| Floor plan view | BLOCKED | #1 (selects guest_count) |
| Order void | BLOCKED | #4 (no void columns) |
| Order split | BLOCKED | #5 (no split_from_order_id) |
| Tip adjust | BLOCKED | #8 (wrong column name), #18 (wrong payment_id) |
| KDS station create | BLOCKED | #10 (type vs station_type) |
| Order comp | BLOCKED | #11 (no comped_at) |
| Discount (UI) | STUBBED | #35 |
| Reports dashboard | WORKS (mock data on initial load) | #23 |
