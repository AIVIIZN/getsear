# Module 06: Kitchen Display System (KDS)

## Overview

The KDS module replaces paper kitchen tickets with digital displays at each kitchen station. It routes order items to the correct station (grill, fry, cold, bar, expo), tracks preparation timing, provides bump/recall functionality, shows all-day counts, and drives speed-of-service metrics. It is the primary communication channel between front-of-house and back-of-house.

**Who uses it:** Kitchen line cooks see tickets at their station. The expo (expeditor) sees all items and coordinates plate-up. Managers monitor ticket times and kitchen throughput.

**Why it matters:** KDS reduces ticket times by 20-30%, eliminates lost/illegible paper tickets, enables course-based firing, and provides the data foundation for speed-of-service reporting. The expo display ensures orders go out complete and correct.

---

## Database Tables

- **`kds_stations`** — Station definitions. Fields: `location_id`, `name` (Grill, Fryer, Cold, Bar, Expo), `station_type` (prep, expo), `prep_stations[]` (which `prep_station` values route here), `terminal_id` (assigned display device), `display_settings` (jsonb: font_size, columns, sound, color_coding, aging_thresholds), `sort_order`, `is_active`.
- **`kds_ticket_events`** — Event log for ticket lifecycle. Fields: `station_id`, `order_id`, `order_item_id`, `event_type` (received, started, bumped, recalled, all_day_updated), `performed_by`, `created_at`.
- **`order_items`** — (Shared with Orders) Source of items routed to stations. Key fields: `prep_station`, `course`, `is_sent`, `is_fired`, `is_ready`, `sent_at`, `fired_at`, `ready_at`.
- **`orders`** — (Shared) Order context: table, server, order type, course info.

---

## API Routes

### Blueprint: `/api/v1/kds/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/stations` | List KDS stations for location | Yes |
| POST | `/stations` | Create KDS station | Manager+ |
| PUT | `/stations/:id` | Update station config (name, routing, display) | Manager+ |
| DELETE | `/stations/:id` | Deactivate station | Manager+ |
| GET | `/stations/:id/tickets` | Get active tickets for a station | Yes |
| POST | `/tickets/:item_id/bump` | Bump item (mark complete at this station) | Yes |
| POST | `/tickets/:order_id/bump-all` | Bump entire order at station | Yes |
| POST | `/tickets/:item_id/recall` | Recall a previously bumped item | Yes |
| GET | `/metrics` | KDS performance metrics (avg ticket time, items/hour) | Manager+ |
| GET | `/all-day` | All-day counts for current station | Yes |

---

## UI Pages / Components

### KDS Display — `/kds` (fullscreen)
- **Dark theme only** — high contrast for kitchen visibility
- **Ticket columns:** 2-4 columns (configurable) showing order tickets
- **Each ticket shows:**
  - Order number and table/name (large font at top)
  - Order type badge (Dine-in, Takeout, Delivery)
  - Server name
  - Items for this station with modifiers and notes
  - Course number badge per item
  - Seat number per item
  - RUSH indicator (red flash) for priority orders
  - Elapsed time since received (aging timer)
- **Aging colors:**
  - Green: < 5 minutes (configurable)
  - Yellow: 5-10 minutes
  - Red: > 10 minutes
  - Thresholds configurable per station
- **Bump action:** Tap ticket or press bump bar button to mark all station items complete. Ticket slides off screen.
- **Recall:** Button to bring back last bumped ticket (undo).
- **All-day strip:** Bottom bar showing aggregate counts of items pending (e.g., "Burger x4, Fries x7, Salad x2"). Updates in real-time.
- **Sound alerts:** Configurable sound on new ticket arrival. Different sound for RUSH orders.
- **Course firing indicator:** Items held for later courses show "HOLD" badge until course is fired.

### Expo Display — `/kds?station=expo`
- Same layout as prep station but shows ALL items across ALL stations for each order
- Items show station origin and completion status (checkmark when bumped at prep station)
- Expo bumps order when ALL items are complete and plated
- Expo bump triggers `order.all_ready` event

### KDS Station Config (Back Office) — `/admin/settings` (KDS section)
- Station name, type (prep/expo)
- Prep station routing (checkboxes: grill, fry, cold, bar, etc.)
- Display settings: font size, columns, aging thresholds (green/yellow/red minutes)
- Sound settings: new ticket sound, rush sound, volume
- Terminal assignment (which device runs this station)

---

## Business Rules

1. **Item routing:** When an order is sent, each `order_item` routes to the KDS station whose `prep_stations[]` array contains the item's `prep_station` value. An item can appear on multiple stations if configured (e.g., burger appears on both grill and expo).

2. **Expo station:** Expo sees all items. Expo does not bump individual items — it bumps the entire order once all items from all prep stations are complete. The expo bump is what triggers the "ready" state.

3. **Course management:** Items with `course > 1` show "HOLD" on KDS until the course is fired by the server (via `POST /orders/:id/fire-course`). When fired, the HOLD badge is removed and the aging timer starts.

4. **Bump semantics:**
   - Prep station bump: Marks item as `is_ready = true` at that station. Creates `kds_ticket_events` record of type `bumped`. If all items for the order at this station are bumped, the ticket is removed.
   - Expo bump: Marks all items on the order as ready. Updates `order_items.is_ready = true` and `ready_at`. If this was the last station, updates `orders.status` to `ready`.

5. **Recall:** Within a configurable window (default 5 minutes), a bumped item can be recalled to the screen. Creates `kds_ticket_events` of type `recalled`. Resets `is_ready = false`.

6. **All-day counts:** Aggregated count of each item currently pending across all active tickets at a station. Updates in real-time as items are received and bumped. Critical for prep planning during rush.

7. **RUSH priority:** Orders or items can be marked RUSH by a server or manager. RUSH tickets move to the front of the queue and display with a red flash/border and distinct sound.

8. **Voided items on KDS:** When an item is voided after being sent, it appears with "(VOIDED)" overlay and strikethrough on the KDS. The cook stops prepping. It does not need to be bumped.

9. **New items on existing order:** When a server adds items to an already-sent order and sends again, only the new items appear as a new ticket on KDS with "ADD" badge, referencing the original order number.

10. **Speed-of-service tracking:** Every ticket event is logged to `kds_ticket_events`. Metrics calculated: avg ticket time (received to bumped), avg order completion time (first item received to expo bump), items per hour per station.

11. **Dark theme:** KDS is the only Sear screen that uses dark theme by default. Kitchen environments have high ambient light from heat lamps and grills — dark backgrounds with bright text provide better contrast.

---

## Dependencies

- **01_auth** — Authentication for station config
- **03_orders** — Order items, status updates, course management
- **02_menu** — Item names, prep stations for routing
- **10_settings** — Location config, terminal assignment

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `kds.item_bumped` | `events.kds` | `{station_id, order_id, item_id}` | Item bumped at prep station |
| `kds.order_bumped` | `events.kds` + `events.orders` | `{order_id, station_id}` | Entire order bumped (expo) |
| `kds.item_recalled` | `events.kds` | `{station_id, order_id, item_id}` | Item recalled |
| `kds.all_day_updated` | `events.kds` | `{station_id, counts}` | All-day counts changed |

### Subscribed Events
| Event | Action |
|-------|--------|
| `order.sent` | Route items to stations, create tickets, play new-ticket sound |
| `order.item_added` | Add new item ticket with "ADD" badge |
| `order.item_voided` | Show "(VOIDED)" overlay on affected item |
| `order.course_fired` | Remove "HOLD" badge from course items, start aging timer |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `kds_metrics_aggregation` | Every 15 minutes | Calculate avg ticket times, throughput per station |
| `kds_stale_ticket_alert` | Every 2 minutes | Alert manager about tickets exceeding red threshold by 2x |
| `kds_daily_speed_report` | Daily at 2 AM | Aggregate speed-of-service data into daily_metrics |

---

## Acceptance Criteria

### Station Management
- [ ] Manager can create KDS stations with name, type, and routing config
- [ ] Manager can edit station display settings (font, columns, aging thresholds, sound)
- [ ] Manager can assign a terminal device to a station
- [ ] Manager can deactivate a station

### Ticket Display
- [ ] Sent order items appear on the correct station based on `prep_station` routing
- [ ] Tickets show order number, table/name, items, modifiers, notes, and elapsed time
- [ ] Aging colors transition at configured thresholds (green → yellow → red)
- [ ] RUSH orders display with priority indicator and distinct sound
- [ ] Course items show "HOLD" until the course is fired
- [ ] Voided items display with "(VOIDED)" overlay

### Bump / Recall
- [ ] Tapping a ticket bumps all items for that station, ticket slides off
- [ ] Bump creates `kds_ticket_events` record
- [ ] Bumped items update `is_ready = true` and `ready_at` on `order_items`
- [ ] Recall brings back the last bumped ticket within 5-minute window
- [ ] Expo bump marks order as fully ready

### All-Day Counts
- [ ] Bottom strip shows real-time aggregate counts of pending items
- [ ] Counts update immediately when new tickets arrive or items are bumped

### New Items / Additions
- [ ] Items added to an existing order after initial send appear as a new ticket with "ADD" badge
- [ ] The new ticket references the original order number

### Speed of Service
- [ ] Avg ticket time (received to bumped) calculated and displayed in metrics
- [ ] Avg order completion time calculated
- [ ] Items per hour per station tracked
- [ ] Metrics accessible via `/api/v1/kds/metrics`

### Real-Time Sync
- [ ] New tickets appear on KDS within 1 second of order send
- [ ] Bumps reflect across all screens (prep and expo) within 1 second
- [ ] Sound plays on new ticket and RUSH ticket arrival

### Dark Theme
- [ ] KDS uses dark theme by default (dark background, bright text)
- [ ] High contrast for kitchen visibility
- [ ] Aging colors visible against dark background
