# Module 17: Delivery Management

## Overview

The Delivery module manages in-house delivery operations and third-party delivery platform integrations. It includes delivery zone management with GeoJSON polygons, driver assignment and GPS tracking, delivery status updates with customer notifications, zone-based fee and minimum calculations, and integration hooks for DoorDash, UberEats, and Grubhub.

**Who uses it:** Managers configure delivery zones and fees. Dispatchers assign drivers. Drivers receive assignments and update delivery status. Customers track their delivery in real-time. Third-party platforms push orders into the system.

**Why it matters:** Delivery represents 15-40% of restaurant revenue and growing. Third-party commissions (15-30%) eat into margins. In-house delivery gives restaurants control over the customer relationship and keeps more revenue. Even restaurants using third-party platforms need order consolidation in one POS.

---

## Database Tables

### Existing Tables

- **`delivery_zones`** — Zone definitions. Fields: `location_id`, `name`, `zone_polygon` (jsonb GeoJSON), `delivery_fee`, `min_order_amount`, `estimated_minutes`, `is_active`.
- **`deliveries`** — Delivery records. Fields: `order_id`, `driver_id`, `pickup_time`, `delivery_time`, `estimated_delivery_at`, `actual_delivery_at`, `status` (pending, assigned, picked_up, en_route, delivered, failed), `delivery_address` (jsonb), `delivery_instructions`, `delivery_fee`, `driver_tip`, tracking fields (`driver_lat`, `driver_lng`, `last_location_at`), `proof_of_delivery_url`, `signature_url`.
- **`orders`** — (Shared) Orders with `order_type = 'delivery'`.

### New Tables

- **`delivery_drivers`** — Driver profiles (may overlap with users or be external). Fields: `id`, `org_id`, `user_id` (nullable — external drivers), `name`, `phone`, `vehicle_type` (car, bike, scooter), `license_plate`, `is_active`, `is_available`, `current_lat`, `current_lng`, `last_location_at`, `created_at`.
- **`third_party_integrations`** — Integration configs. Fields: `id`, `org_id`, `location_id`, `platform` (doordash, ubereats, grubhub), `is_active`, `api_key_encrypted`, `store_id`, `settings` (jsonb: auto_accept, menu_sync_enabled), `last_sync_at`, `created_at`.
- **`third_party_orders`** — Orders from third-party platforms. Fields: `id`, `org_id`, `integration_id`, `platform_order_id`, `platform` (doordash, ubereats, grubhub), `order_id` (linked Sear order), `raw_payload` (jsonb), `status`, `received_at`, `accepted_at`, `created_at`.

---

## API Routes

### Blueprint: `/api/v1/delivery/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/zones` | List delivery zones for location | Yes |
| POST | `/zones` | Create delivery zone (with GeoJSON polygon) | Manager+ |
| PUT | `/zones/:id` | Update delivery zone | Manager+ |
| DELETE | `/zones/:id` | Deactivate zone | Manager+ |
| POST | `/zones/check` | Check if an address is in a delivery zone | Yes |
| GET | `/deliveries` | List deliveries (filter: status, date, driver) | Yes |
| GET | `/deliveries/:id` | Get delivery detail with tracking | Yes |
| POST | `/deliveries/:id/assign` | Assign driver to delivery | Yes |
| POST | `/deliveries/:id/pickup` | Mark picked up | Yes (driver) |
| POST | `/deliveries/:id/en-route` | Mark en route | Yes (driver) |
| POST | `/deliveries/:id/delivered` | Mark delivered (with proof) | Yes (driver) |
| POST | `/deliveries/:id/failed` | Mark delivery failed | Yes (driver) |
| GET | `/drivers` | List delivery drivers | Yes |
| POST | `/drivers` | Add delivery driver | Manager+ |
| PUT | `/drivers/:id` | Update driver | Manager+ |
| PUT | `/drivers/:id/location` | Update driver GPS location | Yes (driver) |
| PUT | `/drivers/:id/availability` | Toggle driver availability | Yes (driver) |
| GET | `/third-party/integrations` | List third-party integrations | Manager+ |
| POST | `/third-party/integrations` | Add integration | Admin+ |
| PUT | `/third-party/integrations/:id` | Update integration | Admin+ |
| GET | `/third-party/orders` | List third-party orders | Yes |
| POST | `/third-party/webhook/:platform` | Webhook receiver for platform orders | No (webhook auth) |

### Public Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/track/:token` | Customer delivery tracking page |

---

## UI Pages / Components

### Delivery Dashboard — `/pos/deliveries`
- **Active deliveries map:** Map view showing driver locations and delivery destinations
- **Delivery list:** Status, order number, customer, address, driver, ETA, elapsed time
- **Status badges:** Pending (gray), Assigned (blue), Picked Up (orange), En Route (yellow), Delivered (green), Failed (red)
- **Assign driver:** Select from available drivers, auto-suggest nearest driver
- **Quick actions:** Assign, view order, contact customer, contact driver

### Zone Manager — `/admin/delivery/zones`
- **Map-based editor:** Draw GeoJSON polygons on a map to define zones
- **Zone list:** Name, fee, minimum order, estimated time, active/inactive
- **Zone editing:** Click zone on map to edit boundaries, fee, minimum
- **Overlap warning:** Alert if zones overlap (customer gets the tightest match)

### Driver Management — `/admin/delivery/drivers`
- Driver list: Name, phone, vehicle, status (available/busy/offline)
- Add/edit driver
- Live map showing driver locations
- Delivery history per driver with stats (avg delivery time, deliveries per shift)

### Third-Party Integration — `/admin/settings` (Delivery tab)
- Connect DoorDash, UberEats, Grubhub
- Enter API credentials
- Configure auto-accept, menu sync
- View incoming third-party orders with accept/reject

### Customer Tracking Page (public) — `/delivery/track/:token`
- Map showing driver location and destination
- Status timeline: Preparing → Picked Up → On the Way → Delivered
- Estimated delivery time countdown
- Driver name and contact option
- Order summary

---

## Business Rules

1. **Zone-based pricing:** Delivery fee and minimum order amount are set per zone. When a customer enters their delivery address, the system checks which zone contains the address (point-in-polygon on GeoJSON). If the address is outside all zones, delivery is unavailable.

2. **Driver assignment:** Manual assignment by dispatcher. Auto-suggest based on: (a) driver availability, (b) proximity to restaurant (current GPS), (c) current delivery load. Future: Auto-assignment algorithm.

3. **GPS tracking:** Drivers update their GPS location periodically via the driver app/interface. Location stored on `delivery_drivers` and `deliveries`. Customer tracking page polls for updates.

4. **Delivery status flow:**
   ```
   pending → assigned → picked_up → en_route → delivered
                                                    ↓
                                                  failed
   ```

5. **Proof of delivery:** Drivers can upload a photo of the delivered order and/or capture a signature. Stored as URLs (`proof_of_delivery_url`, `signature_url`).

6. **Third-party order flow:** Orders from DoorDash/UberEats/Grubhub arrive via webhook. The system creates an order in Sear POS with `source = 'external'` and `order_type = 'delivery'`. If auto-accept is enabled, the order is immediately accepted. Otherwise, staff must manually accept within the platform's time window.

7. **Menu sync with third parties:** When enabled, menu changes in Sear (price changes, 86s, new items) can be pushed to third-party platforms via their APIs. This prevents out-of-sync menus causing rejected orders.

8. **Delivery time estimation:** Estimated delivery time = prep time (from menu items) + travel time (estimated from zone's `estimated_minutes`). Updated when driver marks picked up (travel time recalculates from actual position).

9. **Delivery fee treatment:** Delivery fee is added to the order total as a separate line item. It is taxable in some jurisdictions (configurable per location). The fee is not tipped on (tip base = subtotal before delivery fee, configurable).

10. **Failed delivery handling:** If delivery fails (customer unavailable, wrong address), the driver marks it failed with a reason. The order remains in the system. The manager decides: re-attempt, refund, or mark as waste.

---

## Dependencies

- **01_auth** — Authentication
- **03_orders** — Order creation and management
- **04_payments** — Payment for delivery orders
- **11_online_ordering** — Online delivery orders flow through online ordering
- **10_settings** — Location config, delivery settings
- **External: Google Maps API** — GeoJSON zone editing, address geocoding, distance calculation
- **External: Twilio** — Customer delivery notifications

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `delivery.assigned` | `events.delivery` | `{delivery_id, driver_id, order_id}` | Driver assigned |
| `delivery.picked_up` | `events.delivery` | `{delivery_id}` | Order picked up |
| `delivery.en_route` | `events.delivery` | `{delivery_id, driver_lat, driver_lng}` | Driver en route |
| `delivery.delivered` | `events.delivery` | `{delivery_id}` | Delivery complete |
| `delivery.failed` | `events.delivery` | `{delivery_id, reason}` | Delivery failed |
| `driver.location_updated` | `events.delivery` | `{driver_id, lat, lng}` | Driver GPS update |
| `third_party.order_received` | `events.orders` | `{platform, order_id}` | New third-party order |

### Subscribed Events
| Event | Action |
|-------|--------|
| `order.created` (delivery type) | Create delivery record |
| `kds.order_bumped` (expo) | Notify driver that order is ready for pickup |
| `item.86d` | Push 86 status to connected third-party platforms |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `driver_location_cleanup` | Every 5 minutes | Clear stale driver locations (>10 min old) |
| `delivery_time_alerts` | Every 2 minutes | Alert on deliveries exceeding estimated time |
| `third_party_menu_sync` | Every 30 minutes | Sync menu changes to connected platforms |
| `third_party_order_poll` | Every 1 minute | Poll platforms that don't support webhooks |

---

## Acceptance Criteria

### Delivery Zones
- [ ] Manager can create delivery zones by drawing polygons on a map
- [ ] Each zone has configurable fee, minimum order, and estimated time
- [ ] Address check correctly determines zone membership (point-in-polygon)
- [ ] Addresses outside all zones show "Delivery unavailable"

### Delivery Operations
- [ ] Delivery orders create delivery records automatically
- [ ] Dispatcher can assign drivers to deliveries
- [ ] Drivers can update status through the delivery flow
- [ ] Customer tracking page shows real-time driver location and status

### GPS Tracking
- [ ] Driver location updates periodically
- [ ] Driver position shown on dispatch map
- [ ] Customer tracking page shows driver on map

### Third-Party Integration
- [ ] DoorDash/UberEats/Grubhub orders received via webhook
- [ ] Third-party orders create Sear POS orders
- [ ] Auto-accept configurable per platform
- [ ] Menu changes synced to connected platforms

### Driver Management
- [ ] Drivers can be added with name, phone, vehicle
- [ ] Driver availability toggleable
- [ ] Delivery history tracked per driver
- [ ] Auto-suggest assigns nearest available driver

### Customer Experience
- [ ] Customer receives SMS with tracking link
- [ ] Tracking page shows order status and ETA
- [ ] Proof of delivery (photo/signature) supported
