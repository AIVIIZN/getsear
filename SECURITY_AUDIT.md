# Sear POS v2 — Security Audit

> Generated: 2026-03-22
> Scope: All API route handlers under `src/app/api/`
> Checks: Auth (getAuthUser), Role (requireRole), Input validation (zod), Service key exposure

---

## Middleware Summary

- `src/middleware.ts` checks auth for all routes NOT in `PUBLIC_ROUTES`
- Public routes: `/login`, `/pin-login`, `/register`, `/_next/*`, `/favicon.ico`, `/api/auth`, `/api/webhooks`, `/api/terminals/activate`, `/api/terminals/heartbeat`
- Middleware redirects unauthenticated users to `/login` for non-public routes
- **Note:** Middleware auth is session-based (cookie). API routes still need `getAuthUser()` for user context (org_id, role, location_ids).

---

## Legend

| Symbol | Meaning |
|--------|---------|
| Y | Present and correct |
| N | **Missing — potential issue** |
| n/a | Not applicable (GET-only, public route, or auth route) |
| PARTIAL | Some methods have it, some don't |

---

## Auth Routes (`/api/auth/*`) — PUBLIC

These are intentionally public (in PUBLIC_ROUTES list).

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `auth/login` | POST | n/a | n/a | N | **No zod validation on email/password input** — uses manual check only |
| `auth/logout` | POST | n/a | n/a | n/a | None (no input) |
| `auth/me` | GET | Y (inline) | n/a | n/a | Uses `supabase.auth.getUser()` directly instead of `getAuthUser()` helper — functionally equivalent |
| `auth/pin-login` | POST | n/a | n/a | N | **No zod validation on user_id/pin** — uses manual check only |

---

## Accounting Routes (`/api/accounting/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `accounting/callback` | GET | Y | N | n/a | **No role check** — any authenticated user can complete OAuth callback |
| `accounting/connect` | GET | Y | Y | n/a | None |
| `accounting/disconnect` | POST | Y | Y | n/a | None |
| `accounting/settings` | GET, PATCH | Y | Y | Y | None |
| `accounting/status` | GET | Y | Y | n/a | None |
| `accounting/sync` | POST | Y | Y | Y | None |

---

## Catering Routes (`/api/catering/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `catering/calendar` | GET | Y | N | n/a | **No role check** — any user can view catering calendar |
| `catering/events` | GET, POST | Y | PARTIAL | Y | POST has role check; GET does not |
| `catering/events/[id]` | GET, PUT, DELETE | Y | PARTIAL | Y | PUT/DELETE have role check; GET does not |
| `catering/menus` | GET, POST | Y | Y | Y | None |
| `catering/menus/[id]` | GET, PUT, DELETE | Y | Y | Y | None |

---

## Customer Routes (`/api/customers/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `customers` | GET, POST | Y | Y | Y | None |
| `customers/[id]` | GET, PATCH, DELETE | Y | Y | Y | None |
| `customers/[id]/loyalty` | GET | Y | N | n/a | No role check (read-only, acceptable for staff) |
| `customers/[id]/orders` | GET | Y | N | n/a | No role check (read-only, acceptable for staff) |
| `customers/lookup` | POST | Y | N | Y | **No role check on POST** — any user can look up customers (likely intentional for servers) |
| `customers/merge` | POST | Y | Y | Y | None |

---

## Delivery Routes (`/api/delivery/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `delivery/deliveries` | GET, POST | Y | **N** | Y | **No role check on POST** — any authenticated user can create a delivery |
| `delivery/deliveries/[id]` | GET, DELETE | Y | **N** | n/a | **No role check on DELETE** — any user can delete a delivery |
| `delivery/deliveries/[id]/assign` | POST | Y | **N** | Y | **No role check** — any user can assign a driver |
| `delivery/deliveries/[id]/status` | POST | Y | **N** | Y | **No role check** — any user can change delivery status |
| `delivery/zones` | GET, POST | Y | Y | Y | None |
| `delivery/zones/[id]` | GET, PUT, DELETE | Y | Y | Y | None |

---

## Drive-Thru Routes (`/api/drive-thru/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `drive-thru/menu-boards` | GET, POST | Y | Y | Y | None |
| `drive-thru/menu-boards/[id]` | GET, PUT, DELETE | Y | Y | Y | None |
| `drive-thru/orders` | GET, POST | Y | **N** | Y | **No role check on POST** — any user can create drive-thru orders (may be intentional for cashier role) |
| `drive-thru/orders/[id]` | GET, PUT | Y | **N** | Y | **No role check on PUT** — any user can update drive-thru orders |
| `drive-thru/orders/metrics` | GET | Y | Y | n/a | None |

---

## Franchise Routes (`/api/franchise/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `franchise/locations` | GET | Y | Y | n/a | None |
| `franchise/locations/sync` | POST | Y | Y | Y | None |
| `franchise/reports` | GET | Y | Y | n/a | None |
| `franchise/royalties` | GET | Y | Y | n/a | None |
| `franchise/royalties/[id]` | GET, PUT | Y | Y | Y | None |
| `franchise/royalties/calculate` | POST | Y | Y | Y | None |

---

## House Accounts Routes (`/api/house-accounts/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `house-accounts` | GET, POST | Y | Y | Y | None |
| `house-accounts/[id]` | GET, PATCH | Y | Y | Y | None |
| `house-accounts/[id]/charge` | POST | Y | Y | Y | None |
| `house-accounts/[id]/payment` | POST | Y | Y | Y | None |
| `house-accounts/[id]/statement` | GET | Y | Y | n/a | None |

---

## Inventory Routes (`/api/inventory/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `inventory/items` | GET, POST | Y | Y | Y | None |
| `inventory/items/[id]` | GET, PUT, DELETE | Y | Y | Y | None |
| `inventory/items/[id]/count` | POST | Y | **N** | Y | **No role check** — any user can submit inventory counts |
| `inventory/purchase-orders` | GET, POST | Y | Y | Y | None |
| `inventory/purchase-orders/[id]` | GET, PUT, DELETE | Y | Y | Y | None |
| `inventory/purchase-orders/[id]/receive` | POST | Y | **N** | Y | **No role check** — any user can receive a PO |
| `inventory/purchase-orders/[id]/reconcile` | POST | Y | Y | n/a | None |
| `inventory/recipes` | GET, POST | Y | Y | Y | None |
| `inventory/recipes/[id]` | PUT, DELETE | Y | Y | Y | None |
| `inventory/vendors` | GET, POST | Y | Y | Y | None |
| `inventory/vendors/[id]` | GET, PUT | Y | Y | Y | None |

---

## KDS Routes (`/api/kds/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `kds/stations` | GET, POST | Y | Y | Y | None |
| `kds/stations/[id]` | PATCH | Y | Y | Y | None |
| `kds/tickets` | GET | Y | N | n/a | No role check (read-only, acceptable for kitchen staff) |
| `kds/tickets/[id]/bump` | POST | Y | **N** | **N** | **No role check, no input validation** |
| `kds/tickets/[id]/recall` | POST | Y | **N** | **N** | **No role check, no input validation** |
| `kds/tickets/bump-all` | POST | Y | **N** | Y | **No role check** — any user can bump all tickets |

---

## Loyalty Routes (`/api/loyalty/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `loyalty/programs` | GET, POST | Y | Y | Y | None |
| `loyalty/programs/[id]` | PATCH | Y | Y | Y | None |
| `loyalty/accounts` | GET, POST | Y | **N** | Y | **No role check on POST** — any user can create loyalty accounts |
| `loyalty/accounts/[id]` | GET | Y | N | n/a | No role check (read-only) |
| `loyalty/accounts/[id]/adjust` | POST | Y | Y | Y | None |
| `loyalty/accounts/[id]/earn` | POST | Y | **N** | Y | **No role check** — any user can add points |
| `loyalty/accounts/[id]/redeem` | POST | Y | **N** | Y | **No role check** — any user can redeem points |
| `loyalty/accounts/[id]/transactions` | GET | Y | N | n/a | No role check (read-only) |

---

## Marketing Routes (`/api/marketing/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `marketing/analytics` | GET | Y | Y | n/a | None |
| `marketing/campaigns` | GET, POST | Y | Y | Y | None |
| `marketing/campaigns/[id]` | GET, PUT, DELETE | Y | Y | Y | None |
| `marketing/campaigns/[id]/recipients` | GET, POST | Y | Y | **N** | **POST has no zod validation** — uses manual array check |
| `marketing/campaigns/[id]/send` | POST | Y | Y | **N** | **No input validation** |
| `marketing/segments` | GET | Y | Y | n/a | None |
| `marketing/segments/count` | POST | Y | Y | **N** | **No input validation on POST body** |

---

## Menu Routes (`/api/menu/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `menu/categories` | GET, POST | Y | Y | Y | None |
| `menu/categories/[id]` | PATCH, DELETE | Y | Y | Y | None |
| `menu/categories/reorder` | PATCH | Y | Y | Y | None |
| `menu/items` | GET, POST | Y | Y | Y | None |
| `menu/items/[id]` | PATCH, DELETE | Y | Y | Y | None |
| `menu/items/[id]/86` | PATCH | Y | Y | n/a | None |
| `menu/items/[id]/modifier-groups` | POST | Y | Y | Y | None |
| `menu/items/reorder` | PATCH | Y | Y | Y | None |
| `menu/modifier-groups` | GET, POST | Y | Y | Y | None |
| `menu/modifier-groups/[id]` | PATCH, DELETE | Y | Y | Y | None |

---

## Online Ordering Routes (`/api/online-ordering/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `online-ordering/menus` | GET, POST | Y | Y | Y | None |
| `online-ordering/menus/[id]` | PATCH | Y | Y | Y | None |
| `online-ordering/menus/[id]/items` | GET, PATCH | Y | Y | Y | None |
| `online-ordering/queue` | GET | Y | N | n/a | No role check (read-only, acceptable) |
| `online-ordering/queue/[id]/accept` | POST | Y | **N** | **N** | **No role check, no input validation** |
| `online-ordering/queue/[id]/reject` | POST | Y | **N** | Y | **No role check** — any user can reject orders |
| `online-ordering/settings` | GET, PATCH | Y | Y | Y | None |

---

## Orders Routes (`/api/orders/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `orders` | GET, POST | Y | PARTIAL | Y | POST has no role check (intentional — servers create orders) |
| `orders/active` | GET | Y | N | n/a | Read-only, acceptable |
| `orders/[id]` | GET, PATCH, DELETE | Y | PARTIAL | Y | DELETE has role check; PATCH does not fully (has role check for some fields) |
| `orders/[id]/items` | POST | Y | **N** | Y | **No role check** — any user can add items (likely intentional for servers) |
| `orders/[id]/items/[itemId]` | PATCH, DELETE | Y | Y | Y | None |
| `orders/[id]/comp` | POST | Y | Y | Y | None |
| `orders/[id]/discount` | POST | Y | **N** | Y | **No role check** — any user can apply discounts |
| `orders/[id]/fire-course` | POST | Y | **N** | Y | No role check (operational, acceptable) |
| `orders/[id]/hold` | POST | Y | **N** | **N** | **No role check, no input validation** |
| `orders/[id]/merge` | POST | Y | **N** | Y | **No role check** — any user can merge orders |
| `orders/[id]/move-table` | POST | Y | **N** | Y | No role check (operational, acceptable) |
| `orders/[id]/reopen` | POST | Y | Y | n/a | None |
| `orders/[id]/send` | POST | Y | **N** | **N** | **No input validation** (no body needed, acceptable) |
| `orders/[id]/split` | POST | Y | **N** | Y | **No role check** — any user can split orders |
| `orders/[id]/transfer` | POST | Y | **N** | Y | No role check (operational, acceptable) |

---

## Payments Routes (`/api/payments/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `payments/process` | POST | Y | **N** | Y | **No role check** — any user can process payments |
| `payments/capture` | POST | Y | **N** | Y | **No role check** — any user can capture payments |
| `payments/void` | POST | Y | Y | Y | None |
| `payments/refund` | POST | Y | Y | Y | None |
| `payments/tip-adjust` | POST | Y | **N** | Y | **No role check** — any user can adjust tips |
| `payments/preauth` | POST | Y | **N** | Y | **No role check** — any user can pre-auth |
| `payments/settlement` | GET | Y | Y | n/a | None |
| `payments/gift-card/activate` | POST | Y | **N** | Y | **No role check** — any user can activate gift cards |
| `payments/gift-card/check-balance` | POST | Y | **N** | Y | No role check (read-like, acceptable) |
| `payments/gift-card/reload` | POST | Y | **N** | Y | **No role check** — any user can reload gift cards |

---

## Reservations Routes (`/api/reservations/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `reservations` | GET, POST | Y | Y | Y | None |
| `reservations/[id]` | PATCH, DELETE | Y | Y | Y | None |
| `reservations/[id]/confirm` | POST | Y | Y | n/a | None |
| `reservations/[id]/seat` | POST | Y | Y | Y | None |
| `reservations/availability` | GET | Y | N | n/a | Read-only, acceptable |
| `reservations/waitlist` | GET, POST | Y | Y | Y | None |
| `reservations/waitlist/[id]` | PATCH | Y | Y | Y | None |
| `reservations/waitlist/[id]/seat` | POST | Y | Y | Y | None |

---

## Scheduling Routes (`/api/scheduling/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `scheduling/shifts` | GET, POST | Y | Y | Y | None |
| `scheduling/shifts/[id]` | GET, PUT, DELETE | Y | Y | Y | None |
| `scheduling/templates` | GET, POST | Y | Y | Y | None |
| `scheduling/templates/[id]` | PUT, DELETE | Y | Y | Y | None |
| `scheduling/availability` | GET, PUT | Y | **N** | Y | **No role check on PUT** — users should only edit their own availability, but no ownership check |
| `scheduling/availability/[userId]` | GET | Y | N | n/a | Read-only, acceptable |
| `scheduling/swap-requests` | GET, POST | Y | **N** | Y | **No role check on POST** — any user can create swap requests (likely intentional) |
| `scheduling/swap-requests/[id]` | PUT | Y | Y | Y | None |

---

## Settings Routes (`/api/settings/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `settings/organization` | GET, PATCH | Y | Y | Y | None |
| `settings/locations` | GET, POST | Y | Y | Y | None |
| `settings/locations/[id]` | GET, PATCH, DELETE | Y | Y | Y | None |
| `settings/modules` | GET, PATCH | Y | Y | Y | None |
| `settings/tax-rates` | GET, POST | Y | Y | Y | None |
| `settings/tax-rates/[id]` | PATCH, DELETE | Y | Y | Y | None |
| `settings/terminals` | GET, POST | Y | Y | Y | None |
| `settings/terminals/[id]` | PATCH, DELETE | Y | Y | Y | None |
| `settings/roles` | GET, POST | Y | Y | Y | None |
| `settings/roles/[id]` | PATCH, DELETE | Y | Y | Y | None |

---

## Staff Routes (`/api/staff/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `staff` | GET, POST | Y | Y | Y | None |
| `staff/active` | GET | Y | N | n/a | Read-only, acceptable |
| `staff/[id]` | GET, PATCH, DELETE | Y | Y | Y | None |
| `staff/[id]/clock-in` | POST | Y | **N** | Y | **No role check** — any user can clock in others (should verify self or manager) |
| `staff/[id]/clock-out` | POST | Y | **N** | Y | **No role check** — same issue |
| `staff/[id]/break-start` | POST | Y | **N** | Y | **No role check** |
| `staff/[id]/break-end` | POST | Y | **N** | **N** | **No role check, no input validation** |
| `staff/[id]/time-entries` | GET | Y | Y | n/a | None |
| `staff/time-entries/[id]` | PATCH | Y | Y | Y | None |
| `staff/time-entries/[id]/approve` | POST | Y | Y | n/a | None |
| `staff/tips` | GET | Y | Y | n/a | None |
| `staff/tips/distribute` | POST | Y | Y | Y | None |

---

## Tables Routes (`/api/tables/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `tables` | GET, POST | Y | Y | Y | None |
| `tables/[id]` | PATCH, DELETE | Y | Y | Y | None |
| `tables/[id]/seat` | POST | Y | **N** | Y | **No role check** — any user can seat tables (likely intentional for hosts/servers) |
| `tables/[id]/clear` | POST | Y | **N** | Y | **No role check** |
| `tables/[id]/history` | GET | Y | N | n/a | Read-only, acceptable |
| `tables/bulk-update` | PATCH | Y | Y | Y | None |
| `tables/floor-plans` | GET, POST | Y | Y | Y | None |
| `tables/floor-plans/[id]` | GET, PATCH | Y | Y | Y | None |
| `tables/sections` | GET | Y | N | n/a | Read-only, acceptable |
| `tables/status-summary` | GET | Y | N | n/a | Read-only, acceptable |

---

## Terminal Routes (`/api/terminals/*`)

| Route | Methods | Auth | Role | Validation | Issues |
|-------|---------|------|------|------------|--------|
| `terminals/activate` | POST | n/a (public) | n/a | **N** | **No zod validation** — uses manual checks. Public endpoint, properly in PUBLIC_ROUTES. |
| `terminals/heartbeat` | POST | n/a (public) | n/a | **N** | **No zod validation** — uses manual checks. Public endpoint, properly in PUBLIC_ROUTES. |
| `terminals/register` | POST | Y | Y | **N** | **No zod validation** on registration body |
| `terminals/[id]/configure` | PATCH | Y | Y | **N** | **No zod validation** on configuration body |

---

## Service Key Exposure Check

**Result: PASS** -- No route file references `SUPABASE_SERVICE_ROLE_KEY` directly. All routes use `createAdminClient()` which reads the key from `process.env` server-side only. The key is never sent to the client.

---

## Critical Issues Summary

### HIGH Priority (fix before production)

1. **`orders/[id]/discount` — No role check on POST**
   Discounts directly affect revenue. Should require `manager+` role.
   File: `src/app/api/orders/[id]/discount/route.ts`

2. **`orders/[id]/merge` — No role check on POST**
   Merging orders can be used to obfuscate voids/theft.
   File: `src/app/api/orders/[id]/merge/route.ts`

3. **`delivery/deliveries/[id]` — No role check on DELETE**
   Any user can delete delivery records.
   File: `src/app/api/delivery/deliveries/[id]/route.ts`

4. **`payments/tip-adjust` — No role check**
   Tip adjustments are a fraud vector. Should require `manager+`.
   File: `src/app/api/payments/tip-adjust/route.ts`

5. **`staff/[id]/clock-in` and `clock-out` — No ownership or role check**
   Any user can clock in/out any other user. Should verify `user.id === params.id` or `manager+` role.
   Files: `src/app/api/staff/[id]/clock-in/route.ts`, `src/app/api/staff/[id]/clock-out/route.ts`

### MEDIUM Priority

6. **`delivery/deliveries` POST — No role check** (`src/app/api/delivery/deliveries/route.ts`)
7. **`delivery/deliveries/[id]/assign` — No role check** (`src/app/api/delivery/deliveries/[id]/assign/route.ts`)
8. **`inventory/items/[id]/count` — No role check** (`src/app/api/inventory/items/[id]/count/route.ts`)
9. **`inventory/purchase-orders/[id]/receive` — No role check** (`src/app/api/inventory/purchase-orders/[id]/receive/route.ts`)
10. **`loyalty/accounts` POST — No role check** (`src/app/api/loyalty/accounts/route.ts`)
11. **`loyalty/accounts/[id]/earn` — No role check** (`src/app/api/loyalty/accounts/[id]/earn/route.ts`)
12. **`loyalty/accounts/[id]/redeem` — No role check** (`src/app/api/loyalty/accounts/[id]/redeem/route.ts`)
13. **`online-ordering/queue/[id]/accept` — No role check, no validation** (`src/app/api/online-ordering/queue/[id]/accept/route.ts`)
14. **`payments/gift-card/activate` — No role check** (`src/app/api/payments/gift-card/activate/route.ts`)
15. **`payments/gift-card/reload` — No role check** (`src/app/api/payments/gift-card/reload/route.ts`)
16. **`scheduling/availability` PUT — No role check** (`src/app/api/scheduling/availability/route.ts`)

### LOW Priority (missing zod but has manual validation)

17. **`auth/login` — No zod schema** (manual email/password check is sufficient but zod preferred)
18. **`auth/pin-login` — No zod schema** (manual check is sufficient)
19. **`terminals/activate` — No zod schema** (public, manual checks present)
20. **`terminals/heartbeat` — No zod schema** (public, manual checks present)
21. **`terminals/register` — No zod schema** (`src/app/api/terminals/register/route.ts`)
22. **`terminals/[id]/configure` — No zod schema** (`src/app/api/terminals/[id]/configure/route.ts`)
23. **`marketing/campaigns/[id]/recipients` POST — No zod** (manual array check)
24. **`marketing/campaigns/[id]/send` — No input validation**
25. **`marketing/segments/count` — No input validation**
26. **`kds/tickets/[id]/bump` — No input validation**
27. **`kds/tickets/[id]/recall` — No input validation**
28. **`orders/[id]/hold` — No input validation**
29. **`staff/[id]/break-end` — No input validation**

---

## Routes with Clean Security (no issues found)

- All `settings/*` routes
- All `menu/*` routes
- All `franchise/*` routes
- All `house-accounts/*` routes
- All `reservations/*` routes (including waitlist)
- `marketing/campaigns` (main CRUD)
- `marketing/analytics`, `marketing/segments`
- `scheduling/shifts`, `scheduling/templates`
- `staff` (main CRUD), `staff/tips`, `staff/time-entries`
- `kds/stations`
- `orders/[id]/comp`, `orders/[id]/reopen`
- `payments/void`, `payments/refund`, `payments/settlement`

---

## Recommendations

1. Add `requireRole(user, ['owner', 'admin', 'manager'])` to all discount, merge, tip-adjust, and deletion routes
2. Add ownership check (`user.id === params.id`) to clock-in/clock-out/break routes, with manager override
3. Add zod schemas to all terminal management routes
4. Add zod schemas to auth login/pin-login for consistent validation
5. Consider adding rate limiting to payment processing routes beyond what middleware provides
