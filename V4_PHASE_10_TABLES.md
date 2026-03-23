# Sear POS v4 — Phase 10: Tables & Reservations Deep Integration

**Date:** 2026-03-23
**Phase:** 10 of 13
**Priority:** MEDIUM — week 3
**Estimated Sessions:** 2
**Depends On:** Phase 1 (Order Entry), Phase 6 (Staff)

---

## 1.1 What is this?

Deep integration of table management, reservations, and waitlist into a unified host/manager workflow. Currently, the tables page (`src/app/(pos)/tables/page.tsx`) has a floor plan canvas and basic status display. The reservations page (`src/app/(backoffice)/reservations/page.tsx`) is a standalone CRUD form. The waitlist exists as API endpoints but has no real host workflow. None of these systems talk to each other.

This phase connects them: a reservation triggers a table assignment, which updates table status, which starts tracking turn time, which feeds the capacity dashboard. The host sees one screen with everything they need to manage a busy Saturday night — not three disconnected pages.

Additionally, this phase adds a table list view (alternative to the floor plan for quick scanning), server section assignments with color coding, turn time analytics, and an embeddable reservation widget that restaurants can put on their own website.

**Read these files BEFORE planning:**
- `CLAUDE.md` — project config, tech stack
- `SCHEMA.md` — table, reservation, waitlist table schemas
- `API_SPEC.md` — all 14 table routes + 14 reservation routes
- `BUSINESS_RULES.md` — table status state machine, reservation lifecycle
- `UI_DESIGN.md` — design tokens, touch targets, animation specs
- `src/app/(pos)/tables/page.tsx` — current tables page
- `src/app/(backoffice)/reservations/page.tsx` — current reservations page
- `src/components/tables/` — all existing table components
- `src/stores/table-store.ts` — table Zustand store

---

## 1.2 Tech stack

Already built. No changes to core stack. New additions for this phase:

- **@dnd-kit** — already installed, use for drag-assign (reservation → table)
- **Supabase Realtime** — live table status updates (already configured in `use-realtime.ts`)
- **Twilio** — SMS notifications for waitlist (existing integration)
- **date-fns** — reservation time slot calculations
- **Recharts** — turn time reporting charts (already installed)

---

## 1.3 User roles

| Role | What they do in this phase |
|------|---------------------------|
| **Host** | Manages reservations, waitlist, seats guests, assigns tables |
| **Manager** | Assigns server sections, views capacity dashboard, overrides table status |
| **Server** | Sees their section, views table status, marks tables as cleared |
| **Owner** | Views turn time reports, configures reservation settings |

---

## 1.4 Pages and features

### Page: Tables — List View (NEW)
- **Who:** Host, Manager, Server, Owner
- **What:** Alternative to floor plan — a sortable, filterable table list showing every table with status, server, guest count, elapsed time, and current check total
- **Layout:** Full-width data table with colored status dots, server name with section color pip, time elapsed badge (green/yellow/orange/red based on turn time), and quick-action buttons (Seat, Clear, Move)
- **Toggle:** "Floor Plan | List View" segmented control at top of tables page
- **Sort:** By table number, status, server, time seated, check total
- **Filter:** By section, by status, by server
- **Empty state:** "No tables configured — go to Settings > Tables to add your floor plan"
- **Where it links:** Tap table row → opens table detail popover (same as floor plan tap)

### Page: Tables — Server Sections (NEW panel)
- **Who:** Manager
- **What:** Side panel or modal for assigning tables to server sections
- **Layout:** Left column shows all servers on shift (from staff clock-in data). Right shows table grid. Drag servers onto tables to assign sections. Each section gets a unique color (8 preset colors). Color appears as a pip/badge on the table in both floor plan and list view.
- **Persistence:** Section assignments save to `table_sections` and persist until end of shift or manual reassignment
- **Visual:** Color-coded section overlay on floor plan (tinted background behind tables in that section)
- **Empty state:** "No servers are clocked in — sections will be available once staff clock in"

### Page: Tables — Capacity Dashboard (NEW)
- **Who:** Host, Manager, Owner
- **What:** Real-time capacity overview showing occupancy rate, estimated wait time, and turn time metrics
- **Layout:** Top row: 4 KPI cards (Total Seats, Occupied Seats, Available Tables, Avg Turn Time). Middle: horizontal bar showing capacity % with color gradient (green → yellow → red). Bottom: table of upcoming reservations for next 2 hours with assigned tables.
- **Where it lives:** Tab on the tables page ("Floor Plan | List | Capacity")
- **Real-time:** Updates via Supabase Realtime as tables change status
- **Wait time calculation:** Based on average turn time for current daypart minus time seated for occupied tables
- **Empty state:** "No seating data yet — seat your first guests to start tracking"

### Page: Tables — Turn Time Tracking
- **Who:** Manager, Owner
- **What:** Automatic tracking of how long each table is occupied (seated → cleared)
- **Metrics tracked:** Seated time, time to first order, time to payment, total turn time
- **Reporting:** Accessible from Reports section — turn time by daypart, by server, by table, by day of week
- **Visual on table:** Time badge that changes color at configurable thresholds (e.g., green <45min, yellow 45-75min, orange 75-90min, red >90min for dinner)
- **Data source:** Computed from `tables.seated_at` and `tables.cleared_at` timestamps

### Feature: Reservation → Table Assignment → Auto-Status
- **Who:** Host
- **What:** When a reservation party arrives, host taps "Seat" on the reservation. This opens a table picker (available tables matching party size), host selects table, table status auto-changes to "seated", reservation status changes to "seated", order is optionally auto-created
- **Flow:** Reservation list → "Arrived" button → Party size confirmed → Table picker (filtered by capacity ≥ party size, status = available) → Select table → Table goes "seated" → Reservation goes "seated" → Toast notification "Table 12 seated — Party of 4"
- **Conflict handling:** If selected table is not available, show warning. If reservation has a pre-assigned table, highlight that table in the picker.

### Feature: Waitlist → SMS → Table Assignment
- **Who:** Host
- **What:** Walk-in guests added to waitlist with name, phone, party size, and quoted wait time. When a matching table opens, host gets a notification. Host taps "Notify" → SMS sent via Twilio ("Your table is ready at [Restaurant]! Please return to the host stand."). Guest arrives → host seats them (same flow as reservation seating).
- **SMS templates:** Configurable in Settings. Default: "Hi {name}, your table for {party_size} at {restaurant} is ready! Please check in with the host. Reply STOP to opt out."
- **Wait time accuracy:** System tracks actual vs quoted wait times for reporting
- **Auto-remove:** If guest doesn't check in within configurable timeout (default 15min after SMS), entry turns amber. Host can manually remove or extend.

### Feature: Embeddable Reservation Widget (NEW)
- **Who:** Public (restaurant customers), configured by Owner/Manager
- **What:** A standalone reservation booking page that restaurants embed on their website via iframe or direct link
- **Route:** `/reserve/[location-slug]` — public, no auth required
- **Layout:** Clean, branded form: date picker → time slot selector (30min slots based on availability) → party size → name, phone, email → special requests → "Book Table" button
- **Availability logic:** Queries `reservations/availability` API, considers table capacity, existing reservations, operating hours, blackout dates
- **Confirmation:** Shows confirmation screen with details + sends SMS/email confirmation
- **Settings:** Max party size for online booking, advance booking window (1-90 days), time slot duration, auto-confirm vs require-confirm

---

## 1.5 Look and feel

- **Consistent with v4 design system:** warm off-white background, ember orange accents, 48px touch targets
- **Table status colors:** Available = green (#34C759), Seated = blue (#007AFF), Ordered = amber (#FF9500), Served = purple (#AF52DE), Dessert = pink (#FF2D55), Check Dropped = orange (#FF6B35), Dirty = gray (#8E8E93)
- **Section colors:** 8 preset section colors: coral, teal, lavender, lime, sky, peach, mint, gold
- **Turn time badges:** Green (<target), Yellow (at target), Orange (over target), Red (critical — flashing)
- **Reservation widget:** Minimal, clean design matching restaurant branding. Configurable accent color. Mobile-responsive.
- **Animations:** Table status changes animate with 200ms color fade. Section assignment uses spring drop animation. Capacity bar animates on change.

---

## 1.6 Business rules

- Table status state machine: `available` → `reserved` → `seated` → `ordered` → `served` → `dessert` → `check_dropped` → `paid` → `dirty` → `available`
- Reservation no-show: if not seated within 15min of reservation time, status changes to `no_show`, table released
- Waitlist position is FIFO within each party size bracket
- SMS requires opt-in (phone number collection = implicit opt-in for transactional SMS)
- Turn time thresholds configurable per daypart (lunch = 45min target, dinner = 75min target)
- Table capacity is a hard limit — cannot seat party of 6 at a 4-top without manager override
- Section assignments reset at shift change unless manager pins them
- Reservation widget respects operating hours and blackout dates from location settings
- Double-booking prevention: no two reservations for same table at overlapping times

---

## 1.7 Integrations

- **Supabase Realtime:** Live updates for table status, reservation arrivals, waitlist changes
- **Twilio SMS:** Waitlist notifications, reservation confirmations, reservation reminders (1hr before)
- **BullMQ:** Scheduled job for reservation reminders, no-show detection, stale waitlist cleanup

---

## 1.8 Modules planned but not for this build

- Online ordering integration with table service (Phase 11)
- Kitchen display integration for table-based ticket routing (already done in Phase 3)

---

## 1.9 Files, acceptance criteria, and workflow tests

### Files to CREATE

| # | File | Purpose |
|---|------|---------|
| 1 | `src/components/tables/TableListView.tsx` | Sortable/filterable table list (alternative to floor plan) |
| 2 | `src/components/tables/ServerSectionPanel.tsx` | Drag-assign servers to table sections with color coding |
| 3 | `src/components/tables/CapacityDashboard.tsx` | Real-time capacity KPIs, occupancy bar, upcoming reservations |
| 4 | `src/components/tables/TurnTimeBadge.tsx` | Color-coded elapsed time badge for each table |
| 5 | `src/components/tables/ReservationSeatingFlow.tsx` | Reservation arrival → table picker → seat flow |
| 6 | `src/components/tables/WaitlistPanel.tsx` | Waitlist management with SMS notify button |
| 7 | `src/components/tables/TablePicker.tsx` | Reusable table selection grid filtered by capacity/status |
| 8 | `src/components/tables/SectionColorPicker.tsx` | Color palette for section assignment |
| 9 | `src/app/reserve/[slug]/page.tsx` | Public reservation widget page |
| 10 | `src/app/reserve/[slug]/layout.tsx` | Public layout (no sidebar, no auth) |
| 11 | `src/app/reserve/[slug]/confirmation/page.tsx` | Reservation confirmation page |
| 12 | `src/app/api/reserve/[slug]/route.ts` | Public API: get availability for location |
| 13 | `src/app/api/reserve/[slug]/book/route.ts` | Public API: create reservation (rate-limited) |
| 14 | `src/app/api/tables/turn-times/route.ts` | Turn time reporting endpoint |
| 15 | `src/app/api/tables/sections/assign/route.ts` | Assign server to section |
| 16 | `src/app/api/waitlist/notify/route.ts` | Trigger SMS notification for waitlist entry |
| 17 | `src/hooks/use-table-realtime.ts` | Realtime subscription for table status changes |
| 18 | `src/hooks/use-reservation-realtime.ts` | Realtime subscription for reservation updates |
| 19 | `src/lib/sms/waitlist-templates.ts` | SMS template functions for waitlist notifications |
| 20 | `src/lib/tables/turn-time-calc.ts` | Turn time calculation utilities |

### Files to MODIFY

| # | File | What changes |
|---|------|-------------|
| 1 | `src/app/(pos)/tables/page.tsx` | Add tab navigation (Floor Plan / List / Capacity), integrate section colors, add turn time badges |
| 2 | `src/components/tables/FloorPlanCanvas.tsx` | Add section color overlay, turn time badge on each table, reservation indicator |
| 3 | `src/components/tables/TablePopover.tsx` | Add turn time display, section info, link to reservation if table has one |
| 4 | `src/components/tables/TableShape.tsx` | Add section color border/background tint, turn time badge slot |
| 5 | `src/components/tables/SectionFilter.tsx` | Add server name and section color to filter options |
| 6 | `src/components/tables/StatusSummary.tsx` | Add capacity percentage, estimated wait time |
| 7 | `src/app/(backoffice)/reservations/page.tsx` | Integrate with table assignment flow, add "Seat" action, connect to waitlist |
| 8 | `src/stores/table-store.ts` | Add section assignments, turn time tracking, view mode toggle (floor/list/capacity) |
| 9 | `src/app/api/reservations/[id]/seat/route.ts` | Auto-update table status when reservation is seated |
| 10 | `src/app/api/reservations/waitlist/[id]/seat/route.ts` | Auto-update table status when waitlist guest is seated |
| 11 | `src/app/api/tables/[id]/clear/route.ts` | Record turn time on clear, reset section if shift ended |
| 12 | `src/app/api/tables/[id]/seat/route.ts` | Start turn time tracking, link to reservation if applicable |

### Acceptance Criteria

- [ ] **AC-01:** Tables page shows three-tab navigation: "Floor Plan", "List", "Capacity" — default is Floor Plan
- [ ] **AC-02:** List view displays all tables in a sortable data table with columns: Table #, Status (colored dot + label), Server, Section (color pip), Guests, Time Seated, Check Total
- [ ] **AC-03:** List view sorts by any column header tap. Default sort: table number ascending
- [ ] **AC-04:** List view filters by section (dropdown), by status (multi-select), by server (dropdown)
- [ ] **AC-05:** Manager opens Section Assignment panel → sees all clocked-in servers on left, table grid on right → drags server onto tables → section color appears on those tables in both floor plan and list view
- [ ] **AC-06:** Each server section has a unique color from the 8-color palette. Color appears as a tinted border/background on the table shape in floor plan view and as a colored pip in list view
- [ ] **AC-07:** Turn time badge appears on every occupied table showing elapsed time since seating, color-coded by configurable thresholds (green/yellow/orange/red)
- [ ] **AC-08:** Turn time report endpoint returns average turn time by daypart, by server, by table, and by day of week for a given date range
- [ ] **AC-09:** Host taps "Seat" on a reservation → table picker opens showing only available tables with capacity >= party size → host selects table → table status changes to "seated" → reservation status changes to "seated" → success toast appears
- [ ] **AC-10:** If reservation has a pre-assigned table, that table is highlighted/recommended in the table picker but other tables remain selectable
- [ ] **AC-11:** Host adds walk-in to waitlist with name, phone, party size, quoted wait → entry appears in waitlist panel sorted by arrival time
- [ ] **AC-12:** Host taps "Notify" on waitlist entry → SMS sent via Twilio with restaurant name and table-ready message → entry status changes to "notified" → timestamp recorded
- [ ] **AC-13:** If notified guest doesn't check in within 15 minutes, waitlist entry turns amber with "No Response" badge. Host can remove or re-notify.
- [ ] **AC-14:** Capacity dashboard shows 4 KPI cards: Total Seats (number), Occupied (number + %), Available Tables (count), Avg Turn Time (minutes) — all updating in real-time
- [ ] **AC-15:** Capacity dashboard shows horizontal occupancy bar with green/yellow/red gradient based on capacity percentage
- [ ] **AC-16:** Capacity dashboard shows upcoming reservations for next 2 hours with party size, time, assigned table (if any), and status
- [ ] **AC-17:** Public reservation widget at `/reserve/[slug]` loads without authentication, shows date picker, time slot selector, party size, and guest info form
- [ ] **AC-18:** Reservation widget only shows available time slots based on actual table availability, operating hours, and existing reservations
- [ ] **AC-19:** Booking through widget creates a reservation record, sends SMS + email confirmation, and shows confirmation page with booking details
- [ ] **AC-20:** Widget is mobile-responsive and usable on both phone and desktop
- [ ] **AC-21:** Reservation no-show auto-detection: if not seated within 15min of reservation time, status changes to `no_show` and table is released
- [ ] **AC-22:** Double-booking prevention: cannot create two reservations for overlapping time slots on the same table
- [ ] **AC-23:** All table status changes propagate via Supabase Realtime to all connected terminals within 2 seconds
- [ ] **AC-24:** Section assignments persist across page refreshes and are visible to all terminals at the location

### Workflow Tests

**Workflow 1: Saturday Night Host Flow**
1. Host opens Tables page → switches to Capacity view → sees 60% occupied, 12 available tables
2. Reservation for "Smith, party of 4, 7:30 PM" appears in upcoming list
3. Smith party arrives → host taps reservation → taps "Seat" → table picker shows tables with 4+ seats
4. Host selects Table 14 → table status changes to "seated" → reservation status changes to "seated"
5. Floor plan shows Table 14 in blue with turn time badge starting at 0:00
6. Capacity dashboard updates to 64% occupied

**Workflow 2: Walk-in Waitlist Flow**
1. Walk-in party of 6 arrives, no tables available
2. Host adds to waitlist: "Johnson", phone number, party of 6, quoted 25 min
3. Table 8 (6-top) becomes available 20 minutes later → host sees notification
4. Host taps "Notify" on Johnson entry → SMS sent → status changes to "notified"
5. Johnson party returns → host taps "Seat" → selects Table 8 → table seats, waitlist entry closes
6. System records actual wait time (20min) vs quoted (25min) for reporting

**Workflow 3: Server Section Assignment**
1. Manager opens Section Assignment panel
2. Sees 4 clocked-in servers: Sarah, Mike, Lisa, Tom
3. Drags Sarah onto Tables 1-5 → coral section color appears on those tables
4. Drags Mike onto Tables 6-10 → teal section color appears
5. Floor plan shows color-tinted sections. List view shows colored pips.
6. Sarah logs into POS → her section tables are highlighted

**Workflow 4: Turn Time Monitoring**
1. Table 12 seated at 7:00 PM (dinner, 75min target)
2. At 7:40 PM → badge shows "40min" in green
3. At 7:50 PM → badge shows "50min" in yellow
4. At 8:20 PM → badge shows "80min" in orange
5. At 8:35 PM → badge shows "95min" in red (flashing)
6. Manager notices and checks on table. Table clears at 8:45.
7. Turn time of 105min recorded. Appears in reports as over-target for dinner.

**Workflow 5: Public Reservation Booking**
1. Customer visits restaurant website → clicks "Make a Reservation" → opens `/reserve/downtown-bistro`
2. Selects Friday, March 28 → sees available time slots (6:00, 6:30, 7:00, 7:30, 8:00, 8:30)
3. 7:00 PM slot shows "Limited" (only 2 tables available for that time)
4. Selects 7:00 PM, party of 4 → enters name, phone, email, "Anniversary dinner" as special request
5. Taps "Book Table" → confirmation page shows with all details
6. SMS sent: "Confirmed! Table for 4 at Downtown Bistro, Fri Mar 28 at 7:00 PM."
7. Reservation appears in host's reservation list with "Online" badge

**Workflow 6: No-Show Handling**
1. Reservation for "Garcia, party of 2, 8:00 PM" shows in upcoming list
2. 8:00 PM arrives → reservation highlights as "Due Now"
3. 8:15 PM → no check-in → system auto-changes status to "No Show"
4. Table released back to available pool → host can seat next waitlist guest
5. No-show count increments for Garcia's customer record (if linked)

**Workflow 7: Reservation Reminder SMS**
1. Reservation for "Patel, party of 6" booked for Saturday 7:00 PM
2. BullMQ scheduled job fires at Saturday 6:00 PM (1 hour before)
3. SMS sent via Twilio: "Reminder: Your table for 6 at Downtown Bistro is confirmed for tonight at 7:00 PM. Reply C to confirm or X to cancel."
4. Patel replies "C" → reservation status updated to "confirmed" → host sees green "Confirmed" badge
5. If Patel replies "X" → reservation cancelled → table released → host notified → next waitlist entry gets the slot

**Workflow 8: Multi-Terminal Sync**
1. Host at iPad #1 seats Table 14 → status changes to "seated"
2. Server at iPad #2 sees Table 14 turn blue within 2 seconds (Supabase Realtime)
3. Manager at iPad #3 sees capacity dashboard update from 60% to 64%
4. Bartender at iPad #4 sees table list view update with new "seated" status
5. No page refresh needed — all updates are real-time WebSocket pushes

---

## Design Specifications

### Table List View Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  [Floor Plan]  [List]  [Capacity]              Filter: [All Sections ▾] │
├───────┬──────────┬─────────┬──────────┬────────┬───────────┬───────────┤
│ Table │ Status   │ Server  │ Section  │ Guests │ Time      │ Check     │
├───────┼──────────┼─────────┼──────────┼────────┼───────────┼───────────┤
│ T1    │ ● Seated │ Sarah   │ ● Coral  │ 4/4    │ 32min 🟢  │ $87.50    │
│ T2    │ ● Avail  │ Sarah   │ ● Coral  │ -/6    │ -         │ -         │
│ T3    │ ● Served │ Mike    │ ● Teal   │ 2/2    │ 68min 🟡  │ $42.00    │
│ T4    │ ● Dirty  │ -       │ ● Teal   │ -/4    │ -         │ -         │
│ T5    │ ● Seated │ Lisa    │ ● Lavndr │ 6/8    │ 92min 🔴  │ $234.50   │
└───────┴──────────┴─────────┴──────────┴────────┴───────────┴───────────┘
```

- Row height: 48px (touch-friendly)
- Status dot: 10px circle with status color
- Section pip: 8px circle with section color next to server name
- Time badge: rounded pill with background color matching threshold
- Check total: right-aligned, tabular monospace font

### Capacity Dashboard Layout

```
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ Total Seats│ │  Occupied  │ │  Available │ │ Avg Turn   │
│    120     │ │  78 (65%)  │ │  12 tables │ │  62 min    │
└────────────┘ └────────────┘ └────────────┘ └────────────┘

┌─────────────────────────────────────────────────────────┐
│ Capacity ████████████████████░░░░░░░░░░░░░░  65%       │
│          0%            50%             100%              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Upcoming Reservations (next 2 hours)                    │
├──────────┬──────────────┬───────┬─────────┬─────────────┤
│ 7:00 PM  │ Smith, party 4│ T14  │ Confirm │ [Seat]      │
│ 7:00 PM  │ Jones, party 2│ -    │ Pending │ [Assign]    │
│ 7:30 PM  │ Patel, party 6│ T8   │ Confirm │ [Seat]      │
│ 8:00 PM  │ Garcia, party 2│ -   │ Online  │ [Assign]    │
└──────────┴──────────────┴───────┴─────────┴─────────────┘
```

### Reservation Widget Layout (Mobile-First)

```
┌─────────────────────────────────┐
│     🔥 Downtown Bistro          │
│     Make a Reservation          │
│                                 │
│  Date:  [  March 28, 2026  ▾]  │
│                                 │
│  Party Size:  [- 4 +]          │
│                                 │
│  Available Times:               │
│  [6:00] [6:30] [7:00*] [7:30]  │
│  [8:00] [8:30]                  │
│  * Limited availability         │
│                                 │
│  Name:    [_______________]     │
│  Phone:   [_______________]     │
│  Email:   [_______________]     │
│  Notes:   [_______________]     │
│                                 │
│  [    Book Table    ]           │
│                                 │
│  By booking, you agree to our   │
│  cancellation policy.           │
└─────────────────────────────────┘
```

- Time slots: 60px wide, 44px tall, rounded-full pills
- Selected time: filled with primary color (ember orange)
- "Limited" indicator: small text below slot
- Book button: full width, 56px tall, primary color
- Mobile responsive: stacks naturally on 375px screens

### Server Section Assignment Panel

```
┌──────────────────────────────────────────────────┐
│  Assign Server Sections                    [Done] │
├──────────────────┬───────────────────────────────┤
│  Clocked In      │  Tables                       │
│                  │                               │
│  ● Sarah (4 tbl) │  [T1] [T2] [T3] [T4] [T5]   │
│  ● Mike  (4 tbl) │  [T6] [T7] [T8] [T9] [T10]  │
│  ● Lisa  (3 tbl) │  [T11] [T12] [T13]           │
│  ● Tom   (0 tbl) │  [T14] [T15] [T16]           │
│                  │  [T17] [T18] [T19] [T20]      │
│  Color:         │                               │
│  [●][●][●][●]   │  Drag a server name onto      │
│  [●][●][●][●]   │  tables to assign sections.   │
├──────────────────┴───────────────────────────────┤
│  Unassigned: T14, T15, T16, T17, T18, T19, T20  │
└──────────────────────────────────────────────────┘
```

- Server names are draggable
- Tables show section color when assigned
- Unassigned tables listed at bottom
- Color picker shows 8 preset colors in a 4x2 grid
- Each color swatch is 32x32px with checkmark on selected

### Waitlist Panel Layout

```
┌─────────────────────────────────────────────────┐
│  Waitlist (4 parties)              [+ Add Guest] │
├──────┬───────────┬───────┬────────┬─────────────┤
│ Pos  │ Name      │ Party │ Wait   │ Actions     │
├──────┼───────────┼───────┼────────┼─────────────┤
│ 1    │ Johnson   │ 6     │ 22min  │ [Notify][✕] │
│ 2    │ Williams  │ 2     │ 15min  │ [Notify][✕] │
│ 3    │ Chen      │ 4     │ 8min   │ [Notify][✕] │
│ 4    │ Brown     │ 2     │ 3min   │ [Notify][✕] │
├──────┴───────────┴───────┴────────┴─────────────┤
│ Notified (waiting for return):                   │
│   Garcia (party 4) — notified 5 min ago         │
│   [Seat] [Re-notify] [Remove]                    │
└─────────────────────────────────────────────────┘
```

- "Notify" button: blue, sends SMS immediately
- Notified section: amber background, shows time since notification
- Remove button: requires confirmation ("Are you sure? This removes them from the waitlist.")
- Position numbers update automatically when someone is removed

---

## Database Changes

### New Indexes

| Table | Column(s) | Purpose |
|-------|-----------|---------|
| `reservations` | `location_id, date, status` | Availability queries |
| `reservations` | `location_id, customer_id` | Customer reservation history |
| `tables` | `location_id, section_id` | Section queries |
| `waitlist_entries` | `location_id, status, created_at` | Waitlist ordering |

### New Columns (if not already present)

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `tables` | `section_color` | `varchar(20)` | Section color assignment |
| `tables` | `assigned_server_id` | `uuid` | Server assigned to this table |
| `tables` | `seated_at` | `timestamptz` | When current party was seated |
| `tables` | `cleared_at` | `timestamptz` | When table was last cleared |
| `reservations` | `source` | `varchar(20)` | 'phone', 'walk_in', 'online', 'widget' |
| `reservations` | `reminder_sent_at` | `timestamptz` | When reminder SMS was sent |
| `waitlist_entries` | `notified_at` | `timestamptz` | When SMS notification was sent |
| `waitlist_entries` | `quoted_wait_minutes` | `integer` | Quoted wait time |
| `waitlist_entries` | `actual_wait_minutes` | `integer` | Actual wait time (computed on seat) |

### New Tables (if not already present)

**`table_turn_times`** — Historical turn time records
| Column | Type | Purpose |
|--------|------|---------|
| `id` | `uuid` (UUIDv7) | Primary key |
| `table_id` | `uuid` | FK to tables |
| `location_id` | `uuid` | FK to locations |
| `server_id` | `uuid` | FK to users |
| `seated_at` | `timestamptz` | When seated |
| `first_order_at` | `timestamptz` | When first order was placed |
| `payment_at` | `timestamptz` | When payment was processed |
| `cleared_at` | `timestamptz` | When cleared |
| `party_size` | `integer` | Guest count |
| `check_total` | `numeric(10,2)` | Total check amount |
| `daypart` | `varchar(20)` | lunch/dinner/brunch |

---

## Summary

This phase transforms three disconnected features (tables, reservations, waitlist) into one cohesive host management system. The key deliverables are:

1. **Table List View** — fast scanning alternative to floor plan with sortable columns
2. **Server Sections** — color-coded, drag-assign, visible on floor plan and list view
3. **Turn Time Tracking** — automatic measurement, visual badges, historical reporting
4. **Reservation-Table Integration** — arrival → seat → auto-status → turn time starts
5. **Waitlist-SMS Integration** — add → notify via Twilio → seat → actual wait recorded
6. **Capacity Dashboard** — real-time occupancy, estimated waits, upcoming reservations
7. **Embeddable Widget** — public reservation booking at `/reserve/[slug]`
8. **Reservation Reminders** — automated SMS 1 hour before via BullMQ + Twilio

20 new files, 12 modified files, 24 acceptance criteria, 8 workflow tests, 4 database indexes, 9 new columns, 1 new table.
