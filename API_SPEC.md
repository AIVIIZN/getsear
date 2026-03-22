# Sear POS — API Specification

> **Stack:** Next.js 15 + TypeScript + Supabase
> **Base path:** `/api` (Next.js Route Handlers under `app/api/`)
> **Auth:** Bearer JWT in `Authorization` header; manager overrides via `X-Manager-PIN` header
> **IDs:** UUIDv7 (time-sortable)
> **Money:** Integer cents in API layer; `numeric(10,2)` dollars in DB
> **Timestamps:** ISO 8601 UTC (`timestamptz`)

---

## Route Summary

| Module | Routes | Status |
|--------|--------|--------|
| Auth | 11 | Existing |
| Menu | 21 | Existing |
| Orders | 22 | Existing |
| Payments | 8 | Existing |
| Tables | 12 | Existing |
| Staff | 15 | Existing |
| Reports | 14 | Existing |
| Settings | 20 | Existing |
| Customers | 8 | Existing |
| KDS | 8 | Existing |
| SSE / Real-Time | 4 | Existing |
| Reconciliation | 3 | Existing |
| Online Ordering | 10 | **New** |
| Delivery | 8 | **New** |
| Loyalty | 10 | **New** |
| Reservations & Waitlist | 14 | Existing + expanded |
| Staff Scheduling | 10 | **New** |
| Marketing Campaigns | 10 | **New** |
| Inventory | 14 | Existing + expanded |
| Catering & Events | 10 | **New** |
| House Accounts | 7 | **New** |
| Drive-Thru | 6 | **New** |
| QR Code Ordering | 6 | **New** |
| Franchise | 6 | **New** |
| **Total** | **267** | |

---

## Common Types

```typescript
// Shared across all routes

type UUID = string; // UUIDv7

interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; per_page: number; total: number; total_pages: number };
}

interface ApiSuccess<T> {
  success: true;
  data: T;
}

interface ApiError {
  success: false;
  error: { code: string; message: string; details?: Record<string, string[]> };
}

// Auth levels used in route definitions:
// - public: no auth required
// - authenticated: valid JWT required
// - role:<role>: requires specific role (owner, admin, manager, server, host, kitchen, bartender)
// - permission:<perm>: requires specific permission in JWT claims
// - manager-approval: requires X-Manager-PIN header with valid manager PIN
```

---

## 1. Auth — 11 routes

### `POST /api/auth/login`
- **Auth:** public
- **Rate limit:** 10/min per IP
- **Request:**
  ```typescript
  { email: string; password: string }
  ```
- **Response:**
  ```typescript
  { access_token: string; refresh_token: string; expires_in: number; user: { id: UUID; email: string; name: string; role: string; org_id: UUID; location_ids: UUID[] } }
  ```
- **Logic:** Authenticate with email/password, return JWT with org/role/permission claims.

### `POST /api/auth/login/pin`
- **Auth:** authenticated (terminal session required)
- **Request:**
  ```typescript
  { pin: string; terminal_id: UUID }
  ```
- **Response:**
  ```typescript
  { access_token: string; user: { id: UUID; name: string; role: string; avatar_url: string | null } }
  ```
- **Logic:** Quick PIN-based login within an already-authenticated terminal context. PIN verified against bcrypt hash.

### `POST /api/auth/refresh`
- **Auth:** public (refresh token in body)
- **Request:**
  ```typescript
  { refresh_token: string }
  ```
- **Response:**
  ```typescript
  { access_token: string; refresh_token: string; expires_in: number }
  ```
- **Logic:** Exchange valid refresh token for new access/refresh token pair.

### `POST /api/auth/logout`
- **Auth:** authenticated
- **Request:** `{}`
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Invalidate current session and refresh token.

### `POST /api/auth/forgot-password`
- **Auth:** public
- **Rate limit:** 3/min per email
- **Request:**
  ```typescript
  { email: string }
  ```
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Send password reset email via SendGrid. Always returns 200 regardless of whether email exists (prevents enumeration).

### `POST /api/auth/reset-password`
- **Auth:** public (token in body)
- **Request:**
  ```typescript
  { token: string; new_password: string }
  ```
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Reset password using valid reset token. Password must meet complexity requirements (12+ chars, mixed case, number, symbol).

### `GET /api/auth/me`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { id: UUID; email: string; name: string; role: string; org_id: UUID; location_ids: UUID[]; permissions: string[]; avatar_url: string | null; created_at: string }
  ```
- **Logic:** Return current user profile from JWT claims + database.

### `PUT /api/auth/me`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { name?: string; avatar_url?: string; current_password?: string; new_password?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; avatar_url: string | null }
  ```
- **Logic:** Update current user profile. Password change requires current password verification.

### `POST /api/auth/verify-manager-pin`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { pin: string }
  ```
- **Response:**
  ```typescript
  { valid: boolean; manager_id: UUID; manager_name: string }
  ```
- **Logic:** Verify a manager/owner PIN for override actions. Locks out after 5 failed attempts for 15 minutes.

### `POST /api/auth/terminals/register`
- **Auth:** role:owner | role:admin
- **Request:**
  ```typescript
  { registration_code: string; device_fingerprint: string; name: string; location_id: UUID; terminal_type: 'pos' | 'kds' | 'kiosk' | 'customer_display' }
  ```
- **Response:**
  ```typescript
  { terminal_id: UUID; terminal_token: string; location: { id: UUID; name: string } }
  ```
- **Logic:** Register a new device as a terminal. Generates long-lived terminal session token.

### `POST /api/auth/terminals/heartbeat`
- **Auth:** authenticated (terminal token)
- **Request:**
  ```typescript
  { terminal_id: UUID; app_version: string; battery_level?: number }
  ```
- **Response:**
  ```typescript
  { status: string; server_time: string }
  ```
- **Logic:** Terminal sends periodic heartbeat. Updates last_seen timestamp, detects stale terminals.

---

## 2. Menu — 21 routes

### `GET /api/menu/categories`
- **Auth:** authenticated
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; display_order: number; item_count: number; is_active: boolean; color: string | null }> }
  ```
- **Logic:** List all categories for a location, ordered by display_order.

### `POST /api/menu/categories`
- **Auth:** permission:menu.manage
- **Request:**
  ```typescript
  { name: string; location_id: UUID; color?: string; is_active?: boolean }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; display_order: number; color: string | null }
  ```
- **Logic:** Create a new menu category. Assigned next display_order automatically.

### `PUT /api/menu/categories/[id]`
- **Auth:** permission:menu.manage
- **Request:**
  ```typescript
  { name?: string; color?: string; is_active?: boolean }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; color: string | null; is_active: boolean }
  ```
- **Logic:** Update category name, color, or active status.

### `DELETE /api/menu/categories/[id]`
- **Auth:** permission:menu.manage
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Soft-delete category. Fails if category has active items (must reassign or delete items first).

### `PATCH /api/menu/categories/reorder`
- **Auth:** permission:menu.manage
- **Request:**
  ```typescript
  { order: Array<{ id: UUID; display_order: number }> }
  ```
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Batch update display_order for categories.

### `GET /api/menu/items`
- **Auth:** authenticated
- **Query:** `?category_id=<uuid>&location_id=<uuid>&include_86=true&search=<string>`
- **Response:**
  ```typescript
  PaginatedResponse<{ id: UUID; name: string; price_cents: number; category_id: UUID; is_86: boolean; display_order: number; description: string | null; image_url: string | null; tax_rate_ids: UUID[]; modifier_group_ids: UUID[] }>
  ```
- **Logic:** List menu items with optional filters. 86'd items included only when `include_86=true`.

### `POST /api/menu/items`
- **Auth:** permission:menu.manage
- **Request:**
  ```typescript
  { name: string; price_cents: number; category_id: UUID; location_id: UUID; description?: string; image_url?: string; tax_rate_ids?: UUID[]; modifier_group_ids?: UUID[]; printer_routing?: string[] }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; price_cents: number; category_id: UUID }
  ```
- **Logic:** Create a new menu item with optional modifier group and tax rate associations.

### `GET /api/menu/items/[id]`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { id: UUID; name: string; price_cents: number; category_id: UUID; description: string | null; image_url: string | null; is_86: boolean; display_order: number; tax_rate_ids: UUID[]; modifier_groups: Array<{ id: UUID; name: string; min_selections: number; max_selections: number; modifiers: Array<{ id: UUID; name: string; price_cents: number }> }>; printer_routing: string[] }
  ```
- **Logic:** Get item with full modifier group tree and tax rates.

### `PUT /api/menu/items/[id]`
- **Auth:** permission:menu.manage
- **Request:**
  ```typescript
  { name?: string; price_cents?: number; category_id?: UUID; description?: string; image_url?: string; tax_rate_ids?: UUID[]; modifier_group_ids?: UUID[]; printer_routing?: string[] }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; price_cents: number }
  ```
- **Logic:** Update menu item fields and associations.

### `DELETE /api/menu/items/[id]`
- **Auth:** permission:menu.manage
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Soft-delete menu item. Item remains on existing open orders.

### `PATCH /api/menu/items/[id]/86`
- **Auth:** permission:menu.86
- **Request:**
  ```typescript
  { is_86: boolean }
  ```
- **Response:**
  ```typescript
  { id: UUID; is_86: boolean }
  ```
- **Logic:** Toggle 86 status. Publishes SSE event to all terminals when an item is 86'd.

### `PATCH /api/menu/items/reorder`
- **Auth:** permission:menu.manage
- **Request:**
  ```typescript
  { category_id: UUID; order: Array<{ id: UUID; display_order: number }> }
  ```
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Batch update display_order for items within a category.

### `GET /api/menu/modifier-groups`
- **Auth:** authenticated
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; min_selections: number; max_selections: number; modifier_count: number }> }
  ```
- **Logic:** List all modifier groups.

### `POST /api/menu/modifier-groups`
- **Auth:** permission:menu.manage
- **Request:**
  ```typescript
  { name: string; location_id: UUID; min_selections: number; max_selections: number }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; min_selections: number; max_selections: number }
  ```
- **Logic:** Create modifier group with selection constraints.

### `PUT /api/menu/modifier-groups/[id]`
- **Auth:** permission:menu.manage
- **Request:**
  ```typescript
  { name?: string; min_selections?: number; max_selections?: number }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; min_selections: number; max_selections: number }
  ```
- **Logic:** Update modifier group.

### `DELETE /api/menu/modifier-groups/[id]`
- **Auth:** permission:menu.manage
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Delete modifier group. Fails if currently linked to active menu items.

### `GET /api/menu/modifiers`
- **Auth:** authenticated
- **Query:** `?group_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; price_cents: number; group_id: UUID; display_order: number }> }
  ```
- **Logic:** List modifiers, optionally filtered by group.

### `POST /api/menu/modifiers`
- **Auth:** permission:menu.manage
- **Request:**
  ```typescript
  { name: string; price_cents: number; group_id: UUID }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; price_cents: number; group_id: UUID }
  ```
- **Logic:** Create a modifier within a group.

### `PUT /api/menu/modifiers/[id]`
- **Auth:** permission:menu.manage
- **Request:**
  ```typescript
  { name?: string; price_cents?: number }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; price_cents: number }
  ```
- **Logic:** Update modifier name or price.

### `DELETE /api/menu/modifiers/[id]`
- **Auth:** permission:menu.manage
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Delete modifier. Remains on existing open order items.

### `GET /api/menu/tree`
- **Auth:** authenticated
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; display_order: number; items: Array<{ id: UUID; name: string; price_cents: number; is_86: boolean; modifier_groups: Array<{ id: UUID; name: string; modifiers: Array<{ id: UUID; name: string; price_cents: number }> }> }> }> }
  ```
- **Logic:** Full menu tree (categories > items > modifier groups > modifiers) in one call. Used by POS order entry screen.

---

## 3. Orders — 22 routes

### `GET /api/orders`
- **Auth:** authenticated
- **Query:** `?status=<open|closed|voided>&date_from=<iso>&date_to=<iso>&server_id=<uuid>&table_id=<uuid>&page=<int>&per_page=<int>`
- **Response:**
  ```typescript
  PaginatedResponse<{ id: UUID; order_number: string; status: string; table_id: UUID | null; server_id: UUID; guest_count: number; subtotal_cents: number; tax_cents: number; total_cents: number; created_at: string; closed_at: string | null }>
  ```
- **Logic:** List orders with filters. Defaults to today's open orders.

### `POST /api/orders`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { table_id?: UUID; server_id: UUID; guest_count?: number; order_type: 'dine_in' | 'takeout' | 'delivery' | 'bar_tab'; customer_id?: UUID; notes?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; order_number: string; status: 'draft'; table_id: UUID | null; server_id: UUID }
  ```
- **Logic:** Create a new draft order. Order number is auto-generated using atomic sequence per location per day.

### `GET /api/orders/[id]`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { id: UUID; order_number: string; status: string; table_id: UUID | null; server: { id: UUID; name: string }; guest_count: number; order_type: string; items: Array<{ id: UUID; menu_item_id: UUID; name: string; quantity: number; price_cents: number; modifiers: Array<{ id: UUID; name: string; price_cents: number }>; seat_number: number | null; course: number; status: string; voided: boolean; comp: boolean; notes: string | null }>; discounts: Array<{ id: UUID; name: string; type: 'percentage' | 'fixed'; amount: number }>; payments: Array<{ id: UUID; method: string; amount_cents: number; tip_cents: number; status: string }>; subtotal_cents: number; discount_cents: number; tax_cents: number; total_cents: number; balance_due_cents: number; created_at: string; sent_at: string | null; closed_at: string | null }
  ```
- **Logic:** Get full order with items, modifiers, discounts, and payments.

### `PUT /api/orders/[id]`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { guest_count?: number; notes?: string; order_type?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; guest_count: number; notes: string | null }
  ```
- **Logic:** Update order metadata (not items — use item-specific routes).

### `DELETE /api/orders/[id]`
- **Auth:** authenticated + manager-approval (if order is sent)
- **Request:**
  ```typescript
  { reason: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; status: 'voided' }
  ```
- **Logic:** Void entire order. Draft orders can be voided by any server; sent/open orders require manager PIN. Logged to audit trail.

### `POST /api/orders/[id]/send`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { fire_immediately?: boolean }
  ```
- **Response:**
  ```typescript
  { id: UUID; status: 'sent'; sent_at: string }
  ```
- **Logic:** Send order to kitchen. Creates KDS tickets, fires to printers per routing rules. Publishes SSE events.

### `POST /api/orders/[id]/fire-course`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { course: number }
  ```
- **Response:**
  ```typescript
  { id: UUID; course_fired: number }
  ```
- **Logic:** Fire a specific course number to the kitchen. Sends KDS tickets for items matching that course.

### `POST /api/orders/[id]/items`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { items: Array<{ menu_item_id: UUID; quantity: number; modifier_ids?: UUID[]; seat_number?: number; course?: number; notes?: string }> }
  ```
- **Response:**
  ```typescript
  { order_id: UUID; items_added: Array<{ id: UUID; name: string; price_cents: number }> }
  ```
- **Logic:** Add one or more items to an existing order. If order is already sent, new items are automatically fired to kitchen.

### `PUT /api/orders/[id]/items/[itemId]`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { quantity?: number; modifier_ids?: UUID[]; seat_number?: number; course?: number; notes?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; quantity: number; price_cents: number }
  ```
- **Logic:** Update an order item's quantity, modifiers, seat assignment, course, or notes.

### `DELETE /api/orders/[id]/items/[itemId]`
- **Auth:** authenticated + manager-approval (if item is sent)
- **Request:**
  ```typescript
  { reason: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; voided: true }
  ```
- **Logic:** Void individual item. Sent items require manager PIN. Audit logged.

### `POST /api/orders/[id]/transfer`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { to_server_id: UUID }
  ```
- **Response:**
  ```typescript
  { id: UUID; server_id: UUID }
  ```
- **Logic:** Transfer order to another server. Notifies both servers via SSE.

### `POST /api/orders/[id]/move-table`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { to_table_id: UUID }
  ```
- **Response:**
  ```typescript
  { id: UUID; table_id: UUID }
  ```
- **Logic:** Move order to a different table. Updates both table statuses. Publishes table SSE events.

### `POST /api/orders/[id]/split`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { split_type: 'equal' | 'by_seat' | 'by_item' | 'custom'; splits?: Array<{ item_ids?: UUID[]; amount_cents?: number }> }
  ```
- **Response:**
  ```typescript
  { original_order_id: UUID; checks: Array<{ id: UUID; order_number: string; items: Array<{ id: UUID; name: string }>; total_cents: number }> }
  ```
- **Logic:** Split order into multiple checks. Equal splits duplicate the order; by-seat/by-item/custom creates child orders with assigned items.

### `POST /api/orders/[id]/merge`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { merge_order_id: UUID }
  ```
- **Response:**
  ```typescript
  { id: UUID; merged_items_count: number; total_cents: number }
  ```
- **Logic:** Merge another order into this one. Moves all items from merge_order_id into this order and voids the source.

### `POST /api/orders/[id]/reopen`
- **Auth:** role:manager | role:owner + manager-approval
- **Request:**
  ```typescript
  { reason: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; status: 'open' }
  ```
- **Logic:** Reopen a closed order. Reverses any settlement impact. Audit logged.

### `GET /api/orders/[id]/modifications`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; action: string; details: Record<string, unknown>; performed_by: { id: UUID; name: string }; created_at: string }> }
  ```
- **Logic:** Full modification/audit history for an order.

### `POST /api/orders/[id]/discount`
- **Auth:** permission:orders.discount | manager-approval
- **Request:**
  ```typescript
  { name: string; type: 'percentage' | 'fixed'; amount: number; reason?: string; item_ids?: UUID[] }
  ```
- **Response:**
  ```typescript
  { id: UUID; discount_id: UUID; total_cents: number }
  ```
- **Logic:** Apply discount to order or specific items. Amount is percentage (0-100) or fixed cents. Recalculates totals.

### `DELETE /api/orders/[id]/discount/[discountId]`
- **Auth:** permission:orders.discount
- **Response:**
  ```typescript
  { id: UUID; total_cents: number }
  ```
- **Logic:** Remove a discount from an order. Recalculates totals.

### `POST /api/orders/[id]/items/[itemId]/comp`
- **Auth:** manager-approval
- **Request:**
  ```typescript
  { reason: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; comp: true; comp_reason: string }
  ```
- **Logic:** Comp (zero out) an item. Requires manager PIN. Audit logged with reason.

### `GET /api/orders/open`
- **Auth:** authenticated
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; order_number: string; table_id: UUID | null; server_name: string; item_count: number; total_cents: number; duration_minutes: number; status: string }> }
  ```
- **Logic:** All open orders for the current location. Used by POS main screen.

### `GET /api/orders/by-table/[tableId]`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; order_number: string; server_name: string; total_cents: number; status: string }> }
  ```
- **Logic:** Get all orders associated with a specific table (current seating).

---

## 4. Payments — 8 routes

### `POST /api/payments`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { order_id: UUID; method: 'card' | 'cash' | 'gift_card'; amount_cents: number; tip_cents?: number; token?: string; gift_card_number_hash?: string; cash_tendered_cents?: number; terminal_id?: UUID }
  ```
- **Response:**
  ```typescript
  { id: UUID; order_id: UUID; method: string; amount_cents: number; tip_cents: number; status: 'authorized' | 'captured' | 'completed'; change_due_cents?: number; card_brand?: string; last_four?: string; auth_code?: string }
  ```
- **Logic:** Process payment. Card payments go through Valor (auth or auth+capture). Cash calculates change. Gift card checks balance and deducts.

### `GET /api/payments/[id]`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { id: UUID; order_id: UUID; method: string; amount_cents: number; tip_cents: number; status: string; card_brand: string | null; last_four: string | null; auth_code: string | null; captured_at: string | null; voided_at: string | null; refunded_at: string | null; created_at: string }
  ```
- **Logic:** Get payment details including card info (last four only) and status history.

### `POST /api/payments/[id]/capture`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { amount_cents?: number; tip_cents?: number }
  ```
- **Response:**
  ```typescript
  { id: UUID; status: 'captured'; amount_cents: number; tip_cents: number }
  ```
- **Logic:** Capture a previously authorized payment. Supports partial capture and tip addition (bar tab close).

### `POST /api/payments/[id]/void`
- **Auth:** authenticated + manager-approval
- **Request:**
  ```typescript
  { reason: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; status: 'voided' }
  ```
- **Logic:** Void payment before settlement. Sends void to Valor. Audit logged.

### `POST /api/payments/[id]/refund`
- **Auth:** permission:payments.refund + manager-approval
- **Request:**
  ```typescript
  { amount_cents: number; reason: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; refund_id: UUID; amount_cents: number; status: 'refunded' }
  ```
- **Logic:** Full or partial refund after settlement. Processed through Valor. Creates refund record.

### `POST /api/payments/[id]/adjust-tip`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { tip_cents: number }
  ```
- **Response:**
  ```typescript
  { id: UUID; tip_cents: number; total_cents: number }
  ```
- **Logic:** Adjust tip on authorized/captured payment. Common for post-signing tip entry.

### `POST /api/payments/preauth`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { order_id: UUID; amount_cents: number; terminal_id: UUID }
  ```
- **Response:**
  ```typescript
  { id: UUID; status: 'authorized'; amount_cents: number; auth_code: string }
  ```
- **Logic:** Pre-authorize a card for bar tab. Holds amount on card without capturing.

### `GET /api/payments/settlement-report`
- **Auth:** permission:reports.view
- **Query:** `?date=<iso-date>&location_id=<uuid>`
- **Response:**
  ```typescript
  { date: string; location_id: UUID; card_total_cents: number; cash_total_cents: number; gift_card_total_cents: number; tip_total_cents: number; refund_total_cents: number; void_total_cents: number; net_total_cents: number; transaction_count: number; transactions: Array<{ id: UUID; method: string; amount_cents: number; tip_cents: number; status: string; time: string }> }
  ```
- **Logic:** End-of-day settlement report. Shows all transactions and totals by payment method.

---

## 5. Tables — 12 routes

### `GET /api/tables`
- **Auth:** authenticated
- **Query:** `?location_id=<uuid>&floor_plan_id=<uuid>&status=<available|occupied|reserved|dirty>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; capacity: number; status: string; floor_plan_id: UUID; x: number; y: number; width: number; height: number; shape: 'circle' | 'rectangle' | 'square'; section_id: UUID | null; current_order_id: UUID | null; server_name: string | null; seated_at: string | null; guest_count: number | null }> }
  ```
- **Logic:** List all tables with real-time status, position data, and current occupancy.

### `GET /api/tables/floor-plans`
- **Auth:** authenticated
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; is_default: boolean; table_count: number }> }
  ```
- **Logic:** List floor plans for a location.

### `GET /api/tables/floor-plans/[id]`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { id: UUID; name: string; is_default: boolean; width: number; height: number; background_image_url: string | null; tables: Array<{ id: UUID; name: string; capacity: number; x: number; y: number; width: number; height: number; shape: string; status: string; section_id: UUID | null }> }
  ```
- **Logic:** Get floor plan with all positioned tables.

### `POST /api/tables/floor-plans`
- **Auth:** permission:tables.manage
- **Request:**
  ```typescript
  { name: string; location_id: UUID; width?: number; height?: number; is_default?: boolean }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Create a new floor plan.

### `PUT /api/tables/floor-plans/[id]`
- **Auth:** permission:tables.manage
- **Request:**
  ```typescript
  { name?: string; width?: number; height?: number; is_default?: boolean; tables?: Array<{ id?: UUID; name: string; capacity: number; x: number; y: number; width: number; height: number; shape: string }> }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; table_count: number }
  ```
- **Logic:** Update floor plan layout. When `tables` array is provided, creates/updates/removes tables to match (bulk layout save from drag-and-drop editor).

### `POST /api/tables/[id]/seat`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { guest_count: number; server_id: UUID; reservation_id?: UUID }
  ```
- **Response:**
  ```typescript
  { table_id: UUID; status: 'occupied'; order_id: UUID }
  ```
- **Logic:** Seat guests at table. Creates a new draft order automatically. Links reservation if provided. Publishes SSE event.

### `POST /api/tables/[id]/clear`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { table_id: UUID; status: 'dirty' }
  ```
- **Logic:** Clear table after guests leave. Sets status to dirty (or available if auto-bus is on). Publishes SSE event.

### `PUT /api/tables/[id]/status`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { status: 'available' | 'occupied' | 'reserved' | 'dirty' | 'blocked' }
  ```
- **Response:**
  ```typescript
  { table_id: UUID; status: string }
  ```
- **Logic:** Manually update table status. Publishes SSE event.

### `GET /api/tables/[id]/history`
- **Auth:** authenticated
- **Query:** `?date_from=<iso>&date_to=<iso>`
- **Response:**
  ```typescript
  { data: Array<{ order_id: UUID; server_name: string; guest_count: number; seated_at: string; cleared_at: string; duration_minutes: number; total_cents: number }> }
  ```
- **Logic:** Table turn history for analysis. Used by reports and table management.

### `GET /api/tables/sections`
- **Auth:** authenticated
- **Query:** `?location_id=<uuid>&floor_plan_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; server: { id: UUID; name: string } | null; table_ids: UUID[] }> }
  ```
- **Logic:** Get server section assignments for current shift.

### `PUT /api/tables/sections`
- **Auth:** permission:tables.manage
- **Request:**
  ```typescript
  { sections: Array<{ id?: UUID; name: string; server_id: UUID | null; table_ids: UUID[] }> }
  ```
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Bulk update section assignments. Used by hosts/managers during shift setup.

### `GET /api/tables/status-summary`
- **Auth:** authenticated
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { total: number; available: number; occupied: number; reserved: number; dirty: number; blocked: number; average_turn_time_minutes: number }
  ```
- **Logic:** Quick summary of table statuses for dashboard display.

---

## 6. Staff — 15 routes

### `GET /api/staff`
- **Auth:** permission:staff.view
- **Query:** `?location_id=<uuid>&role=<string>&is_active=<boolean>&page=<int>&per_page=<int>`
- **Response:**
  ```typescript
  PaginatedResponse<{ id: UUID; name: string; email: string | null; role: string; pin_last_four: string; is_active: boolean; hire_date: string | null; location_ids: UUID[] }>
  ```
- **Logic:** List staff members with optional filters.

### `POST /api/staff`
- **Auth:** permission:staff.manage
- **Request:**
  ```typescript
  { name: string; email?: string; role: string; pin: string; location_ids: UUID[]; hire_date?: string; hourly_rate_cents?: number; avatar_url?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; role: string }
  ```
- **Logic:** Create staff member. PIN is hashed with bcrypt before storage.

### `GET /api/staff/[id]`
- **Auth:** permission:staff.view
- **Response:**
  ```typescript
  { id: UUID; name: string; email: string | null; role: string; is_active: boolean; hire_date: string | null; hourly_rate_cents: number | null; location_ids: UUID[]; avatar_url: string | null; created_at: string }
  ```
- **Logic:** Get staff member details.

### `PUT /api/staff/[id]`
- **Auth:** permission:staff.manage
- **Request:**
  ```typescript
  { name?: string; email?: string; role?: string; pin?: string; location_ids?: UUID[]; hourly_rate_cents?: number; avatar_url?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; role: string }
  ```
- **Logic:** Update staff member. PIN re-hashed if changed.

### `DELETE /api/staff/[id]`
- **Auth:** permission:staff.manage
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Deactivate staff member (soft delete). Cannot delete users with open orders or active clock-in.

### `POST /api/staff/clock-in`
- **Auth:** authenticated (PIN login context)
- **Request:**
  ```typescript
  { staff_id: UUID; role_override?: string; location_id: UUID }
  ```
- **Response:**
  ```typescript
  { time_entry_id: UUID; staff_id: UUID; clocked_in_at: string }
  ```
- **Logic:** Clock in staff member. Creates time entry record.

### `POST /api/staff/clock-out`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { staff_id: UUID; tip_declaration_cents?: number }
  ```
- **Response:**
  ```typescript
  { time_entry_id: UUID; clocked_out_at: string; hours_worked: number; tip_declaration_cents: number | null }
  ```
- **Logic:** Clock out staff member. Optionally declare cash tips. Closes time entry.

### `POST /api/staff/break/start`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { staff_id: UUID; break_type: 'paid' | 'unpaid' }
  ```
- **Response:**
  ```typescript
  { break_id: UUID; started_at: string }
  ```
- **Logic:** Start a break. Tracks paid vs unpaid for labor reporting.

### `POST /api/staff/break/end`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { staff_id: UUID }
  ```
- **Response:**
  ```typescript
  { break_id: UUID; ended_at: string; duration_minutes: number }
  ```
- **Logic:** End current break. Calculates duration.

### `GET /api/staff/time-entries`
- **Auth:** permission:staff.view
- **Query:** `?staff_id=<uuid>&date_from=<iso>&date_to=<iso>&location_id=<uuid>&approved=<boolean>`
- **Response:**
  ```typescript
  PaginatedResponse<{ id: UUID; staff_id: UUID; staff_name: string; clocked_in_at: string; clocked_out_at: string | null; hours_worked: number; breaks: Array<{ type: string; duration_minutes: number }>; approved: boolean; edited: boolean }>
  ```
- **Logic:** List time entries with filters. Used for payroll and labor reports.

### `PUT /api/staff/time-entries/[id]`
- **Auth:** permission:staff.manage + manager-approval
- **Request:**
  ```typescript
  { clocked_in_at?: string; clocked_out_at?: string; reason: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; edited: true; hours_worked: number }
  ```
- **Logic:** Edit time entry (fix missed clock-in/out). Requires manager PIN. Audit logged with reason.

### `POST /api/staff/time-entries/[id]/approve`
- **Auth:** permission:staff.manage
- **Response:**
  ```typescript
  { id: UUID; approved: true }
  ```
- **Logic:** Approve time entry for payroll.

### `GET /api/staff/on-duty`
- **Auth:** authenticated
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; role: string; clocked_in_at: string; hours_so_far: number; on_break: boolean }> }
  ```
- **Logic:** Currently clocked-in staff at a location.

### `GET /api/staff/tips`
- **Auth:** permission:staff.view
- **Query:** `?staff_id=<uuid>&date_from=<iso>&date_to=<iso>`
- **Response:**
  ```typescript
  { data: Array<{ staff_id: UUID; staff_name: string; card_tips_cents: number; cash_tips_declared_cents: number; tip_pool_share_cents: number; auto_gratuity_cents: number; total_cents: number }> }
  ```
- **Logic:** Tip report for staff over a period.

### `POST /api/staff/tip-pool/distribute`
- **Auth:** permission:staff.manage
- **Request:**
  ```typescript
  { date: string; location_id: UUID; method: 'equal' | 'hours' | 'points'; pool_amount_cents: number; staff_ids: UUID[] }
  ```
- **Response:**
  ```typescript
  { distributions: Array<{ staff_id: UUID; staff_name: string; share_cents: number }> }
  ```
- **Logic:** Distribute tip pool among eligible staff. Method determines split (equal, by hours worked, or by point allocation).

---

## 7. Reports — 14 routes

### `GET /api/reports/sales/daily`
- **Auth:** permission:reports.view
- **Query:** `?date=<iso-date>&location_id=<uuid>`
- **Response:**
  ```typescript
  { date: string; net_sales_cents: number; gross_sales_cents: number; tax_cents: number; discount_cents: number; comp_cents: number; void_cents: number; order_count: number; guest_count: number; average_check_cents: number; per_guest_average_cents: number; hourly_breakdown: Array<{ hour: number; sales_cents: number; order_count: number }> }
  ```
- **Logic:** Daily sales summary with hourly breakdown.

### `GET /api/reports/sales/weekly`
- **Auth:** permission:reports.view
- **Query:** `?week_start=<iso-date>&location_id=<uuid>`
- **Response:**
  ```typescript
  { week_start: string; week_end: string; total_sales_cents: number; daily_breakdown: Array<{ date: string; sales_cents: number; order_count: number }> ; comparison: { prior_week_cents: number; change_percentage: number } }
  ```
- **Logic:** Weekly sales summary with day-by-day breakdown and prior week comparison.

### `GET /api/reports/sales/monthly`
- **Auth:** permission:reports.view
- **Query:** `?month=<YYYY-MM>&location_id=<uuid>`
- **Response:**
  ```typescript
  { month: string; total_sales_cents: number; daily_breakdown: Array<{ date: string; sales_cents: number }>; comparison: { prior_month_cents: number; prior_year_month_cents: number; change_percentage: number } }
  ```
- **Logic:** Monthly sales summary with daily breakdown and period comparisons.

### `GET /api/reports/sales/custom`
- **Auth:** permission:reports.view
- **Query:** `?date_from=<iso>&date_to=<iso>&location_id=<uuid>`
- **Response:**
  ```typescript
  { date_from: string; date_to: string; total_sales_cents: number; order_count: number; average_check_cents: number; daily_breakdown: Array<{ date: string; sales_cents: number; order_count: number }> }
  ```
- **Logic:** Custom date range sales report.

### `GET /api/reports/sales/hourly`
- **Auth:** permission:reports.view
- **Query:** `?date=<iso-date>&location_id=<uuid>`
- **Response:**
  ```typescript
  { date: string; hours: Array<{ hour: number; sales_cents: number; order_count: number; guest_count: number; labor_cost_cents: number }> }
  ```
- **Logic:** Hourly sales heatmap data for a single day. Includes labor cost per hour.

### `GET /api/reports/product-mix`
- **Auth:** permission:reports.view
- **Query:** `?date_from=<iso>&date_to=<iso>&location_id=<uuid>&category_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ menu_item_id: UUID; name: string; category: string; quantity_sold: number; gross_sales_cents: number; percentage_of_sales: number; food_cost_cents: number | null; profit_cents: number | null }> }
  ```
- **Logic:** Product mix (PMIX) report showing quantity sold and revenue per item.

### `GET /api/reports/category-mix`
- **Auth:** permission:reports.view
- **Query:** `?date_from=<iso>&date_to=<iso>&location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ category_id: UUID; name: string; item_count: number; quantity_sold: number; sales_cents: number; percentage_of_total: number }> }
  ```
- **Logic:** Sales breakdown by menu category.

### `GET /api/reports/server-performance`
- **Auth:** permission:reports.view
- **Query:** `?date_from=<iso>&date_to=<iso>&location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ staff_id: UUID; name: string; order_count: number; guest_count: number; net_sales_cents: number; average_check_cents: number; per_guest_average_cents: number; tip_percentage: number; covers_per_hour: number }> }
  ```
- **Logic:** Server performance metrics including sales, check averages, and tip percentages.

### `GET /api/reports/labor`
- **Auth:** permission:reports.view
- **Query:** `?date_from=<iso>&date_to=<iso>&location_id=<uuid>`
- **Response:**
  ```typescript
  { total_labor_cost_cents: number; total_sales_cents: number; labor_percentage: number; overtime_cost_cents: number; by_role: Array<{ role: string; hours: number; cost_cents: number; head_count: number }>; daily_breakdown: Array<{ date: string; labor_cost_cents: number; sales_cents: number; labor_percentage: number }> }
  ```
- **Logic:** Labor cost report with role breakdown and labor-to-sales ratio.

### `GET /api/reports/discount-summary`
- **Auth:** permission:reports.view
- **Query:** `?date_from=<iso>&date_to=<iso>&location_id=<uuid>`
- **Response:**
  ```typescript
  { total_discount_cents: number; total_comp_cents: number; total_void_cents: number; discounts: Array<{ name: string; count: number; amount_cents: number; approved_by: string }>; comps: Array<{ item_name: string; reason: string; amount_cents: number; server: string; manager: string }>; voids: Array<{ order_number: string; reason: string; amount_cents: number; server: string; manager: string }> }
  ```
- **Logic:** Summary of discounts, comps, and voids with approver details.

### `GET /api/reports/payment-summary`
- **Auth:** permission:reports.view
- **Query:** `?date_from=<iso>&date_to=<iso>&location_id=<uuid>`
- **Response:**
  ```typescript
  { by_method: Array<{ method: string; transaction_count: number; total_cents: number; tip_cents: number }>; refunds: { count: number; total_cents: number }; card_brands: Array<{ brand: string; count: number; total_cents: number }> }
  ```
- **Logic:** Payment method breakdown with card brand detail.

### `GET /api/reports/tax-report`
- **Auth:** permission:reports.view
- **Query:** `?date_from=<iso>&date_to=<iso>&location_id=<uuid>`
- **Response:**
  ```typescript
  { total_tax_collected_cents: number; by_rate: Array<{ tax_rate_id: UUID; name: string; rate: number; taxable_sales_cents: number; tax_collected_cents: number }>; by_category: Array<{ category: string; taxable_sales_cents: number; tax_cents: number }> }
  ```
- **Logic:** Tax liability report broken down by tax rate and category.

### `POST /api/reports/export`
- **Auth:** permission:reports.view
- **Request:**
  ```typescript
  { report_type: string; format: 'csv' | 'pdf'; date_from: string; date_to: string; location_id: UUID; filters?: Record<string, unknown> }
  ```
- **Response:**
  ```typescript
  { job_id: UUID; status: 'queued' }
  ```
- **Logic:** Queue a report export job. Returns job ID for polling.

### `GET /api/reports/export/[jobId]`
- **Auth:** permission:reports.view
- **Response:**
  ```typescript
  { job_id: UUID; status: 'queued' | 'processing' | 'completed' | 'failed'; download_url: string | null; expires_at: string | null }
  ```
- **Logic:** Check export job status. Returns signed download URL when completed.

---

## 8. Settings — 20 routes

### `GET /api/settings/organization`
- **Auth:** role:owner | role:admin
- **Response:**
  ```typescript
  { id: UUID; name: string; logo_url: string | null; timezone: string; currency: string; default_tip_percentages: number[]; auto_gratuity_threshold: number | null; auto_gratuity_percentage: number | null; created_at: string }
  ```
- **Logic:** Get organization-level settings.

### `PUT /api/settings/organization`
- **Auth:** role:owner
- **Request:**
  ```typescript
  { name?: string; logo_url?: string; timezone?: string; default_tip_percentages?: number[]; auto_gratuity_threshold?: number; auto_gratuity_percentage?: number }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Update organization settings.

### `GET /api/settings/locations/[id]`
- **Auth:** role:owner | role:admin | role:manager
- **Response:**
  ```typescript
  { id: UUID; name: string; address: { street: string; city: string; state: string; zip: string }; phone: string | null; timezone: string; currency: string; tax_rates: Array<{ id: UUID; name: string; rate: number }>; surcharge_enabled: boolean; surcharge_rate: number | null; operating_hours: Array<{ day: number; open: string; close: string }>; receipt_header: string | null; receipt_footer: string | null }
  ```
- **Logic:** Get location-specific settings including tax, surcharge, and hours.

### `PUT /api/settings/locations/[id]`
- **Auth:** role:owner | role:admin
- **Request:**
  ```typescript
  { name?: string; address?: { street: string; city: string; state: string; zip: string }; phone?: string; timezone?: string; surcharge_enabled?: boolean; surcharge_rate?: number; operating_hours?: Array<{ day: number; open: string; close: string }>; receipt_header?: string; receipt_footer?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Update location settings.

### `GET /api/settings/tax-rates`
- **Auth:** authenticated
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; rate: number; applies_to: 'all' | 'food' | 'alcohol' | 'prepared_food'; is_default: boolean }> }
  ```
- **Logic:** List tax rates for a location.

### `POST /api/settings/tax-rates`
- **Auth:** role:owner | role:admin
- **Request:**
  ```typescript
  { name: string; rate: number; location_id: UUID; applies_to: 'all' | 'food' | 'alcohol' | 'prepared_food'; is_default?: boolean }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; rate: number }
  ```
- **Logic:** Create a tax rate.

### `PUT /api/settings/tax-rates/[id]`
- **Auth:** role:owner | role:admin
- **Request:**
  ```typescript
  { name?: string; rate?: number; applies_to?: string; is_default?: boolean }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; rate: number }
  ```
- **Logic:** Update a tax rate.

### `GET /api/settings/terminals`
- **Auth:** role:owner | role:admin | role:manager
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; type: string; location_id: UUID; last_seen: string | null; is_online: boolean; app_version: string | null }> }
  ```
- **Logic:** List registered terminals with online status.

### `POST /api/settings/terminals`
- **Auth:** role:owner | role:admin
- **Request:**
  ```typescript
  { name: string; location_id: UUID; type: 'pos' | 'kds' | 'kiosk' | 'customer_display' }
  ```
- **Response:**
  ```typescript
  { id: UUID; registration_code: string; expires_at: string }
  ```
- **Logic:** Generate terminal registration code. Code expires in 15 minutes.

### `PUT /api/settings/terminals/[id]`
- **Auth:** role:owner | role:admin
- **Request:**
  ```typescript
  { name?: string; type?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; type: string }
  ```
- **Logic:** Update terminal name or type.

### `DELETE /api/settings/terminals/[id]`
- **Auth:** role:owner | role:admin
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Deactivate terminal. Revokes terminal session token.

### `GET /api/settings/printers`
- **Auth:** role:owner | role:admin | role:manager
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; type: 'receipt' | 'kitchen' | 'bar' | 'label'; connection: 'network' | 'bluetooth' | 'usb'; ip_address: string | null; is_online: boolean }> }
  ```
- **Logic:** List configured printers.

### `POST /api/settings/printers`
- **Auth:** role:owner | role:admin
- **Request:**
  ```typescript
  { name: string; location_id: UUID; type: 'receipt' | 'kitchen' | 'bar' | 'label'; connection: 'network' | 'bluetooth' | 'usb'; ip_address?: string; mac_address?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Add a printer configuration.

### `PUT /api/settings/printers/[id]`
- **Auth:** role:owner | role:admin
- **Request:**
  ```typescript
  { name?: string; type?: string; ip_address?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Update printer configuration.

### `POST /api/settings/printers/[id]/test`
- **Auth:** role:owner | role:admin
- **Response:**
  ```typescript
  { success: boolean; message: string }
  ```
- **Logic:** Send test print to verify printer connectivity.

### `GET /api/settings/modules`
- **Auth:** role:owner | role:admin
- **Response:**
  ```typescript
  { data: Array<{ id: string; name: string; description: string; enabled: boolean; config: Record<string, unknown> | null; required_plan: string }> }
  ```
- **Logic:** List all available modules with enable/disable status.

### `POST /api/settings/modules/[id]/enable`
- **Auth:** role:owner
- **Response:**
  ```typescript
  { id: string; enabled: true }
  ```
- **Logic:** Enable a module. Checks plan eligibility and resolves dependencies.

### `POST /api/settings/modules/[id]/disable`
- **Auth:** role:owner
- **Response:**
  ```typescript
  { id: string; enabled: false }
  ```
- **Logic:** Disable a module. Checks for dependent modules first.

### `PUT /api/settings/modules/[id]/config`
- **Auth:** role:owner | role:admin
- **Request:**
  ```typescript
  { config: Record<string, unknown> }
  ```
- **Response:**
  ```typescript
  { id: string; config: Record<string, unknown> }
  ```
- **Logic:** Update module-specific configuration.

### `GET /api/settings/roles`
- **Auth:** role:owner | role:admin
- **Response:**
  ```typescript
  { data: Array<{ role: string; permissions: string[]; is_system: boolean }> }
  ```
- **Logic:** List all roles and their permission sets.

### `PUT /api/settings/roles/[role]/permissions`
- **Auth:** role:owner
- **Request:**
  ```typescript
  { permissions: string[] }
  ```
- **Response:**
  ```typescript
  { role: string; permissions: string[] }
  ```
- **Logic:** Update permissions for a role. Cannot modify system roles (owner, platform_admin).

---

## 9. Customers — 8 routes

### `GET /api/customers`
- **Auth:** authenticated
- **Query:** `?search=<string>&page=<int>&per_page=<int>`
- **Response:**
  ```typescript
  PaginatedResponse<{ id: UUID; name: string; email: string | null; phone: string | null; visit_count: number; total_spent_cents: number; last_visit: string | null }>
  ```
- **Logic:** Search/list customers by name, email, or phone.

### `POST /api/customers`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { name: string; email?: string; phone?: string; notes?: string; birthday?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Create a customer record.

### `GET /api/customers/[id]`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { id: UUID; name: string; email: string | null; phone: string | null; notes: string | null; birthday: string | null; visit_count: number; total_spent_cents: number; average_check_cents: number; last_visit: string | null; loyalty: { points: number; tier: string } | null; tags: string[]; created_at: string }
  ```
- **Logic:** Get customer with aggregated stats and loyalty info.

### `PUT /api/customers/[id]`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { name?: string; email?: string; phone?: string; notes?: string; birthday?: string; tags?: string[] }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Update customer record.

### `GET /api/customers/[id]/orders`
- **Auth:** authenticated
- **Query:** `?page=<int>&per_page=<int>`
- **Response:**
  ```typescript
  PaginatedResponse<{ id: UUID; order_number: string; date: string; total_cents: number; items: Array<{ name: string; quantity: number }> }>
  ```
- **Logic:** Customer order history, most recent first.

### `GET /api/customers/[id]/loyalty`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { customer_id: UUID; program_id: UUID; points_balance: number; tier: string; tier_progress: number; lifetime_points: number; rewards_available: Array<{ id: UUID; name: string; points_required: number }> }
  ```
- **Logic:** Customer loyalty account details and available rewards.

### `POST /api/customers/lookup`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { phone?: string; email?: string }
  ```
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; phone: string | null; email: string | null }> }
  ```
- **Logic:** Lookup customer by phone or email. POST to avoid putting PII in query strings.

### `POST /api/customers/merge`
- **Auth:** permission:customers.manage
- **Request:**
  ```typescript
  { primary_id: UUID; duplicate_id: UUID }
  ```
- **Response:**
  ```typescript
  { merged_id: UUID; orders_transferred: number; loyalty_points_combined: number }
  ```
- **Logic:** Merge duplicate customer records. All orders and loyalty move to primary. Duplicate is soft-deleted.

---

## 10. KDS — 8 routes

### `GET /api/kds/stations`
- **Auth:** authenticated
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; type: 'kitchen' | 'bar' | 'expo' | 'prep'; filter_categories: UUID[]; location_id: UUID }> }
  ```
- **Logic:** List KDS stations for a location.

### `POST /api/kds/stations`
- **Auth:** permission:kds.manage
- **Request:**
  ```typescript
  { name: string; location_id: UUID; type: 'kitchen' | 'bar' | 'expo' | 'prep'; filter_categories?: UUID[] }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; type: string }
  ```
- **Logic:** Create a KDS station. Filter categories determine which items appear on the station.

### `PUT /api/kds/stations/[id]`
- **Auth:** permission:kds.manage
- **Request:**
  ```typescript
  { name?: string; type?: string; filter_categories?: UUID[] }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Update KDS station configuration.

### `GET /api/kds/stations/[id]/tickets`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; order_id: UUID; order_number: string; table_name: string | null; server_name: string; items: Array<{ id: UUID; name: string; quantity: number; modifiers: string[]; notes: string | null; status: 'pending' | 'in_progress' | 'completed'; seat_number: number | null }>; course: number; priority: 'normal' | 'rush' | 'vip'; created_at: string; age_seconds: number }> }
  ```
- **Logic:** Get active (unbumped) tickets for a KDS station. Sorted by age. Items filtered by station category routing.

### `POST /api/kds/tickets/[itemId]/bump`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { id: UUID; status: 'completed'; bumped_at: string }
  ```
- **Logic:** Bump (mark complete) a single item on the KDS. Publishes SSE event.

### `POST /api/kds/tickets/[orderId]/bump-all`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { order_id: UUID; items_bumped: number }
  ```
- **Logic:** Bump all items for an order on this station. Used for expo bump.

### `POST /api/kds/tickets/[itemId]/recall`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { id: UUID; status: 'pending'; recalled_at: string }
  ```
- **Logic:** Recall a bumped item back to the active queue.

### `GET /api/kds/metrics`
- **Auth:** permission:reports.view
- **Query:** `?station_id=<uuid>&date=<iso-date>`
- **Response:**
  ```typescript
  { station_id: UUID; date: string; average_ticket_time_seconds: number; tickets_completed: number; items_completed: number; longest_ticket_seconds: number; hourly_breakdown: Array<{ hour: number; avg_time_seconds: number; count: number }> }
  ```
- **Logic:** KDS performance metrics (speed of service) for a station.

---

## 11. SSE / Real-Time — 4 routes

### `GET /api/events/orders`
- **Auth:** authenticated
- **Response:** `text/event-stream`
  ```typescript
  // SSE events:
  // event: order.created     data: { id: UUID; order_number: string; table_id: UUID | null }
  // event: order.updated     data: { id: UUID; status: string; total_cents: number }
  // event: order.sent        data: { id: UUID; sent_at: string }
  // event: order.closed      data: { id: UUID; closed_at: string }
  // event: order.voided      data: { id: UUID; reason: string }
  // event: order.transferred data: { id: UUID; from_server: UUID; to_server: UUID }
  ```
- **Logic:** SSE stream for order status changes. Filtered by location. Used by all POS terminals.

### `GET /api/events/kds`
- **Auth:** authenticated
- **Response:** `text/event-stream`
  ```typescript
  // event: ticket.new        data: { order_id: UUID; items: Array<{ id: UUID; name: string }> }
  // event: ticket.bumped     data: { item_id: UUID; order_id: UUID }
  // event: ticket.recalled   data: { item_id: UUID; order_id: UUID }
  // event: ticket.rush       data: { order_id: UUID }
  ```
- **Logic:** SSE stream for kitchen display updates. Filtered by station.

### `GET /api/events/tables`
- **Auth:** authenticated
- **Response:** `text/event-stream`
  ```typescript
  // event: table.seated      data: { table_id: UUID; guest_count: number; server_id: UUID }
  // event: table.cleared     data: { table_id: UUID }
  // event: table.status      data: { table_id: UUID; status: string }
  // event: table.moved       data: { from_table_id: UUID; to_table_id: UUID; order_id: UUID }
  ```
- **Logic:** SSE stream for table status changes. Used by floor plan display.

### `GET /api/events/86`
- **Auth:** authenticated
- **Response:** `text/event-stream`
  ```typescript
  // event: item.86           data: { item_id: UUID; name: string; is_86: boolean }
  ```
- **Logic:** SSE stream for 86 status changes. All terminals receive this to update menu availability in real time.

---

## 12. Reconciliation — 3 routes

### `POST /api/reconciliation/close-day`
- **Auth:** role:manager | role:owner
- **Request:**
  ```typescript
  { location_id: UUID; date: string; cash_counted_cents: number; denomination_breakdown?: Record<string, number> }
  ```
- **Response:**
  ```typescript
  { id: UUID; date: string; status: 'closed'; expected_cash_cents: number; actual_cash_cents: number; variance_cents: number; card_total_cents: number; summary: { order_count: number; gross_sales_cents: number; net_sales_cents: number } }
  ```
- **Logic:** Close business day. Compares expected vs actual cash, records variance. Locks day from further transactions.

### `GET /api/reconciliation/daily-report`
- **Auth:** permission:reports.view
- **Query:** `?date=<iso-date>&location_id=<uuid>`
- **Response:**
  ```typescript
  { date: string; location_id: UUID; gross_sales_cents: number; net_sales_cents: number; tax_collected_cents: number; tips_cents: number; card_payments_cents: number; cash_payments_cents: number; gift_card_payments_cents: number; refunds_cents: number; voids_cents: number; discounts_cents: number; comps_cents: number; expected_cash_cents: number; actual_cash_cents: number | null; variance_cents: number | null; is_closed: boolean }
  ```
- **Logic:** Daily reconciliation report showing all financial totals.

### `POST /api/reconciliation/match-deposit`
- **Auth:** role:owner | role:admin
- **Request:**
  ```typescript
  { date: string; location_id: UUID; deposit_amount_cents: number; bank_reference?: string }
  ```
- **Response:**
  ```typescript
  { matched: boolean; expected_cents: number; deposited_cents: number; variance_cents: number }
  ```
- **Logic:** Match bank deposit to expected card settlement amount. Flags variances for investigation.

---

## 13. Online Ordering — 10 routes

### `GET /api/online-ordering/config`
- **Auth:** role:owner | role:admin | role:manager
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { location_id: UUID; enabled: boolean; accepting_orders: boolean; estimated_prep_minutes: number; max_future_days: number; minimum_order_cents: number; delivery_enabled: boolean; pickup_enabled: boolean; schedule_enabled: boolean; menu_overrides: Array<{ menu_item_id: UUID; available: boolean; online_price_cents: number | null }> }
  ```
- **Logic:** Get online ordering configuration for a location.

### `PUT /api/online-ordering/config`
- **Auth:** role:owner | role:admin
- **Request:**
  ```typescript
  { location_id: UUID; enabled?: boolean; estimated_prep_minutes?: number; max_future_days?: number; minimum_order_cents?: number; delivery_enabled?: boolean; pickup_enabled?: boolean; schedule_enabled?: boolean }
  ```
- **Response:**
  ```typescript
  { location_id: UUID; enabled: boolean }
  ```
- **Logic:** Update online ordering settings.

### `GET /api/online-ordering/menu`
- **Auth:** public
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; items: Array<{ id: UUID; name: string; description: string | null; price_cents: number; image_url: string | null; is_available: boolean; modifier_groups: Array<{ id: UUID; name: string; min: number; max: number; modifiers: Array<{ id: UUID; name: string; price_cents: number }> }> }> }> }
  ```
- **Logic:** Public menu for online ordering. Excludes 86'd items and items not enabled for online. May have different prices.

### `POST /api/online-ordering/orders`
- **Auth:** public (with CAPTCHA or rate limiting)
- **Rate limit:** 5/min per IP
- **Request:**
  ```typescript
  { location_id: UUID; order_type: 'pickup' | 'delivery'; customer: { name: string; phone: string; email?: string }; items: Array<{ menu_item_id: UUID; quantity: number; modifier_ids?: UUID[]; notes?: string }>; scheduled_for?: string; delivery_address?: { street: string; city: string; state: string; zip: string; apt?: string }; tip_cents?: number; payment_token: string; notes?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; order_number: string; status: 'pending'; estimated_ready_at: string; total_cents: number }
  ```
- **Logic:** Place an online order. Payment is pre-authorized via tokenized card. Order enters pending queue for restaurant acceptance.

### `GET /api/online-ordering/orders`
- **Auth:** authenticated
- **Query:** `?location_id=<uuid>&status=<pending|accepted|preparing|ready|completed|rejected>`
- **Response:**
  ```typescript
  PaginatedResponse<{ id: UUID; order_number: string; customer_name: string; order_type: string; status: string; total_cents: number; scheduled_for: string | null; created_at: string }>
  ```
- **Logic:** List online orders for staff management view.

### `POST /api/online-ordering/orders/[id]/accept`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { estimated_minutes?: number }
  ```
- **Response:**
  ```typescript
  { id: UUID; status: 'accepted'; estimated_ready_at: string }
  ```
- **Logic:** Accept an incoming online order. Captures payment. Creates POS order and sends to kitchen. Notifies customer via SMS.

### `POST /api/online-ordering/orders/[id]/reject`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { reason: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; status: 'rejected' }
  ```
- **Logic:** Reject an online order. Voids payment authorization. Notifies customer via SMS with reason.

### `POST /api/online-ordering/orders/[id]/ready`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { id: UUID; status: 'ready' }
  ```
- **Logic:** Mark online order as ready for pickup/delivery. Notifies customer via SMS.

### `PUT /api/online-ordering/throttle`
- **Auth:** role:manager | role:owner
- **Request:**
  ```typescript
  { location_id: UUID; throttle_minutes: number; max_orders_per_interval?: number; paused?: boolean }
  ```
- **Response:**
  ```typescript
  { location_id: UUID; throttle_minutes: number; paused: boolean }
  ```
- **Logic:** Throttle or pause incoming online orders during rush. Adjusts estimated prep times shown to customers.

### `GET /api/online-ordering/orders/[id]/track`
- **Auth:** public (with order ID + phone number)
- **Query:** `?phone=<string>`
- **Response:**
  ```typescript
  { id: UUID; order_number: string; status: string; estimated_ready_at: string | null; items: Array<{ name: string; quantity: number }>; total_cents: number }
  ```
- **Logic:** Public order tracking for customers. Validated by matching phone number.

---

## 14. Delivery — 8 routes

### `GET /api/delivery/zones`
- **Auth:** permission:delivery.manage
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; polygon: Array<{ lat: number; lng: number }>; delivery_fee_cents: number; minimum_order_cents: number; estimated_minutes: number; is_active: boolean }> }
  ```
- **Logic:** List delivery zones with geographic boundaries.

### `POST /api/delivery/zones`
- **Auth:** permission:delivery.manage
- **Request:**
  ```typescript
  { name: string; location_id: UUID; polygon: Array<{ lat: number; lng: number }>; delivery_fee_cents: number; minimum_order_cents?: number; estimated_minutes: number }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Create a delivery zone with polygon boundary.

### `PUT /api/delivery/zones/[id]`
- **Auth:** permission:delivery.manage
- **Request:**
  ```typescript
  { name?: string; polygon?: Array<{ lat: number; lng: number }>; delivery_fee_cents?: number; minimum_order_cents?: number; estimated_minutes?: number; is_active?: boolean }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Update delivery zone.

### `DELETE /api/delivery/zones/[id]`
- **Auth:** permission:delivery.manage
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Remove a delivery zone.

### `POST /api/delivery/check-address`
- **Auth:** public
- **Request:**
  ```typescript
  { location_id: UUID; address: { street: string; city: string; state: string; zip: string } }
  ```
- **Response:**
  ```typescript
  { deliverable: boolean; zone_id: UUID | null; delivery_fee_cents: number | null; estimated_minutes: number | null }
  ```
- **Logic:** Check if an address is within a delivery zone. Uses point-in-polygon against zone boundaries.

### `POST /api/delivery/orders/[id]/assign`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { driver_id: UUID }
  ```
- **Response:**
  ```typescript
  { order_id: UUID; driver_id: UUID; status: 'assigned' }
  ```
- **Logic:** Assign a delivery driver to an order.

### `PUT /api/delivery/orders/[id]/status`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { status: 'picked_up' | 'en_route' | 'delivered' | 'failed'; notes?: string }
  ```
- **Response:**
  ```typescript
  { order_id: UUID; status: string; updated_at: string }
  ```
- **Logic:** Update delivery status. Notifies customer via SMS on key transitions.

### `GET /api/delivery/orders/[id]/track`
- **Auth:** public (with order ID + phone)
- **Query:** `?phone=<string>`
- **Response:**
  ```typescript
  { order_id: UUID; status: string; driver_name: string | null; estimated_delivery_at: string | null }
  ```
- **Logic:** Public delivery tracking for customers.

---

## 15. Loyalty — 10 routes

### `GET /api/loyalty/programs`
- **Auth:** role:owner | role:admin
- **Query:** `?org_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; type: 'points' | 'visits' | 'spend'; earn_rate: number; is_active: boolean; tier_count: number }> }
  ```
- **Logic:** List loyalty programs for the organization.

### `POST /api/loyalty/programs`
- **Auth:** role:owner
- **Request:**
  ```typescript
  { name: string; type: 'points' | 'visits' | 'spend'; earn_rate: number; points_per_dollar?: number; visits_to_reward?: number; spend_threshold_cents?: number; reward_description: string; reward_value_cents: number }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; type: string }
  ```
- **Logic:** Create a loyalty program with earning rules and reward configuration.

### `PUT /api/loyalty/programs/[id]`
- **Auth:** role:owner
- **Request:**
  ```typescript
  { name?: string; earn_rate?: number; reward_description?: string; reward_value_cents?: number; is_active?: boolean }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Update loyalty program.

### `GET /api/loyalty/programs/[id]/tiers`
- **Auth:** role:owner | role:admin
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; min_points: number; multiplier: number; perks: string[] }> }
  ```
- **Logic:** List tiers for a loyalty program (e.g., Silver, Gold, Platinum).

### `POST /api/loyalty/programs/[id]/tiers`
- **Auth:** role:owner
- **Request:**
  ```typescript
  { name: string; min_points: number; multiplier: number; perks: string[] }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Create a loyalty tier.

### `GET /api/loyalty/accounts/[customerId]`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { customer_id: UUID; program_id: UUID; points_balance: number; lifetime_points: number; tier: { name: string; multiplier: number; perks: string[] }; next_tier: { name: string; points_needed: number } | null; recent_activity: Array<{ date: string; action: string; points: number; description: string }> }
  ```
- **Logic:** Get a customer's loyalty account with tier status and recent activity.

### `POST /api/loyalty/earn`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { customer_id: UUID; order_id: UUID; amount_cents: number }
  ```
- **Response:**
  ```typescript
  { points_earned: number; new_balance: number; tier_changed: boolean; new_tier: string | null }
  ```
- **Logic:** Award loyalty points for a completed order. Applies tier multiplier. Auto-called when order is closed with a linked customer.

### `POST /api/loyalty/redeem`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { customer_id: UUID; order_id: UUID; reward_id?: UUID; points_to_redeem?: number }
  ```
- **Response:**
  ```typescript
  { points_redeemed: number; discount_cents: number; new_balance: number }
  ```
- **Logic:** Redeem loyalty points or a specific reward against an order.

### `GET /api/loyalty/balance/[customerId]`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { customer_id: UUID; points_balance: number; rewards_available: number }
  ```
- **Logic:** Quick balance check for POS display.

### `GET /api/loyalty/reports`
- **Auth:** permission:reports.view
- **Query:** `?date_from=<iso>&date_to=<iso>&program_id=<uuid>`
- **Response:**
  ```typescript
  { total_points_issued: number; total_points_redeemed: number; total_redemption_value_cents: number; active_members: number; new_signups: number; redemption_rate: number; top_members: Array<{ customer_id: UUID; name: string; points: number; spend_cents: number }> }
  ```
- **Logic:** Loyalty program analytics.

---

## 16. Reservations & Waitlist — 14 routes

### `GET /api/reservations`
- **Auth:** authenticated
- **Query:** `?date=<iso-date>&status=<confirmed|seated|no_show|cancelled>&location_id=<uuid>`
- **Response:**
  ```typescript
  PaginatedResponse<{ id: UUID; guest_name: string; party_size: number; date: string; time: string; status: string; phone: string | null; table_id: UUID | null; notes: string | null }>
  ```
- **Logic:** List reservations with filters.

### `POST /api/reservations`
- **Auth:** authenticated (or public for online booking)
- **Request:**
  ```typescript
  { location_id: UUID; guest_name: string; party_size: number; date: string; time: string; phone?: string; email?: string; notes?: string; customer_id?: UUID }
  ```
- **Response:**
  ```typescript
  { id: UUID; guest_name: string; date: string; time: string; status: 'confirmed' }
  ```
- **Logic:** Create a reservation. Checks table availability for the timeslot. Sends confirmation SMS if phone provided.

### `PUT /api/reservations/[id]`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { guest_name?: string; party_size?: number; date?: string; time?: string; phone?: string; notes?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; guest_name: string; date: string; time: string }
  ```
- **Logic:** Update reservation details.

### `DELETE /api/reservations/[id]`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Cancel reservation. Sends cancellation notification if phone/email on file.

### `POST /api/reservations/[id]/seat`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { table_id: UUID }
  ```
- **Response:**
  ```typescript
  { id: UUID; status: 'seated'; table_id: UUID; order_id: UUID }
  ```
- **Logic:** Seat a reservation at a table. Creates order and updates table status.

### `POST /api/reservations/[id]/no-show`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { id: UUID; status: 'no_show' }
  ```
- **Logic:** Mark reservation as no-show.

### `POST /api/reservations/[id]/confirm`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { id: UUID; confirmation_sent: boolean; method: 'sms' | 'email' }
  ```
- **Logic:** Send confirmation reminder via SMS or email.

### `POST /api/reservations/[id]/remind`
- **Auth:** authenticated (or automated via scheduled task)
- **Response:**
  ```typescript
  { id: UUID; reminder_sent: boolean }
  ```
- **Logic:** Send upcoming reservation reminder to guest.

### `GET /api/reservations/availability`
- **Auth:** authenticated (or public for online booking)
- **Query:** `?location_id=<uuid>&date=<iso-date>&party_size=<int>`
- **Response:**
  ```typescript
  { date: string; slots: Array<{ time: string; available_tables: number }> }
  ```
- **Logic:** Check available reservation slots for a date and party size.

### `GET /api/reservations/waitlist`
- **Auth:** authenticated
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; guest_name: string; party_size: number; quoted_wait_minutes: number; actual_wait_minutes: number; phone: string | null; status: 'waiting' | 'notified' | 'seated' | 'left'; added_at: string }> }
  ```
- **Logic:** Current active waitlist.

### `POST /api/reservations/waitlist`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { location_id: UUID; guest_name: string; party_size: number; phone?: string; notes?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; position: number; quoted_wait_minutes: number }
  ```
- **Logic:** Add a party to the waitlist. Estimates wait based on current turns and party size.

### `PUT /api/reservations/waitlist/[id]`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { party_size?: number; notes?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; party_size: number }
  ```
- **Logic:** Update waitlist entry.

### `POST /api/reservations/waitlist/[id]/notify`
- **Auth:** authenticated
- **Response:**
  ```typescript
  { id: UUID; status: 'notified'; notified_at: string }
  ```
- **Logic:** Notify guest their table is ready via SMS.

### `POST /api/reservations/waitlist/[id]/seat`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { table_id: UUID }
  ```
- **Response:**
  ```typescript
  { id: UUID; status: 'seated'; table_id: UUID; order_id: UUID; actual_wait_minutes: number }
  ```
- **Logic:** Seat a waitlisted party. Creates order and records actual wait time.

---

## 17. Staff Scheduling — 10 routes

### `GET /api/scheduling/templates`
- **Auth:** permission:scheduling.manage
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; shifts: Array<{ role: string; day: number; start_time: string; end_time: string; headcount: number }> }> }
  ```
- **Logic:** List schedule templates (reusable weekly patterns).

### `POST /api/scheduling/templates`
- **Auth:** permission:scheduling.manage
- **Request:**
  ```typescript
  { name: string; location_id: UUID; shifts: Array<{ role: string; day: number; start_time: string; end_time: string; headcount: number }> }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Create a reusable schedule template.

### `GET /api/scheduling/shifts`
- **Auth:** authenticated
- **Query:** `?location_id=<uuid>&week_start=<iso-date>&staff_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; staff_id: UUID; staff_name: string; role: string; date: string; start_time: string; end_time: string; is_published: boolean; status: 'scheduled' | 'confirmed' | 'swap_requested' | 'called_off' }> }
  ```
- **Logic:** List shifts for a week. Staff see only their own shifts; managers see all.

### `POST /api/scheduling/shifts`
- **Auth:** permission:scheduling.manage
- **Request:**
  ```typescript
  { location_id: UUID; staff_id: UUID; date: string; start_time: string; end_time: string; role?: string; notes?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; staff_id: UUID; date: string }
  ```
- **Logic:** Create a single shift assignment.

### `PUT /api/scheduling/shifts/[id]`
- **Auth:** permission:scheduling.manage
- **Request:**
  ```typescript
  { staff_id?: UUID; start_time?: string; end_time?: string; notes?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; staff_id: UUID }
  ```
- **Logic:** Update a shift. Notifies affected staff if published.

### `DELETE /api/scheduling/shifts/[id]`
- **Auth:** permission:scheduling.manage
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Remove a shift from the schedule.

### `GET /api/scheduling/availability`
- **Auth:** authenticated
- **Query:** `?staff_id=<uuid>&week_start=<iso-date>`
- **Response:**
  ```typescript
  { staff_id: UUID; availability: Array<{ day: number; available: boolean; start_time: string | null; end_time: string | null; notes: string | null }> }
  ```
- **Logic:** Get staff availability for a week.

### `PUT /api/scheduling/availability`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { staff_id: UUID; week_start: string; availability: Array<{ day: number; available: boolean; start_time?: string; end_time?: string; notes?: string }> }
  ```
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Set staff availability for a week.

### `POST /api/scheduling/shifts/[id]/swap`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { requested_by: UUID; swap_with_staff_id: UUID; swap_shift_id?: UUID }
  ```
- **Response:**
  ```typescript
  { id: UUID; status: 'swap_requested' }
  ```
- **Logic:** Request a shift swap. Notifies target staff member. Requires manager approval if configured.

### `POST /api/scheduling/publish`
- **Auth:** permission:scheduling.manage
- **Request:**
  ```typescript
  { location_id: UUID; week_start: string }
  ```
- **Response:**
  ```typescript
  { shifts_published: number; notifications_sent: number }
  ```
- **Logic:** Publish the schedule for a week. Sends notifications to all affected staff via SMS/push.

---

## 18. Marketing Campaigns — 10 routes

### `GET /api/marketing/campaigns`
- **Auth:** permission:marketing.manage
- **Query:** `?status=<draft|active|completed|paused>&page=<int>&per_page=<int>`
- **Response:**
  ```typescript
  PaginatedResponse<{ id: UUID; name: string; type: 'email' | 'sms' | 'push'; status: string; segment_id: UUID | null; sent_count: number; open_rate: number | null; created_at: string; scheduled_at: string | null }>
  ```
- **Logic:** List marketing campaigns with performance metrics.

### `POST /api/marketing/campaigns`
- **Auth:** permission:marketing.manage
- **Request:**
  ```typescript
  { name: string; type: 'email' | 'sms' | 'push'; subject?: string; body: string; segment_id?: UUID; scheduled_at?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; status: 'draft' }
  ```
- **Logic:** Create a campaign in draft status.

### `GET /api/marketing/campaigns/[id]`
- **Auth:** permission:marketing.manage
- **Response:**
  ```typescript
  { id: UUID; name: string; type: string; subject: string | null; body: string; status: string; segment: { id: UUID; name: string; member_count: number } | null; stats: { sent: number; delivered: number; opened: number; clicked: number; unsubscribed: number; open_rate: number; click_rate: number } | null; created_at: string; sent_at: string | null }
  ```
- **Logic:** Get campaign details with delivery stats.

### `PUT /api/marketing/campaigns/[id]`
- **Auth:** permission:marketing.manage
- **Request:**
  ```typescript
  { name?: string; subject?: string; body?: string; segment_id?: UUID; scheduled_at?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Update a draft campaign.

### `DELETE /api/marketing/campaigns/[id]`
- **Auth:** permission:marketing.manage
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Delete a draft campaign. Cannot delete sent campaigns.

### `POST /api/marketing/campaigns/[id]/send`
- **Auth:** permission:marketing.manage
- **Response:**
  ```typescript
  { id: UUID; status: 'sending'; estimated_recipients: number }
  ```
- **Logic:** Send a campaign immediately or schedule it. Queues delivery via Celery.

### `POST /api/marketing/campaigns/[id]/pause`
- **Auth:** permission:marketing.manage
- **Response:**
  ```typescript
  { id: UUID; status: 'paused' }
  ```
- **Logic:** Pause an active campaign.

### `GET /api/marketing/segments`
- **Auth:** permission:marketing.manage
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; rules: Array<{ field: string; operator: string; value: string }>; member_count: number }> }
  ```
- **Logic:** List customer segments for targeting.

### `POST /api/marketing/segments`
- **Auth:** permission:marketing.manage
- **Request:**
  ```typescript
  { name: string; rules: Array<{ field: string; operator: 'equals' | 'gt' | 'lt' | 'contains' | 'between'; value: string | number }> }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; member_count: number }
  ```
- **Logic:** Create a customer segment. Rules filter customers dynamically (e.g., "visit_count > 5", "last_visit between 30d ago and 7d ago").

### `GET /api/marketing/campaigns/[id]/analytics`
- **Auth:** permission:marketing.manage
- **Response:**
  ```typescript
  { campaign_id: UUID; sent: number; delivered: number; bounced: number; opened: number; clicked: number; unsubscribed: number; revenue_attributed_cents: number; orders_attributed: number; timeline: Array<{ timestamp: string; event: string; count: number }> }
  ```
- **Logic:** Detailed campaign analytics with attributed revenue.

---

## 19. Inventory — 14 routes

### `GET /api/inventory/items`
- **Auth:** permission:inventory.view
- **Query:** `?location_id=<uuid>&search=<string>&below_par=<boolean>&category=<string>`
- **Response:**
  ```typescript
  PaginatedResponse<{ id: UUID; name: string; sku: string | null; category: string; unit: string; quantity_on_hand: number; par_level: number | null; cost_per_unit_cents: number; vendor_id: UUID | null; last_counted_at: string | null }>
  ```
- **Logic:** List inventory items with filters. `below_par` flag shows only items below par level.

### `POST /api/inventory/items`
- **Auth:** permission:inventory.manage
- **Request:**
  ```typescript
  { name: string; location_id: UUID; sku?: string; category?: string; unit: string; quantity_on_hand: number; par_level?: number; cost_per_unit_cents: number; vendor_id?: UUID }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Create an inventory item.

### `PUT /api/inventory/items/[id]`
- **Auth:** permission:inventory.manage
- **Request:**
  ```typescript
  { name?: string; sku?: string; category?: string; unit?: string; par_level?: number; cost_per_unit_cents?: number; vendor_id?: UUID }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Update inventory item details.

### `POST /api/inventory/items/[id]/count`
- **Auth:** permission:inventory.manage
- **Request:**
  ```typescript
  { quantity: number; counted_by: UUID; notes?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; previous_quantity: number; new_quantity: number; variance: number }
  ```
- **Logic:** Record an inventory count. Calculates variance from expected quantity.

### `POST /api/inventory/items/[id]/adjust`
- **Auth:** permission:inventory.manage
- **Request:**
  ```typescript
  { quantity_change: number; reason: 'waste' | 'theft' | 'correction' | 'transfer' | 'other'; notes?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; new_quantity: number }
  ```
- **Logic:** Manual inventory adjustment with required reason.

### `GET /api/inventory/items/low-stock`
- **Auth:** permission:inventory.view
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; quantity_on_hand: number; par_level: number; deficit: number; vendor_name: string | null }> }
  ```
- **Logic:** Items below par level, sorted by deficit severity.

### `GET /api/inventory/vendors`
- **Auth:** permission:inventory.view
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; contact_name: string | null; phone: string | null; email: string | null; item_count: number }> }
  ```
- **Logic:** List vendors.

### `POST /api/inventory/vendors`
- **Auth:** permission:inventory.manage
- **Request:**
  ```typescript
  { name: string; contact_name?: string; phone?: string; email?: string; address?: string; notes?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Create a vendor.

### `GET /api/inventory/purchase-orders`
- **Auth:** permission:inventory.view
- **Query:** `?status=<draft|submitted|received|cancelled>&vendor_id=<uuid>`
- **Response:**
  ```typescript
  PaginatedResponse<{ id: UUID; vendor_name: string; status: string; total_cents: number; item_count: number; created_at: string; expected_at: string | null }>
  ```
- **Logic:** List purchase orders.

### `POST /api/inventory/purchase-orders`
- **Auth:** permission:inventory.manage
- **Request:**
  ```typescript
  { vendor_id: UUID; location_id: UUID; items: Array<{ inventory_item_id: UUID; quantity: number; unit_cost_cents: number }>; expected_at?: string; notes?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; vendor_name: string; total_cents: number; status: 'draft' }
  ```
- **Logic:** Create a purchase order.

### `POST /api/inventory/purchase-orders/[id]/receive`
- **Auth:** permission:inventory.manage
- **Request:**
  ```typescript
  { items: Array<{ inventory_item_id: UUID; quantity_received: number; actual_cost_cents?: number }>; notes?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; status: 'received'; items_received: number; variance_items: number }
  ```
- **Logic:** Receive a purchase order. Updates inventory quantities. Flags items with quantity or cost variances.

### `GET /api/inventory/recipes`
- **Auth:** permission:inventory.view
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; menu_item_id: UUID; menu_item_name: string; ingredients: Array<{ inventory_item_id: UUID; name: string; quantity: number; unit: string; cost_cents: number }>; total_cost_cents: number; selling_price_cents: number; food_cost_percentage: number }> }
  ```
- **Logic:** List recipes (menu item to ingredient mappings) with costing.

### `POST /api/inventory/recipes`
- **Auth:** permission:inventory.manage
- **Request:**
  ```typescript
  { menu_item_id: UUID; ingredients: Array<{ inventory_item_id: UUID; quantity: number; unit: string }> }
  ```
- **Response:**
  ```typescript
  { id: UUID; total_cost_cents: number; food_cost_percentage: number }
  ```
- **Logic:** Create or update a recipe. Auto-calculates food cost percentage against menu item price.

### `POST /api/inventory/waste`
- **Auth:** permission:inventory.manage
- **Request:**
  ```typescript
  { inventory_item_id: UUID; quantity: number; reason: string; staff_id: UUID }
  ```
- **Response:**
  ```typescript
  { id: UUID; inventory_item_id: UUID; new_quantity: number }
  ```
- **Logic:** Record waste. Deducts from inventory and logs for waste reporting.

---

## 20. Catering & Events — 10 routes

### `GET /api/catering/events`
- **Auth:** permission:catering.view
- **Query:** `?date_from=<iso>&date_to=<iso>&status=<inquiry|confirmed|completed|cancelled>`
- **Response:**
  ```typescript
  PaginatedResponse<{ id: UUID; name: string; customer_name: string; date: string; guest_count: number; status: string; total_cents: number; deposit_paid: boolean }>
  ```
- **Logic:** List catering events/bookings.

### `POST /api/catering/events`
- **Auth:** permission:catering.manage
- **Request:**
  ```typescript
  { name: string; customer_id?: UUID; customer_name: string; customer_phone: string; customer_email?: string; date: string; start_time: string; end_time: string; guest_count: number; location_id: UUID; venue_type: 'on_premise' | 'off_premise'; notes?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; status: 'inquiry' }
  ```
- **Logic:** Create a catering event inquiry.

### `PUT /api/catering/events/[id]`
- **Auth:** permission:catering.manage
- **Request:**
  ```typescript
  { name?: string; date?: string; start_time?: string; end_time?: string; guest_count?: number; status?: string; notes?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; status: string }
  ```
- **Logic:** Update event details.

### `GET /api/catering/events/[id]`
- **Auth:** permission:catering.view
- **Response:**
  ```typescript
  { id: UUID; name: string; customer: { id: UUID | null; name: string; phone: string; email: string | null }; date: string; start_time: string; end_time: string; guest_count: number; venue_type: string; status: string; menu: Array<{ id: UUID; name: string; price_per_person_cents: number; items: Array<{ name: string; quantity_per_person: number }> }> | null; beo: { setup_time: string; special_instructions: string; equipment: string[]; staffing: Array<{ role: string; count: number }> } | null; invoice: { subtotal_cents: number; tax_cents: number; service_charge_cents: number; total_cents: number; deposit_cents: number; deposit_paid: boolean; balance_due_cents: number } | null; notes: string | null }
  ```
- **Logic:** Full event detail with menu, BEO, and invoice.

### `POST /api/catering/events/[id]/menu`
- **Auth:** permission:catering.manage
- **Request:**
  ```typescript
  { packages: Array<{ name: string; price_per_person_cents: number; items: Array<{ menu_item_id?: UUID; name: string; quantity_per_person?: number }> }> }
  ```
- **Response:**
  ```typescript
  { event_id: UUID; total_cents: number }
  ```
- **Logic:** Set the catering menu for an event. Recalculates total based on guest count.

### `PUT /api/catering/events/[id]/beo`
- **Auth:** permission:catering.manage
- **Request:**
  ```typescript
  { setup_time: string; special_instructions?: string; equipment?: string[]; staffing?: Array<{ role: string; count: number }>; timeline?: Array<{ time: string; activity: string }> }
  ```
- **Response:**
  ```typescript
  { event_id: UUID; beo_updated: true }
  ```
- **Logic:** Create or update Banquet Event Order (BEO) with setup, equipment, and staffing requirements.

### `GET /api/catering/events/[id]/beo/pdf`
- **Auth:** permission:catering.view
- **Response:** `application/pdf`
- **Logic:** Generate and download BEO as PDF for printing/sharing.

### `POST /api/catering/events/[id]/invoice`
- **Auth:** permission:catering.manage
- **Request:**
  ```typescript
  { service_charge_percentage?: number; deposit_percentage?: number; custom_line_items?: Array<{ description: string; amount_cents: number }> }
  ```
- **Response:**
  ```typescript
  { event_id: UUID; invoice_id: UUID; total_cents: number; deposit_required_cents: number }
  ```
- **Logic:** Generate invoice for catering event. Includes menu cost, service charge, tax, and custom line items.

### `POST /api/catering/events/[id]/invoice/send`
- **Auth:** permission:catering.manage
- **Response:**
  ```typescript
  { sent: boolean; method: 'email'; sent_to: string }
  ```
- **Logic:** Email invoice to customer via SendGrid.

### `POST /api/catering/events/[id]/invoice/payment`
- **Auth:** permission:catering.manage
- **Request:**
  ```typescript
  { amount_cents: number; method: 'card' | 'cash' | 'check'; reference?: string }
  ```
- **Response:**
  ```typescript
  { payment_id: UUID; amount_cents: number; balance_due_cents: number }
  ```
- **Logic:** Record a payment against the catering invoice (deposit or final payment).

---

## 21. House Accounts — 7 routes

### `GET /api/house-accounts`
- **Auth:** permission:house_accounts.view
- **Query:** `?status=<active|suspended|closed>&search=<string>`
- **Response:**
  ```typescript
  PaginatedResponse<{ id: UUID; name: string; customer_id: UUID | null; credit_limit_cents: number; current_balance_cents: number; status: string; last_charge_at: string | null }>
  ```
- **Logic:** List house accounts. Common for regulars and corporate clients (R Power feature).

### `POST /api/house-accounts`
- **Auth:** permission:house_accounts.manage
- **Request:**
  ```typescript
  { name: string; customer_id?: UUID; credit_limit_cents: number; billing_email?: string; billing_address?: string; payment_terms_days?: number; notes?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; credit_limit_cents: number }
  ```
- **Logic:** Create a house account with credit limit.

### `PUT /api/house-accounts/[id]`
- **Auth:** permission:house_accounts.manage
- **Request:**
  ```typescript
  { name?: string; credit_limit_cents?: number; billing_email?: string; status?: 'active' | 'suspended' | 'closed'; notes?: string }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; status: string }
  ```
- **Logic:** Update house account. Suspending prevents new charges.

### `POST /api/house-accounts/[id]/charge`
- **Auth:** authenticated
- **Request:**
  ```typescript
  { order_id: UUID; amount_cents: number; tip_cents?: number }
  ```
- **Response:**
  ```typescript
  { charge_id: UUID; amount_cents: number; new_balance_cents: number }
  ```
- **Logic:** Charge an order to a house account. Fails if over credit limit or account suspended.

### `POST /api/house-accounts/[id]/payment`
- **Auth:** permission:house_accounts.manage
- **Request:**
  ```typescript
  { amount_cents: number; method: 'card' | 'cash' | 'check'; reference?: string }
  ```
- **Response:**
  ```typescript
  { payment_id: UUID; amount_cents: number; new_balance_cents: number }
  ```
- **Logic:** Record a payment against house account balance.

### `GET /api/house-accounts/[id]/statement`
- **Auth:** permission:house_accounts.view
- **Query:** `?date_from=<iso>&date_to=<iso>`
- **Response:**
  ```typescript
  { account_id: UUID; account_name: string; period_start: string; period_end: string; opening_balance_cents: number; charges: Array<{ date: string; order_number: string; amount_cents: number; tip_cents: number }>; payments: Array<{ date: string; amount_cents: number; method: string; reference: string | null }>; closing_balance_cents: number }
  ```
- **Logic:** Generate account statement for a period.

### `POST /api/house-accounts/[id]/statement/send`
- **Auth:** permission:house_accounts.manage
- **Request:**
  ```typescript
  { date_from: string; date_to: string }
  ```
- **Response:**
  ```typescript
  { sent: boolean; sent_to: string }
  ```
- **Logic:** Email statement to billing contact via SendGrid.

---

## 22. Drive-Thru — 6 routes

### `GET /api/drive-thru/lanes`
- **Auth:** authenticated
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; is_active: boolean; current_order_id: UUID | null; position: number }> }
  ```
- **Logic:** List drive-thru lanes and their current state.

### `POST /api/drive-thru/lanes`
- **Auth:** permission:drive_thru.manage
- **Request:**
  ```typescript
  { name: string; location_id: UUID; position: number }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string }
  ```
- **Logic:** Create a drive-thru lane.

### `PUT /api/drive-thru/lanes/[id]`
- **Auth:** permission:drive_thru.manage
- **Request:**
  ```typescript
  { name?: string; is_active?: boolean; position?: number }
  ```
- **Response:**
  ```typescript
  { id: UUID; name: string; is_active: boolean }
  ```
- **Logic:** Update lane config or activate/deactivate.

### `GET /api/drive-thru/metrics`
- **Auth:** permission:reports.view
- **Query:** `?location_id=<uuid>&date=<iso-date>`
- **Response:**
  ```typescript
  { date: string; average_service_time_seconds: number; cars_served: number; peak_hour: number; peak_service_time_seconds: number; hourly_breakdown: Array<{ hour: number; cars: number; avg_time_seconds: number }> }
  ```
- **Logic:** Drive-thru speed of service metrics.

### `GET /api/drive-thru/menu-board/config`
- **Auth:** permission:drive_thru.manage
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { location_id: UUID; layout: 'single' | 'dual'; panels: Array<{ position: number; category_ids: UUID[]; featured_item_ids: UUID[]; promo_text: string | null; promo_image_url: string | null }> }
  ```
- **Logic:** Get digital menu board configuration.

### `PUT /api/drive-thru/menu-board/config`
- **Auth:** permission:drive_thru.manage
- **Request:**
  ```typescript
  { location_id: UUID; layout: 'single' | 'dual'; panels: Array<{ position: number; category_ids: UUID[]; featured_item_ids?: UUID[]; promo_text?: string; promo_image_url?: string }> }
  ```
- **Response:**
  ```typescript
  { message: string }
  ```
- **Logic:** Update digital menu board layout and content.

---

## 23. QR Code Ordering — 6 routes

### `POST /api/qr-ordering/codes/generate`
- **Auth:** permission:qr_ordering.manage
- **Request:**
  ```typescript
  { location_id: UUID; table_ids: UUID[]; format: 'png' | 'svg' | 'pdf'; size?: number }
  ```
- **Response:**
  ```typescript
  { codes: Array<{ table_id: UUID; table_name: string; qr_url: string; download_url: string }> }
  ```
- **Logic:** Generate QR codes for tables. Each code encodes a URL linking to the location menu with table context.

### `GET /api/qr-ordering/codes`
- **Auth:** permission:qr_ordering.manage
- **Query:** `?location_id=<uuid>`
- **Response:**
  ```typescript
  { data: Array<{ table_id: UUID; table_name: string; qr_url: string; scan_count: number; last_scanned_at: string | null }> }
  ```
- **Logic:** List generated QR codes with scan analytics.

### `GET /api/qr-ordering/menu`
- **Auth:** public
- **Query:** `?location_id=<uuid>&table_id=<uuid>`
- **Response:**
  ```typescript
  { location_name: string; table_name: string; categories: Array<{ id: UUID; name: string; items: Array<{ id: UUID; name: string; description: string | null; price_cents: number; image_url: string | null; modifier_groups: Array<{ id: UUID; name: string; min: number; max: number; modifiers: Array<{ id: UUID; name: string; price_cents: number }> }> }> }> }
  ```
- **Logic:** Public menu for QR code scanning. Includes table context for order association.

### `POST /api/qr-ordering/orders`
- **Auth:** public (with CAPTCHA)
- **Rate limit:** 3/min per table
- **Request:**
  ```typescript
  { location_id: UUID; table_id: UUID; items: Array<{ menu_item_id: UUID; quantity: number; modifier_ids?: UUID[]; notes?: string; seat_number?: number }>; customer_name?: string }
  ```
- **Response:**
  ```typescript
  { order_id: UUID; order_number: string; status: 'pending'; message: string }
  ```
- **Logic:** Submit order from QR code scan. Creates order linked to the table. If table already has an open order, items are added to it.

### `GET /api/qr-ordering/orders/[id]/status`
- **Auth:** public (with order token)
- **Response:**
  ```typescript
  { order_id: UUID; status: string; items: Array<{ name: string; quantity: number; status: 'pending' | 'preparing' | 'ready' }>; total_cents: number }
  ```
- **Logic:** Guest-facing order status tracking.

### `PUT /api/qr-ordering/config`
- **Auth:** permission:qr_ordering.manage
- **Request:**
  ```typescript
  { location_id: UUID; enabled: boolean; require_payment: boolean; allow_reorder: boolean; show_prices: boolean; custom_welcome_message?: string }
  ```
- **Response:**
  ```typescript
  { location_id: UUID; enabled: boolean }
  ```
- **Logic:** Configure QR ordering behavior for a location.

---

## 24. Franchise — 6 routes

### `GET /api/franchise/locations`
- **Auth:** role:owner (franchise org)
- **Response:**
  ```typescript
  { data: Array<{ id: UUID; name: string; address: string; is_active: boolean; monthly_sales_cents: number; royalty_rate: number; last_report_date: string }> }
  ```
- **Logic:** List all franchise locations with high-level metrics.

### `GET /api/franchise/royalties`
- **Auth:** role:owner (franchise org)
- **Query:** `?period=<YYYY-MM>&location_id=<uuid>`
- **Response:**
  ```typescript
  { period: string; locations: Array<{ location_id: UUID; name: string; gross_sales_cents: number; royalty_rate: number; royalty_due_cents: number; marketing_fund_cents: number; status: 'calculated' | 'invoiced' | 'paid' }>; total_royalty_cents: number; total_marketing_fund_cents: number }
  ```
- **Logic:** Calculate royalties across franchise locations for a period.

### `POST /api/franchise/royalties/invoice`
- **Auth:** role:owner (franchise org)
- **Request:**
  ```typescript
  { period: string; location_ids: UUID[] }
  ```
- **Response:**
  ```typescript
  { invoices_created: number; total_cents: number }
  ```
- **Logic:** Generate royalty invoices for selected locations.

### `GET /api/franchise/consolidated-reports`
- **Auth:** role:owner (franchise org)
- **Query:** `?report_type=<sales|labor|product_mix>&date_from=<iso>&date_to=<iso>`
- **Response:**
  ```typescript
  { report_type: string; period: { from: string; to: string }; consolidated: Record<string, unknown>; by_location: Array<{ location_id: UUID; name: string; data: Record<string, unknown> }> }
  ```
- **Logic:** Consolidated reports across all franchise locations with per-location breakdown.

### `POST /api/franchise/sync/menu`
- **Auth:** role:owner (franchise org)
- **Request:**
  ```typescript
  { source_location_id: UUID; target_location_ids: UUID[]; sync_prices: boolean; sync_modifiers: boolean }
  ```
- **Response:**
  ```typescript
  { synced_locations: number; items_synced: number; conflicts: Array<{ location_id: UUID; item_name: string; conflict: string }> }
  ```
- **Logic:** Push menu from source location to target locations. Reports conflicts (e.g., price overrides, missing modifiers).

### `POST /api/franchise/sync/settings`
- **Auth:** role:owner (franchise org)
- **Request:**
  ```typescript
  { source_location_id: UUID; target_location_ids: UUID[]; settings_to_sync: string[] }
  ```
- **Response:**
  ```typescript
  { synced_locations: number; settings_applied: string[] }
  ```
- **Logic:** Sync specific settings (tax rates, tip config, roles, etc.) across franchise locations.

---

## Error Response Format

All error responses follow this shape:

```typescript
{
  success: false,
  error: {
    code: string,          // Machine-readable: "VALIDATION_ERROR", "NOT_FOUND", "UNAUTHORIZED", etc.
    message: string,       // Human-readable description
    details?: {            // Field-level errors for validation failures
      [field: string]: string[]
    }
  }
}
```

### Standard HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Validation error / bad request |
| 401 | Missing or invalid authentication |
| 403 | Insufficient permissions / manager approval required |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate, stale data) |
| 422 | Unprocessable entity (business rule violation) |
| 429 | Rate limited |
| 500 | Internal server error |

---

## Authentication Headers

```
Authorization: Bearer <jwt_access_token>
X-Manager-PIN: <4-6 digit PIN>          # Only for manager-approval routes
X-Location-ID: <uuid>                    # Optional location context override
X-Terminal-ID: <uuid>                    # Terminal identification
X-Idempotency-Key: <uuid>               # For POST payment routes (prevent double-charge)
```

---

## Rate Limits

| Endpoint Pattern | Limit |
|------------------|-------|
| `POST /api/auth/login` | 10/min per IP |
| `POST /api/auth/forgot-password` | 3/min per email |
| `POST /api/online-ordering/orders` | 5/min per IP |
| `POST /api/qr-ordering/orders` | 3/min per table |
| `POST /api/reports/export` | 5/min per user |
| All other endpoints | 200/min per user, 5000/hour |

---

## Pagination

All list endpoints support cursor or offset pagination:

```
?page=1&per_page=50    # Offset pagination (default per_page: 50, max: 200)
```

Response includes `meta` object:
```typescript
{
  meta: {
    page: number,
    per_page: number,
    total: number,
    total_pages: number
  }
}
```

---

## Next.js Route Handler File Structure

```
app/api/
├── auth/
│   ├── login/
│   │   └── route.ts               # POST
│   │   └── pin/route.ts           # POST
│   ├── refresh/route.ts           # POST
│   ├── logout/route.ts            # POST
│   ├── forgot-password/route.ts   # POST
│   ├── reset-password/route.ts    # POST
│   ├── me/route.ts                # GET, PUT
│   ├── verify-manager-pin/route.ts # POST
│   └── terminals/
│       ├── register/route.ts      # POST
│       └── heartbeat/route.ts     # POST
├── menu/
│   ├── categories/
│   │   ├── route.ts               # GET, POST
│   │   ├── reorder/route.ts       # PATCH
│   │   └── [id]/route.ts          # PUT, DELETE
│   ├── items/
│   │   ├── route.ts               # GET, POST
│   │   ├── reorder/route.ts       # PATCH
│   │   └── [id]/
│   │       ├── route.ts           # GET, PUT, DELETE
│   │       └── 86/route.ts        # PATCH
│   ├── modifier-groups/
│   │   ├── route.ts               # GET, POST
│   │   └── [id]/route.ts          # PUT, DELETE
│   ├── modifiers/
│   │   ├── route.ts               # GET, POST
│   │   └── [id]/route.ts          # PUT, DELETE
│   └── tree/route.ts              # GET
├── orders/
│   ├── route.ts                   # GET, POST
│   ├── open/route.ts              # GET
│   ├── by-table/[tableId]/route.ts # GET
│   └── [id]/
│       ├── route.ts               # GET, PUT, DELETE
│       ├── send/route.ts          # POST
│       ├── fire-course/route.ts   # POST
│       ├── items/
│       │   ├── route.ts           # POST
│       │   └── [itemId]/
│       │       ├── route.ts       # PUT, DELETE
│       │       └── comp/route.ts  # POST
│       ├── transfer/route.ts      # POST
│       ├── move-table/route.ts    # POST
│       ├── split/route.ts         # POST
│       ├── merge/route.ts         # POST
│       ├── reopen/route.ts        # POST
│       ├── modifications/route.ts # GET
│       └── discount/
│           ├── route.ts           # POST
│           └── [discountId]/route.ts # DELETE
├── payments/
│   ├── route.ts                   # POST
│   ├── preauth/route.ts           # POST
│   ├── settlement-report/route.ts # GET
│   └── [id]/
│       ├── route.ts               # GET
│       ├── capture/route.ts       # POST
│       ├── void/route.ts          # POST
│       ├── refund/route.ts        # POST
│       └── adjust-tip/route.ts    # POST
├── tables/
│   ├── route.ts                   # GET
│   ├── floor-plans/
│   │   ├── route.ts               # GET, POST
│   │   └── [id]/route.ts          # GET, PUT
│   ├── sections/route.ts          # GET, PUT
│   ├── status-summary/route.ts    # GET
│   └── [id]/
│       ├── seat/route.ts          # POST
│       ├── clear/route.ts         # POST
│       ├── status/route.ts        # PUT
│       └── history/route.ts       # GET
├── staff/
│   ├── route.ts                   # GET, POST
│   ├── clock-in/route.ts          # POST
│   ├── clock-out/route.ts         # POST
│   ├── break/
│   │   ├── start/route.ts         # POST
│   │   └── end/route.ts           # POST
│   ├── time-entries/
│   │   ├── route.ts               # GET
│   │   └── [id]/
│   │       ├── route.ts           # PUT
│   │       └── approve/route.ts   # POST
│   ├── on-duty/route.ts           # GET
│   ├── tips/route.ts              # GET
│   ├── tip-pool/distribute/route.ts # POST
│   └── [id]/route.ts              # GET, PUT, DELETE
├── reports/
│   ├── sales/
│   │   ├── daily/route.ts         # GET
│   │   ├── weekly/route.ts        # GET
│   │   ├── monthly/route.ts       # GET
│   │   ├── custom/route.ts        # GET
│   │   └── hourly/route.ts        # GET
│   ├── product-mix/route.ts       # GET
│   ├── category-mix/route.ts      # GET
│   ├── server-performance/route.ts # GET
│   ├── labor/route.ts             # GET
│   ├── discount-summary/route.ts  # GET
│   ├── payment-summary/route.ts   # GET
│   ├── tax-report/route.ts        # GET
│   └── export/
│       ├── route.ts               # POST
│       └── [jobId]/route.ts       # GET
├── settings/
│   ├── organization/route.ts      # GET, PUT
│   ├── locations/[id]/route.ts    # GET, PUT
│   ├── tax-rates/
│   │   ├── route.ts               # GET, POST
│   │   └── [id]/route.ts         # PUT
│   ├── terminals/
│   │   ├── route.ts               # GET, POST
│   │   └── [id]/route.ts          # PUT, DELETE
│   ├── printers/
│   │   ├── route.ts               # GET, POST
│   │   └── [id]/
│   │       ├── route.ts           # PUT
│   │       └── test/route.ts      # POST
│   ├── modules/
│   │   ├── route.ts               # GET
│   │   └── [id]/
│   │       ├── enable/route.ts    # POST
│   │       ├── disable/route.ts   # POST
│   │       └── config/route.ts    # PUT
│   └── roles/
│       ├── route.ts               # GET
│       └── [role]/permissions/route.ts # PUT
├── customers/
│   ├── route.ts                   # GET, POST
│   ├── lookup/route.ts            # POST
│   ├── merge/route.ts             # POST
│   └── [id]/
│       ├── route.ts               # GET, PUT
│       ├── orders/route.ts        # GET
│       └── loyalty/route.ts       # GET
├── kds/
│   ├── stations/
│   │   ├── route.ts               # GET, POST
│   │   └── [id]/
│   │       ├── route.ts           # PUT
│   │       └── tickets/route.ts   # GET
│   ├── tickets/
│   │   ├── [itemId]/
│   │   │   ├── bump/route.ts      # POST
│   │   │   └── recall/route.ts    # POST
│   │   └── [orderId]/bump-all/route.ts # POST
│   └── metrics/route.ts           # GET
├── events/
│   ├── orders/route.ts            # GET (SSE)
│   ├── kds/route.ts               # GET (SSE)
│   ├── tables/route.ts            # GET (SSE)
│   └── 86/route.ts                # GET (SSE)
├── reconciliation/
│   ├── close-day/route.ts         # POST
│   ├── daily-report/route.ts      # GET
│   └── match-deposit/route.ts     # POST
├── online-ordering/
│   ├── config/route.ts            # GET, PUT
│   ├── menu/route.ts              # GET
│   ├── orders/
│   │   ├── route.ts               # GET, POST
│   │   └── [id]/
│   │       ├── accept/route.ts    # POST
│   │       ├── reject/route.ts    # POST
│   │       ├── ready/route.ts     # POST
│   │       └── track/route.ts     # GET
│   └── throttle/route.ts          # PUT
├── delivery/
│   ├── zones/
│   │   ├── route.ts               # GET, POST
│   │   └── [id]/route.ts          # PUT, DELETE
│   ├── check-address/route.ts     # POST
│   └── orders/[id]/
│       ├── assign/route.ts        # POST
│       ├── status/route.ts        # PUT
│       └── track/route.ts         # GET
├── loyalty/
│   ├── programs/
│   │   ├── route.ts               # GET, POST
│   │   └── [id]/
│   │       ├── route.ts           # PUT
│   │       └── tiers/route.ts     # GET, POST
│   ├── accounts/[customerId]/route.ts # GET
│   ├── earn/route.ts              # POST
│   ├── redeem/route.ts            # POST
│   ├── balance/[customerId]/route.ts # GET
│   └── reports/route.ts           # GET
├── reservations/
│   ├── route.ts                   # GET, POST
│   ├── availability/route.ts      # GET
│   ├── waitlist/
│   │   ├── route.ts               # GET, POST
│   │   └── [id]/
│   │       ├── route.ts           # PUT
│   │       ├── notify/route.ts    # POST
│   │       └── seat/route.ts      # POST
│   └── [id]/
│       ├── route.ts               # PUT, DELETE
│       ├── seat/route.ts          # POST
│       ├── no-show/route.ts       # POST
│       ├── confirm/route.ts       # POST
│       └── remind/route.ts        # POST
├── scheduling/
│   ├── templates/route.ts         # GET, POST
│   ├── shifts/
│   │   ├── route.ts               # GET, POST
│   │   └── [id]/
│   │       ├── route.ts           # PUT, DELETE
│   │       └── swap/route.ts      # POST
│   ├── availability/route.ts      # GET, PUT
│   └── publish/route.ts           # POST
├── marketing/
│   ├── campaigns/
│   │   ├── route.ts               # GET, POST
│   │   └── [id]/
│   │       ├── route.ts           # GET, PUT, DELETE
│   │       ├── send/route.ts      # POST
│   │       ├── pause/route.ts     # POST
│   │       └── analytics/route.ts # GET
│   └── segments/route.ts          # GET, POST
├── inventory/
│   ├── items/
│   │   ├── route.ts               # GET, POST
│   │   ├── low-stock/route.ts     # GET
│   │   └── [id]/
│   │       ├── route.ts           # PUT
│   │       ├── count/route.ts     # POST
│   │       └── adjust/route.ts    # POST
│   ├── vendors/route.ts           # GET, POST
│   ├── purchase-orders/
│   │   ├── route.ts               # GET, POST
│   │   └── [id]/receive/route.ts  # POST
│   ├── recipes/route.ts           # GET, POST
│   └── waste/route.ts             # POST
├── catering/
│   └── events/
│       ├── route.ts               # GET, POST
│       └── [id]/
│           ├── route.ts           # GET, PUT
│           ├── menu/route.ts      # POST
│           ├── beo/
│           │   ├── route.ts       # PUT
│           │   └── pdf/route.ts   # GET
│           └── invoice/
│               ├── route.ts       # POST
│               ├── send/route.ts  # POST
│               └── payment/route.ts # POST
├── house-accounts/
│   ├── route.ts                   # GET, POST
│   └── [id]/
│       ├── route.ts               # PUT
│       ├── charge/route.ts        # POST
│       ├── payment/route.ts       # POST
│       ├── statement/
│       │   ├── route.ts           # GET
│       │   └── send/route.ts      # POST
├── drive-thru/
│   ├── lanes/
│   │   ├── route.ts               # GET, POST
│   │   └── [id]/route.ts          # PUT
│   ├── metrics/route.ts           # GET
│   └── menu-board/config/route.ts # GET, PUT
├── qr-ordering/
│   ├── codes/
│   │   ├── route.ts               # GET
│   │   └── generate/route.ts      # POST
│   ├── menu/route.ts              # GET
│   ├── orders/
│   │   ├── route.ts               # POST
│   │   └── [id]/status/route.ts   # GET
│   └── config/route.ts            # PUT
└── franchise/
    ├── locations/route.ts         # GET
    ├── royalties/
    │   ├── route.ts               # GET
    │   └── invoice/route.ts       # POST
    ├── consolidated-reports/route.ts # GET
    └── sync/
        ├── menu/route.ts          # POST
        └── settings/route.ts      # POST
```
