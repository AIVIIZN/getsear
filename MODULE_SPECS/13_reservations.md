# Module 13: Reservations & Waitlist

## Overview

The Reservations module handles advance table bookings and real-time waitlist management. It includes an online reservation widget, SMS confirmations/reminders, table assignment algorithms, no-show tracking, estimated wait times, and VIP priority handling. It integrates with the Tables module for real-time availability and the Customers module for guest history.

**Who uses it:** Guests book reservations online or by phone. Hosts manage the reservation book and waitlist. Servers see upcoming reservations for their sections. Managers review no-show rates and booking patterns.

**Why it matters:** Reservations smooth demand, reduce wait times, and enable prep planning. No-show tracking identifies unreliable guests. The waitlist feature captures walk-in demand and provides accurate wait estimates, reducing guest abandonment.

---

## Database Tables

### Existing Tables

- **`reservations`** — Reservation records. Fields: `location_id`, `customer_id`, `guest_name`, `guest_phone`, `guest_email`, `party_size`, `reservation_date`, `reservation_time`, `duration_minutes` (default 90), `table_id`, `status` (pending, confirmed, seated, completed, no_show, cancelled), `notes`, `special_requests`, `confirmation_sent_at`, `reminder_sent_at`.
- **`waitlist_entries`** — Walk-in waitlist. Fields: `location_id`, `guest_name`, `guest_phone`, `party_size`, `quoted_wait_minutes`, `position`, `status` (waiting, notified, seated, cancelled, no_show), `notified_at`, `seated_at`, `table_id`, `notes`.
- **`tables`** — (Shared) Table capacity and availability.
- **`customers`** — (Shared) Guest profiles and history.

### New Tables

- **`reservation_settings`** — Per-location reservation config. Fields: `id`, `org_id`, `location_id`, `is_accepting_reservations`, `max_party_size`, `min_advance_hours`, `max_advance_days`, `default_duration_minutes`, `turn_buffer_minutes` (time between seatings), `time_slot_interval_minutes` (15 or 30), `auto_confirm` (boolean), `reminder_hours_before`, `no_show_window_minutes` (grace period), `vip_priority_enabled`, `online_widget_enabled`, `created_at`.
- **`reservation_blocks`** — Blocked times (holidays, private events). Fields: `id`, `org_id`, `location_id`, `block_date`, `start_time`, `end_time`, `reason`, `is_all_day`, `created_at`.
- **`no_show_history`** — Track guest reliability. Fields: `id`, `org_id`, `customer_id`, `guest_phone`, `reservation_id`, `no_show_date`, `created_at`.

---

## API Routes

### Blueprint: `/api/v1/reservations/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | List reservations (filter: date, status, party size) | Yes |
| POST | `/` | Create reservation (staff or online) | Yes (or public widget) |
| GET | `/:id` | Get reservation detail | Yes |
| PUT | `/:id` | Update reservation | Yes |
| DELETE | `/:id` | Cancel reservation | Yes |
| POST | `/:id/seat` | Mark as seated | Yes |
| POST | `/:id/no-show` | Mark as no-show | Yes |
| POST | `/:id/confirm` | Send confirmation SMS/email | Yes |
| POST | `/:id/remind` | Send reminder SMS | Yes |
| GET | `/availability` | Check available time slots (date, party_size) | Public |
| GET | `/waitlist` | Current waitlist | Yes |
| POST | `/waitlist` | Add to waitlist | Yes |
| PUT | `/waitlist/:id` | Update waitlist entry | Yes |
| DELETE | `/waitlist/:id` | Remove from waitlist | Yes |
| POST | `/waitlist/:id/notify` | Notify guest (table ready) | Yes |
| POST | `/waitlist/:id/seat` | Seat from waitlist | Yes |
| GET | `/waitlist/estimate` | Get estimated wait time for party size | Public |

### Public Widget Routes (no auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/widget/:location_slug` | Get reservation widget config |
| GET | `/widget/:location_slug/availability` | Check available slots |
| POST | `/widget/:location_slug/book` | Book reservation from widget |

---

## UI Pages / Components

### Reservation Book (Host View) — `/reservations`
- **Timeline view:** Time slots as rows, tables as columns, reservations as blocks
- **Date navigation:** Previous/next day, date picker, "Today" button
- **Reservation cards:** Guest name, party size, time, table, status badge, special requests icon
- **Color-coded status:** Confirmed (blue), Seated (green), No-show (red), Cancelled (gray)
- **Actions:** Seat, cancel, no-show, edit, send reminder
- **Quick add:** "+ New Reservation" button with inline form
- **VIP indicator:** Star badge for VIP guests
- **No-show history:** Warning icon for guests with prior no-shows

### Waitlist Panel — `/reservations?tab=waitlist`
- Ordered list of waiting parties
- Each entry: Guest name, party size, quoted wait, actual wait time (live counter), phone
- "Notify" button — sends "Your table is ready" SMS
- "Seat" button — assigns table and creates order
- "Cancel" / "No-show" actions
- Estimated wait calculator at top: Enter party size, see estimated wait

### Online Reservation Widget (Guest-Facing) — embeddable
- Date picker
- Party size selector
- Available time slots displayed as tappable buttons
- Guest info form: Name, phone, email, special requests
- Confirmation screen with details and SMS confirmation sent
- Mobile-optimized design
- Brandable with restaurant colors/logo

### Reservation Settings (Back Office) — `/admin/settings` (Reservations tab)
- Accept reservations toggle
- Max party size
- Advance booking window (min/max)
- Default duration and turn buffer
- Time slot intervals (15 or 30 minutes)
- Auto-confirm toggle
- Reminder timing (hours before)
- No-show grace period
- VIP priority toggle
- Online widget enable/disable
- Blocked dates management

---

## Business Rules

1. **Availability calculation:** Available slots are calculated from: (a) total table capacity for the requested party size, (b) existing reservations + duration + turn buffer, (c) blocked times, (d) business hours. The algorithm finds tables that can accommodate the party size and are not reserved during the requested window.

2. **Table assignment algorithm:**
   - Match party size to table capacity (prefer smallest table that fits)
   - For parties larger than any single table, suggest mergeable adjacent tables
   - VIP guests get preferred tables (flagged in table config)
   - Consider server section balance (avoid overloading one section)
   - Manual override always available (host can assign any table)

3. **No-show tracking:** Guests marked as no-show are tracked by phone number. On future reservations, the host sees a no-show count badge. After configurable threshold (default: 3 no-shows), the system can require credit card hold (future feature) or flag for manager review.

4. **SMS notifications (via Twilio):**
   - Confirmation: Sent immediately after booking
   - Reminder: Sent X hours before (configurable, default: 2 hours)
   - Waitlist notification: "Your table is ready! Please check in within 10 minutes."
   - No-show: If guest doesn't arrive within grace period, no-show recorded

5. **Waitlist estimated wait time:** Calculated based on: (a) number of parties ahead in line, (b) average table turn time from `table_history`, (c) available table count for the requested party size. Estimate updates dynamically as tables turn.

6. **VIP priority:** If enabled, VIP guests (from customer tags) are seated before non-VIP guests on the waitlist, regardless of position. The host is notified and can override.

7. **Reservation duration:** Default 90 minutes for full-service, configurable by party size (larger parties get more time). Duration is used for availability calculation — a 7:00 PM reservation for 90 minutes blocks the table until 8:30 PM plus turn buffer.

8. **Turn buffer:** Configurable minutes between seatings (default: 15). This accounts for bussing, resetting, and the next party's arrival.

9. **Cross-reference with customers:** If a reservation phone/email matches an existing customer record, the reservation is linked. Customer preferences, allergens, and VIP status are displayed to the host.

10. **Online widget:** An embeddable JavaScript widget that restaurants can add to their website. It calls the public API for availability and booking. No authentication required for guests.

---

## Dependencies

- **01_auth** — Staff authentication; public routes for widget
- **05_tables** — Table capacity and availability data
- **08_customers** — Customer linkage, VIP status, no-show history
- **10_settings** — Business hours, location config
- **External: Twilio** — SMS confirmations, reminders, and waitlist notifications

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `reservation.created` | `events.reservations` | `{reservation_id, date, time, party_size}` | New reservation booked |
| `reservation.seated` | `events.reservations` + `events.tables` | `{reservation_id, table_id}` | Guest seated |
| `reservation.no_show` | `events.reservations` | `{reservation_id}` | Guest marked no-show |
| `reservation.cancelled` | `events.reservations` | `{reservation_id}` | Reservation cancelled |
| `waitlist.added` | `events.reservations` | `{waitlist_id, party_size, position}` | Guest added to waitlist |
| `waitlist.notified` | `events.reservations` | `{waitlist_id}` | Guest notified table ready |
| `waitlist.seated` | `events.reservations` + `events.tables` | `{waitlist_id, table_id}` | Waitlist guest seated |

### Subscribed Events
| Event | Action |
|-------|--------|
| `table.cleared` | Recalculate waitlist wait times, check next waitlist party |
| `order.closed` | Update table turn time data for wait estimation |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `send_reminders` | Every 15 minutes | Send reminder SMS for upcoming reservations within reminder window |
| `mark_no_shows` | Every 10 minutes | Auto-mark reservations as no-show past grace period |
| `waitlist_time_update` | Every 5 minutes | Recalculate estimated wait times for all waitlist entries |
| `reservation_analytics` | Daily at 3 AM | Aggregate reservation/no-show data for reporting |

---

## Acceptance Criteria

### Reservations
- [ ] Staff can create a reservation with date, time, party size, guest info
- [ ] Available time slots calculated correctly based on table capacity and existing bookings
- [ ] Table auto-assigned based on party size (smallest fitting table)
- [ ] SMS confirmation sent on booking
- [ ] SMS reminder sent at configured time before reservation
- [ ] Staff can mark reservation as seated (updates table status)
- [ ] Staff can mark reservation as no-show
- [ ] No-show count tracked per guest phone number

### Online Widget
- [ ] Widget shows available dates and time slots
- [ ] Guest can book without authentication
- [ ] Guest receives SMS confirmation
- [ ] Widget is brandable with restaurant colors

### Waitlist
- [ ] Staff can add walk-in to waitlist with party size and name
- [ ] Estimated wait time calculated and displayed
- [ ] "Notify" sends SMS to guest when table is ready
- [ ] "Seat" assigns table and creates order
- [ ] Waitlist positions update when parties are seated
- [ ] VIP guests prioritized (if enabled)

### Availability
- [ ] Availability accounts for existing reservations + duration + buffer
- [ ] Blocked dates/times prevent booking
- [ ] Business hours respected
- [ ] Turn buffer prevents back-to-back overbooking

### No-Show Management
- [ ] No-show guests auto-marked after grace period
- [ ] No-show history displayed on future reservations
- [ ] No-show count badge visible to host
