# Module 03: Order Management (Core POS)

## Overview

The Orders module is the heart of Sear POS. It handles the full lifecycle of a restaurant order from creation through payment and close. Every dollar of revenue flows through this module. It must be fast (sub-second item adds), reliable (zero lost orders), and flexible (handles dine-in, takeout, delivery, bar tabs, catering, online, kiosk, and drive-thru).

**Who uses it:** Servers (dine-in order entry), bartenders (bar/tab orders), cashiers (takeout/counter), hosts (takeout queue), kitchen staff (via KDS integration), managers (voids, comps, overrides), online/kiosk systems (automated order creation).

**Why it matters:** This is the revenue engine. Every order generates sales data, drives kitchen workflow, triggers payments, feeds reports, and updates customer history. Order accuracy and speed directly impact guest experience and table turnover.

---

## Database Tables

### Core Tables

- **`orders`** — Master order record. Key fields: `order_number` (sequential per-location per-day), `display_number` (prefix + number for guest display), `order_type` (enum: dine_in, takeout, delivery, bar, catering, online, kiosk, drive_thru, qr), `status` (enum: draft, open, fired, ready, served, closed, voided, refunded), `server_id`, `table_id`, `customer_id`, `guest_count`, `guest_name`, `guest_phone`, financial denorms (`subtotal`, `discount_total`, `tax_total`, `tip_total`, `total`, `amount_paid`, `balance_due`), timing (`opened_at`, `sent_at`, `closed_at`, `scheduled_for`), `delivery_address` (jsonb), `source` (pos/online/kiosk/phone/catering), `notes`.
- **`order_items`** — Line items. Fields: `menu_item_id`, snapshot fields (`name`, `short_name`, `unit_price`, `quantity`, `modifier_total`, `discount_amount`, `tax_amount`, `line_total`), kitchen routing (`prep_station`, `course`, `seat_number`), status flags (`is_sent`, `is_fired`, `is_ready`, `is_served`, `is_voided`), `void_reason`, `is_comped`, `comp_reason`, `comp_amount`, `notes`, timestamps (`sent_at`, `fired_at`, `ready_at`, `served_at`, `voided_at`).
- **`order_item_modifiers`** — Modifiers on each order item. Snapshot fields (`name`, `price_adjustment`, `quantity`), references to `modifier_id` and `modifier_group_id`.
- **`order_modifications`** — Audit trail of post-send changes. Fields: `modification_type` (add_item, remove_item, modify_item, change_quantity, void_item, comp_item, change_table, change_server, apply_discount), `description`, `previous_value`/`new_value` (jsonb), `performed_by`, `approved_by`.
- **`order_discounts`** — Discounts applied to orders/items. Fields: `discount_id`, `order_item_id` (null for order-level), `name`, `discount_type`, `value`, `applied_amount`, `applied_by`, `approved_by`.
- **`discounts`** — Discount definitions with rules, scheduling, and applicability.

### Supporting Tables
- **`tables`** — Table assignment for dine-in orders
- **`users`** — Server assignment
- **`customers`** — Customer linkage
- **`menu_items`** — Source data for order items (snapshotted at order time)

---

## API Routes

### Blueprint: `/api/v1/orders/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | List orders (filter: status, date range, server, table, type) | Yes |
| POST | `/` | Create new order (draft) | Yes |
| GET | `/:id` | Get order with items, modifiers, payments, modifications | Yes |
| PUT | `/:id` | Update order metadata (notes, guest info, type) | Yes |
| DELETE | `/:id` | Void entire order (manager PIN if already sent) | Manager+ |
| POST | `/:id/send` | Send order to kitchen (marks unsent items as sent) | Yes |
| POST | `/:id/fire-course` | Fire next course for this order | Yes |
| POST | `/:id/items` | Add items to existing order | Yes |
| PUT | `/:id/items/:item_id` | Update order item (quantity, modifiers, notes) | Yes |
| DELETE | `/:id/items/:item_id` | Void individual item (reason required, manager PIN if sent) | Yes |
| POST | `/:id/transfer` | Transfer order to another server | Yes |
| POST | `/:id/move-table` | Move order to a different table | Yes |
| POST | `/:id/split` | Split order into multiple checks | Yes |
| POST | `/:id/merge` | Merge another order into this one | Yes |
| POST | `/:id/reopen` | Reopen a closed order | Manager+ |
| GET | `/:id/modifications` | Get modification history | Yes |
| POST | `/:id/discount` | Apply discount (manager PIN if requires approval) | Yes |
| DELETE | `/:id/discount/:disc_id` | Remove discount | Manager+ |
| POST | `/:id/items/:item_id/comp` | Comp an item (reason required, manager PIN) | Manager+ |
| GET | `/open` | List all open orders for current location | Yes |
| GET | `/by-table/:table_id` | Get orders for a specific table | Yes |

---

## UI Pages / Components

### POS Order Entry — `/pos`
- **3-panel layout (iPad landscape):**
  - **Left panel (order):** Current order items with quantities, modifiers, prices. Seat tabs along top. Running subtotal/tax/total at bottom. Action buttons: Send, Hold, Print, Pay.
  - **Center panel (menu grid):** Category tabs across top, item buttons in grid below. 86'd items grayed out. Quick search bar.
  - **Right panel (quick actions):** Repeat last, open item (custom name/price), discount, void, notes, seat assignment, course assignment.
- **Item tap:** If item has required modifiers, opens modifier slide-over. Otherwise adds directly to order.
- **Quantity adjustment:** Long-press or tap quantity to increment/change. Swipe left to void.
- **Seat tracking:** Seat tabs (1, 2, 3...) let server assign items to specific seats for split checks.
- **Course management:** Items show course number badge. "Fire Course" button sends next course to kitchen.
- **Order types:** Toggle at top of order panel: Dine-in, Takeout, Delivery, Bar.

### Modifier Selection Slide-Over
- (Shared with Menu module — see 02_menu.md)

### Check Management — `/pos/checks`
- List of all open checks for current server (or all if manager)
- Split check interface: drag items between checks, or split equal/by-seat/custom
- Merge interface: select two orders to combine
- Transfer interface: reassign to different server
- Move table interface: reassign to different table

### Cash Drawer Count — `/pos/cash-drawer`
- Denomination entry grid (coins and bills)
- Running total calculator
- Expected vs actual comparison
- Over/short display
- Submit count to close drawer

---

## Business Rules

### Order State Machine

```
DRAFT → OPEN → FIRED → READY → SERVED → CLOSED
                                           ↓
At any point before CLOSED: → VOIDED    REFUNDED
```

1. **Draft:** Order is being built on the terminal. Not visible to kitchen. Can be freely modified.
2. **Open:** Order has been sent to kitchen. Items route to KDS stations based on `prep_station`. Modifications after this point create `order_modifications` records.
3. **Fired:** Kitchen has begun preparing. Triggered per-item by KDS bump or auto-fire.
4. **Ready:** All non-voided items are complete. Expo has verified.
5. **Served:** Food delivered to guest.
6. **Closed:** Payment complete, `balance_due = 0`.
7. **Voided:** Entire order cancelled. Requires manager approval if any items were sent.
8. **Refunded:** Closed order with refund processed.

### Core Rules

1. **Order number generation:** Sequential per-location per-day, using `next_order_number()` function with advisory lock to prevent race conditions. Display number format: `{prefix}-{number}` (e.g., "A-042").

2. **Item snapshotting:** When an item is added to an order, its name, price, and modifier names/prices are snapshotted into `order_items` and `order_item_modifiers`. Menu changes after order creation do not affect existing orders.

3. **Send to kitchen:** Only unsent items (`is_sent = false`) are sent. This allows adding items to an already-sent order. Each send creates an `order_modifications` record of type `add_item`.

4. **Void rules:** Voiding an unsent item is free. Voiding a sent item requires manager PIN and a `void_reason` (enum: customer_request, kitchen_error, server_error, wrong_item, quality_issue, 86d, duplicate, other). Voided items are flagged but not deleted.

5. **Comp rules:** Comping requires manager PIN, a `comp_reason` (enum: manager_comp, quality_issue, service_issue, birthday, vip, employee_meal, promotional, other), and records `comp_amount`. Comped items reduce the order total.

6. **Split checks:** Three modes:
   - **By seat:** Items auto-assigned by seat number become separate checks
   - **Equal split:** Total divided evenly across N checks
   - **Custom:** User drags items between checks or enters custom amounts
   - Each resulting check becomes a separate order with `split_from_order_id` metadata

7. **Merge checks:** Two orders at the same table merge into one. The absorbed order is marked voided with metadata indicating the merge.

8. **Transfer:** Changes `server_id` on the order. Creates an `order_modifications` record. The previous and new server are both notified via SSE.

9. **Move table:** Changes `table_id`. Updates old table status to `dirty`/`available` and new table status to `seated`/`ordered`. Creates an `order_modifications` record.

10. **Reopen:** Manager-only action on a closed order. Sets status back to `served`, recalculates `balance_due`. Creates audit trail.

11. **Discount application:** Discounts can be order-level or item-level. Percentage discounts have optional `max_discount_amount` caps. Discounts flagged `requires_manager_approval` trigger the manager PIN flow. The `applied_amount` (actual dollars removed) is calculated and stored.

12. **Tax calculation:** Tax is calculated per-item based on the item's `tax_rate_id`. If no item-specific rate, the location's default tax rate applies. Tax applies to the post-discount price. Tax-exempt items (`is_taxable = false`) skip tax.

13. **Financial denormalization:** The order's `subtotal`, `discount_total`, `tax_total`, `total`, and `balance_due` are recalculated and stored on every item add/remove/modify/void/comp/discount. These are denormalized for fast reads — the authoritative values derive from line items.

14. **Order types:**
    - `dine_in`: Requires table assignment (configurable per location)
    - `takeout`: Requires `guest_name`, optional `guest_phone`, optional `scheduled_for`
    - `delivery`: Requires `delivery_address`, `guest_phone`
    - `bar`: Tab-based, linked to pre-auth card
    - `catering`: Links to catering event, may have special pricing
    - `online`: Created by online ordering module
    - `kiosk`: Created by kiosk module
    - `drive_thru`: Created by drive-thru module
    - `qr`: Created by QR table ordering

---

## Dependencies

- **01_auth** — Authentication, authorization, manager overrides
- **02_menu** — Menu items, categories, modifiers for order entry
- **05_tables** — Table assignment and status updates
- **06_kds** — Kitchen ticket routing on send
- **04_payments** — Payment processing for order close
- **10_settings** — Tax rates, location config

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `order.created` | `events.orders` | `{order_id, order_number, type, table_id, server_id}` | New order created |
| `order.updated` | `events.orders` | `{order_id, changes}` | Order metadata changed |
| `order.sent` | `events.orders` + `events.kds` | `{order_id, items[]}` | Order sent to kitchen |
| `order.item_added` | `events.orders` | `{order_id, item}` | Item added after initial send |
| `order.item_voided` | `events.orders` | `{order_id, item_id, reason}` | Item voided |
| `order.transferred` | `events.orders` | `{order_id, from_server, to_server}` | Server transfer |
| `order.table_moved` | `events.orders` + `events.tables` | `{order_id, from_table, to_table}` | Table move |
| `order.closed` | `events.orders` | `{order_id, total, payment_method}` | Order fully paid |
| `order.voided` | `events.orders` | `{order_id, reason, voided_by}` | Entire order voided |
| `order.course_fired` | `events.kds` | `{order_id, course_number}` | Course fired to kitchen |

### Subscribed Events
| Event | Action |
|-------|--------|
| `kds.item_bumped` | Update `order_items.is_ready`, check if all items ready |
| `payment.completed` | Update `amount_paid`, `balance_due`, close if fully paid |
| `table.cleared` | Mark associated orders as closed if unpaid (edge case handling) |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `stale_draft_cleanup` | Every 30 minutes | Delete draft orders older than 4 hours with no items |
| `order_number_reset` | Daily at midnight (per location TZ) | Reset order number sequence for new day |
| `recalculate_order_totals` | On-demand (Celery task) | Recalculate financial totals for an order (safety net for drift) |

---

## Acceptance Criteria

### Order Creation
- [ ] User can create a dine-in order with table and guest count
- [ ] User can create a takeout order with guest name
- [ ] User can create a delivery order with address and phone
- [ ] Order receives sequential `order_number` and formatted `display_number`
- [ ] Order starts in `draft` status

### Item Management
- [ ] User can add items to order by tapping menu grid buttons
- [ ] Items with required modifiers trigger modifier slide-over
- [ ] User can adjust item quantity
- [ ] User can add notes to individual items
- [ ] User can assign items to specific seats
- [ ] User can assign items to specific courses
- [ ] Item prices include modifier price adjustments in `line_total`

### Send to Kitchen
- [ ] Tapping "Send" marks all unsent items as `is_sent = true` and sets `sent_at`
- [ ] Sent items route to KDS stations based on `prep_station`
- [ ] SSE event `order.sent` broadcasts to all terminals and KDS
- [ ] Adding items after send only sends the new items on next "Send"
- [ ] Order status transitions from `draft` to `open` on first send

### Void / Comp
- [ ] Voiding an unsent item removes it from the order immediately
- [ ] Voiding a sent item requires manager PIN and void reason
- [ ] Voided items show "(VOIDED)" on KDS
- [ ] Comping an item requires manager PIN and comp reason
- [ ] Comp reduces order total by the comp amount
- [ ] All voids and comps create `order_modifications` records

### Split / Merge / Transfer / Move
- [ ] User can split an order by seat, equal, or custom
- [ ] Split creates separate orders that can be paid independently
- [ ] User can merge two orders at the same table
- [ ] User can transfer an order to a different server
- [ ] User can move an order to a different table
- [ ] All operations create `order_modifications` audit records

### Discounts
- [ ] User can apply order-level percentage or fixed discounts
- [ ] User can apply item-level discounts
- [ ] Discounts requiring manager approval trigger PIN prompt
- [ ] Discount amounts are correctly calculated and stored
- [ ] Tax recalculates on post-discount amounts

### Financial Accuracy
- [ ] Order `subtotal` equals sum of non-voided, non-comped line totals
- [ ] Order `tax_total` equals sum of non-voided item tax amounts
- [ ] Order `total` equals subtotal - discount_total + tax_total
- [ ] Order `balance_due` equals total - amount_paid
- [ ] Order closes when `balance_due` reaches 0

### Order Types
- [ ] Each order type (dine-in, takeout, delivery, bar, online, kiosk, drive-thru, qr) can be created
- [ ] Dine-in orders require table assignment (when location requires it)
- [ ] Takeout orders accept guest name and scheduled pickup time
- [ ] Delivery orders require delivery address

### Reopen
- [ ] Manager can reopen a closed order
- [ ] Reopened order returns to `served` status with recalculated `balance_due`
- [ ] Reopen creates audit log entry
