# Module 18: Catering & Events

## Overview

The Catering module handles large-format orders for events, parties, and corporate functions. It provides an event calendar, BEO (Banquet Event Order) templates, lead management pipeline, quote/contract generation, custom catering menus with special pricing, prep lists, pack sheets, invoicing, and deposit collection.

**Who uses it:** Catering managers handle leads, create quotes, and manage events. Kitchen managers use prep lists and pack sheets. Owners review catering revenue. Customers receive quotes, contracts, and invoices.

**Why it matters:** Catering margins are typically 10-15% higher than regular dine-in. A restaurant doing $50K/month in catering adds meaningful revenue with minimal incremental fixed cost. Proper catering management requires tools beyond standard POS order entry.

---

## Database Tables

### New Tables

- **`catering_events`** — Event records. Fields: `id`, `org_id`, `location_id`, `customer_id`, `event_name`, `event_date`, `event_time`, `end_time`, `guest_count`, `event_type` (corporate, wedding, birthday, holiday, social, other), `venue_name`, `venue_address` (jsonb), `status` (lead, quoted, confirmed, deposit_paid, in_progress, completed, cancelled), `contact_name`, `contact_phone`, `contact_email`, `special_instructions`, `internal_notes`, `assigned_to` (user_id), `created_at`, `updated_at`.
- **`catering_quotes`** — Quote documents. Fields: `id`, `event_id`, `quote_number`, `version`, `items` (jsonb array: [{name, quantity, unit_price, total, notes}]), `subtotal`, `tax`, `service_charge`, `service_charge_percentage`, `total`, `valid_until`, `status` (draft, sent, accepted, declined, expired), `sent_at`, `accepted_at`, `notes`, `created_by`, `created_at`.
- **`catering_menus`** — Custom catering menus. Fields: `id`, `org_id`, `name` (Corporate Lunch, Wedding Reception, BBQ Package), `description`, `per_person_price`, `min_guests`, `max_guests`, `items` (jsonb array of menu items with quantities), `is_active`, `created_at`.
- **`catering_invoices`** — Invoicing. Fields: `id`, `event_id`, `quote_id`, `invoice_number`, `amount_due`, `amount_paid`, `status` (pending, partial, paid, overdue, cancelled), `due_date`, `line_items` (jsonb), `payment_terms`, `sent_at`, `created_at`.
- **`catering_deposits`** — Deposit tracking. Fields: `id`, `event_id`, `invoice_id`, `amount`, `payment_method`, `payment_id`, `collected_by`, `collected_at`, `refunded`, `refunded_at`, `notes`, `created_at`.
- **`catering_prep_lists`** — Prep planning. Fields: `id`, `event_id`, `prep_date`, `items` (jsonb array: [{item_name, quantity, unit, prep_notes, assigned_to}]), `status` (pending, in_progress, completed), `created_by`, `created_at`.
- **`catering_pack_sheets`** — Packing checklists. Fields: `id`, `event_id`, `items` (jsonb array: [{item_name, quantity, packed, notes}]), `equipment` (jsonb: chafing dishes, serving utensils, linens), `status` (pending, packed, loaded), `packed_by`, `packed_at`, `created_at`.
- **`beo_templates`** — Banquet Event Order templates. Fields: `id`, `org_id`, `name`, `sections` (jsonb: [{section_name, content}] — e.g., Menu, Bar, Setup, AV, Timeline), `created_at`.

---

## API Routes

### Blueprint: `/api/v1/catering/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/events` | List catering events (filter: date, status, assigned_to) | Yes |
| POST | `/events` | Create catering event/lead | Yes |
| GET | `/events/:id` | Get event detail with quotes, invoices, prep | Yes |
| PUT | `/events/:id` | Update event | Yes |
| DELETE | `/events/:id` | Cancel event | Manager+ |
| POST | `/events/:id/convert` | Convert to POS order (for billing) | Yes |
| GET | `/quotes` | List quotes | Yes |
| POST | `/quotes` | Create quote for an event | Yes |
| PUT | `/quotes/:id` | Update quote | Yes |
| POST | `/quotes/:id/send` | Send quote to customer (email) | Yes |
| POST | `/quotes/:id/accept` | Mark quote as accepted | Yes |
| GET | `/menus` | List catering menus | Yes |
| POST | `/menus` | Create catering menu package | Manager+ |
| PUT | `/menus/:id` | Update catering menu | Manager+ |
| DELETE | `/menus/:id` | Deactivate menu | Manager+ |
| POST | `/invoices` | Create invoice for event | Manager+ |
| GET | `/invoices/:id` | Get invoice | Yes |
| POST | `/invoices/:id/send` | Send invoice to customer | Yes |
| POST | `/deposits` | Record deposit payment | Yes |
| GET | `/deposits/:event_id` | Get deposits for event | Yes |
| POST | `/prep-lists` | Generate prep list for event | Yes |
| GET | `/prep-lists/:id` | Get prep list | Yes |
| PUT | `/prep-lists/:id` | Update prep list status | Yes |
| POST | `/pack-sheets` | Generate pack sheet for event | Yes |
| GET | `/pack-sheets/:id` | Get pack sheet | Yes |
| PUT | `/pack-sheets/:id` | Update pack sheet | Yes |
| GET | `/beo-templates` | List BEO templates | Yes |
| POST | `/beo-templates` | Create BEO template | Manager+ |
| POST | `/events/:id/beo` | Generate BEO from template for event | Yes |
| GET | `/calendar` | Calendar view data (events by date range) | Yes |

---

## UI Pages / Components

### Event Calendar — `/admin/catering`
- Monthly calendar view with event markers
- Color-coded by status (lead=gray, confirmed=blue, deposit_paid=green, completed=purple)
- Click date to add event, click event to view details
- List view toggle for detailed upcoming events

### Event Detail — `/admin/catering/events/:id`
- **Header:** Event name, date, status badge, customer info
- **Tabs:** Overview, Quote, Invoice, Prep, Pack Sheet, BEO, Notes
- **Overview:** Guest count, venue, contact, special instructions, assigned staff
- **Quote tab:** Quote builder with line items, pricing, send/accept/decline actions
- **Invoice tab:** Invoice generated from accepted quote, payment status
- **Prep tab:** Auto-generated prep list from quote items, checkboxes
- **Pack tab:** Equipment and item checklist for off-premise events
- **BEO tab:** Generated BEO document with all event details
- **Status workflow buttons:** Progress event through stages

### Lead Pipeline — `/admin/catering/pipeline`
- Kanban-style view: Lead → Quoted → Confirmed → Deposit Paid → Completed
- Drag events between stages
- Card shows: Event name, date, guest count, estimated value

### Quote Builder
- Select from catering menus or build custom
- Line items: Item name, quantity, unit price, notes
- Service charge (percentage or fixed)
- Tax calculation
- Total with deposit amount indicator
- Preview as PDF
- Send via email with accept/decline links

### Catering Menu Manager — `/admin/catering/menus`
- Package-style menus: "Corporate Lunch ($18/person)" with included items
- Per-person pricing with min/max guests
- Customizable items per package

---

## Business Rules

1. **Lead-to-event pipeline:** Events start as leads (inquiry). The flow: Lead → Quoted (quote sent) → Confirmed (quote accepted) → Deposit Paid → In Progress (day of) → Completed. Each transition can trigger notifications.

2. **Quote versioning:** Quotes can be revised. Each revision increments `version`. Only the latest version is active. Historical versions are preserved.

3. **Deposit policy:** Configurable deposit requirement (e.g., 50% deposit to confirm). Deposits tracked separately. Balance due on event date or net terms.

4. **Catering-specific pricing:** Catering menus have per-person pricing separate from the regular menu. Items can be priced differently for catering. Service charges (typically 18-22%) are configurable per event.

5. **POS integration:** When a catering event reaches "in progress," it can be converted to a POS order for billing and payment processing. This allows using the standard payment flow (card, cash, house account).

6. **Prep list auto-generation:** Prep lists are auto-generated from the accepted quote items. Each item gets a quantity (event guest_count x per-person qty), prep instructions, and can be assigned to a prep cook.

7. **Pack sheet for off-premise:** Off-premise catering events generate a pack sheet listing all food items, equipment (chafing dishes, serving utensils, linens, plates), and transport requirements.

8. **BEO (Banquet Event Order):** A formal document containing all event details: client info, event schedule/timeline, menu, bar setup, A/V requirements, room setup, staffing, and special notes. Generated from templates.

9. **Invoicing:** Invoices are generated from accepted quotes. They include line items, deposits already paid, and balance due. Invoices can be sent via email with payment link.

10. **Calendar conflicts:** The system warns if multiple events are booked for the same date/time at the same location, considering capacity limits.

---

## Dependencies

- **01_auth** — Authentication
- **02_menu** — Menu items for catering menu packages
- **03_orders** — Order creation when converting event to POS order
- **04_payments** — Deposit and balance payment processing
- **08_customers** — Customer records for catering clients
- **10_settings** — Location config
- **External: SendGrid** — Email quotes, invoices, confirmations

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `catering.lead_created` | Internal | `{event_id, customer}` | New catering inquiry |
| `catering.quote_sent` | Internal | `{event_id, quote_id}` | Quote emailed to customer |
| `catering.confirmed` | Internal | `{event_id}` | Event confirmed |
| `catering.deposit_received` | Internal | `{event_id, amount}` | Deposit payment recorded |

### Subscribed Events
- None specific (catering is primarily a management workflow, not real-time)

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `quote_expiry_check` | Daily at 9 AM | Flag expired quotes, notify manager |
| `event_reminder` | Daily at 9 AM | Remind staff of events in the next 3 days |
| `invoice_overdue_check` | Daily at 10 AM | Flag overdue invoices, send reminder email |
| `prep_list_generation` | 2 days before event | Auto-generate prep list for confirmed events |

---

## Acceptance Criteria

### Event Management
- [ ] User can create a catering event with date, guest count, customer, venue
- [ ] Events display on calendar view with status color-coding
- [ ] Events progress through pipeline: Lead → Quoted → Confirmed → Completed
- [ ] Kanban pipeline view shows events by stage

### Quotes
- [ ] User can build a quote with line items (from catering menus or custom)
- [ ] Service charge calculated and applied
- [ ] Quote can be previewed as PDF
- [ ] Quote can be sent via email to customer
- [ ] Quote versioning tracks revisions
- [ ] Customer can accept/decline (via email link or manual staff update)

### Deposits & Invoicing
- [ ] Deposit amount calculated from configurable policy
- [ ] Deposit payment recorded and tracked
- [ ] Invoice generated from accepted quote
- [ ] Invoice shows deposits applied and balance due
- [ ] Invoice sent via email

### Prep & Pack
- [ ] Prep list auto-generated from accepted quote items
- [ ] Prep items have quantity, instructions, and assignment
- [ ] Pack sheet generated for off-premise events
- [ ] Equipment checklist included in pack sheet

### BEO
- [ ] BEO generated from template with event-specific details
- [ ] BEO includes menu, timeline, setup, staffing, special notes
- [ ] BEO exportable as PDF

### POS Integration
- [ ] Confirmed event can be converted to POS order
- [ ] Payment processed through standard POS payment flow
