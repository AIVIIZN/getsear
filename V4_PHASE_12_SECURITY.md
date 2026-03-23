# Sear POS v4 — Phase 12: Security & Performance Hardening

**Date:** 2026-03-23
**Phase:** 12 of 13
**Priority:** HIGH — before launch
**Estimated Sessions:** 2
**Depends On:** All previous phases (this hardens everything built so far)

---

## 1.1 What is this?

A security and performance hardening pass across the entire Sear POS codebase. Currently, the application has security gaps that would be unacceptable in a production POS system handling payment data and personal information:

1. **Missing Zod validation** on many API routes — raw request bodies trusted without schema validation
2. **In-memory rate limiting** that resets on server restart and doesn't work across PM2 cluster workers
3. **No location-level authorization** — a user authenticated to Org A could potentially access Location B's data if they know the ID
4. **No MFA** — owner/admin accounts protected only by password
5. **No password reset flow** — users locked out if they forget their password
6. **Untyped Supabase client** — `as any` casts throughout the codebase hide type errors
7. **No query optimization** — missing indexes, potential N+1 queries, no connection pooling strategy
8. **No load testing** — unknown how the system performs under dinner rush load

This phase is not about adding features. It is about making every existing feature production-safe.

**Read these files BEFORE planning:**
- `CLAUDE.md` — project config, coding rules
- `API_SPEC.md` — all 267 routes (audit each for Zod validation)
- `SCHEMA.md` — database tables and indexes
- `src/lib/supabase/server.ts` — current Supabase client setup
- `src/lib/supabase/client.ts` — client-side Supabase client
- `src/lib/api/auth.ts` — current auth helper
- Every `route.ts` file in `src/app/api/` — audit for validation gaps

---

## 1.2 Tech stack

No new frameworks. Hardening tools:

- **Zod** — already installed, needs enforcement on all routes
- **Redis** — already running for BullMQ, extend for rate limiting
- **ioredis** — Redis client for rate limiting middleware
- **Supabase CLI** — `supabase gen types typescript` for typed client
- **autocannon / k6** — load testing tool
- **@supabase/supabase-js** — typed generics with generated types

---

## 1.3 User roles

| Role | Security context |
|------|-----------------|
| **Owner** | MFA required. Full access. Password reset available. |
| **Admin** | MFA required. Full access minus billing. Password reset available. |
| **Manager** | Standard auth. Location-scoped access. PIN for overrides. |
| **Server/Bartender/Host/Kitchen** | PIN login only. Location-scoped. Limited to role permissions. |

---

## 1.4 Pages and features

### Feature: Zod Validation on ALL API Routes

**What:** Every API route handler must validate the incoming request body, query parameters, and URL parameters using Zod schemas before processing. No route should trust raw input.

**Current state audit — routes MISSING Zod validation:**

The following route groups need Zod schema creation and enforcement:

| Route Group | Routes | Files to Fix |
|-------------|--------|-------------|
| Auth | `/api/auth/login`, `/api/auth/pin-login` | `src/app/api/auth/login/route.ts`, `src/app/api/auth/pin-login/route.ts` |
| Settings | All 8 settings routes | `src/app/api/settings/organization/route.ts`, `settings/locations/route.ts`, `settings/locations/[id]/route.ts`, `settings/tax-rates/route.ts`, `settings/tax-rates/[id]/route.ts`, `settings/terminals/route.ts`, `settings/terminals/[id]/route.ts`, `settings/roles/[id]/route.ts` |
| Menu | 7 routes | `src/app/api/menu/categories/route.ts`, `menu/categories/[id]/route.ts`, `menu/categories/reorder/route.ts`, `menu/items/route.ts`, `menu/items/[id]/route.ts`, `menu/items/reorder/route.ts`, `menu/modifier-groups/route.ts`, `menu/modifier-groups/[id]/route.ts` |
| Orders | 5 routes | `src/app/api/orders/[id]/route.ts`, `orders/[id]/send/route.ts`, `orders/[id]/fire-course/route.ts`, `orders/[id]/hold/route.ts`, `orders/active/route.ts` |
| Payments | 5 routes | `src/app/api/payments/capture/route.ts`, `payments/void/route.ts`, `payments/refund/route.ts`, `payments/preauth/route.ts`, `payments/settlement/route.ts` |
| Tables | 8 routes | `src/app/api/tables/route.ts`, `tables/[id]/route.ts`, `tables/[id]/seat/route.ts`, `tables/[id]/clear/route.ts`, `tables/sections/route.ts`, `tables/bulk-update/route.ts`, `tables/floor-plans/route.ts`, `tables/floor-plans/[id]/route.ts` |
| Staff | 10 routes | `src/app/api/staff/route.ts`, `staff/[id]/route.ts`, `staff/[id]/clock-in/route.ts`, `staff/[id]/clock-out/route.ts`, `staff/[id]/break-start/route.ts`, `staff/[id]/break-end/route.ts`, `staff/[id]/time-entries/route.ts`, `staff/time-entries/[id]/route.ts`, `staff/tips/route.ts`, `staff/tips/distribute/route.ts` |
| Customers | 5 routes | `src/app/api/customers/route.ts`, `customers/[id]/route.ts`, `customers/lookup/route.ts`, `customers/merge/route.ts`, `customers/[id]/orders/route.ts` |
| Reservations | 8 routes | `src/app/api/reservations/route.ts`, `reservations/[id]/route.ts`, `reservations/[id]/confirm/route.ts`, `reservations/[id]/seat/route.ts`, `reservations/waitlist/route.ts`, `reservations/waitlist/[id]/route.ts`, `reservations/waitlist/[id]/seat/route.ts`, `reservations/availability/route.ts` |
| Inventory | 7 routes | All routes in `src/app/api/inventory/` |
| Loyalty | 7 routes | All routes in `src/app/api/loyalty/` |
| Online Ordering | 7 routes | All routes in `src/app/api/online-ordering/` |
| Marketing | 5 routes | All routes in `src/app/api/marketing/` |
| Scheduling | 8 routes | All routes in `src/app/api/scheduling/` |
| Delivery | 6 routes | All routes in `src/app/api/delivery/` |
| Catering | 5 routes | All routes in `src/app/api/catering/` |
| House Accounts | 5 routes | All routes in `src/app/api/house-accounts/` |
| Drive-Thru | 5 routes | All routes in `src/app/api/drive-thru/` |
| Franchise | 6 routes | All routes in `src/app/api/franchise/` |
| KDS | 2 routes | `src/app/api/kds/stations/[id]/route.ts`, `src/app/api/kds/tickets/route.ts` |
| Reports | All report routes | All routes in `src/app/api/reports/` |

**Implementation pattern:**
```typescript
// src/lib/api/validate.ts — shared validation helper
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

export async function validateBody<T>(req: NextRequest, schema: z.ZodSchema<T>): Promise<T> {
  const body = await req.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ValidationError(result.error.flatten());
  }
  return result.data;
}
```

Each route group gets a dedicated schema file in `src/lib/schemas/`.

### Feature: Redis-Backed Rate Limiting

**What:** Replace in-memory rate limiter with Redis-backed sliding window rate limiter that works across PM2 cluster workers.

**Rate limit tiers:**
| Tier | Limit | Window | Applies to |
|------|-------|--------|-----------|
| Auth | 5 attempts | 15 minutes | `/api/auth/login`, `/api/auth/pin-login` |
| Public | 30 requests | 1 minute | `/reserve/*`, `/order/*`, all public endpoints |
| Standard | 100 requests | 1 minute | All authenticated endpoints |
| Bulk | 10 requests | 1 minute | `/api/*/bulk-*`, batch operations |
| Payment | 20 requests | 1 minute | `/api/payments/*` |

**Implementation:** Sliding window counter in Redis using `MULTI`/`EXEC` for atomicity. Key format: `ratelimit:{tier}:{identifier}:{window}`. Identifier is IP for public, user_id for authenticated.

### Feature: Location-Level Authorization

**What:** A `requireLocation` helper that verifies the authenticated user has access to the location referenced in the request. Currently, if a user at Location A knows Location B's ID, they could potentially access Location B's data.

**Implementation:**
```typescript
// src/lib/api/require-location.ts
export async function requireLocation(userId: string, locationId: string): Promise<void> {
  // Check user_locations table for active assignment
  // Throw 403 if user is not assigned to this location
}
```

**Apply to:** Every route that accepts `location_id` as a parameter or reads it from the request context. This includes orders, tables, menu (location-specific pricing), staff (clock in/out), KDS, reservations, and all module routes.

### Feature: MFA for Owner/Admin (TOTP)

**What:** Time-based One-Time Password (TOTP) as second factor for owner and admin role logins. Uses Supabase Auth MFA support.

**Flow:**
1. Owner/Admin enables MFA in Settings > Security
2. Shown QR code to scan with authenticator app (Google Authenticator, Authy, 1Password)
3. Enter verification code to confirm setup
4. On subsequent logins: email/password → TOTP code → access granted
5. Recovery codes generated on setup (10 single-use codes) — shown once, must be saved

**UI:**
- Settings > Security page: "Two-Factor Authentication" section
- Setup wizard: QR code display → verification input → recovery codes display
- Login page: TOTP input step (6-digit code, 30-second window)

### Feature: Password Reset Flow

**What:** Forgot password → email with reset link → new password form → logged in.

**Flow:**
1. Login page: "Forgot your password?" link
2. Enter email address → "If an account exists, we'll send a reset link"
3. SendGrid sends email with secure reset link (Supabase Auth `resetPasswordForEmail`)
4. Link opens `/auth/reset-password?token=xxx` page
5. User enters new password (with strength indicator) + confirmation
6. Password updated → redirected to login → "Password updated successfully" toast

**Security:**
- Reset link expires after 1 hour
- Reset link is single-use
- Rate limited: 3 reset requests per email per hour
- No information leak: same response whether email exists or not

### Feature: Supabase Typed Client

**What:** Generate TypeScript types from the Supabase database schema and use them throughout the codebase, replacing all `as any` type assertions.

**Steps:**
1. Run `supabase gen types typescript --project-id lbekiyxqemxozmghgmtp > src/lib/supabase/database.types.ts`
2. Update `src/lib/supabase/server.ts` to use `createServerClient<Database>(...)`
3. Update `src/lib/supabase/client.ts` to use `createBrowserClient<Database>(...)`
4. Find and replace every `as any` related to Supabase queries with proper types
5. Fix any type errors that surface (these are real bugs hiding behind `as any`)

**Audit:** Search entire codebase for `as any` — every instance must be justified or removed.

### Feature: Performance Optimization

**What:** Database query optimization, index creation, N+1 query detection, and connection pooling configuration.

**Index audit — missing indexes to create:**
| Table | Column(s) | Type | Reason |
|-------|-----------|------|--------|
| `orders` | `location_id, status, created_at` | composite | Filter active orders by location |
| `orders` | `server_id, created_at` | composite | Server performance reports |
| `order_items` | `order_id` | btree | Order item lookup (N+1 prevention) |
| `order_items` | `menu_item_id, created_at` | composite | Product mix reports |
| `payments` | `order_id` | btree | Payment lookup for order |
| `payments` | `location_id, created_at` | composite | Payment reports |
| `tables` | `location_id, status` | composite | Table status queries |
| `reservations` | `location_id, date, status` | composite | Availability checks |
| `time_entries` | `user_id, clock_in_at` | composite | Staff time queries |
| `kds_tickets` | `station_id, status, created_at` | composite | KDS ticket queries |
| `inventory_items` | `location_id, quantity` | composite | Low stock queries |
| `customers` | `org_id, phone` | btree | Phone lookup |
| `customers` | `org_id, email` | btree | Email lookup |

**N+1 query detection:** Audit all list endpoints that fetch related data. Common patterns:
- Order list fetching items per order (should use single join query)
- Staff list fetching time entries per staff member
- Menu items fetching modifier groups per item
- KDS tickets fetching items per ticket

**Connection pooling:** Verify Supabase connection pooler is configured. Use `pgbouncer` mode for serverless-compatible pooling. Ensure all queries use the pooled connection string.

### Feature: Load Testing Setup

**What:** Configure and run load tests simulating a dinner rush: 50 concurrent POS terminals creating orders, processing payments, and updating KDS simultaneously.

**Scenarios:**
| Scenario | Concurrent Users | Duration | Actions |
|----------|-----------------|----------|---------|
| Normal dinner | 10 terminals | 5 min | Create order, add items, send to kitchen, process payment |
| Rush hour | 30 terminals | 10 min | Same as above + frequent menu checks + table status updates |
| Stress test | 50 terminals | 15 min | All of above + KDS bumps + report queries + reservation lookups |

**Metrics to capture:**
- P50, P95, P99 response times per endpoint
- Error rate (target: <0.1%)
- Throughput (requests/second)
- Database connection count
- Memory usage
- CPU usage

**Tools:** k6 scripts in `src/scripts/load-tests/`

---

## 1.5 Look and feel

- MFA setup page: clean, step-by-step wizard with large QR code display (200x200px), monospace recovery codes, copy-to-clipboard button
- Password reset page: centered card layout, password strength meter (red/yellow/green bar), clear requirements text
- Settings > Security page: organized sections with toggle switches, status indicators
- Rate limit error: clean 429 response with "Too many requests. Please wait X seconds." message displayed as toast on frontend
- No visible changes to existing pages — this phase is invisible to end users except for MFA and password reset

---

## 1.6 Business rules

- Manager PIN is already bcrypt-hashed — no changes needed
- MFA is required for `owner` and `admin` roles, optional for `manager`
- MFA can be enforced org-wide by owner in settings
- Rate limiting must not interfere with legitimate dinner rush usage (100 req/min per user is sufficient)
- Password minimum: 8 characters, at least one uppercase, one lowercase, one number
- Session timeout: 12 hours for POS terminals, 1 hour for back-office (configurable)
- All API errors return consistent format: `{ error: string, code: string, details?: object }`
- PCI compliance: card data never touches Sear servers (Valor handles all card data). Verify no route logs or stores card numbers.

---

## 1.7 Integrations

- **Redis:** Rate limiting storage, session caching
- **Supabase Auth:** MFA (TOTP), password reset
- **SendGrid:** Password reset emails
- **Supabase CLI:** Type generation

---

## 1.8 Modules planned but not for this build

None — this phase hardens all existing modules.

---

## 1.9 Files, acceptance criteria, and workflow tests

### Files to CREATE

| # | File | Purpose |
|---|------|---------|
| 1 | `src/lib/api/validate.ts` | Shared Zod validation helper (validateBody, validateQuery, validateParams) |
| 2 | `src/lib/api/rate-limit.ts` | Redis-backed sliding window rate limiter |
| 3 | `src/lib/api/require-location.ts` | Location-level authorization helper |
| 4 | `src/lib/api/error-response.ts` | Consistent API error response builder |
| 5 | `src/lib/schemas/auth.ts` | Zod schemas for auth routes |
| 6 | `src/lib/schemas/orders.ts` | Zod schemas for order routes |
| 7 | `src/lib/schemas/payments.ts` | Zod schemas for payment routes |
| 8 | `src/lib/schemas/menu.ts` | Zod schemas for menu routes |
| 9 | `src/lib/schemas/tables.ts` | Zod schemas for table routes |
| 10 | `src/lib/schemas/staff.ts` | Zod schemas for staff routes |
| 11 | `src/lib/schemas/customers.ts` | Zod schemas for customer routes |
| 12 | `src/lib/schemas/reservations.ts` | Zod schemas for reservation routes |
| 13 | `src/lib/schemas/settings.ts` | Zod schemas for settings routes |
| 14 | `src/lib/schemas/kds.ts` | Zod schemas for KDS routes |
| 15 | `src/lib/schemas/inventory.ts` | Zod schemas for inventory routes |
| 16 | `src/lib/schemas/loyalty.ts` | Zod schemas for loyalty routes |
| 17 | `src/lib/schemas/online-ordering.ts` | Zod schemas for online ordering routes |
| 18 | `src/lib/schemas/marketing.ts` | Zod schemas for marketing routes |
| 19 | `src/lib/schemas/scheduling.ts` | Zod schemas for scheduling routes |
| 20 | `src/lib/schemas/delivery.ts` | Zod schemas for delivery routes |
| 21 | `src/lib/schemas/catering.ts` | Zod schemas for catering routes |
| 22 | `src/lib/schemas/house-accounts.ts` | Zod schemas for house account routes |
| 23 | `src/lib/schemas/drive-thru.ts` | Zod schemas for drive-thru routes |
| 24 | `src/lib/schemas/franchise.ts` | Zod schemas for franchise routes |
| 25 | `src/lib/schemas/reports.ts` | Zod schemas for report routes |
| 26 | `src/lib/supabase/database.types.ts` | Generated Supabase TypeScript types |
| 27 | `src/app/auth/reset-password/page.tsx` | Password reset form page |
| 28 | `src/app/auth/forgot-password/page.tsx` | Forgot password email entry page |
| 29 | `src/app/(backoffice)/settings/security/page.tsx` | MFA setup + security settings page |
| 30 | `src/components/auth/MFASetup.tsx` | MFA QR code + verification wizard |
| 31 | `src/components/auth/MFAVerify.tsx` | TOTP code input during login |
| 32 | `src/components/auth/PasswordStrength.tsx` | Password strength indicator |
| 33 | `src/components/auth/RecoveryCodes.tsx` | Recovery code display and copy |
| 34 | `src/app/api/auth/forgot-password/route.ts` | Password reset email trigger |
| 35 | `src/app/api/auth/reset-password/route.ts` | Password reset execution |
| 36 | `src/app/api/auth/mfa/setup/route.ts` | MFA TOTP setup (generate secret, QR) |
| 37 | `src/app/api/auth/mfa/verify/route.ts` | MFA TOTP verification |
| 38 | `src/app/api/auth/mfa/recovery/route.ts` | Recovery code verification |
| 39 | `src/scripts/load-tests/dinner-rush.ts` | k6 load test: normal dinner scenario |
| 40 | `src/scripts/load-tests/stress-test.ts` | k6 load test: 50 concurrent terminals |
| 41 | `src/scripts/load-tests/helpers.ts` | Shared load test utilities |
| 42 | `supabase/migrations/xxx_add_indexes.sql` | Database index creation migration |

### Files to MODIFY

| # | File | What changes |
|---|------|-------------|
| 1 | `src/lib/supabase/server.ts` | Add `Database` generic type to `createServerClient<Database>()` |
| 2 | `src/lib/supabase/client.ts` | Add `Database` generic type to `createBrowserClient<Database>()` |
| 3 | `src/lib/api/auth.ts` | Add `requireLocation` check, integrate rate limiter |
| 4 | `src/app/api/auth/login/route.ts` | Add Zod validation, rate limiting, MFA check |
| 5 | `src/app/api/auth/pin-login/route.ts` | Add Zod validation, rate limiting |
| 6-100+ | Every `route.ts` in `src/app/api/` | Add Zod validation import + validateBody/validateQuery calls |
| 101 | `src/app/(auth)/login/page.tsx` | Add "Forgot password?" link, MFA code step |
| 102 | `src/app/(backoffice)/settings/layout.tsx` | Add "Security" nav item |
| 103 | `src/middleware.ts` | Add rate limiting middleware for public routes |

*Note: Every single API route file is modified in this phase. The table above shows key files; the full list is every route.ts in src/app/api/.*

### Acceptance Criteria

- [ ] **AC-01:** Every API route that accepts POST/PUT/PATCH body validates it with a Zod schema. Invalid input returns 400 with structured error listing invalid fields.
- [ ] **AC-02:** Every API route that accepts query parameters validates them with a Zod schema. Invalid params return 400.
- [ ] **AC-03:** Sending `{"email": 123, "password": true}` to `/api/auth/login` returns 400 with field-level error messages, not a 500 server error.
- [ ] **AC-04:** Sending a valid request with extra unexpected fields strips the extra fields (Zod `.strict()` or `.strip()` configured appropriately per route).
- [ ] **AC-05:** Rate limiter uses Redis (verified by checking Redis keys after requests). Persists across PM2 worker restarts.
- [ ] **AC-06:** 6th login attempt within 15 minutes returns 429 with "Too many login attempts. Please wait X minutes."
- [ ] **AC-07:** Rate limit headers included in responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- [ ] **AC-08:** User at Location A cannot access Location B's orders, tables, menu, staff, or any other location-scoped data — returns 403.
- [ ] **AC-09:** `requireLocation` check is present in every route that handles location-specific data.
- [ ] **AC-10:** Owner enables MFA → scans QR code with authenticator app → enters 6-digit code → MFA activated → recovery codes displayed
- [ ] **AC-11:** Owner with MFA enabled logs in → enters email/password → prompted for TOTP code → enters code → access granted
- [ ] **AC-12:** Owner enters wrong TOTP code 3 times → temporarily locked out for 5 minutes
- [ ] **AC-13:** Owner uses recovery code instead of TOTP → access granted → recovery code marked as used → cannot be reused
- [ ] **AC-14:** User clicks "Forgot password" → enters email → receives reset email within 30 seconds → clicks link → enters new password → password updated → can log in with new password
- [ ] **AC-15:** Password reset link expires after 1 hour. Clicking expired link shows "This link has expired" message.
- [ ] **AC-16:** Password reset link is single-use. Second click shows "This link has already been used" message.
- [ ] **AC-17:** `database.types.ts` is generated and used in both server and client Supabase clients. Zero `as any` casts related to Supabase queries remain.
- [ ] **AC-18:** All 13 database indexes from the optimization plan are created. Verified with `\d+ table_name` in psql.
- [ ] **AC-19:** Order list endpoint uses a single query with JOIN (not N+1) to fetch orders with their items. Verified by checking query count in Supabase logs.
- [ ] **AC-20:** Load test: 10 concurrent terminals creating orders for 5 minutes → P95 response time < 500ms, error rate < 0.1%
- [ ] **AC-21:** Load test: 30 concurrent terminals for 10 minutes → P95 response time < 1000ms, error rate < 0.5%
- [ ] **AC-22:** Load test: 50 concurrent terminals for 15 minutes → system remains responsive, no OOM crashes, no connection pool exhaustion
- [ ] **AC-23:** No API route logs or stores raw card numbers, CVVs, or full card data. Grep for `card_number`, `cvv`, `pan` returns zero matches in route handlers.
- [ ] **AC-24:** All API errors return consistent JSON format: `{ error: string, code: string, details?: object }` — no raw stack traces in production.

### Workflow Tests

**Workflow 1: Zod Validation End-to-End**
1. Send POST to `/api/orders` with missing required fields → 400 with `{ error: "Validation failed", code: "VALIDATION_ERROR", details: { fieldErrors: { location_id: ["Required"] } } }`
2. Send POST to `/api/orders` with valid fields + extra `hacker_field: true` → field stripped, order created normally
3. Send POST to `/api/payments/capture` with `amount: "not_a_number"` → 400 with type error details
4. Send GET to `/api/orders/active?location_id=not-a-uuid` → 400 with UUID format error

**Workflow 2: Rate Limiting Under Load**
1. Send 5 login attempts with wrong password → all return 401
2. Send 6th attempt → returns 429 with `Retry-After` header
3. Wait for window to expire → next attempt returns 401 (not 429)
4. Restart PM2 workers → rate limit state persists in Redis → 7th attempt still blocked

**Workflow 3: Location Authorization**
1. User authenticated to Location "Downtown" (location_id: abc-123)
2. Fetch `/api/orders/active?location_id=abc-123` → 200, returns Downtown orders
3. Fetch `/api/orders/active?location_id=xyz-789` (Uptown location) → 403 "Access denied to this location"
4. Attempt to create order with `location_id: xyz-789` → 403
5. Attempt to update table at wrong location → 403

**Workflow 4: MFA Setup and Login**
1. Owner opens Settings > Security → "Two-Factor Authentication: Not configured"
2. Taps "Enable 2FA" → QR code appears → scans with Google Authenticator
3. Enters 6-digit code from app → "2FA enabled successfully" → 10 recovery codes displayed
4. Owner saves recovery codes → taps "Done"
5. Logs out → logs back in → enters email/password → "Enter your authentication code" screen appears
6. Enters code from authenticator → logged in successfully
7. Next login: enters wrong code → "Invalid code" → tries recovery code → logged in → code marked used

**Workflow 5: Password Reset**
1. User on login page → taps "Forgot your password?"
2. Enters email "manager@restaurant.com" → "If an account exists, you'll receive a reset link"
3. Email arrives with reset link → clicks link → lands on `/auth/reset-password`
4. Enters new password "NewPass123!" → strength meter shows green → enters confirmation → taps "Reset Password"
5. "Password updated!" → redirected to login → logs in with new password

**Workflow 6: Load Test Dinner Rush**
1. Start k6 script with 30 virtual users
2. Each user: authenticate → fetch menu → create order → add 3-5 items → send to kitchen → process payment
3. Concurrent: 5 users querying KDS tickets, 3 users checking table status, 2 users running reports
4. After 10 minutes: collect metrics → P95 < 1000ms → error rate < 0.5% → no connection pool exhaustion
5. Check Supabase dashboard: connection count stable, no query timeouts

---

## Summary

This phase makes Sear POS production-safe with:
- **Zod validation** on all ~120+ API route handlers
- **Redis rate limiting** across PM2 cluster workers
- **Location-level authorization** preventing cross-location data access
- **MFA (TOTP)** for owner/admin accounts
- **Password reset** via email
- **Typed Supabase client** eliminating `as any` casts
- **13 database indexes** for query performance
- **N+1 query elimination** on all list endpoints
- **Load testing** simulating 50 concurrent dinner rush terminals

42 new files, 100+ modified files, 24 acceptance criteria, 6 workflow tests.
