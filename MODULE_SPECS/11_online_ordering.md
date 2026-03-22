# Module 11: Online Ordering & QR Code

## Overview

The Online Ordering module provides a commission-free, branded web portal where guests can browse the restaurant's menu, place orders for pickup or delivery, and pay online. It also includes QR code table ordering — guests scan a QR code at their table to view the menu and order/pay from their phone. Both features reduce labor needs and increase order throughput.

**Who uses it:** Guests access the online ordering portal and QR code ordering from their phones. Restaurant staff accept/reject incoming orders and manage the queue. Managers configure the online menu, ordering windows, and throttling.

**Why it matters:** Toast charges $75/month for online ordering. DoorDash, UberEats, and Grubhub take 15-30% commissions. Sear's commission-free online ordering is included at the Professional tier ($49/month), saving restaurants thousands monthly. QR code ordering reduces server touchpoints and increases table turnover.

---

## Database Tables

### Existing Tables

- **`online_menus`** — Online menu configuration per location. Fields: `location_id`, `name`, `slug` (public URL), `is_active`, `settings` (jsonb: theme colors, logo, min_order amount, delivery_fee, pickup_lead_time, delivery_lead_time, max_orders_per_hour, ordering_window).
- **`online_menu_items`** — Items available online. Fields: `online_menu_id`, `menu_item_id`, `is_available`, `sort_order`, `online_price` (override, null = use menu_item price), `online_description` (extended description for web).
- **`online_order_queue`** — Incoming order queue. Fields: `order_id`, `status` (pending, accepted, rejected, preparing), `estimated_ready_minutes`, `accepted_by`, `accepted_at`, `customer_notified_at`.
- **`orders`** — (Shared) Orders with `source = 'online'` or `source = 'qr'`.

### New Tables

- **`qr_codes`** — QR code configurations. Fields: `id`, `org_id`, `location_id`, `table_id` (nullable — can be tableless for takeout), `code` (unique token), `qr_image_url`, `is_active`, `scan_count`, `last_scanned_at`, `created_at`.
- **`online_order_tracking`** — Guest-facing order status. Fields: `id`, `order_id`, `tracking_token` (public, for tracking page URL), `status_updates` (jsonb array: [{status, message, timestamp}]), `estimated_ready_at`, `created_at`.
- **`order_throttle_config`** — Throttling rules. Fields: `id`, `org_id`, `location_id`, `max_orders_per_15_min`, `max_orders_per_hour`, `current_count_15min`, `current_count_hour`, `is_paused`, `pause_reason`, `paused_by`, `paused_at`.

---

## API Routes

### Blueprint: `/api/v1/online/` (public routes for guest ordering)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/menu/:slug` | Get public online menu with categories, items, modifiers | No (public) |
| POST | `/orders` | Place an online order (with payment) | No (public) |
| GET | `/orders/:token/track` | Get order tracking status | No (public, token-auth) |
| GET | `/availability/:slug` | Check if ordering is available (hours, throttle) | No (public) |

### Blueprint: `/api/v1/online/admin/` (staff-facing)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/queue` | List pending online orders | Yes |
| POST | `/queue/:id/accept` | Accept an incoming order | Yes |
| POST | `/queue/:id/reject` | Reject an order (with reason) | Yes |
| PUT | `/queue/:id/ready-time` | Update estimated ready time | Yes |
| POST | `/queue/:id/notify` | Notify customer (order ready) | Yes |
| GET | `/menus` | List online menus for location | Manager+ |
| POST | `/menus` | Create online menu | Manager+ |
| PUT | `/menus/:id` | Update online menu settings | Manager+ |
| PUT | `/menus/:id/items` | Sync items to online menu | Manager+ |
| POST | `/qr-codes` | Generate QR code (for table or general) | Manager+ |
| GET | `/qr-codes` | List QR codes | Manager+ |
| PUT | `/qr-codes/:id` | Update QR code config | Manager+ |
| DELETE | `/qr-codes/:id` | Deactivate QR code | Manager+ |
| PUT | `/throttle` | Update throttle config | Manager+ |
| POST | `/throttle/pause` | Pause online ordering | Manager+ |
| POST | `/throttle/resume` | Resume online ordering | Manager+ |

---

## UI Pages / Components

### Online Ordering Portal (Guest-Facing) — `/{slug}` or `/order/{slug}`
- **Mobile-optimized** responsive design
- Restaurant branding (logo, colors, name from settings)
- **Menu browsing:** Categories with item cards (image, name, description, price)
- **Item detail:** Tap to see full description, allergens, modifiers
- **Cart:** Floating cart icon with item count, slide-up cart view
- **Checkout:** Guest name, phone, email, order type (pickup/delivery), delivery address, scheduled time or ASAP, payment via Valor (card-not-present), optional tip
- **Order confirmation page** with estimated ready time and tracking link
- **Unavailable state:** If outside business hours or throttled, show friendly message with next available time

### Order Tracking Page — `/track/:token`
- Order status timeline: Placed → Accepted → Preparing → Ready → Complete
- Estimated ready time countdown
- Order summary (items, total)
- Restaurant contact info

### QR Code Ordering (Guest Phone) — `/qr/:code`
- Scans to table-linked ordering experience
- Same menu browsing as online ordering
- Table number auto-assigned from QR code
- Can add items incrementally (scan again to add more)
- Can request check / pay from phone
- Server notified of QR orders in real-time

### Online Order Queue (Staff-Facing) — `/pos/online-orders`
- List of incoming orders: order number, time, items, order type, estimated ready
- Accept / Reject buttons per order
- Reject requires reason (out of items, kitchen closed, etc.)
- Ready time adjustment
- "Notify Customer" button (sends SMS via Twilio)
- Order count and throttle status indicator
- Pause/Resume toggle for online ordering

### QR Code Management (Back Office) — `/admin/settings` (QR section)
- Generate QR codes per table
- Bulk generate for all tables
- Download printable QR code sheets
- View scan analytics

---

## Business Rules

1. **Menu sync:** The online menu pulls from the main `menu_items` catalog but allows per-item overrides (different price, extended description, availability toggle). Items marked 86'd in the main menu are automatically unavailable online.

2. **Order throttling:** To prevent the kitchen from being overwhelmed, online orders are throttled. Configurable limits: max orders per 15 minutes and per hour. When the limit is reached, the ordering portal shows "Kitchen is busy — please try again in X minutes." Managers can also manually pause ordering.

3. **Acceptance workflow:** Online orders enter a `pending` state. Staff must accept within a configurable window (default: 5 minutes). Unaccepted orders trigger an escalating alert (sound, push). If not accepted within 10 minutes, the order is auto-rejected with a notification to the guest.

4. **Scheduled orders:** Guests can schedule pickup/delivery for a future time. Scheduled orders enter the queue at the appropriate lead time before the scheduled time.

5. **QR code table linking:** Each QR code can be linked to a specific table. When scanned, the system creates an order for that table. If a QR order already exists for that table, scanning again allows adding items to the existing order. If the QR is not table-linked, it creates a takeout order.

6. **Payment for online orders:** Card-not-present payments processed through Valor REST API (not terminal). Valor's CNP rate (3.50% + 15c) applies. Payment captured at order time, not auth-only.

7. **Order notifications:**
   - Guest receives SMS confirmation when order is placed
   - Guest receives SMS when order is accepted (with estimated ready time)
   - Guest receives SMS when order is ready for pickup
   - Delivery orders receive SMS with tracking link

8. **Real-time menu sync:** When an item is 86'd or a price changes, the online menu updates within 60 seconds (menu cache invalidation).

9. **Minimum order amount:** Configurable per online menu. Orders below the minimum show a message and cannot be submitted.

10. **Operating hours:** Online ordering respects business hours from the location settings. Outside of hours, the portal shows "Closed — opens at [time]" with the menu viewable but ordering disabled.

---

## Dependencies

- **01_auth** — Staff authentication for queue management
- **02_menu** — Menu data source, 86 sync
- **03_orders** — Order creation and management
- **04_payments** — Online payment processing (Valor CNP)
- **05_tables** — Table linking for QR orders
- **08_customers** — Customer lookup/creation from guest info
- **10_settings** — Business hours, location config
- **External: Twilio** — SMS notifications
- **External: Valor PayTech** — Card-not-present payment

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `online_order.received` | `events.orders` | `{order_id, type, items_count}` | New online order placed |
| `online_order.accepted` | `events.orders` | `{order_id, ready_minutes}` | Staff accepted order |
| `online_order.rejected` | `events.orders` | `{order_id, reason}` | Staff rejected order |
| `online_order.ready` | `events.orders` | `{order_id}` | Order ready for pickup |
| `qr_order.received` | `events.orders` + `events.tables` | `{order_id, table_id}` | QR code order placed |
| `throttle.status_changed` | `events.settings` | `{location_id, is_paused, current_count}` | Throttle state changed |

### Subscribed Events
| Event | Action |
|-------|--------|
| `item.86d` | Mark item unavailable on online menu |
| `item.available` | Mark item available on online menu |
| `menu.updated` | Invalidate online menu cache |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `throttle_counter_reset` | Every 15 minutes | Reset 15-minute throttle counter |
| `unaccepted_order_alert` | Every 1 minute | Escalate unaccepted orders past threshold |
| `scheduled_order_release` | Every 1 minute | Release scheduled orders into queue at appropriate lead time |
| `online_menu_cache_sync` | Every 5 minutes | Ensure online menu cache is in sync with menu changes |

---

## Acceptance Criteria

### Online Ordering Portal
- [ ] Guest can browse menu by category on mobile
- [ ] Guest can view item details, allergens, and modifiers
- [ ] Guest can add items to cart with modifier selections
- [ ] Guest can choose pickup or delivery
- [ ] Guest can schedule a future order time
- [ ] Guest can pay with card online (Valor CNP)
- [ ] Guest receives SMS order confirmation
- [ ] Portal shows "Closed" outside business hours

### Order Tracking
- [ ] Guest receives tracking link after placing order
- [ ] Tracking page shows real-time status updates
- [ ] Estimated ready time countdown displays correctly

### Order Queue (Staff)
- [ ] Incoming online orders appear in queue within 5 seconds
- [ ] Staff can accept or reject orders
- [ ] Rejecting requires a reason
- [ ] Unaccepted orders trigger escalating alerts
- [ ] "Notify Customer" sends SMS via Twilio

### QR Code Ordering
- [ ] QR codes can be generated per table
- [ ] Scanning QR code opens table-linked ordering experience
- [ ] Items can be added incrementally via repeated scans
- [ ] QR orders appear on POS and KDS like regular orders
- [ ] Guest can pay from phone via QR ordering

### Throttling
- [ ] Order throttle limits are enforced
- [ ] Throttled state shows friendly message to guests
- [ ] Manager can manually pause/resume ordering
- [ ] Current order count visible on queue screen

### Menu Sync
- [ ] 86'd items immediately unavailable on online portal
- [ ] Price changes reflected within 60 seconds
- [ ] Online menu supports different prices from in-house menu
