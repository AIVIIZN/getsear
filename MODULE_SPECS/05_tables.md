# Module 05: Table & Floor Plan Management

## Overview

The Tables module manages the visual floor plan, table status tracking, server section assignments, and real-time table state synchronization. It provides the spatial awareness layer that connects physical restaurant layout to the POS system.

**Who uses it:** Hosts use the floor plan to seat guests and manage the waitlist. Servers see their assigned sections. Managers view the full floor status. The system updates table states as orders progress.

**Why it matters:** Table management drives service flow. A host needs to see which tables are available, which are occupied, and which are about to turn. Server section assignments ensure balanced workload. Real-time sync means every terminal shows the same state.

---

## Database Tables

- **`floor_plans`** — Floor plan canvases. Fields: `location_id`, `name` (Main Dining, Patio, Bar Area), `sort_order`, `is_active`, `canvas_width` (default 1200), `canvas_height` (default 800), `background_image_url`.
- **`tables`** — Individual tables. Fields: `floor_plan_id`, `name` (T1, B3, P12), `capacity`, `shape` (rectangle, circle, square), `pos_x`, `pos_y`, `width`, `height`, `rotation` (degrees), `status` (available, seated, ordered, served, check_presented, dirty), `current_order_id`, `current_server_id`, `seated_at`, `is_active`, `section` (A, B, Patio, Bar).
- **`orders`** — (Shared) Orders reference `table_id`.

### New Tables (for rebuild)

- **`table_history`** — Turn history for speed-of-service. Fields: `id`, `org_id`, `table_id`, `order_id`, `server_id`, `seated_at`, `first_order_at`, `served_at`, `check_presented_at`, `cleared_at`, `guest_count`, `total_amount`, `turn_time_minutes`, `created_at`.
- **`server_sections`** — Persistent section assignments. Fields: `id`, `org_id`, `location_id`, `floor_plan_id`, `user_id`, `section_name`, `shift_date`, `is_active`, `created_at`.

---

## API Routes

### Blueprint: `/api/v1/tables/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | List all tables with current status (for location) | Yes |
| GET | `/floor-plans` | List floor plans for location | Yes |
| GET | `/floor-plans/:id` | Get floor plan with all its tables | Yes |
| POST | `/floor-plans` | Create floor plan | Manager+ |
| PUT | `/floor-plans/:id` | Update floor plan (name, canvas size, background) | Manager+ |
| DELETE | `/floor-plans/:id` | Deactivate floor plan | Manager+ |
| POST | `/` | Create table | Manager+ |
| PUT | `/:id` | Update table (name, capacity, shape, position) | Manager+ |
| DELETE | `/:id` | Deactivate table | Manager+ |
| POST | `/:id/seat` | Seat guests at table (sets status, guest count, server) | Yes |
| POST | `/:id/clear` | Clear table (mark available after bussing) | Yes |
| PUT | `/:id/status` | Update table status manually | Yes |
| GET | `/:id/history` | Get table turn history | Yes |
| GET | `/sections` | Get server section assignments | Yes |
| PUT | `/sections` | Update server section assignments | Manager+ |
| GET | `/status-summary` | Aggregate status counts for dashboard | Yes |
| POST | `/:id/merge` | Merge two adjacent tables | Manager+ |
| POST | `/:id/split` | Split a merged table back | Manager+ |

---

## UI Pages / Components

### Floor Plan View — `/tables`
- **Visual canvas** showing all tables as positioned shapes (rectangles, circles, squares)
- **Color-coded status:**
  - Green: Available
  - Blue: Seated (order not yet placed)
  - Orange: Ordered (food being prepared)
  - Yellow: Served (food delivered, waiting for payment)
  - Purple: Check Presented
  - Red: Dirty (needs bussing)
- **Table labels:** Table name, guest count, server initials, time seated (timer)
- **Floor plan tabs** across top (Main Dining, Patio, Bar Area)
- **Tap table:** Opens detail popover with: guest count, server name, order summary, time seated, action buttons (view order, move, clear)
- **Section highlighting:** Toggle to color tables by assigned server section
- **Stale table alerts:** Tables seated > configurable threshold flash or show warning badge

### Floor Plan Editor (Manager Mode) — `/tables?edit=true`
- **Edit mode toggle** to enter layout editing
- **Drag tables** to reposition on canvas
- **Resize tables** via drag handles
- **Add table:** Select shape, enter name and capacity, click to place
- **Delete table:** Select and delete (with confirmation)
- **Section assignment:** Select tables and assign to section (A, B, C, Patio, etc.)
- **Grid snap** for alignment
- **Background image upload** for floor plan reference
- **Save layout** button persists all positions

### Table Detail Popover (component)
- Current status badge
- Guest count
- Server name
- Order summary (items, subtotal)
- Time seated with elapsed timer
- Action buttons: View Order, Clear Table, Transfer Server, Move Order

---

## Business Rules

1. **Table status lifecycle:**
   ```
   available → seated → ordered → served → check_presented → dirty → available
   ```
   Status transitions are triggered by order events and manual actions.

2. **Auto-status updates:**
   - `available → seated`: When `POST /:id/seat` is called
   - `seated → ordered`: When first order is sent to kitchen for this table
   - `ordered → served`: When all items on the order are marked `is_served`
   - `served → check_presented`: When payment screen is opened for this table's order
   - Any → `dirty`: When table is cleared but not yet bussed
   - `dirty → available`: When `POST /:id/clear` is called (or auto after configurable delay)

3. **Server sections:** Sections are named areas (A, B, Patio, Bar) assigned per shift. When a table in a section is seated, the assigned server is auto-suggested. Sections can be reassigned mid-shift by a manager.

4. **Table merge:** Two adjacent tables can be combined into one large party table. The merged table gets a combined name (e.g., "T1+T2"), combined capacity, and a single order. Splitting reverses this.

5. **Stale table alerts:** Tables occupied longer than a configurable threshold (default: 90 minutes for dine-in, 45 minutes for bar) display a visual warning. An SSE event is published for manager notification.

6. **Table history / turn tracking:** Every seat-to-clear cycle creates a `table_history` record with timestamps and financials. This feeds the speed-of-service and table turn reports.

7. **Multi-floor-plan support:** Each location can have multiple floor plans (Main Dining, Patio, Bar, Private Room). Each floor plan has its own canvas and tables. Floor plan tabs allow switching between views.

8. **Real-time sync:** Table status changes broadcast via SSE to all terminals. Every terminal showing the floor plan updates within 1 second.

9. **Guest count tracking:** `guest_count` is set at seating time and stored on both the table and the order. Used for covers-based reporting and auto-gratuity triggers.

10. **Table name uniqueness:** Table names must be unique within a floor plan.

---

## Dependencies

- **01_auth** — Authentication, manager+ for layout editing
- **03_orders** — Order-to-table linkage, status triggers
- **07_staff** — Server assignments for sections
- **10_settings** — Location config for stale table thresholds

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `table.status_changed` | `events.tables` | `{table_id, status, server_id, guest_count, order_id}` | Any status change |
| `table.seated` | `events.tables` | `{table_id, guest_count, server_id}` | Guests seated |
| `table.cleared` | `events.tables` | `{table_id}` | Table cleared/available |
| `table.stale_alert` | `events.tables` | `{table_id, minutes_occupied}` | Table exceeds time threshold |
| `sections.updated` | `events.tables` | `{location_id, sections}` | Section assignments changed |

### Subscribed Events
| Event | Action |
|-------|--------|
| `order.sent` | Update table status to `ordered` |
| `order.all_served` | Update table status to `served` |
| `payment.started` | Update table status to `check_presented` |
| `order.closed` | Auto-transition table to `dirty` |
| `order.table_moved` | Update old table (clear) and new table (update order ref) |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `stale_table_check` | Every 5 minutes | Check for tables exceeding occupancy threshold, publish alerts |
| `auto_clear_dirty` | Every 10 minutes | Auto-clear tables in `dirty` status longer than threshold (configurable, default 15 min) |
| `table_turn_aggregation` | Daily at 3 AM | Aggregate `table_history` into daily avg turn times for reporting |

---

## Acceptance Criteria

### Floor Plan Display
- [ ] Floor plan renders with all tables in correct positions, shapes, and sizes
- [ ] Tables are color-coded by status (green/blue/orange/yellow/purple/red)
- [ ] Table labels show name, guest count, server initials, and elapsed time
- [ ] Floor plan tabs switch between multiple floor plans
- [ ] Floor plan updates in real-time via SSE (under 1 second)

### Floor Plan Editor
- [ ] Manager can enter edit mode to rearrange tables
- [ ] Tables can be dragged to new positions
- [ ] Tables can be resized
- [ ] New tables can be added with shape, name, and capacity
- [ ] Tables can be deleted (with confirmation)
- [ ] Layout changes persist on save
- [ ] Grid snap aids alignment

### Table Operations
- [ ] Host can seat guests at a table (sets status, count, server)
- [ ] Status auto-transitions through order lifecycle
- [ ] Table can be manually cleared after bussing
- [ ] Table can be manually set to any valid status

### Server Sections
- [ ] Manager can assign tables to named sections
- [ ] Manager can assign servers to sections for a shift
- [ ] Section view highlights tables by color per section
- [ ] Seating a table in a section auto-suggests the assigned server

### Table Merge/Split
- [ ] Manager can merge two tables into a combined party table
- [ ] Merged table shows combined name and capacity
- [ ] Manager can split a merged table back to individual tables

### Table History
- [ ] Each seat-to-clear cycle creates a `table_history` record
- [ ] History includes timestamps for seated, ordered, served, cleared
- [ ] Table turn time is calculated from history records
- [ ] Table history is viewable per table

### Stale Table Alerts
- [ ] Tables occupied beyond threshold display visual warning
- [ ] SSE alert published for stale tables
- [ ] Threshold is configurable per location

### Real-Time Sync
- [ ] Table status changes on one terminal reflect on all other terminals within 1 second
- [ ] Multiple users viewing the floor plan see consistent state
