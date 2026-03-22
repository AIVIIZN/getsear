# Module 19: Drive-Thru Operations

## Overview

The Drive-Thru module optimizes order-taking and fulfillment for drive-thru restaurant operations. It includes lane management, order-to-completion speed tracking, customer confirmation display integration, digital menu board daypart scheduling, and mobile POS for line-busting during peak times.

**Who uses it:** Drive-thru order takers enter orders. Kitchen staff prepare drive-thru orders (via KDS with priority). Window cashiers handle payment and hand-off. Managers monitor speed-of-service metrics and lane throughput. Line-busters take orders on mobile devices in the drive-thru line.

**Why it matters:** Drive-thru represents 60-70% of revenue for QSR/fast-casual with drive-thru lanes. Speed is the #1 customer priority — every second matters. Average drive-thru time target is under 3 minutes. This module provides the tools to measure and optimize that.

---

## Database Tables

### New Tables

- **`drive_thru_lanes`** — Lane configuration. Fields: `id`, `org_id`, `location_id`, `lane_number`, `name` (Lane 1, Lane 2, Express), `is_active`, `has_confirmation_display`, `has_menu_board`, `created_at`.
- **`drive_thru_sessions`** — Per-car tracking. Fields: `id`, `org_id`, `location_id`, `lane_id`, `order_id`, `vehicle_description` (color, type — for identification), `order_taken_at`, `payment_at`, `handoff_at`, `total_time_seconds`, `created_at`.
- **`menu_board_schedules`** — Digital menu board content scheduling. Fields: `id`, `org_id`, `location_id`, `lane_id`, `name`, `content_type` (menu, promotion, daypart_menu), `content_config` (jsonb: category_ids to display, promo images, pricing), `start_time`, `end_time`, `days_of_week[]`, `priority` (higher overrides lower), `is_active`, `created_at`.
- **`drive_thru_metrics`** — Pre-aggregated speed metrics. Fields: `id`, `org_id`, `location_id`, `metric_date`, `metric_hour`, `avg_total_time_seconds`, `avg_order_time_seconds`, `avg_payment_time_seconds`, `avg_handoff_time_seconds`, `cars_served`, `peak_queue_length`, `created_at`.

### Existing Tables Used

- **`orders`** — (Shared) Orders with `order_type = 'drive_thru'`.
- **`terminals`** — (Shared) Drive-thru specific terminals (order point, payment window, line-buster).
- **`kds_stations`** — (Shared) Drive-thru kitchen station routing.

---

## API Routes

### Blueprint: `/api/v1/drive-thru/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/lanes` | List drive-thru lanes | Yes |
| POST | `/lanes` | Create lane | Manager+ |
| PUT | `/lanes/:id` | Update lane config | Manager+ |
| GET | `/sessions/active` | Get active drive-thru sessions (cars in lane) | Yes |
| POST | `/sessions` | Start new drive-thru session (car arrives) | Yes |
| PUT | `/sessions/:id/order` | Link order to session | Yes |
| PUT | `/sessions/:id/payment` | Record payment timestamp | Yes |
| PUT | `/sessions/:id/handoff` | Record handoff (order delivered to car) | Yes |
| GET | `/metrics` | Speed-of-service metrics (filter: date, hour) | Manager+ |
| GET | `/metrics/live` | Real-time current queue and avg times | Yes |
| GET | `/menu-boards` | List menu board schedules | Manager+ |
| POST | `/menu-boards` | Create menu board schedule | Manager+ |
| PUT | `/menu-boards/:id` | Update menu board schedule | Manager+ |
| DELETE | `/menu-boards/:id` | Delete schedule | Manager+ |
| GET | `/menu-boards/current` | Get current active menu board content | Yes |
| GET | `/confirmation-display/:lane_id` | Get order confirmation data for display | Yes |

---

## UI Pages / Components

### Drive-Thru Order Entry — `/pos?mode=drive-thru`
- Same POS order entry but optimized for speed:
  - Larger buttons for frequent items
  - "Quick combos" prominently displayed
  - Auto-suggest popular modifications
  - Car description field (color, vehicle type) for identification
  - Lane indicator
  - Timer showing elapsed time since order started
- "Next Car" button to cycle to new session
- Queue view: Cars in lane with status indicators

### Drive-Thru Dashboard — `/drive-thru`
- **Live metrics:**
  - Current cars in lane (count)
  - Average total time (rolling 30-min window)
  - Average order-taking time
  - Average payment time
  - Average handoff time
- **Target indicators:** Green (under target), Yellow (at target), Red (over target)
- **Queue visualization:** Lane diagram showing car positions and wait times
- **Hourly trend chart:** Cars served per hour, avg time per hour

### Confirmation Display — `/drive-thru/confirm/:lane_id` (customer-facing)
- Shows order items as they're entered (real-time via SSE)
- Running total
- "Please verify your order" message
- Large, clear font for outdoor visibility
- Branded with restaurant logo

### Menu Board Management — `/admin/drive-thru/menu-boards`
- Schedule editor: Assign menu content to time slots
- Daypart auto-swap: Breakfast menu 5AM-11AM, lunch menu 11AM-4PM, dinner 4PM-close
- Promotional content scheduling: Insert promo images during specific times
- Preview of what the board shows at any given time

### Line-Busting Mode — `/pos?mode=line-bust`
- Mobile-optimized POS for handheld devices (iPad mini)
- Walk-to-car order taking during peak times
- Same menu entry as regular POS
- Creates drive-thru order linked to lane/position
- Order appears at payment window when car arrives

---

## Business Rules

1. **Session tracking:** A drive-thru session represents one car's journey: arrival → order taken → payment → handoff. Each phase is timestamped. Total time = handoff_at - order_taken_at. This granular tracking enables bottleneck identification.

2. **Speed targets:**
   - Total time target: Configurable (industry standard: 180 seconds / 3 minutes)
   - Order-taking target: 60 seconds
   - Payment target: 30 seconds
   - Handoff target: 30 seconds
   - Targets displayed with color coding on dashboard

3. **Menu board daypart scheduling:** Digital menu boards automatically swap content based on time of day. The system uses the location's timezone and daypart schedules (from Menu module) to determine which categories to display. Priority levels allow promotional content to override standard menus during specific windows.

4. **Confirmation display:** As the order taker adds items, they appear in real-time on the customer-facing confirmation display via SSE. This reduces errors by allowing the customer to verify before the order is sent.

5. **Line-busting:** During peak times, staff with handheld devices walk the drive-thru line taking orders from cars before they reach the order point. The order is pre-entered and linked to the car (by description). When the car reaches the payment window, the order is already in the system — payment only.

6. **Multi-lane support:** Locations with multiple drive-thru lanes manage each independently. Orders route to kitchen from any lane. Payment windows can serve multiple lanes.

7. **Drive-thru orders on KDS:** Drive-thru orders appear on KDS with a "DRIVE-THRU" badge and lane indicator. They may have priority routing during peak hours (configurable).

8. **Peak detection:** The system tracks queue length over time. When queue exceeds a configurable threshold (e.g., 8 cars), it triggers alerts: suggest activating line-busting, alert manager of staffing need.

9. **Order accuracy tracking:** Future enhancement — track remakes and corrections tied to drive-thru sessions to correlate speed with accuracy.

10. **Car identification:** Vehicle descriptions (color + type) help the handoff window identify which order belongs to which car, especially when cars change lanes or arrive out of order.

---

## Dependencies

- **01_auth** — Authentication
- **02_menu** — Menu data, daypart schedules for menu boards
- **03_orders** — Order creation (`order_type = 'drive_thru'`)
- **04_payments** — Payment processing at window
- **06_kds** — Kitchen ticket routing with drive-thru priority
- **10_settings** — Location config, speed targets

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `drive_thru.car_arrived` | `events.drive_thru` | `{session_id, lane_id}` | New car enters lane |
| `drive_thru.order_taken` | `events.drive_thru` | `{session_id, order_id, elapsed}` | Order completed for car |
| `drive_thru.payment_done` | `events.drive_thru` | `{session_id, elapsed}` | Payment processed |
| `drive_thru.handoff_done` | `events.drive_thru` | `{session_id, total_time}` | Order handed off |
| `drive_thru.queue_alert` | `events.drive_thru` | `{lane_id, queue_length}` | Queue exceeds threshold |
| `confirmation.item_added` | `events.drive_thru` | `{lane_id, item}` | Item added (for confirmation display) |

### Subscribed Events
| Event | Action |
|-------|--------|
| `order.sent` | Update session status, start kitchen timer |
| `kds.order_bumped` | Update session — order ready for handoff |
| `menu.updated` | Refresh menu board content if affected |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `drive_thru_metrics_agg` | Every 15 minutes | Aggregate session data into `drive_thru_metrics` |
| `menu_board_daypart_check` | Every 1 minute | Check if menu board content needs to swap for daypart |
| `stale_session_cleanup` | Every 30 minutes | Close sessions that have been open > 30 minutes (car left) |
| `peak_detection` | Every 5 minutes | Check queue lengths, trigger peak alerts |

---

## Acceptance Criteria

### Lane Management
- [ ] Manager can create and configure drive-thru lanes
- [ ] Each lane can be toggled active/inactive
- [ ] Confirmation display and menu board assignment per lane

### Session Tracking
- [ ] New drive-thru session created when car arrives
- [ ] Each phase timestamped (order, payment, handoff)
- [ ] Total time calculated from timestamps
- [ ] Sessions linked to orders

### Speed Metrics
- [ ] Live dashboard shows current avg times per phase
- [ ] Color coding against configurable targets (green/yellow/red)
- [ ] Hourly trend chart shows throughput
- [ ] Historical metrics aggregated per hour and per day

### Confirmation Display
- [ ] Items appear on confirmation display in real-time as entered
- [ ] Running total displayed
- [ ] Display is customer-facing optimized (large font, branded)

### Menu Boards
- [ ] Menu board content scheduled by daypart
- [ ] Automatic content swap at daypart boundaries
- [ ] Promotional content can override during specific windows
- [ ] Preview shows current board state

### Line-Busting
- [ ] Line-bust mode on mobile device creates drive-thru orders
- [ ] Pre-entered orders available at payment window
- [ ] Car description links order to car in lane

### Peak Management
- [ ] Queue length tracked and displayed
- [ ] Alert triggered when queue exceeds threshold
- [ ] Line-busting recommendation during peak
