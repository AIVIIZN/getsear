# Module 07: Staff Management

## Overview

The Staff module handles employee lifecycle management, time tracking, and tip distribution. It covers the full employment workflow from onboarding to daily clock-in/out, break tracking, time entry approval, and tip reporting. It integrates with the Auth module for PIN-based login and the Reports module for labor cost analysis.

**Who uses it:** Managers create and manage staff records, approve time entries, and configure tip distribution. Staff members clock in/out via PIN, view their schedules and tip summaries. Owners review labor costs and tip compliance reports.

**Why it matters:** Labor is typically 25-35% of restaurant revenue. Accurate time tracking prevents wage disputes. Proper tip handling ensures IRS compliance (Form 8027). Efficient staffing directly impacts service quality and profitability.

---

## Database Tables

- **`users`** — Employee records. Key fields: `first_name`, `last_name`, `display_name`, `email`, `phone`, `pin_hash` (bcrypt), `role` (user_role enum), `location_ids[]`, `hire_date`, `hourly_rate`, `is_active`, `avatar_url`, `settings` (jsonb), `deleted_at`.
- **`shifts`** — Shift definitions. Fields: `location_id`, `name` (Lunch, Dinner, All Day), `shift_date`, `start_time`, `end_time`, `manager_id`, summary fields (`total_sales`, `total_labor_cost`, `total_comps`, `total_voids`), `is_closed`, `closed_by`, `closed_at`, `notes`.
- **`time_entries`** — Clock in/out records. Fields: `user_id`, `location_id`, `shift_id`, `clock_in`, `clock_out`, `role_during_shift`, `hourly_rate`, calculated fields (`regular_hours`, `overtime_hours`, `total_pay`), tip fields (`cash_tips`, `credit_tips`, `tip_out_given`, `tip_out_received`), `is_approved`, `approved_by`, `notes`.
- **`break_entries`** — Break tracking. Fields: `time_entry_id`, `break_type` (paid, unpaid), `start_time`, `end_time`, `duration_minutes`.
- **`permissions`** / **`role_permissions`** / **`user_permission_overrides`** — (Shared with Auth)

### New Tables (for rebuild)

- **`tip_pool_configs`** — Tip pool distribution rules. Fields: `id`, `org_id`, `location_id`, `name` (e.g., "Standard Pool", "Bar Pool"), `pool_type` (percentage, points), `is_active`, `config` (jsonb: role percentages or point values), `created_at`.
- **`tip_distributions`** — Individual tip distribution records. Fields: `id`, `org_id`, `location_id`, `shift_date`, `pool_config_id`, `total_pool_amount`, `distribution_data` (jsonb: array of {user_id, amount, method}), `distributed_by`, `distributed_at`, `created_at`.

---

## API Routes

### Blueprint: `/api/v1/staff/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | List staff members (filter: role, location, active) | Manager+ |
| POST | `/` | Create staff member | Manager+ |
| GET | `/:id` | Get staff member detail | Manager+ (or self) |
| PUT | `/:id` | Update staff member | Manager+ |
| DELETE | `/:id` | Deactivate staff member (soft delete) | Admin+ |
| POST | `/clock-in` | Clock in via PIN | Yes (PIN auth) |
| POST | `/clock-out` | Clock out | Yes |
| POST | `/break/start` | Start break | Yes |
| POST | `/break/end` | End break | Yes |
| GET | `/time-entries` | List time entries (filter: date range, user, location) | Manager+ (or own) |
| PUT | `/time-entries/:id` | Edit time entry (manager correction) | Manager+ |
| POST | `/time-entries/:id/approve` | Approve time entry | Manager+ |
| GET | `/on-duty` | List currently clocked-in staff | Yes |
| GET | `/tips` | Tip summary for period (filter: date range, user) | Manager+ (or own) |
| POST | `/tip-pool/distribute` | Distribute tip pool for a shift | Manager+ |
| GET | `/tip-pool/configs` | List tip pool configurations | Manager+ |
| POST | `/tip-pool/configs` | Create tip pool config | Manager+ |
| PUT | `/tip-pool/configs/:id` | Update tip pool config | Manager+ |

---

## UI Pages / Components

### Staff Manager (Back Office) — `/admin/staff`
- **Staff list:** Table of all employees with name, role, location(s), status, hire date
- **Search/filter:** By name, role, location, active/inactive
- **Staff detail panel (right side or modal):**
  - Profile: Name, email, phone, avatar upload
  - Employment: Role, locations, hire date, hourly rate
  - PIN: Set/reset PIN (manager action)
  - Permissions: View role defaults, set per-user overrides
  - Time entries: Recent clock in/out history
  - Tip summary: Tips earned this pay period
- **Create staff form:** All profile and employment fields
- **Deactivate:** Soft delete with confirmation (preserves historical data)

### Time Clock — `/clock` (PIN login screen variant)
- PIN numpad entry
- Clock in: Shows current time, role selection (if multi-role), location confirmation
- Clock out: Shows hours worked today, tip entry prompt
- Break start/end: Buttons when clocked in
- On-duty display: List of currently clocked-in staff

### Time Entry Management — `/admin/staff/time-entries`
- Date range picker
- Table of time entries: Employee, date, clock in/out, hours, breaks, tips, status (pending/approved)
- Edit: Manager can modify clock in/out times (with reason, creates audit trail)
- Approve: Checkbox or bulk approve for the period
- Unapproved entries highlighted

### Tip Distribution — `/admin/staff/tips`
- Select shift/date for distribution
- Shows total tip pool (credit tips from closed orders)
- Distribution method selector (direct to server, pool by percentage, pool by points)
- Preview distribution amounts per staff member
- Confirm and distribute button
- History of past distributions

---

## Business Rules

### Time Tracking

1. **Clock in via PIN:** Staff enter their PIN to clock in. System records `clock_in` timestamp, location, and role for this shift. If the employee has multiple roles, they select which role they are working.

2. **Clock out:** Records `clock_out` timestamp. Calculates `regular_hours` and `overtime_hours` (overtime rules configurable per location — federal default is >40 hours/week, some states have daily overtime rules like CA >8 hours/day).

3. **Break tracking:** Breaks are categorized as paid or unpaid. Unpaid breaks are deducted from total hours. Break enforcement is configurable (e.g., require 30-min break for shifts >6 hours).

4. **Time entry approval:** Managers review and approve time entries before payroll export. Edited entries maintain an audit trail of the original and modified values.

5. **Overtime calculation:** Configurable per location. Standard: >40 hours/week at 1.5x rate. California: >8 hours/day at 1.5x, >12 hours/day at 2x. System tracks both weekly and daily hours.

6. **Auto clock-out:** If a staff member forgets to clock out, the system auto-clocks them out at a configurable threshold (default: 12 hours after clock-in) and flags the entry for manager review.

### Tip Management

7. **Tip types:**
   - **Cash tips:** Self-reported by server at clock-out or shift end
   - **Credit tips:** Tracked automatically from card payment tip amounts
   - **Tip-out given:** Amount server tips out to support staff (bussers, food runners, bartenders)
   - **Tip-out received:** Amount support staff receives from tip-out pool

8. **Tip distribution models:**
   - **Direct:** Tips go to the serving employee. No pool.
   - **Percentage pool:** Tips pooled and distributed by role percentage (e.g., servers 70%, bartenders 15%, bussers 10%, food runners 5%)
   - **Points pool:** Each role has point values. Total pool divided by total points, multiplied by individual points.

9. **Auto-gratuity treatment:** Auto-gratuity (for large parties) is treated as a service charge (revenue), NOT a tip. It does not enter the tip pool unless the restaurant explicitly directs it there. This is the IRS-correct treatment.

10. **Form 8027 compliance:** Restaurants with >10 tipped employees must file Form 8027 annually. The system tracks: total food & beverage charged receipts, total charged tips, and allocated tips. The report is generated via the Reports module.

11. **Tip credit states:** In states with no tip credit (e.g., California), the system ensures tipped employees are paid full minimum wage before tips. The `hourly_rate` on the time entry must meet state minimum.

### Employee Management

12. **PIN uniqueness:** Enforced within the organization. System rejects duplicate PINs.

13. **Multi-location staff:** Employees can be assigned to multiple locations via `location_ids[]`. They clock in at whichever location they are working that day.

14. **Role-based defaults:** Each role has default permissions from `role_permissions`. Managers can override per user via `user_permission_overrides` (grant or deny specific permissions).

15. **Soft deactivation:** Deactivated staff (`is_active = false`) cannot log in or clock in, but their historical data (orders, time entries, tips) is preserved.

---

## Dependencies

- **01_auth** — PIN management, role/permission system, JWT claims
- **03_orders** — Server assignment on orders, tip data from payments
- **04_payments** — Credit tip amounts from card payments
- **10_settings** — Location config (overtime rules, break requirements, minimum wage)

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `staff.clocked_in` | `events.staff` | `{user_id, location_id, role}` | Clock in |
| `staff.clocked_out` | `events.staff` | `{user_id, location_id, hours}` | Clock out |
| `staff.break_started` | `events.staff` | `{user_id}` | Break start |
| `staff.break_ended` | `events.staff` | `{user_id}` | Break end |
| `staff.tips_distributed` | `events.staff` | `{location_id, shift_date, total}` | Tip pool distributed |

### Subscribed Events
| Event | Action |
|-------|--------|
| `payment.completed` | Update server's credit tip accumulation for current shift |
| `order.closed` | Associate order revenue with serving staff for tip calc |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `auto_clock_out` | Every 30 minutes | Auto clock out entries exceeding max shift hours |
| `break_compliance_check` | Every hour | Alert managers of staff missing required breaks |
| `overtime_alert` | Every 2 hours | Alert managers when staff approach overtime threshold |
| `tip_credit_compliance` | Weekly | Verify tipped employees meet minimum wage after tip credit |

---

## Acceptance Criteria

### Staff CRUD
- [ ] Manager can create a staff member with all profile and employment fields
- [ ] Manager can edit staff member details
- [ ] Manager can deactivate a staff member (soft delete)
- [ ] Manager can assign staff to multiple locations
- [ ] Manager can set/reset staff PIN
- [ ] PIN uniqueness enforced within organization

### Time Tracking
- [ ] Staff can clock in via PIN entry
- [ ] Staff can select role if multi-role
- [ ] Staff can clock out and see hours worked
- [ ] Staff can start/end breaks
- [ ] Unpaid break time deducted from total hours
- [ ] Regular and overtime hours calculated correctly
- [ ] Auto clock-out triggers after configurable threshold
- [ ] On-duty list shows all currently clocked-in staff

### Time Entry Management
- [ ] Manager can view time entries filtered by date, user, location
- [ ] Manager can edit clock in/out times with reason
- [ ] Manager can approve time entries individually or in bulk
- [ ] Edited entries show audit trail of changes
- [ ] Unapproved entries are visually highlighted

### Tip Management
- [ ] Credit tips auto-tracked from card payment tip amounts
- [ ] Staff can report cash tips at clock-out
- [ ] Manager can configure tip pool distribution rules
- [ ] Manager can execute tip pool distribution for a shift
- [ ] Distribution preview shows amount per staff member before confirm
- [ ] Distribution creates `tip_distributions` record
- [ ] Tip summary report shows tips by employee for date range

### Compliance
- [ ] Overtime calculation respects location-specific rules (weekly and daily)
- [ ] Break compliance alerts fire when breaks are missed
- [ ] Form 8027 data tracked (food/bev receipts, charged tips, allocated tips)
- [ ] Tip credit compliance verified for applicable states
