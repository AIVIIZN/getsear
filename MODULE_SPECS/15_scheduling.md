# Module 15: Staff Scheduling

## Overview

The Scheduling module enables managers to create, publish, and manage employee work schedules. It integrates with the time clock for actual-vs-scheduled comparison and provides labor cost forecasting to keep staffing levels aligned with projected revenue.

**Who uses it:** Managers create and publish schedules. Staff view their upcoming shifts, submit availability, and request shift swaps. Owners review labor cost projections.

**Why it matters:** Labor is the largest controllable cost. Overstaffing wastes money; understaffing degrades service. Scheduling tools reduce manager time spent on schedules by 80% and cut labor costs by 2-5% through better alignment with demand.

---

## Database Tables

### Existing Tables

- **`schedule_templates`** — Reusable schedule templates. Fields: `location_id`, `name` (Default Week, Holiday Week), `is_active`.
- **`scheduled_shifts`** — Individual shift assignments. Fields: `location_id`, `template_id`, `user_id`, `role` (user_role enum), `shift_date`, `start_time`, `end_time`, `status` (scheduled, confirmed, swap_requested, swapped, called_out, no_show), `notes`, `published_at`.
- **`shift_swap_requests`** — Swap requests. Fields: `scheduled_shift_id`, `requested_by`, `swap_with_user_id` (null = open swap), `status` (pending, approved, denied, taken), `approved_by`.
- **`availability`** — Staff availability windows. Fields: `user_id`, `day_of_week`, `start_time`, `end_time`, `is_available`, `effective_date`, `expiration_date`.
- **`time_entries`** — (Shared with Staff module) Actual clock in/out for comparison.
- **`users`** — (Shared) Staff records with `hourly_rate` and `role`.

### New Tables

- **`schedule_weeks`** — Published schedule periods. Fields: `id`, `org_id`, `location_id`, `week_start_date`, `status` (draft, published, locked), `published_at`, `published_by`, `total_scheduled_hours`, `total_projected_labor_cost`, `notes`, `created_at`.
- **`schedule_notes`** — Manager notes per day. Fields: `id`, `schedule_week_id`, `note_date`, `note_text`, `created_by`, `created_at`.

---

## API Routes

### Blueprint: `/api/v1/scheduling/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/weeks` | List schedule weeks (filter: date range, status) | Yes |
| POST | `/weeks` | Create new schedule week | Manager+ |
| GET | `/weeks/:id` | Get schedule week with all shifts | Yes |
| PUT | `/weeks/:id` | Update schedule week | Manager+ |
| POST | `/weeks/:id/publish` | Publish schedule (notify staff) | Manager+ |
| POST | `/weeks/:id/copy` | Copy schedule to a new week | Manager+ |
| GET | `/shifts` | List shifts (filter: week, user, role, date) | Yes |
| POST | `/shifts` | Create shift | Manager+ |
| PUT | `/shifts/:id` | Update shift | Manager+ |
| DELETE | `/shifts/:id` | Delete shift | Manager+ |
| POST | `/shifts/bulk` | Bulk create shifts (from template) | Manager+ |
| GET | `/templates` | List schedule templates | Manager+ |
| POST | `/templates` | Create template | Manager+ |
| PUT | `/templates/:id` | Update template | Manager+ |
| POST | `/templates/:id/apply` | Apply template to a week | Manager+ |
| GET | `/availability` | Get staff availability (filter: user, date range) | Yes |
| PUT | `/availability` | Update own availability | Yes |
| POST | `/swap-requests` | Request a shift swap | Yes |
| GET | `/swap-requests` | List pending swap requests | Manager+ |
| PUT | `/swap-requests/:id` | Approve/deny swap request | Manager+ |
| POST | `/swap-requests/:id/take` | Take an open swap | Yes |
| GET | `/labor-forecast` | Projected labor cost for a schedule | Manager+ |
| GET | `/comparison` | Scheduled vs actual hours comparison | Manager+ |

---

## UI Pages / Components

### Schedule View — `/admin/scheduling`
- **Week view (primary):** Columns = days (Mon-Sun), rows = staff members. Shift blocks show start-end times, role badge. Color-coded by role.
- **Day view:** Single day with all shifts, showing coverage levels per hour.
- **Date navigation:** Previous/next week, date picker, "This Week" button
- **Staff list (left sidebar):** Names with availability indicators (green = available, red = unavailable, yellow = partial)
- **Drag-and-drop:** Drag shifts to reassign or reschedule. Drag edges to adjust times.
- **Coverage chart:** Bottom bar showing staffed hours per role vs demand (based on historical sales data by hour)
- **Labor cost preview:** Running total of projected labor cost for the week as shifts are added

### Shift Creation
- Select staff member (with availability overlay)
- Set date, start time, end time
- Assign role (if multi-role employee)
- Add notes
- Recurring option: "Repeat weekly" checkbox

### Template Manager
- Save current week as template
- Apply template to a new week (pre-fills shifts, user selects which staff)
- Multiple templates per location (Default, Holiday, Summer)

### Staff Availability — `/admin/scheduling/availability`
- Grid: Days of week as columns, staff as rows
- Each cell shows available time windows
- Staff can self-edit their own availability
- Manager can view all staff availability for planning

### Swap Requests — `/admin/scheduling/swaps`
- List of pending requests: Who wants to swap, which shift, proposed swap partner (or open)
- Approve/Deny buttons
- Open swaps visible to eligible staff who can "Take" them

### My Schedule (Staff View) — `/my-schedule`
- Personal upcoming shifts in list or calendar view
- Shift details: Date, time, role, location, notes
- "Request Swap" button per shift
- Availability editor for setting recurring availability
- Push/SMS notification when schedule is published

### Labor Forecast — `/admin/scheduling/forecast`
- Projected labor cost vs projected revenue (from historical data)
- Target labor percentage line
- Cost breakdown by role
- Overtime warnings (staff approaching 40 hours)
- Understaffing/overstaffing indicators per hour

---

## Business Rules

1. **Availability enforcement:** When creating a shift, the system warns (but does not block) if the assigned staff member is marked as unavailable during that time. The manager can override.

2. **Overtime projection:** As shifts are added, the system tallies weekly hours per employee and warns when approaching overtime threshold (default: 40 hours). The labor forecast shows overtime cost impact.

3. **Schedule publishing:** Schedules are created in `draft` state. Publishing sends notifications to all assigned staff (SMS via Twilio and/or push). Once published, the schedule is visible to staff on their "My Schedule" view.

4. **Shift swap flow:**
   - Employee requests swap (specifies partner or leaves open)
   - If partner specified: Partner receives notification and can accept/decline
   - If open: All eligible staff at that location can volunteer
   - Manager approves the swap
   - Shift assignment updates
   - Both parties notified

5. **Template application:** Applying a template to a week copies the shift patterns but requires staff assignment (since different staff may work each week). The manager assigns staff from a dropdown that shows availability.

6. **Labor cost calculation:** `projected_cost = sum(shift_hours * employee_hourly_rate)` for all shifts in the week. Overtime hours use 1.5x rate. This is projected, not actual.

7. **Scheduled vs actual comparison:** After the week completes, a comparison report shows: scheduled hours vs actual hours (from time_entries), per employee and per role. Helps identify clock-in variance and scheduling accuracy.

8. **Recurring shifts:** A shift can be marked as recurring (weekly). The system auto-generates the shift for subsequent weeks until the recurrence is stopped.

9. **Integration with time clock:** When a staff member clocks in, the system checks if they have a scheduled shift. If not, the clock-in proceeds but the entry is flagged as "unscheduled." If the clock-in time differs from the scheduled time by more than a configurable buffer (default: 15 minutes), it's flagged as "late" or "early."

10. **Minimum rest between shifts:** The system warns if a shift is scheduled less than configurable hours (default: 8) after the employee's previous shift end time ("clopening" detection).

---

## Dependencies

- **01_auth** — Authentication, role-based access
- **07_staff** — Staff records, hourly rates, time entries
- **09_reports** — Historical sales data for demand forecasting
- **10_settings** — Location config, overtime rules
- **External: Twilio** — SMS notifications for schedule publishing

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `schedule.published` | `events.staff` | `{week_id, location_id, week_start}` | Schedule published to staff |
| `shift.swap_requested` | `events.staff` | `{swap_id, shift_id, requested_by}` | New swap request |
| `shift.swap_approved` | `events.staff` | `{swap_id, shift_id}` | Swap approved |

### Subscribed Events
| Event | Action |
|-------|--------|
| `staff.clocked_in` | Check against scheduled shift, flag variance |
| `staff.clocked_out` | Update scheduled vs actual comparison |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `publish_reminder` | Daily at 9 AM (Mon) | Remind managers to publish next week's schedule if still draft |
| `shift_reminder` | Daily at 8 PM | SMS reminder to staff of tomorrow's shifts |
| `recurring_shift_generation` | Weekly (Sunday midnight) | Auto-generate recurring shifts for the next week |
| `scheduled_vs_actual_report` | Weekly (Monday 3 AM) | Calculate scheduled vs actual hours for the completed week |

---

## Acceptance Criteria

### Schedule Creation
- [ ] Manager can create a schedule week and add shifts
- [ ] Shifts show on week view with drag-and-drop editing
- [ ] Labor cost preview updates as shifts are added/modified
- [ ] Overtime warnings appear when employee approaches threshold
- [ ] Availability indicators show when assigning shifts

### Publishing
- [ ] Manager can publish a draft schedule
- [ ] Staff receive notification (SMS) when schedule is published
- [ ] Published schedules visible on staff "My Schedule" view

### Templates
- [ ] Manager can save current week as template
- [ ] Manager can apply template to a new week
- [ ] Template shifts can be individually adjusted after application

### Swap Requests
- [ ] Staff can request a shift swap (with partner or open)
- [ ] Open swaps visible to eligible staff
- [ ] Manager can approve/deny swap requests
- [ ] Approved swaps update shift assignments and notify both parties

### Availability
- [ ] Staff can set recurring availability (days/times)
- [ ] Manager can view all staff availability on a grid
- [ ] Availability conflicts shown as warnings during shift creation

### Labor Forecast
- [ ] Projected labor cost displayed for the schedule week
- [ ] Overtime cost calculated at 1.5x rate
- [ ] Target labor percentage comparison shown
- [ ] Understaffing/overstaffing indicators per hour

### Scheduled vs Actual
- [ ] Comparison report shows scheduled vs actual hours per employee
- [ ] Variance flagged for late/early/unscheduled clock-ins
- [ ] Report available after week completes
