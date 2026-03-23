# Sear POS v4 — Phase 6: Staff & Labor Management Production Depth

**Build Brief (MASTER_TEMPLATE Part 1)**
**Date:** 2026-03-23
**Priority:** HIGH — Week 1
**Estimated Sessions:** 2-3

---

## 1.1 What is this?

A production-depth rebuild of the Sear POS staff and labor management system. The current state has basic CRUD for staff records, clock-in/out endpoints, break start/end endpoints, time entry listing/approval, and tip distribution via a single distribute endpoint. What exists is database-backed but largely invisible — the back-office staff page is a flat table of employees with a side sheet for create/edit, a rudimentary time clock tab, and a basic tip summary. There is no permission configuration UI, no overtime calculation engine, no server checkout flow, no tip pooling configuration, no cash drawer denomination counter, no break compliance tracking, no payroll export, no labor cost forecasting, and no scheduling integration beyond the API scaffolding.

This phase transforms staff management from a CRUD admin page into a complete labor management system that matches Toast's Team Management: per-user permission overrides, real-time overtime tracking with configurable state-specific thresholds, server checkout reports, 4 tip pooling models with visual configuration, denomination-level cash drawer counting, break compliance monitoring with proactive alerts, payroll export for ADP/Gusto/Paychex, labor cost forecasting from schedules, and a shift marketplace with swap request push notifications.

**Read these files BEFORE planning:**
- `CLAUDE.md` — project config, tech stack, naming conventions
- `SEAR_POS_ARCHITECTURE.md` sections: Staff Management Reality (line 1255), Enterprise Staff Management (line 1613), Permission Roles (lines 2450-2650)
- `BUSINESS_RULES.md` section 6: Staff Rules (line 702) — clock in/out, break rules, overtime calculation, tip pool distribution, manager PIN approval
- `UI_DESIGN.md` — design system tokens
- `SCHEMA.md` — shifts, time_entries, break_entries, cash_drawers, cash_drawer_events, tip_distributions, cash_tip_reports, permissions, user_permissions tables; mod.scheduling tables (schedule_templates, scheduled_shifts, shift_swap_requests, staff_availability)
- `API_SPEC.md` section 6: Staff (15 routes) and section: Staff Scheduling (10 routes)


## 1.2 Tech stack

Already built. Do not change:
- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- **Components:** shadcn/ui (heavily customized to match design system)
- **State:** Zustand v5 + Immer
- **Database:** Supabase (PostgreSQL) — shifts, time_entries, break_entries, cash_drawers, tip_distributions, scheduled_shifts tables exist
- **Real-Time:** Supabase Realtime for live on-duty board, break alerts, overtime warnings
- **Background Jobs:** BullMQ v5 + Redis for break compliance alerts, overtime threshold alerts, payroll export generation
- **Icons:** Lucide React
- **Charts:** Recharts (for labor cost forecasting graphs)
- **Forms:** react-hook-form + zod


## 1.3 User roles

Relevant roles for staff and labor management:
- **Owner** (demo@getsear.com / demo1234): full labor control — manage all employees, configure permissions, set pay rates, configure tip pools, run payroll export, view all reports, edit any time entry, manage schedules
- **General Manager**: hire/fire at their location, set schedules, approve time-off, edit timecards, configure tip pools. CANNOT set pay rates above a threshold without owner approval. Cannot create Owner or GM accounts.
- **Assistant Manager**: view schedules, approve clock-in/out adjustments, perform drawer counts. Cannot edit pay rates, cannot create/delete accounts.
- **Shift Lead / MOD**: approve late clock-ins for their shift, count their own drawer. Cannot access other drawers or the safe.
- **Server**: clock in/out (own timecard only), view own tips for current shift, own drawer only. Cannot access reports, labor data, other servers' data.
- **Bartender**: all server functions plus tab management. Own bar drawer.
- **Host, Busser, Line Cook, Expo, Cashier, Delivery Driver**: clock in/out (own timecard only). No access to labor management.
- **Kitchen Manager**: schedule kitchen staff, approve clock-in adjustments for kitchen team. Cannot access FOH labor management.


## 1.4 Pages and features

### Page: Staff Management Hub (Back-Office)
- **Who:** Owner, GM
- **Route:** `/staff` (back-office, rebuild existing page)
- **Layout:** Horizontal tab bar at top with 7 tabs: Roster, Time Clock, Permissions, Tips, Cash Drawers, Schedule, Payroll
- **Tab 1 — Roster:**
  - Table of all staff: Avatar (initials circle), Name, Role (badge), Phone, Email, Hire Date, Status (Active/Inactive badge), Hourly Rate (owner only), Actions (Edit, Deactivate)
  - Filters: Role dropdown (All, Server, Bartender, Host, etc.), Status (Active/Inactive), Search by name
  - "Add Employee" button opens side sheet: First Name, Last Name, Email, Phone, Role (dropdown), Hourly Rate, PIN (4-6 digits, auto-hash with bcrypt), Emergency Contact, Start Date
  - Quick-deactivate: one tap sets `is_active = false`, PIN stops working immediately, confirmation dialog: "Deactivate {name}? Their PIN will stop working immediately."
  - Bulk actions: Select multiple employees, Deactivate, Change Role, Export Selected
  - Employee detail view (click row): profile card with photo/initials, contact info, employment summary (days employed, total hours, avg hours/week), recent time entries, recent tip earnings, permission overrides
- **Empty state:** "No team members yet — add your first employee to get started" with illustration of people, CTA button "Add First Employee"

- **Tab 2 — Time Clock:**
  - Two sections: "On Duty Now" live board (top) and "Time Entry History" table (bottom)
  - **On Duty Board:** Card grid of currently clocked-in employees, each card shows: Name, Role badge, Clocked In time, Hours So Far (live ticker), Break Status (On Break badge with duration), Overtime Warning (amber badge if approaching threshold, red if in OT). Cards sorted by clock-in time.
  - Tap an on-duty card: quick actions dropdown — Start Break, End Break, Clock Out, View Time Entry
  - **Time Entry History:** Date range picker (default: current pay period). Table columns: Date, Employee, Role, Clock In, Clock Out, Regular Hours, OT Hours, Breaks (count + total duration), Tips Declared, Status (Approved/Pending/Edited), Actions (Edit, Approve)
  - Edit time entry: opens modal with original and edited times, requires reason text field. If not a manager, requires Manager PIN. Audit log entry created automatically.
  - Bulk approve: select multiple pending entries, "Approve Selected" button
  - Overtime summary banner at top: "3 employees approaching overtime this week" with expandable list
  - Export time entries as CSV (date range filter applied)
- **Empty state:** "No time entries yet. Employees clock in from the POS terminal or the clock-in button above."

- **Tab 3 — Permissions:**
  - Left column: list of all active employees with role badge
  - Right column: permission matrix for selected employee
  - Permission categories displayed as collapsible accordion sections:
    - **Orders:** void_pre_send, void_post_send, comp, discount, reopen_closed, price_override, transfer_table
    - **Payments:** process_payment, refund, adjust_tip, cash_drawer_no_sale, batch_settle
    - **Menu:** view_menu, edit_menu, edit_prices, manage_modifiers, manage_86
    - **Staff:** view_staff, manage_staff, edit_time_entries, approve_time_entries, manage_schedule
    - **Reports:** view_shift_reports, view_daily_reports, view_labor_reports, view_financial_reports, view_payroll
    - **Settings:** view_settings, edit_location_settings, manage_terminals, manage_printers
  - Each permission shows 3 states: Inherit from Role (default), Grant Override (green check), Deny Override (red X)
  - Role defaults shown in muted text for reference: "Default for Server: Deny"
  - "Reset to Role Defaults" button per employee
  - "Copy Permissions From" dropdown to clone another employee's overrides
  - Changes save immediately (optimistic UI with undo toast)
- **Empty state:** "Select an employee from the list to configure their permissions."

- **Tab 4 — Tips:**
  - Sub-tabs: Distribution, Pool Config, Server Checkout
  - **Distribution sub-tab:**
    - Date picker (default: today)
    - Summary cards: Total Card Tips, Total Cash Tips Declared, Total Auto-Gratuity, Total Pool Amount, Tips Per Labor Hour
    - Distribution table: Employee, Role, Card Tips, Cash Declared, Pool Share, Tip-Out Given, Tip-Out Received, Net Tips
    - "Run Distribution" button: executes tip pool calculation based on configured model, shows preview before committing
    - Distribution preview modal: shows each employee's calculated share with breakdown of formula. Adjustable overrides before commit.
    - "Undo Last Distribution" button (within 2 hours of running)
  - **Pool Config sub-tab:**
    - 4 tip pool models displayed as selectable cards with visual diagram:
      1. **Direct** — Server keeps 100% of their tips. Diagram shows single arrow from tips to server.
      2. **Tip-out by % of Sales** — Configurable percentage per role. Fields: Busser % (default 3%), Bar % (default 1%), Runner % (default 1%). Diagram shows server with arrows splitting to support roles.
      3. **Tip Pool by Hours** — All tips pooled, split proportionally by hours worked. Eligible roles checkboxes. Diagram shows pool bucket distributing to employees by hour weight.
      4. **Hybrid (Points)** — Each role has a point value. Fields: Server points (default 10), Bartender points (default 8), Busser points (default 5), Runner points (default 3), Host points (default 2). Diagram shows pool with weighted distribution.
    - Active model highlighted with primary color border
    - "Processing fee deduction" toggle with percentage field (default 2.49%) — deducts card processing fee from card tips before pooling
    - Tip pool eligible roles: checkbox list of all roles. Default: FOH only. FLSA warning banner: "Managers and owners cannot participate in tip pools under federal law."
    - BOH inclusion toggle with legal disclaimer: "Including back-of-house staff in tip pools is only legal if the employer does not take a tip credit."
    - Preview calculator: enter hypothetical total tips + staff hours → see distribution breakdown
  - **Server Checkout sub-tab:**
    - Designed for end-of-shift checkout flow. Select employee from dropdown.
    - Checkout report card:
      - **Sales Summary:** Net Sales, Total Checks, Average Check, Guest Count
      - **Tip Summary:** Card Tips Earned, Auto-Gratuity, Cash Tips Declared (editable field for declaration), Tip-Out Owed (calculated from pool config), Tip-Out Received, Net Tips
      - **Cash Owed:** Starting Cash + Cash Sales Received - Cash Tips Kept - Tip-Out Paid in Cash = Cash Due to House
      - **Denomination Breakdown** of cash owed (for making change)
    - "Declare Cash Tips" field — server enters amount, saved to cash_tip_reports table
    - "Complete Checkout" button: records tip declaration, calculates tip-out, closes time entry, prints checkout slip
    - Print button: generates formatted checkout report for receipt printer

- **Tab 5 — Cash Drawers:**
  - List of all drawers: Name, Terminal, Status (Open/Closed badge), Assigned To, Opened At, Expected Cash, Over/Short
  - Tap drawer to open detail view:
    - Event log: timestamp, event type, amount, running total, who performed
    - Open Drawer: assigns to employee, starting cash amount with denomination counter
    - Close Drawer: denomination counter for actual cash, system calculates expected, shows over/short
  - **Denomination Counter UI (used for open and close):**
    - Grid of US currency denominations: $100, $50, $20, $10, $5, $1, Quarters ($0.25), Dimes ($0.10), Nickels ($0.05), Pennies ($0.01)
    - Each denomination: label, quantity input (number stepper), subtotal (auto-calculated)
    - Running total at bottom, large font
    - For close: shows Expected amount, Actual amount (from counter), Over/Short (green if over, red if short, with absolute value)
    - Over/short threshold alert: if |over_short| > $5.00 (configurable), requires manager acknowledgment with reason
  - Safe drop recording: amount, denomination count, employee, manager PIN required
  - "Pay In / Pay Out" for non-sale cash movements with reason codes
- **Empty state:** "No cash drawers configured. Go to Settings > Terminals to assign drawers."

- **Tab 6 — Schedule:**
  - Weekly calendar view (Mon-Sun, configurable start day)
  - Columns: one per day. Rows: one per employee (grouped by role)
  - Each shift: colored block showing start-end time, role, assigned employee name
  - Drag-and-drop to move shifts between days/employees (@dnd-kit)
  - Click shift block to edit: time, employee, role, notes
  - "Add Shift" button on any day/employee intersection
  - **Template system:** Save current week as template, apply template to future weeks
  - **Publish button:** Sets `published_at` on all draft shifts, sends push notification to all affected employees: "Your schedule for [week] has been published"
  - **Shift Marketplace panel** (right sidebar, collapsible):
    - Open shifts (unassigned) listed as cards: date, time, role, location
    - Swap requests: Employee A wants to swap with Employee B. Shows both shifts. Approve/Deny buttons for manager.
    - Drop requests: Employee wants to drop shift. Shows reason. If approved, shift becomes open.
    - Pickup requests: Employee wants to pick up an open shift. Approve/Deny.
    - Each request shows: requester name, shift details, status badge, timestamp
  - **Labor forecast bar** at top of calendar:
    - Projected total labor hours for the week
    - Projected labor cost (hours x rates)
    - Projected labor % (labor cost / forecasted revenue from same week last year)
    - Color coding: green (< 28%), amber (28-32%), red (> 32%)
    - Per-day breakdown on hover
  - **Availability overlay toggle:** Shows employee availability as green/red background behind shift blocks
  - Schedule conflict detection: if shift overlaps with employee's existing shift at another location or conflicts with availability, show red warning border
- **Empty state:** "No shifts scheduled for this week. Create your first shift or apply a template."

- **Tab 7 — Payroll:**
  - Pay period selector (Weekly, Bi-Weekly, Semi-Monthly — configurable)
  - Summary cards: Total Regular Hours, Total OT Hours, Total Labor Cost, Total Tips (Card + Cash Declared), Average Hourly Cost
  - Employee payroll table: Name, Role, Regular Hours, OT Hours, Regular Pay, OT Pay, Total Pay, Card Tips, Cash Tips Declared, Tip Pool Share, Total Compensation
  - All unapproved time entries flagged with warning icon — "X unapproved entries" banner at top
  - **Export button** with format selector:
    - **Generic CSV:** date, employee_name, employee_id, regular_hours, ot_hours, regular_rate, ot_rate, regular_pay, ot_pay, card_tips, cash_tips_declared, tip_pool_share, total_compensation
    - **ADP Format:** Employee ID, Regular Hours, OT Hours, Regular Earnings, OT Earnings, Tips, Deduction codes in ADP WFN import format
    - **Gusto Format:** Employee Email, Regular Hours, OT Hours, Regular Pay, OT Pay, Tips, Additional Earnings in Gusto CSV import format
    - **Paychex Format:** Employee SSN (last 4), Regular Hours, OT Hours, Regular Earnings, OT Earnings, Tips in Paychex Flex import format
  - Export generates file and shows download link. Sensitive data (SSN digits for Paychex) pulled from employee profile, never displayed in UI.
  - **IRS 8027 Data section** (collapsible):
    - Gross receipts, Charge receipts, Charge tips, Service charges
    - Total reported tips vs 8% threshold
    - Tip allocation calculation if reported tips < 8% of gross receipts
- **Empty state:** "No payroll data for this period. Time entries appear here once employees clock in."

### Page: POS Clock-In Screen
- **Who:** All employees
- **Route:** POS terminal clock-in overlay (not a separate page — accessed from POS topbar clock icon)
- **Layout:** Full-screen overlay on POS with PIN pad
- **Features:**
  - Large PIN pad (48px+ buttons) — employee enters their PIN
  - After PIN entry: shows employee name, current role, scheduled shift (if any)
  - If clocking in > 5 minutes early: "Early clock-in. Manager approval required." — Manager PIN prompt
  - Role override dropdown (if employee works multiple roles): "Clocking in as: [Server]" with dropdown to change
  - Clock In / Clock Out toggle based on current state
  - On clock out: "Declare cash tips?" with amount entry, then "Cash tip declaration: $XX.XX" confirmation
  - Break buttons visible while clocked in: "Start Break" (shows paid/unpaid option), "End Break"
  - Current shift info displayed: hours worked, break time, overtime status

### Feature: Break Compliance Engine
- **Who:** System (automatic alerts to managers)
- **Background job:** BullMQ recurring job runs every 5 minutes
- **Logic:**
  1. Query all currently clocked-in employees
  2. For each employee, check hours elapsed since clock-in and since last break
  3. Apply location's state-specific break rules (California, New York, Federal, Custom)
  4. **Pre-alert:** When employee is 15 minutes from a required break deadline, send toast notification to shift manager: "Reminder: {name} must take a meal break in 15 minutes"
  5. **Violation alert:** If break deadline passes without break start, escalate: red banner notification to GM, logged as compliance event
  6. Break compliance dashboard (within Time Clock tab): shows employees approaching break deadlines, employees who missed breaks today, weekly compliance percentage
  7. Break rules configurable per location in Settings: state dropdown (pre-loads state rules), custom override fields for meal break threshold hours, rest break threshold hours, paid/unpaid default

### Feature: Overtime Calculation Engine
- **Who:** System (automatic), visible to managers
- **Background job:** BullMQ recurring job runs every 15 minutes during operating hours
- **Logic:**
  1. For each clocked-in employee, calculate: daily hours (current day), weekly hours (current pay-period week), consecutive days worked
  2. Apply location's overtime rules:
     - **Federal (default):** OT after 40 hours/week at 1.5x
     - **California:** OT after 8 hours/day at 1.5x, after 12 hours/day at 2x. OT after 40 hours/week. 7th consecutive day: first 8 hours at 1.5x, after 8 hours at 2x
     - **Colorado:** OT after 12 hours/day or 40 hours/week
     - **Custom:** configurable daily and weekly thresholds
  3. **Multi-location consolidation:** If employee has time entries at other locations within the org during the same week, sum all hours for OT calculation
  4. **Approaching threshold (36 hours weekly or 6 hours daily in CA):** amber alert badge on On Duty board card, toast notification to shift manager: "{name}: {X} hours this week. OT in {Y} hours."
  5. **In overtime:** red OT badge on On Duty board card, persistent banner notification to manager
  6. OT hours and OT rate calculated on time_entries at clock-out

### Feature: Labor Cost Forecasting
- **Who:** Owner, GM
- **Displayed:** Schedule tab labor forecast bar, also on Reports daily dashboard
- **Logic:**
  1. For each scheduled shift in the week: scheduled_hours x employee's hourly_rate = shift_cost
  2. Sum all shift_costs = projected_labor_cost
  3. Projected_revenue = same week last year's actual revenue (from daily_metrics table), adjusted by trailing 4-week trend
  4. Projected_labor_percentage = (projected_labor_cost / projected_revenue) x 100
  5. Color thresholds: green (< 28%), amber (28-32%), red (> 32%) — thresholds configurable in settings
  6. Per-daypart breakdown: if shifts are tagged with daypart, show labor cost per daypart vs projected revenue per daypart
  7. "What-if" mode: manager can add/remove hypothetical shifts to see labor % impact before publishing schedule


## 1.5 Look and feel

- **Mode:** Light-first (matches overall POS design system)
- **Vibe:** Professional back-office tool, information-dense but organized, fast data entry
- **Reference products:** Toast Team Management, 7shifts scheduling, Homebase time clock, Square Staff Management
- **Layout:** Full viewport below topbar. Tab bar with 7 tabs spans full width.
- **On Duty Board cards:** White cards with warm shadows, role badge uses role-specific color (server=blue, bartender=purple, host=teal, kitchen=orange), live hours ticker in monospace font, break/OT badges inline
- **Permission matrix:** Zebra-striped rows, 3-state toggles (inherit=gray, grant=green, deny=red) with clear iconography. Accordion sections collapse to show only active overrides.
- **Denomination counter:** Large number inputs (48px height), denomination labels with bill/coin icons, running total in 32px bold font. Over/short displayed in 24px with color: green for even/over, red for short.
- **Schedule calendar:** Colored shift blocks by role (consistent with On Duty role colors), drag handle visible on hover, availability shown as subtle background tint (green=available, red=unavailable), labor forecast bar uses gradient fill
- **Tip pool config:** 4 model cards with simplified flow diagrams (SVG or CSS), selected model has ember-orange border + checkmark badge
- **Server checkout report:** Receipt-style card layout (narrow, vertically stacked, clear section dividers), mimics a printed checkout slip for familiarity
- **Touch targets:** 48px minimum for all interactive elements (PIN pad buttons 64px)
- **Alerts:** Break compliance and OT warnings use amber/red with pulse animation, dismissible but logged
- **Empty states:** Every tab has a designed empty state with helpful message and illustration


## 1.6 Business rules

- **PIN hashing:** All PINs hashed with bcrypt (cost factor 10). Never stored or transmitted in plaintext. Never SHA-256.
- **Clock-in restrictions:** Cannot clock in more than 5 minutes before scheduled shift without manager approval. Configurable 1-30 minutes. Cannot be clocked in at two locations simultaneously.
- **Late clock-out warning:** If clocked in past scheduled end time by > 15 minutes, notification to manager.
- **Automatic clock-out:** If no activity for 12 hours (configurable), system auto-clocks out and alerts manager.
- **Break compliance (California):** 30-minute unpaid meal break before the 5th hour. Second before the 10th hour. 10-minute paid rest break per 4 hours. If missed, 1-hour penalty pay owed.
- **Break compliance (New York):** 30-minute meal break for shifts > 6 hours spanning 11 AM-2 PM.
- **Break compliance (Federal):** No requirement, but breaks < 20 minutes must be paid.
- **Break waiver:** Manager can acknowledge a waived break (where legally permitted) with reason code. Logged for audit.
- **Overtime multi-location:** Hours consolidated across all locations in the org for a single employee within the same work week.
- **Overtime calculation timing:** OT calculated at clock-out and written to time_entries.overtime_hours. Also recalculated nightly by BullMQ job to catch any edge cases.
- **Tip pool FLSA compliance:** Managers and owners NOT eligible for tip pools. System prevents adding manager/owner roles to pool-eligible list with warning.
- **Tip pool BOH inclusion:** Only legal if employer does NOT take a tip credit. Toggle requires manager acknowledgment of legal responsibility.
- **Processing fee deduction from tips:** Legal in most states. Calculates: tip_amount x processing_fee_pct. Configurable, default off.
- **Cash tip declaration:** Required at clock-out. If not declared, system records $0 with flag for review. IRS 8027 compliance.
- **Server checkout cash owed:** Formula: starting_cash + cash_sales_received - cash_tips_kept - tip_out_paid_cash = cash_due_to_house. Discrepancy > $5 requires manager review.
- **Time entry edits:** Always require manager PIN and reason text. Audit-logged with original values, new values, who edited, why.
- **Permission overrides:** Per-user overrides take precedence over role defaults. Three states: inherit (use role default), grant (allow regardless of role), deny (block regardless of role).
- **Payroll export:** Never displays or exports full SSN. Paychex format uses last 4 digits stored in employee profile. All exports logged in audit trail.
- **Shift swap rules:** Both employees must be qualified for each other's role. Swap cannot create overtime violation. Manager approval required.
- **Schedule publish:** Setting `published_at` makes shifts visible to employees and triggers push notification.
- **Labor cost alert:** If projected labor % exceeds 32% of projected revenue, alert GM and area manager. Threshold configurable per location.


## 1.7 Integrations

- **Supabase Realtime:** Live On Duty board updates (clock-in/out/break events broadcast on `staff:{locationId}` channel), break compliance alerts, overtime warnings
- **BullMQ + Redis:** Background jobs for break compliance checks (every 5 min), overtime threshold checks (every 15 min), nightly OT recalculation, payroll export file generation
- **Payroll Systems (export only, not API integration for v4):**
  - ADP Workforce Now CSV import format
  - Gusto CSV import format
  - Paychex Flex CSV import format
- **Supabase Realtime (scheduling):** Schedule publish notification broadcast on `schedule:{locationId}` channel
- **Receipt Printer:** Server checkout report printable via ESC/POS (Phase 5 printer integration)
- **POS Topbar:** Clock-in button in topbar component triggers clock overlay. On-duty count badge visible in topbar.


## 1.8 Modules planned but not for this phase

- **Full payroll API integration** (ADP/Gusto/Paychex OAuth + bidirectional sync) — Phase 8 Integrations
- **7shifts / HotSchedules bidirectional sync** — Phase 8 Integrations
- **Geo-fencing clock-in** (GPS verification) — future, requires native app or PWA geolocation
- **Photo verification on clock-in** (selfie capture) — future
- **Workday HRIS master data sync** — Phase 8 Integrations (enterprise)
- **IRS Form 8027 PDF generation** — Phase 7 Reports (data collected here, form generated there)
- **Minor labor law enforcement** (scheduling restrictions for under-18) — Phase 11 Scheduling deep pass
- **SSO / SAML for enterprise staff login** — Phase 12 Security
- **Offline clock-in/out** — Phase 9 Offline Mode
- **Server performance metrics** (avg check, upsell rate, alcohol attachment rate) — Phase 7 Reports


## 1.9 Files to create or modify

### New Files
| File | Purpose |
|------|---------|
| `src/components/staff/StaffRoster.tsx` | Roster tab: employee table with filters, search, bulk actions |
| `src/components/staff/StaffDetailSheet.tsx` | Side sheet for employee create/edit form |
| `src/components/staff/StaffDetailView.tsx` | Employee detail view (profile card, summary, recent activity) |
| `src/components/staff/TimeClock.tsx` | Time Clock tab: On Duty board + Time Entry History |
| `src/components/staff/OnDutyBoard.tsx` | Live card grid of clocked-in employees with break/OT badges |
| `src/components/staff/OnDutyCard.tsx` | Individual on-duty employee card with live timer |
| `src/components/staff/TimeEntryTable.tsx` | Time entry history table with date filter, edit, approve |
| `src/components/staff/TimeEntryEditModal.tsx` | Edit time entry modal with reason field + manager PIN |
| `src/components/staff/OvertimeBanner.tsx` | Banner showing employees approaching/in overtime |
| `src/components/staff/PermissionsTab.tsx` | Permissions tab: employee list + permission matrix |
| `src/components/staff/PermissionMatrix.tsx` | Accordion-based permission grid with 3-state toggles |
| `src/components/staff/PermissionToggle.tsx` | Individual permission toggle: inherit/grant/deny |
| `src/components/staff/TipsTab.tsx` | Tips tab orchestrator with 3 sub-tabs |
| `src/components/staff/TipDistribution.tsx` | Tip distribution sub-tab: summary cards + distribution table |
| `src/components/staff/TipDistributionPreview.tsx` | Distribution preview modal with formula breakdown |
| `src/components/staff/TipPoolConfig.tsx` | Tip pool configuration sub-tab: 4 model cards + settings |
| `src/components/staff/TipPoolModelCard.tsx` | Single tip pool model card with diagram |
| `src/components/staff/ServerCheckout.tsx` | Server checkout sub-tab: sales/tip/cash summary + declare + print |
| `src/components/staff/CashDrawersTab.tsx` | Cash Drawers tab: drawer list + detail view |
| `src/components/staff/DenominationCounter.tsx` | Denomination counter grid with quantity inputs + running total |
| `src/components/staff/CashDrawerDetail.tsx` | Drawer detail: event log, open/close flows |
| `src/components/staff/ScheduleTab.tsx` | Schedule tab: weekly calendar + shift marketplace |
| `src/components/staff/ScheduleCalendar.tsx` | Weekly calendar grid with shift blocks |
| `src/components/staff/ShiftBlock.tsx` | Draggable shift block component |
| `src/components/staff/ShiftEditModal.tsx` | Create/edit shift modal |
| `src/components/staff/ShiftMarketplace.tsx` | Right sidebar: open shifts, swap requests, pickup requests |
| `src/components/staff/SwapRequestCard.tsx` | Individual swap/drop/pickup request card |
| `src/components/staff/LaborForecastBar.tsx` | Labor forecast bar with projected hours/cost/percentage |
| `src/components/staff/ScheduleTemplateDialog.tsx` | Save/apply schedule template dialog |
| `src/components/staff/PayrollTab.tsx` | Payroll tab: period selector, summary, employee table, export |
| `src/components/staff/PayrollExportDialog.tsx` | Export format selector dialog (Generic, ADP, Gusto, Paychex) |
| `src/components/staff/IRS8027Section.tsx` | Collapsible IRS 8027 data section |
| `src/components/staff/BreakComplianceBanner.tsx` | Break compliance alerts banner for Time Clock tab |
| `src/components/staff/ClockInOverlay.tsx` | Full-screen POS clock-in/out overlay with PIN pad |
| `src/components/staff/PinPad.tsx` | Reusable large PIN pad (64px buttons) for clock-in/manager auth |
| `src/app/api/staff/permissions/route.ts` | GET: list permissions for user. PUT: update permission overrides |
| `src/app/api/staff/permissions/[userId]/route.ts` | GET/PUT permission overrides for specific user |
| `src/app/api/staff/checkout/route.ts` | POST: run server checkout calculation for employee + date |
| `src/app/api/staff/overtime/route.ts` | GET: overtime status for all on-duty employees |
| `src/app/api/staff/break-compliance/route.ts` | GET: break compliance status for all on-duty employees |
| `src/app/api/staff/payroll/export/route.ts` | POST: generate payroll export in specified format |
| `src/app/api/staff/cash-drawers/route.ts` | GET: list drawers. POST: create drawer |
| `src/app/api/staff/cash-drawers/[id]/route.ts` | GET/PUT drawer detail |
| `src/app/api/staff/cash-drawers/[id]/open/route.ts` | POST: open drawer with starting denomination count |
| `src/app/api/staff/cash-drawers/[id]/close/route.ts` | POST: close drawer with closing denomination count, calculate over/short |
| `src/app/api/staff/cash-drawers/[id]/events/route.ts` | GET: event log for drawer. POST: record pay-in/pay-out/safe-drop |
| `src/app/api/staff/tip-pool-config/route.ts` | GET/PUT: tip pool model and settings for location |
| `src/app/api/staff/labor-forecast/route.ts` | GET: projected labor cost/percentage for date range |
| `src/app/api/scheduling/shifts/open/route.ts` | GET: open/unassigned shifts (shift marketplace) |
| `src/app/api/scheduling/shifts/[id]/pickup/route.ts` | POST: employee picks up open shift |
| `src/app/api/scheduling/publish/route.ts` | POST: publish schedule for week (set published_at on all draft shifts) |
| `src/lib/staff/overtime-engine.ts` | Overtime calculation: federal, CA, CO, custom. Multi-location consolidation |
| `src/lib/staff/break-compliance.ts` | Break compliance checking: state rules, threshold calculations, alert generation |
| `src/lib/staff/tip-pool-calculator.ts` | Tip pool distribution: 4 models (direct, tipout-by-sales, pool-by-hours, hybrid-points) |
| `src/lib/staff/server-checkout.ts` | Server checkout report calculation: sales, tips, cash owed |
| `src/lib/staff/payroll-export.ts` | Payroll CSV generation: generic, ADP, Gusto, Paychex formats |
| `src/lib/staff/labor-forecast.ts` | Labor cost forecasting: schedule x rates vs projected revenue |
| `src/lib/staff/denomination-calculator.ts` | Denomination breakdown calculation (given dollar amount, optimal bill/coin count) |
| `src/lib/staff/permission-defaults.ts` | Default permission sets per role (the 12 roles from SEAR_POS_ARCHITECTURE.md) |
| `src/stores/staff-store.ts` | Zustand store: on-duty list, selected employee, active tab, schedule state |
| `src/stores/schedule-store.ts` | Zustand store: schedule calendar state, drag state, template state |

### Modified Files
| File | Changes |
|------|---------|
| `src/app/(backoffice)/staff/page.tsx` | Complete rebuild: 7-tab layout, import all new tab components |
| `src/components/layout/Topbar.tsx` | Add clock-in button with on-duty count badge, trigger ClockInOverlay |
| `src/components/pos/StaffClockButton.tsx` | Connect to ClockInOverlay instead of standalone button |
| `src/hooks/use-clock.ts` | Extend: add break compliance state, overtime state, real-time subscription |
| `src/hooks/use-realtime.ts` | Add `staff:{locationId}` channel subscription for on-duty updates |
| `src/app/api/staff/[id]/clock-in/route.ts` | Add: early clock-in restriction check, simultaneous clock-in prevention, broadcast to realtime |
| `src/app/api/staff/[id]/clock-out/route.ts` | Add: overtime calculation at clock-out, cash tip declaration, broadcast to realtime |
| `src/app/api/staff/[id]/break-start/route.ts` | Add: break type recording, compliance timer reset, broadcast |
| `src/app/api/staff/[id]/break-end/route.ts` | Add: duration calculation, compliance check, broadcast |
| `src/app/api/staff/tips/distribute/route.ts` | Rebuild: support 4 distribution models from tip-pool-calculator.ts |
| `src/app/api/staff/time-entries/[id]/route.ts` | Add: manager PIN verification, audit log entry with original/new values |
| `src/app/api/scheduling/shifts/route.ts` | Add: labor forecast data inclusion, conflict detection |
| `src/app/api/scheduling/swap-requests/route.ts` | Add: role qualification check, OT conflict check |
| `src/app/api/scheduling/swap-requests/[id]/route.ts` | Add: approval/deny with notification broadcast |

### Database Migrations (if needed)
| Migration | Changes |
|-----------|---------|
| `add_user_permission_overrides` | Create `user_permission_overrides` table (id, org_id, user_id, permission_code, override_type enum('grant','deny'), created_by, created_at). Unique on (user_id, permission_code). |
| `add_tip_pool_config` | Create `tip_pool_configs` table (id, org_id, location_id, model enum('direct','tipout_sales','pool_hours','hybrid_points'), tipout_busser_pct, tipout_bar_pct, tipout_runner_pct, point_values jsonb, eligible_roles text[], include_boh boolean, deduct_processing_fee boolean, processing_fee_pct, is_active, created_at, updated_at). |
| `add_cash_drawer_denomination_counts` | Create `cash_drawer_counts` table (id, cash_drawer_id, count_type enum('opening','closing','safe_drop'), denominations jsonb, total, counted_by, created_at). |
| `add_break_compliance_config` | Add `break_rules_state text`, `break_meal_threshold_hours numeric(3,1)`, `break_rest_threshold_hours numeric(3,1)`, `break_meal_duration_minutes int`, `overtime_rule text` to `locations` settings. |
| `add_overtime_config` | Add `ot_daily_threshold numeric(4,1)`, `ot_weekly_threshold numeric(4,1)`, `ot_daily_rate_multiplier numeric(3,2) default 1.5`, `ot_weekly_rate_multiplier numeric(3,2) default 1.5` to `locations` or location settings. |
| `add_break_compliance_events` | Create `break_compliance_events` table (id, org_id, location_id, user_id, time_entry_id, event_type enum('pre_alert','violation','waiver'), break_type, threshold_hours, actual_hours, acknowledged_by, acknowledged_at, notes, created_at). |
| `add_payroll_exports` | Create `payroll_exports` table (id, org_id, location_id, pay_period_start, pay_period_end, format, file_path, exported_by, created_at) for audit trail. |

---

## Acceptance Criteria

### Roster Management
- [ ] Staff roster tab shows all employees in a sortable/filterable table with: name, role badge, phone, email, hire date, status, hourly rate (owner only)
- [ ] "Add Employee" opens side sheet with all required fields; PIN is hashed with bcrypt before storage; new employee appears in table immediately
- [ ] Quick-deactivate: one tap on deactivate button shows confirmation dialog, sets `is_active = false`, employee's PIN stops working for clock-in within 5 seconds
- [ ] Employee detail view shows profile summary, employment stats, recent time entries, and recent tip earnings

### Time Clock
- [ ] On Duty Board shows real-time card grid of clocked-in employees with live hour counters (updates every 30 seconds), break status badges, and overtime warning badges
- [ ] Tapping an on-duty card opens quick actions: Start Break, End Break, Clock Out
- [ ] Time Entry History table loads with date range filter (default current pay period), shows all required columns, supports sort by any column
- [ ] Edit time entry requires manager PIN + reason text, creates audit log entry with original and new values
- [ ] Bulk approve: select multiple pending entries, approve all with one click

### POS Clock-In Overlay
- [ ] POS topbar clock icon opens full-screen overlay with large PIN pad (64px buttons)
- [ ] PIN entry identifies employee, shows name + role + scheduled shift
- [ ] Early clock-in (> 5 min before schedule) blocks with "Manager approval required" and shows manager PIN prompt
- [ ] Cannot clock in if already clocked in at another location (simultaneous prevention)
- [ ] Clock-out flow prompts for cash tip declaration, records to cash_tip_reports table

### Permissions
- [ ] Permission tab shows employee list (left) and permission matrix (right) for selected employee
- [ ] Permission matrix displays all permission categories as collapsible accordion sections with individual permission rows
- [ ] Each permission has 3-state toggle: Inherit from Role (gray), Grant Override (green check), Deny Override (red X)
- [ ] Role default shown as muted reference text next to each toggle
- [ ] "Reset to Role Defaults" clears all overrides for the employee
- [ ] "Copy Permissions From" clones another employee's overrides
- [ ] Permission changes save immediately with optimistic UI and undo toast

### Tip Pool Configuration
- [ ] 4 tip pool models displayed as selectable cards: Direct, Tip-out by % of Sales, Pool by Hours, Hybrid Points
- [ ] Selecting a model activates it with ember-orange border and reveals its configuration fields
- [ ] Tip-out model shows editable percentage fields per support role (busser, bar, runner)
- [ ] Hours model shows eligible roles checkboxes
- [ ] Hybrid model shows point-value fields per role
- [ ] FLSA warning banner prevents adding manager/owner roles to pool-eligible list
- [ ] Processing fee deduction toggle with percentage field

### Tip Distribution
- [ ] Distribution tab shows summary cards: Total Card Tips, Cash Tips Declared, Auto-Gratuity, Pool Amount
- [ ] "Run Distribution" calculates shares using active pool model and shows preview before committing
- [ ] Preview modal shows each employee's share with formula breakdown; amounts adjustable before commit
- [ ] Distribution results saved to tip_distributions table with correct distribution_method

### Server Checkout
- [ ] Select employee from dropdown, checkout report generates showing: net sales, total checks, avg check, guest count, card tips, cash declared, tip-out owed/received, net tips, cash owed to house
- [ ] Cash owed formula correct: starting_cash + cash_sales - cash_tips_kept - tip_out_cash = cash_due
- [ ] "Declare Cash Tips" field saves to cash_tip_reports table
- [ ] "Complete Checkout" closes time entry and records all tip data

### Cash Drawer Denomination Counter
- [ ] Denomination counter shows grid of all US denominations ($100 through pennies) with quantity stepper inputs
- [ ] Running total auto-calculates as quantities change
- [ ] On drawer close: Expected amount displayed, Actual from counter, Over/Short calculated and color-coded (green = even/over, red = short)
- [ ] Over/short exceeding $5.00 triggers manager acknowledgment requirement with reason field

### Break Compliance
- [ ] Break compliance engine runs every 5 minutes via BullMQ job
- [ ] Pre-alert sent to manager 15 minutes before required break deadline
- [ ] Violation alert escalates to GM if break deadline passes without break taken
- [ ] Break compliance events logged to break_compliance_events table
- [ ] Manager can acknowledge waived break with reason code (where legally permitted)
- [ ] Break rules configurable per location by selecting state (CA, NY, Federal, Custom)

### Overtime
- [ ] Overtime engine calculates correctly for Federal (40hr/week), California (8hr/day + 40hr/week + 7th day), Colorado (12hr/day or 40hr/week)
- [ ] Multi-location hours consolidated: 30hrs at Location A + 15hrs at Location B = 45hrs with 5hrs OT
- [ ] Approaching OT threshold (36hrs weekly or configurable) shows amber alert badge on On Duty card
- [ ] In OT shows red badge on On Duty card + persistent banner notification to manager
- [ ] OT hours and rates written to time_entries at clock-out

### Schedule
- [ ] Weekly calendar renders with day columns and employee rows grouped by role
- [ ] Shifts displayed as colored blocks (role-specific colors) with start/end time and employee name
- [ ] Drag-and-drop to move shifts between days and employees; conflict detection prevents invalid moves
- [ ] Publish button sets published_at on all draft shifts and broadcasts notification
- [ ] Shift Marketplace sidebar shows open shifts, swap requests, and pickup requests with approve/deny buttons

### Labor Forecast
- [ ] Labor forecast bar at top of schedule shows: projected hours, projected cost, projected labor % with color coding
- [ ] Forecast uses actual hourly rates from employee profiles and projected revenue from same-week-last-year data
- [ ] Color thresholds: green (< 28%), amber (28-32%), red (> 32%) — configurable

### Payroll Export
- [ ] Payroll tab shows summary cards + employee payroll table for selected pay period
- [ ] Unapproved time entries flagged with warning icon and count banner
- [ ] Export dialog offers 4 formats: Generic CSV, ADP, Gusto, Paychex
- [ ] Export generates downloadable file with correct format for selected payroll system
- [ ] Export logged in payroll_exports audit table

---

## Workflow Tests

### Workflow 1: Full Shift Lifecycle — Clock In, Break, Overtime Alert, Clock Out, Checkout
1. Server Sarah enters PIN on POS terminal clock-in overlay at 4:55 PM, scheduled shift is 5 PM
2. System shows: "Sarah Chen, Server, Shift: 5:00 PM - 11:00 PM" — clock-in succeeds (within 5-min window)
3. Sarah appears on On Duty Board in Time Clock tab with live timer starting at 0:00
4. At 9:45 PM (4h 50min elapsed), manager gets toast: "Sarah Chen must take a meal break in 10 minutes" (California location)
5. Manager taps Sarah's card, taps "Start Break" — break badge appears on card, timer pauses
6. At 10:15 PM Sarah's break ends (30 min) — "End Break" tapped, timer resumes
7. At 11:15 PM (past scheduled end), manager gets late clock-out warning: "Sarah Chen still clocked in. Scheduled end: 11:00 PM"
8. Sarah enters PIN to clock out — system prompts "Declare cash tips?" — Sarah enters $45.00
9. Manager opens Server Checkout, selects Sarah — sees: Net Sales $1,842.00, Card Tips $312.40, Cash Declared $45.00, Tip-out owed $55.26 (3% to bussers), Net Tips $302.14, Cash owed to house $127.50
10. Manager taps "Complete Checkout" — time entry closed, tip data recorded, checkout slip ready to print

### Workflow 2: Tip Pool Distribution — Pool by Hours Model
1. Owner opens Tips tab > Pool Config, selects "Pool by Hours" model
2. Checks eligible roles: Server, Bartender, Busser. Unchecks Host, Kitchen. Saves.
3. End of Friday dinner shift. Owner opens Tips tab > Distribution, selects today's date
4. Summary shows: Total Card Tips $2,847.00, Cash Declared $380.00. Pool Amount $2,847.00 (card only — cash declared separately)
5. Owner clicks "Run Distribution" — preview shows:
   - Server A (8 hrs): $2,847 x (8/28) = $813.43
   - Server B (6 hrs): $2,847 x (6/28) = $610.07
   - Bartender (8 hrs): $2,847 x (8/28) = $813.43
   - Busser A (6 hrs): $2,847 x (6/28) = $610.07
   Total hours: 28. Each share shown with formula.
6. Owner adjusts Busser A's share up by $20 (manual override for extra work) — system rebalances
7. Owner commits distribution — amounts written to tip_distributions table

### Workflow 3: Permission Override — Bartender Gets Comp Authority
1. Owner opens Permissions tab, selects bartender "Mike" from employee list
2. Permission matrix shows defaults for Bartender role: comp = Deny, discount = Deny
3. Owner expands "Orders" section, finds "comp" permission — currently "Inherit from Role (Deny)"
4. Owner clicks toggle to "Grant Override" — green check appears
5. Owner finds "discount" permission, sets to "Grant Override" with a note
6. Changes save immediately, undo toast appears for 5 seconds
7. Mike goes to POS, opens a check, taps an item — "Comp" option now available (was previously hidden/grayed)
8. Mike comps a dessert for a regular — comp goes through without manager PIN prompt

### Workflow 4: Cash Drawer Open/Close with Denomination Count
1. Manager opens Cash Drawers tab, taps "Main Register", taps "Open Drawer"
2. Denomination counter appears. Manager counts starting cash: 5x $20 = $100, 10x $5 = $50, 20x $1 = $20, $15 in coins (6x quarters, 0 dimes, 0 nickels, 0 pennies). Total: $171.50
3. Manager assigns drawer to Server Lisa. Drawer opens, status shows "Open, Assigned: Lisa, Starting: $171.50"
4. Throughout shift: cash sales and change events auto-log in event timeline
5. At close, Lisa taps "Close Drawer". Denomination counter appears for actual count.
6. Lisa counts: 2x $100, 3x $50, 8x $20, 6x $10, 15x $5, 22x $1, $18.75 in coins = $655.75
7. System shows: Expected $648.50, Actual $655.75, Over/Short: +$7.25 (green)
8. Over/short > $5 threshold — manager acknowledgment required. Manager enters PIN and reason: "Likely incorrect change given"
9. Drawer closes. Event log shows full history.

### Workflow 5: Schedule Week with Labor Forecast and Shift Swap
1. GM opens Schedule tab, sees empty week for next Monday-Sunday
2. GM clicks "Apply Template" — selects "Standard Week" template — shifts populate across the week
3. Labor forecast bar updates: 280 projected hours, $4,760 projected cost, 29.1% labor (amber — between 28-32%)
4. GM removes one server shift on Tuesday (slow night) — forecast drops to 272 hours, $4,624, 28.3% (still amber)
5. GM adds a busser shift on Saturday — forecast goes to 280 hours, $4,680, 28.6%
6. GM clicks "Publish Schedule" — all shifts get `published_at` timestamp, all affected employees receive notification
7. Wednesday: Server Alex opens the app, sees shift swap request form. Requests to swap Thursday 5-11 PM shift with Server Jordan's Friday 5-11 PM shift.
8. Swap request appears in Shift Marketplace sidebar. GM reviews: both are servers (role qualified), neither swap creates OT conflict.
9. GM approves swap. Alex's shift moves to Friday, Jordan's to Thursday. Both notified.

### Workflow 6: Payroll Export for Bi-Weekly Period
1. Owner opens Payroll tab, selects bi-weekly period "Mar 10-23, 2026"
2. Summary cards show: 842 Regular Hours, 23 OT Hours, $14,892 Labor Cost, $6,247 Total Tips
3. Warning banner: "4 unapproved time entries" — owner clicks, sees 4 entries needing approval
4. Owner bulk-approves all 4 entries. Warning clears.
5. Owner clicks "Export" — dialog shows 4 format options
6. Owner selects "ADP Format" — system generates CSV with ADP Workforce Now column headers
7. File downloads: `sear_payroll_adp_2026-03-10_2026-03-23.csv`
8. Owner imports file into ADP — all columns map correctly, hours and earnings match

### Workflow 7: Multi-Location Overtime Detection
1. Employee "David" works at both Downtown and Midtown locations
2. Monday-Thursday: David works 8hr/day at Downtown = 32 hours
3. Friday: David clocks in at Midtown. After 6 hours (38 total across locations), overtime engine detects approaching threshold.
4. Midtown manager gets alert: "David Martinez: 38 hours this week (across locations). OT threshold in 2 hours."
5. After 8 hours at Midtown on Friday (40 total), OT kicks in. Red OT badge appears on David's On Duty card.
6. David clocks out after 10 hours at Midtown. Time entry shows: Regular 8.0 hrs, OT 2.0 hrs. OT calculated at 1.5x his rate.
7. Payroll export shows consolidated: Regular 40 hrs, OT 2 hrs across both locations.
