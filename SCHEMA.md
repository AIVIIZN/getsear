# Sear POS — Complete Database Schema

> Database-only specification for the Sear POS rebuild.
> This document is the single source of truth for every table, column, enum, index, and RLS policy.

---

## 1. Overview

| Property | Value |
|----------|-------|
| Engine | PostgreSQL 17.6 via Supabase |
| Region | us-east-1 |
| IDs | UUIDv7 (time-sortable, application-generated) |
| Timestamps | `timestamptz`, stored in UTC, displayed in `locations.timezone` |
| Money | `numeric(10,2)` stored as dollars in the database. Python API layer uses integer cents — conversion happens at the service boundary. |
| Multi-tenancy | Shared schema. Every tenant-scoped table carries `org_id`. Enforced via RLS. |
| Soft deletes | Reference data (menu items, staff, customers, categories, orgs, locations) uses `deleted_at timestamptz`. Transactional data uses hard deletes after retention period. |
| Tracking | Every table has `created_at timestamptz NOT NULL DEFAULT now()` and `updated_at timestamptz NOT NULL DEFAULT now()`. Transactional tables also carry `created_by` / `updated_by`. |

---

## 2. Naming Conventions

| Rule | Example |
|------|---------|
| All table and column names are `snake_case` | `order_items`, `menu_item_id` |
| Organization FK is `org_id` (not `organization_id`) | `org_id uuid NOT NULL REFERENCES organizations(id)` |
| All foreign key columns end with `_id` | `location_id`, `server_id`, `customer_id` |
| All timestamp columns end with `_at` | `created_at`, `opened_at`, `settled_at` |
| All boolean columns start with `is_` or `has_` | `is_active`, `is_voided`, `is_taxable` |
| Date columns end with `_date` | `shift_date`, `metric_date` |
| Enum type names match the column name where used | `order_status` type → `status order_status` column on `orders` |
| Join tables concatenate both entity names | `menu_item_modifier_groups` |
| Index names follow `idx_{table}_{column(s)}` | `idx_orders_location`, `idx_orders_status` |

---

## 3. Enum Types

### order_status

Order lifecycle state machine.

```sql
CREATE TYPE order_status AS ENUM (
    'draft',      -- Being built on terminal, not yet sent
    'open',       -- Sent to kitchen/bar, actively being worked
    'fired',      -- Kitchen has started preparing
    'ready',      -- Ready for pickup/serve
    'served',     -- Delivered to guest
    'closed',     -- Fully paid and complete
    'voided',     -- Cancelled entirely
    'refunded'    -- Closed then refunded
);
```

### order_type

```sql
CREATE TYPE order_type AS ENUM (
    'dine_in', 'takeout', 'delivery', 'bar', 'catering', 'online', 'kiosk', 'drive_thru'
);
```

### payment_status

```sql
CREATE TYPE payment_status AS ENUM (
    'pending',      -- Payment initiated
    'authorized',   -- Card authorized, not yet captured
    'captured',     -- Card charged
    'settled',      -- Funds transferred (end of day batch)
    'declined',     -- Card declined
    'voided',       -- Authorization voided before capture
    'refunded',     -- Partial or full refund
    'failed'        -- Processing error
);
```

### payment_method

```sql
CREATE TYPE payment_method AS ENUM (
    'cash', 'credit_card', 'debit_card', 'gift_card', 'house_account',
    'apple_pay', 'google_pay', 'external'
);
```

### user_role

```sql
CREATE TYPE user_role AS ENUM (
    'platform_admin',  -- Sear internal admin
    'owner',           -- Restaurant owner
    'admin',           -- Restaurant admin/GM
    'manager',         -- Shift manager
    'server',          -- Front of house
    'bartender',       -- Bar
    'host',            -- Host/hostess
    'kitchen',         -- Back of house
    'cashier',         -- Cashier-only access
    'driver',          -- Delivery driver
    'kiosk',           -- Kiosk device account
    'readonly'         -- View-only (accountant, etc.)
);
```

### terminal_type

```sql
CREATE TYPE terminal_type AS ENUM (
    'server_station', 'bar', 'host', 'cashier', 'kds', 'kiosk',
    'customer_display', 'drive_thru'
);
```

### discount_type

```sql
CREATE TYPE discount_type AS ENUM (
    'percentage', 'fixed_amount', 'bogo', 'free_item'
);
```

### comp_reason

```sql
CREATE TYPE comp_reason AS ENUM (
    'manager_comp', 'quality_issue', 'service_issue', 'birthday',
    'vip', 'employee_meal', 'promotional', 'other'
);
```

### void_reason

```sql
CREATE TYPE void_reason AS ENUM (
    'customer_request', 'kitchen_error', 'server_error', 'wrong_item',
    'quality_issue', '86d', 'duplicate', 'other'
);
```

### cash_drawer_event_type

```sql
CREATE TYPE cash_drawer_event_type AS ENUM (
    'open_shift', 'close_shift', 'cash_sale', 'cash_refund',
    'paid_in', 'paid_out', 'tip_payout', 'no_sale', 'count'
);
```

---

## 4. RLS Policy Pattern

Every table with tenant data has RLS enabled. Policies use JWT claims from `current_setting('request.jwt.claims')`.

### Tenant isolation (applied to every org-scoped table)

```sql
-- SELECT: user sees only their org's rows
CREATE POLICY "tenant_isolation_select" ON <table>
  FOR SELECT USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );

-- INSERT: user can only insert for their org
CREATE POLICY "tenant_isolation_insert" ON <table>
  FOR INSERT WITH CHECK (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );

-- UPDATE: user can only update their org's rows
CREATE POLICY "tenant_isolation_update" ON <table>
  FOR UPDATE USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );

-- DELETE: user can only delete their org's rows
CREATE POLICY "tenant_isolation_delete" ON <table>
  FOR DELETE USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );
```

### Location-scoped policy (orders, shifts, time_entries, etc.)

Owner/admin roles see all locations. Other roles see only their assigned `location_ids` from JWT claims.

```sql
CREATE POLICY "location_scoped_select" ON <table>
  FOR SELECT USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
    AND (
      (current_setting('request.jwt.claims', true)::json->>'role') IN ('owner', 'admin')
      OR
      location_id = ANY(
        ARRAY(SELECT json_array_elements_text(
          current_setting('request.jwt.claims', true)::json->'location_ids'
        ))::uuid[]
      )
    )
  );
```

### Platform admin bypass

```sql
CREATE POLICY "platform_admin_bypass" ON <table>
  FOR ALL USING (
    (current_setting('request.jwt.claims', true)::json->>'platform_role') = 'platform_admin'
  );
```

---

## 5. Tables — Core

### organizations

Restaurant group / billing entity.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| name | text | NO | | Organization name |
| slug | text | NO | | URL-friendly identifier, globally unique |
| plan | text | NO | 'starter' | Subscription tier: starter, professional, enterprise |
| subscription_status | text | NO | 'trialing' | trialing, active, past_due, cancelled |
| trial_ends_at | timestamptz | YES | | |
| logo_url | text | YES | | |
| primary_color | text | YES | '#1a1a2e' | Brand hex color |
| owner_name | text | YES | | |
| owner_email | text | YES | | |
| owner_phone | text | YES | | |
| settings | jsonb | NO | '{}' | Org-wide defaults: default_currency, default_timezone, receipt_header, receipt_footer, tip_percentages |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| deleted_at | timestamptz | YES | | Soft delete |

**PK:** `id`
**Unique:** `slug`
**RLS:** Platform-level; org owners/admins see their own org.

---

### locations

Physical restaurant site belonging to an organization.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| name | text | NO | | e.g. "Downtown Location" |
| slug | text | NO | | URL-friendly, unique within org |
| address_line1 | text | YES | | |
| address_line2 | text | YES | | |
| city | text | YES | | |
| state | text | YES | | |
| zip | text | YES | | |
| country | text | YES | 'US' | |
| latitude | numeric(10,7) | YES | | |
| longitude | numeric(10,7) | YES | | |
| phone | text | YES | | |
| email | text | YES | | |
| timezone | text | NO | 'America/New_York' | IANA timezone for display |
| currency | text | NO | 'USD' | |
| business_hours | jsonb | NO | '[]' | Array: [{day, open, close}] |
| settings | jsonb | NO | '{}' | Overrides org defaults: auto_gratuity_pct, default_tax_rate_id, order_number_prefix, etc. |
| is_active | boolean | NO | true | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| deleted_at | timestamptz | YES | | Soft delete |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`
**Unique:** `(org_id, slug)`
**Indexes:** `idx_locations_org(org_id)`
**RLS:** Tenant isolation on org_id.

---

### terminals

iPad or device registered to a location.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| name | text | NO | | e.g. "Bar iPad 1" |
| terminal_type | terminal_type | NO | | Enum |
| device_id | text | YES | | Browser fingerprint or assigned ID |
| is_online | boolean | NO | false | |
| last_heartbeat_at | timestamptz | YES | | |
| current_user_id | uuid | YES | | FK → users; currently logged-in user |
| settings | jsonb | NO | '{}' | assigned_sections, default_order_type, printer_ip |
| is_active | boolean | NO | true | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `current_user_id` → `users(id)`
**Indexes:** `idx_terminals_location(location_id)`
**RLS:** Tenant isolation on org_id.

---

### org_modules

Tracks which optional modules are enabled per organization.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| module_id | text | NO | | e.g. 'mod.kds', 'mod.inventory', 'mod.loyalty' |
| is_enabled | boolean | NO | true | |
| enabled_at | timestamptz | NO | now() | |
| disabled_at | timestamptz | YES | | |
| config | jsonb | NO | '{}' | Module-specific configuration |
| location_ids | uuid[] | YES | NULL | Which locations have this module; NULL = all |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`
**Unique:** `(org_id, module_id)`
**Indexes:** `idx_org_modules_org(org_id)`
**RLS:** Tenant isolation on org_id.

---

### module_migrations

Tracks applied migrations per module per tenant.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| module_id | text | NO | | Which module |
| migration_name | text | NO | | Migration file identifier |
| applied_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`
**Unique:** `(org_id, module_id, migration_name)`

---

### users

Staff members / system users.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | | PK (matches Supabase Auth user ID) |
| org_id | uuid | NO | | FK → organizations |
| email | text | YES | | |
| phone | text | YES | | |
| first_name | text | NO | | |
| last_name | text | NO | | |
| display_name | text | YES | | Shown on receipts/orders |
| avatar_url | text | YES | | |
| pin_hash | text | YES | | 4-6 digit PIN, bcrypt hashed |
| role | user_role | NO | 'server' | |
| location_ids | uuid[] | NO | '{}' | Which locations this user can access |
| hire_date | date | YES | | |
| hourly_rate | numeric(8,2) | YES | | |
| is_active | boolean | NO | true | |
| settings | jsonb | NO | '{}' | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| deleted_at | timestamptz | YES | | Soft delete |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`
**Indexes:** `idx_users_org(org_id)`, `idx_users_email(email)`, `idx_users_pin(org_id, pin_hash) WHERE pin_hash IS NOT NULL`
**RLS:** Tenant isolation on org_id.

---

### permissions

Granular permission definitions (beyond role-based defaults).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| code | text | NO | | Unique permission code: 'orders.void', 'reports.payroll', 'menu.edit' |
| module_id | text | NO | | Which module defines this permission |
| description | text | YES | | |
| category | text | YES | | UI grouping |

**PK:** `id`
**Unique:** `code`

---

### role_permissions

Maps default permissions to roles.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| role | user_role | NO | | Enum value |
| permission_id | uuid | NO | | FK → permissions |

**PK:** `(role, permission_id)`
**FK:** `permission_id` → `permissions(id)`

---

### user_permission_overrides

Per-user grant/deny overrides beyond role defaults.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| user_id | uuid | NO | | FK → users |
| permission_id | uuid | NO | | FK → permissions |
| granted | boolean | NO | | true = grant, false = deny |

**PK:** `(user_id, permission_id)`
**FK:** `user_id` → `users(id)`, `permission_id` → `permissions(id)`

---

### menu_categories

Groupings for menu items (e.g. "Appetizers", "Drinks").

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | YES | | FK → locations; NULL = org-wide template |
| name | text | NO | | |
| description | text | YES | | |
| sort_order | int | NO | 0 | |
| is_active | boolean | NO | true | |
| available_start_time | time | YES | | Category only shows during these hours |
| available_end_time | time | YES | | |
| available_days | int[] | YES | '{0,1,2,3,4,5,6}' | 0=Sunday |
| color | text | YES | | Hex color for POS button |
| image_url | text | YES | | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| deleted_at | timestamptz | YES | | Soft delete |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`
**Indexes:** `idx_menu_categories_org(org_id)`, `idx_menu_categories_location(location_id)`
**RLS:** Tenant isolation on org_id.

---

### menu_items

Individual sellable items on the menu.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| category_id | uuid | NO | | FK → menu_categories |
| location_id | uuid | YES | | FK → locations; NULL = org-wide |
| name | text | NO | | |
| short_name | text | YES | | Abbreviated for kitchen tickets |
| description | text | YES | | |
| price | numeric(10,2) | NO | | Base price (cash price under Dual Pricing) |
| cost | numeric(10,2) | YES | | Food cost for margin tracking |
| tax_rate_id | uuid | YES | | FK → tax_rates |
| is_taxable | boolean | NO | true | |
| prep_station | text | YES | | 'grill', 'fryer', 'cold', 'bar', 'expo' |
| prep_time_minutes | int | YES | | |
| course | text | YES | | 'appetizer', 'entree', 'dessert', 'drink' |
| is_active | boolean | NO | true | |
| is_86d | boolean | NO | false | Temporarily unavailable |
| available_start_time | time | YES | | |
| available_end_time | time | YES | | |
| available_days | int[] | YES | '{0,1,2,3,4,5,6}' | |
| color | text | YES | | POS button color |
| image_url | text | YES | | |
| sort_order | int | NO | 0 | |
| nutrition | jsonb | YES | | Calories, macros (for online ordering) |
| allergens | text[] | YES | | e.g. ['gluten', 'dairy', 'nuts'] |
| plu_code | text | YES | | Price look-up code |
| barcode | text | YES | | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| deleted_at | timestamptz | YES | | Soft delete |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `category_id` → `menu_categories(id)`, `location_id` → `locations(id)`, `tax_rate_id` → `tax_rates(id)`
**Indexes:** `idx_menu_items_org(org_id)`, `idx_menu_items_category(category_id)`, `idx_menu_items_location(location_id)`, `idx_menu_items_plu(org_id, plu_code) WHERE plu_code IS NOT NULL`
**RLS:** Tenant isolation on org_id.

---

### modifier_groups

Groups of modifiers that can be attached to menu items (e.g. "Temperature", "Sides").

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| name | text | NO | | e.g. "Temperature", "Sides", "Add-ons" |
| min_selections | int | NO | 0 | 0 = optional |
| max_selections | int | NO | 1 | 1 = pick one, >1 = pick many |
| is_required_prompt | boolean | NO | false | Force server to actively choose even if min=0 |
| sort_order | int | NO | 0 | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| deleted_at | timestamptz | YES | | Soft delete |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`
**Indexes:** `idx_modifier_groups_org(org_id)`
**RLS:** Tenant isolation on org_id.

---

### modifiers

Individual modifier choices within a group.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| modifier_group_id | uuid | NO | | FK → modifier_groups |
| name | text | NO | | |
| short_name | text | YES | | |
| price_adjustment | numeric(10,2) | NO | 0 | Additional cost |
| is_default | boolean | NO | false | |
| is_active | boolean | NO | true | |
| sort_order | int | NO | 0 | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| deleted_at | timestamptz | YES | | Soft delete |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `modifier_group_id` → `modifier_groups(id)`
**Indexes:** `idx_modifiers_group(modifier_group_id)`
**RLS:** Tenant isolation on org_id.

---

### menu_item_modifier_groups

Join table: which modifier groups apply to which menu items.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| menu_item_id | uuid | NO | | FK → menu_items |
| modifier_group_id | uuid | NO | | FK → modifier_groups |
| sort_order | int | NO | 0 | |

**PK:** `(menu_item_id, modifier_group_id)`
**FK:** `menu_item_id` → `menu_items(id)`, `modifier_group_id` → `modifier_groups(id)`

---

### tax_rates

Tax rate configurations per location.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | YES | | FK → locations; NULL = org-wide default |
| name | text | NO | | e.g. "State Sales Tax", "Alcohol Tax" |
| rate | numeric(6,4) | NO | | 0.0825 = 8.25% |
| is_inclusive | boolean | NO | false | VAT-style (price includes tax) |
| is_default | boolean | NO | false | |
| applies_to | text[] | YES | '{}' | Empty = all items; ['alcohol', 'food', 'merchandise'] |
| is_active | boolean | NO | true | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`
**Indexes:** `idx_tax_rates_org(org_id)`, `idx_tax_rates_location(location_id)`
**RLS:** Tenant isolation on org_id.

---

### orders

The core order record.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| terminal_id | uuid | YES | | FK → terminals |
| order_number | int | NO | | Sequential per-location, per-day |
| display_number | text | NO | | e.g. "A-042" (shown to customer) |
| order_type | order_type | NO | 'dine_in' | |
| status | order_status | NO | 'draft' | |
| server_id | uuid | YES | | FK → users |
| table_id | uuid | YES | | FK → tables |
| customer_id | uuid | YES | | FK → customers |
| guest_count | int | YES | | |
| guest_name | text | YES | | For takeout/delivery |
| guest_phone | text | YES | | |
| subtotal | numeric(10,2) | NO | 0 | Denormalized; authoritative from line items |
| discount_total | numeric(10,2) | NO | 0 | |
| tax_total | numeric(10,2) | NO | 0 | |
| tip_total | numeric(10,2) | NO | 0 | |
| total | numeric(10,2) | NO | 0 | |
| amount_paid | numeric(10,2) | NO | 0 | |
| balance_due | numeric(10,2) | NO | 0 | |
| opened_at | timestamptz | NO | now() | |
| sent_at | timestamptz | YES | | When first sent to kitchen |
| closed_at | timestamptz | YES | | |
| scheduled_for | timestamptz | YES | | Scheduled pickup/delivery time |
| delivery_address | jsonb | YES | | {line1, line2, city, state, zip} |
| fire_course_2_at | timestamptz | YES | | When to fire entrees |
| notes | text | YES | | Internal staff notes |
| source | text | YES | 'pos' | 'pos', 'online', 'kiosk', 'phone', 'catering', 'drive_thru', 'qr' |
| metadata | jsonb | NO | '{}' | online_order_id, delivery_partner, catering_event_id, etc. |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| created_by | uuid | YES | | FK → users |
| updated_by | uuid | YES | | FK → users |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `terminal_id` → `terminals(id)`, `server_id` → `users(id)`, `table_id` → `tables(id)`, `customer_id` → `customers(id)`, `created_by` → `users(id)`, `updated_by` → `users(id)`
**Indexes:** `idx_orders_org(org_id)`, `idx_orders_location(location_id)`, `idx_orders_status(location_id, status)`, `idx_orders_server(server_id)`, `idx_orders_table(table_id) WHERE table_id IS NOT NULL`, `idx_orders_customer(customer_id) WHERE customer_id IS NOT NULL`, `idx_orders_opened(location_id, opened_at)`, `idx_orders_number(location_id, order_number)`
**RLS:** Tenant isolation + location-scoped.

**Helper function:**
```sql
CREATE OR REPLACE FUNCTION next_order_number(p_location_id uuid)
RETURNS int AS $$
DECLARE
    v_next int;
BEGIN
    SELECT COALESCE(MAX(order_number), 0) + 1 INTO v_next
    FROM orders
    WHERE location_id = p_location_id
      AND opened_at::date = CURRENT_DATE;
    RETURN v_next;
END;
$$ LANGUAGE plpgsql;
```

---

### order_items

Line items on an order.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| order_id | uuid | NO | | FK → orders (ON DELETE CASCADE) |
| menu_item_id | uuid | YES | | FK → menu_items; NULL for open/custom items |
| name | text | NO | | Snapshot of item name at time of order |
| short_name | text | YES | | |
| quantity | int | NO | 1 | |
| unit_price | numeric(10,2) | NO | | |
| modifier_total | numeric(10,2) | NO | 0 | Sum of modifier price adjustments |
| discount_amount | numeric(10,2) | NO | 0 | |
| tax_amount | numeric(10,2) | NO | 0 | |
| line_total | numeric(10,2) | NO | | (unit_price + modifier_total) * quantity - discount |
| prep_station | text | YES | | Kitchen routing |
| course | int | YES | 1 | 1 = first course, 2 = entree, etc. |
| seat_number | int | YES | | Which seat at the table |
| is_sent | boolean | NO | false | Sent to kitchen |
| is_fired | boolean | NO | false | Kitchen started making it |
| is_ready | boolean | NO | false | Ready to serve |
| is_served | boolean | NO | false | |
| is_voided | boolean | NO | false | |
| void_reason | void_reason | YES | | |
| voided_by | uuid | YES | | FK → users |
| voided_at | timestamptz | YES | | |
| is_comped | boolean | NO | false | |
| comp_reason | comp_reason | YES | | |
| comp_amount | numeric(10,2) | YES | | |
| comped_by | uuid | YES | | FK → users |
| notes | text | YES | | "No onions", "Extra sauce" |
| sent_at | timestamptz | YES | | |
| fired_at | timestamptz | YES | | |
| ready_at | timestamptz | YES | | |
| served_at | timestamptz | YES | | |
| sort_order | int | NO | 0 | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| created_by | uuid | YES | | FK → users |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `order_id` → `orders(id)`, `menu_item_id` → `menu_items(id)`, `voided_by` → `users(id)`, `comped_by` → `users(id)`, `created_by` → `users(id)`
**Indexes:** `idx_order_items_order(order_id)`, `idx_order_items_org(org_id)`, `idx_order_items_menu_item(menu_item_id)`, `idx_order_items_status(order_id, is_sent, is_voided)`
**RLS:** Tenant isolation on org_id.

---

### order_item_modifiers

Modifiers applied to a specific order item (snapshot at time of order).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| order_item_id | uuid | NO | | FK → order_items (ON DELETE CASCADE) |
| modifier_id | uuid | YES | | FK → modifiers; NULL for custom modifiers |
| modifier_group_id | uuid | YES | | FK → modifier_groups |
| name | text | NO | | Snapshot |
| price_adjustment | numeric(10,2) | NO | 0 | |
| quantity | int | NO | 1 | |
| created_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `order_item_id` → `order_items(id)`, `modifier_id` → `modifiers(id)`, `modifier_group_id` → `modifier_groups(id)`
**Indexes:** `idx_order_item_modifiers_item(order_item_id)`

---

### order_modifications

Audit trail of changes to orders after they have been sent.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| order_id | uuid | NO | | FK → orders |
| order_item_id | uuid | YES | | FK → order_items |
| modification_type | text | NO | | 'add_item', 'remove_item', 'modify_item', 'change_quantity', 'void_item', 'comp_item', 'change_table', 'change_server', 'apply_discount' |
| description | text | NO | | Human-readable description |
| previous_value | jsonb | YES | | Before state |
| new_value | jsonb | YES | | After state |
| performed_by | uuid | NO | | FK → users |
| approved_by | uuid | YES | | FK → users (manager approval) |
| created_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `order_id` → `orders(id)`, `order_item_id` → `order_items(id)`, `performed_by` → `users(id)`, `approved_by` → `users(id)`
**Indexes:** `idx_order_mods_order(order_id)`, `idx_order_mods_org(org_id)`
**RLS:** Tenant isolation on org_id.

---

### payments

Payment records (one order can have multiple payments for splits).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| order_id | uuid | NO | | FK → orders |
| payment_method | payment_method | NO | | |
| status | payment_status | NO | 'pending' | |
| amount | numeric(10,2) | NO | | Amount applied to this order |
| tip_amount | numeric(10,2) | NO | 0 | |
| total_amount | numeric(10,2) | NO | | amount + tip |
| processor_transaction_id | text | YES | | From Valor |
| card_brand | text | YES | | 'visa', 'mastercard', 'amex', 'discover' |
| card_last_four | text | YES | | '4242' |
| auth_code | text | YES | | 6-digit auth code |
| gift_card_id | uuid | YES | | FK → gift_cards |
| cash_tendered | numeric(10,2) | YES | | |
| change_due | numeric(10,2) | YES | | |
| split_index | int | YES | | 1, 2, 3... for split payments |
| refund_amount | numeric(10,2) | YES | | |
| refund_reason | text | YES | | |
| refunded_by | uuid | YES | | FK → users |
| refunded_at | timestamptz | YES | | |
| original_payment_id | uuid | YES | | FK → payments (for refund records) |
| processed_by | uuid | NO | | FK → users |
| processed_at | timestamptz | NO | now() | |
| processor_response | jsonb | YES | | Full processor response payload |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `order_id` → `orders(id)`, `gift_card_id` → `gift_cards(id)`, `refunded_by` → `users(id)`, `original_payment_id` → `payments(id)`, `processed_by` → `users(id)`
**Indexes:** `idx_payments_order(order_id)`, `idx_payments_org(org_id)`, `idx_payments_processor_txn(processor_transaction_id) WHERE processor_transaction_id IS NOT NULL`
**RLS:** Tenant isolation on org_id.

---

### tip_adjustments

Post-close tip changes (common with card tips signed on paper).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| payment_id | uuid | NO | | FK → payments |
| order_id | uuid | NO | | FK → orders |
| server_id | uuid | NO | | FK → users |
| original_tip | numeric(10,2) | NO | | |
| adjusted_tip | numeric(10,2) | NO | | |
| reason | text | YES | | |
| adjusted_by | uuid | NO | | FK → users |
| created_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `payment_id` → `payments(id)`, `order_id` → `orders(id)`, `server_id` → `users(id)`, `adjusted_by` → `users(id)`
**RLS:** Tenant isolation on org_id.

---

### tip_distributions

Tracks how tips are distributed to individual staff members.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| shift_date | date | NO | | |
| payment_id | uuid | YES | | FK → payments |
| order_id | uuid | YES | | FK → orders |
| tip_amount | numeric(10,2) | NO | | Total tip being distributed |
| tip_type | text | NO | | 'credit_card', 'cash_reported', 'auto_gratuity' |
| user_id | uuid | NO | | FK → users (recipient) |
| distribution_method | text | NO | | 'direct', 'pool', 'tipout' |
| amount | numeric(10,2) | NO | | Amount this staff member receives |
| tipout_from_user_id | uuid | YES | | FK → users; who they received tipout from |
| tipout_percentage | numeric(5,2) | YES | | |
| created_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `payment_id` → `payments(id)`, `order_id` → `orders(id)`, `user_id` → `users(id)`, `tipout_from_user_id` → `users(id)`
**Indexes:** `idx_tip_distributions_user_date(user_id, shift_date)`, `idx_tip_distributions_org_date(org_id, shift_date)`
**RLS:** Tenant isolation on org_id.

---

### cash_tip_reports

Self-reported cash tips per shift (for IRS Form 8027 compliance).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| user_id | uuid | NO | | FK → users |
| shift_date | date | NO | | |
| reported_amount | numeric(10,2) | NO | | |
| reported_at | timestamptz | NO | now() | |

**PK:** `id`
**Unique:** `(user_id, shift_date)`
**FK:** `org_id` → `organizations(id)`, `user_id` → `users(id)`
**RLS:** Tenant isolation on org_id.

---

### discounts

Discount definitions (templates that can be applied to orders).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| name | text | NO | | e.g. "Happy Hour", "Employee 50%", "Senior 10%" |
| discount_type | discount_type | NO | | |
| percentage | numeric(5,2) | YES | | For percentage type |
| fixed_amount | numeric(10,2) | YES | | For fixed_amount type |
| applies_to | text | NO | 'order' | 'order', 'item', 'category' |
| category_ids | uuid[] | YES | | If applies_to = 'category' |
| item_ids | uuid[] | YES | | If applies_to specific items |
| requires_manager_approval | boolean | NO | false | |
| max_discount_amount | numeric(10,2) | YES | | Cap for percentage discounts |
| min_order_amount | numeric(10,2) | YES | | Minimum order to apply |
| is_active | boolean | NO | true | |
| start_date | date | YES | | |
| end_date | date | YES | | |
| available_days | int[] | YES | | |
| available_start_time | time | YES | | |
| available_end_time | time | YES | | |
| promo_code | text | YES | | Optional promo code |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| deleted_at | timestamptz | YES | | Soft delete |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`
**Indexes:** `idx_discounts_org(org_id)`
**RLS:** Tenant isolation on org_id.

---

### order_discounts

Discounts applied to a specific order or order item.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| order_id | uuid | NO | | FK → orders |
| discount_id | uuid | YES | | FK → discounts; NULL for custom/manual discounts |
| order_item_id | uuid | YES | | FK → order_items; NULL if order-level discount |
| name | text | NO | | |
| discount_type | discount_type | NO | | |
| value | numeric(10,2) | NO | | The percentage or fixed amount |
| applied_amount | numeric(10,2) | NO | | Actual dollar amount removed |
| applied_by | uuid | NO | | FK → users |
| approved_by | uuid | YES | | FK → users (manager approval) |
| created_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `order_id` → `orders(id)`, `discount_id` → `discounts(id)`, `order_item_id` → `order_items(id)`, `applied_by` → `users(id)`, `approved_by` → `users(id)`

---

### floor_plans

Visual layout canvas for table management.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| name | text | NO | | "Main Dining", "Patio", "Bar Area" |
| sort_order | int | NO | 0 | |
| is_active | boolean | NO | true | |
| canvas_width | int | NO | 1200 | |
| canvas_height | int | NO | 800 | |
| background_image_url | text | YES | | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`
**RLS:** Tenant isolation on org_id.

---

### tables

Physical tables positioned on a floor plan.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| floor_plan_id | uuid | NO | | FK → floor_plans |
| name | text | NO | | "T1", "B3", "P12" |
| capacity | int | NO | 4 | |
| shape | text | NO | 'rectangle' | 'rectangle', 'circle', 'square' |
| pos_x | int | NO | 0 | X position on canvas |
| pos_y | int | NO | 0 | Y position on canvas |
| width | int | NO | 80 | |
| height | int | NO | 80 | |
| rotation | int | NO | 0 | Degrees |
| status | text | NO | 'available' | 'available', 'seated', 'ordered', 'served', 'check_presented', 'dirty' |
| current_order_id | uuid | YES | | Denormalized for fast floor plan rendering |
| current_server_id | uuid | YES | | FK → users |
| seated_at | timestamptz | YES | | |
| is_active | boolean | NO | true | |
| sort_order | int | NO | 0 | |
| section | text | YES | | Server section: "A", "B", "Patio", "Bar" |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `floor_plan_id` → `floor_plans(id)`, `current_server_id` → `users(id)`
**Indexes:** `idx_tables_location(location_id)`, `idx_tables_floor_plan(floor_plan_id)`, `idx_tables_status(location_id, status)`
**RLS:** Tenant isolation on org_id.

---

### customers

Customer CRM records.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| first_name | text | YES | | |
| last_name | text | YES | | |
| email | text | YES | | |
| phone | text | YES | | |
| notes | text | YES | | "Allergic to shellfish", "Prefers booth" |
| tags | text[] | YES | | ['vip', 'regular', 'food-allergy'] |
| total_visits | int | NO | 0 | Denormalized, updated async |
| total_spent | numeric(12,2) | NO | 0 | |
| average_check | numeric(10,2) | NO | 0 | |
| last_visit_at | timestamptz | YES | | |
| marketing_opt_in | boolean | NO | false | |
| birthday | date | YES | | |
| anniversary | date | YES | | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| deleted_at | timestamptz | YES | | Soft delete |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`
**Indexes:** `idx_customers_org(org_id)`, `idx_customers_phone(org_id, phone) WHERE phone IS NOT NULL`, `idx_customers_email(org_id, email) WHERE email IS NOT NULL`
**RLS:** Tenant isolation on org_id.

---

### customer_addresses

Saved addresses for a customer (delivery, billing).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| customer_id | uuid | NO | | FK → customers |
| label | text | YES | 'home' | 'home', 'work', 'other' |
| line1 | text | NO | | |
| line2 | text | YES | | |
| city | text | NO | | |
| state | text | NO | | |
| zip | text | NO | | |
| is_default | boolean | NO | false | |
| created_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `customer_id` → `customers(id)`

---

### customer_payment_methods

Tokenized saved payment methods (no raw card data).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| customer_id | uuid | NO | | FK → customers |
| processor_name | text | NO | | Always 'valor' |
| processor_customer_id | text | YES | | Valor customer reference ID |
| processor_card_token | text | NO | | Valor's token for this card |
| card_brand | text | NO | | 'visa', 'mastercard', etc. |
| card_last_four | text | NO | | |
| exp_month | int | YES | | |
| exp_year | int | YES | | |
| cardholder_name | text | YES | | |
| is_default | boolean | YES | false | |
| is_active | boolean | YES | true | |
| created_at | timestamptz | NO | now() | |
| last_used_at | timestamptz | YES | | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `customer_id` → `customers(id)`
**Indexes:** `idx_cpm_customer(customer_id)`
**RLS:** Tenant isolation on org_id.

---

### shifts

Operational shift periods (Lunch, Dinner, etc.).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| name | text | YES | | "Lunch", "Dinner", "All Day" |
| shift_date | date | NO | | |
| start_time | timestamptz | NO | | |
| end_time | timestamptz | YES | | NULL = still open |
| manager_id | uuid | YES | | FK → users; manager on duty |
| total_sales | numeric(12,2) | YES | | Populated on close |
| total_labor_cost | numeric(10,2) | YES | | |
| total_comps | numeric(10,2) | YES | | |
| total_voids | numeric(10,2) | YES | | |
| is_closed | boolean | NO | false | |
| closed_by | uuid | YES | | FK → users |
| closed_at | timestamptz | YES | | |
| notes | text | YES | | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `manager_id` → `users(id)`, `closed_by` → `users(id)`
**Indexes:** `idx_shifts_location_date(location_id, shift_date)`
**RLS:** Tenant isolation on org_id + location-scoped.

---

### time_entries

Clock in/out records for staff.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| user_id | uuid | NO | | FK → users |
| shift_id | uuid | YES | | FK → shifts |
| clock_in | timestamptz | NO | | |
| clock_out | timestamptz | YES | | |
| role_during_shift | user_role | YES | | Role worked (may differ from primary) |
| hourly_rate | numeric(8,2) | YES | | Rate during this shift |
| regular_hours | numeric(5,2) | YES | | Calculated |
| overtime_hours | numeric(5,2) | YES | | |
| total_pay | numeric(10,2) | YES | | |
| cash_tips | numeric(10,2) | NO | 0 | |
| credit_tips | numeric(10,2) | NO | 0 | |
| tip_out_given | numeric(10,2) | NO | 0 | |
| tip_out_received | numeric(10,2) | NO | 0 | |
| notes | text | YES | | |
| is_approved | boolean | NO | false | |
| approved_by | uuid | YES | | FK → users |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `user_id` → `users(id)`, `shift_id` → `shifts(id)`, `approved_by` → `users(id)`
**Indexes:** `idx_time_entries_user(user_id)`, `idx_time_entries_location_date(location_id, clock_in)`
**RLS:** Tenant isolation on org_id + location-scoped.

---

### break_entries

Break periods within a time entry.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| time_entry_id | uuid | NO | | FK → time_entries |
| break_type | text | NO | 'unpaid' | 'paid', 'unpaid' |
| start_time | timestamptz | NO | | |
| end_time | timestamptz | YES | | |
| duration_minutes | int | YES | | |
| created_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `time_entry_id` → `time_entries(id)`

---

### cash_drawers

Physical cash drawer state and reconciliation.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| terminal_id | uuid | YES | | FK → terminals |
| name | text | NO | 'Main Drawer' | |
| is_open | boolean | NO | false | |
| opened_by | uuid | YES | | FK → users |
| opened_at | timestamptz | YES | | |
| starting_cash | numeric(10,2) | YES | | |
| current_cash | numeric(10,2) | YES | | |
| expected_cash | numeric(10,2) | YES | | |
| actual_cash | numeric(10,2) | YES | | Counted at close |
| over_short | numeric(10,2) | YES | | |
| closed_by | uuid | YES | | FK → users |
| closed_at | timestamptz | YES | | |
| notes | text | YES | | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `terminal_id` → `terminals(id)`, `opened_by` → `users(id)`, `closed_by` → `users(id)`
**RLS:** Tenant isolation on org_id.

---

### cash_drawer_events

Individual cash movements in a drawer.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| cash_drawer_id | uuid | NO | | FK → cash_drawers |
| event_type | cash_drawer_event_type | NO | | |
| amount | numeric(10,2) | NO | | |
| running_total | numeric(10,2) | NO | | |
| order_id | uuid | YES | | FK → orders |
| payment_id | uuid | YES | | FK → payments |
| description | text | YES | | |
| performed_by | uuid | NO | | FK → users |
| created_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `cash_drawer_id` → `cash_drawers(id)`, `order_id` → `orders(id)`, `payment_id` → `payments(id)`, `performed_by` → `users(id)`
**Indexes:** `idx_cash_events_drawer(cash_drawer_id)`

---

### gift_cards

Gift card records (numbers are hashed, never stored in plain text in API responses).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| card_number | text | NO | | Masked in API responses |
| card_number_hash | text | NO | | SHA-256 hash for lookups |
| pin_hash | text | YES | | Optional PIN |
| initial_balance | numeric(10,2) | NO | | |
| current_balance | numeric(10,2) | NO | | |
| purchased_by_customer_id | uuid | YES | | FK → customers |
| purchased_at | timestamptz | NO | now() | |
| purchase_order_id | uuid | YES | | FK → orders |
| recipient_name | text | YES | | |
| recipient_email | text | YES | | |
| recipient_phone | text | YES | | |
| message | text | YES | | |
| is_active | boolean | NO | true | |
| expires_at | timestamptz | YES | | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `purchased_by_customer_id` → `customers(id)`, `purchase_order_id` → `orders(id)`
**Indexes:** `idx_gift_cards_org(org_id)`, `idx_gift_cards_number(card_number_hash)`
**RLS:** Tenant isolation on org_id.

---

### gift_card_transactions

Ledger of gift card balance changes.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| gift_card_id | uuid | NO | | FK → gift_cards |
| transaction_type | text | NO | | 'purchase', 'reload', 'redeem', 'refund', 'adjustment' |
| amount | numeric(10,2) | NO | | Positive for loads, negative for redemptions |
| balance_after | numeric(10,2) | NO | | |
| order_id | uuid | YES | | FK → orders |
| payment_id | uuid | YES | | FK → payments |
| performed_by | uuid | YES | | FK → users |
| notes | text | YES | | |
| created_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `gift_card_id` → `gift_cards(id)`, `order_id` → `orders(id)`, `payment_id` → `payments(id)`, `performed_by` → `users(id)`

---

### audit_log

Immutable audit trail of all significant actions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | YES | | FK → locations |
| user_id | uuid | YES | | FK → users |
| user_name | text | YES | | Denormalized for readability |
| user_role | user_role | YES | | |
| action | text | NO | | e.g. 'order.void', 'menu.price_change', 'user.login' |
| entity_type | text | NO | | 'order', 'payment', 'menu_item', 'user' |
| entity_id | uuid | YES | | |
| description | text | NO | | Human-readable |
| previous_state | jsonb | YES | | Before the change |
| new_state | jsonb | YES | | After the change |
| ip_address | inet | YES | | |
| user_agent | text | YES | | |
| terminal_id | uuid | YES | | |
| created_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `user_id` → `users(id)`
**Indexes:** `idx_audit_org_date(org_id, created_at DESC)`, `idx_audit_entity(entity_type, entity_id)`, `idx_audit_user(user_id)`, `idx_audit_action(action)`
**RLS:** Tenant isolation on org_id. Partition by month recommended for performance.

---

## 6. Tables — Payments Infrastructure

### settlement_batches

End-of-day batch settlement records from Valor.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| processor_batch_id | text | YES | | Valor batch ID |
| transaction_count | int | NO | | |
| gross_amount | numeric(12,2) | NO | | |
| refund_amount | numeric(12,2) | YES | 0 | |
| net_amount | numeric(12,2) | NO | | |
| batch_opened_at | timestamptz | YES | | |
| batch_closed_at | timestamptz | NO | | |
| expected_deposit_date | date | YES | | |
| actual_deposit_date | date | YES | | |
| actual_deposit_amount | numeric(12,2) | YES | | |
| is_reconciled | boolean | YES | false | |
| reconciled_at | timestamptz | YES | | |
| variance_amount | numeric(10,2) | YES | 0 | |
| created_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`
**Indexes:** `idx_batch_org_date(org_id, batch_closed_at)`
**RLS:** Tenant isolation on org_id.

---

### chargebacks

Dispute/chargeback tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| payment_id | uuid | YES | | FK → payments |
| processor_dispute_id | text | NO | | |
| reason_code | text | NO | | |
| reason_description | text | YES | | |
| amount | numeric(10,2) | NO | | |
| received_at | timestamptz | NO | | |
| respond_by | timestamptz | NO | | Deadline |
| status | text | NO | 'open' | 'open', 'evidence_submitted', 'won', 'lost', 'expired' |
| evidence_submitted_at | timestamptz | YES | | |
| evidence | jsonb | YES | | |
| resolved_at | timestamptz | YES | | |
| resolution | text | YES | | 'won', 'lost', 'accepted' |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `payment_id` → `payments(id)`
**RLS:** Tenant isolation on org_id.

---

### surcharge_config

Dual Pricing / surcharge / cash discount configuration per location.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| program_type | text | NO | 'none' | 'none', 'surcharge', 'cash_discount', 'dual_pricing' |
| surcharge_rate | numeric(4,2) | YES | | e.g. 3.00 for 3% |
| cash_discount_rate | numeric(4,2) | YES | | e.g. 4.00 for 4% |
| merchant_discount_rate | numeric(4,2) | YES | | Actual processing cost rate |
| state | text | NO | | For legal validation |
| card_network_registered | boolean | YES | false | |
| registration_date | date | YES | | |
| signage_confirmed | boolean | YES | false | |
| is_active | boolean | YES | true | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`
**RLS:** Tenant isolation on org_id.

---

### tip_config

Tip calculation and distribution configuration per location.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| calculate_on | text | YES | 'pre_tax' | 'pre_tax' or 'post_tax' |
| suggested_percentages | int[] | YES | '{18,20,22}' | |
| default_percentage | int | YES | 20 | |
| auto_grat_enabled | boolean | YES | true | |
| auto_grat_party_size | int | YES | 6 | |
| auto_grat_percentage | int | YES | 20 | |
| distribution_model | text | YES | 'direct' | 'direct', 'pool', 'hybrid' |
| tipout_rules | jsonb | YES | '[]' | [{role, percentage, based_on}] |
| pool_method | text | YES | 'hours_worked' | 'hours_worked', 'equal', 'points' |
| pool_point_values | jsonb | YES | '{}' | {server: 2, bartender: 2, busser: 1} |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`
**RLS:** Tenant isolation on org_id.

---

### payment_devices

Valor payment terminals/readers registered to a location.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| device_serial | text | NO | | |
| device_model | text | NO | | 'VP800', 'VP550', 'VP300_Pro', 'RCKT' |
| device_label | text | YES | | "Bar Reader", "Station 1" |
| connection_type | text | NO | | 'bluetooth', 'wifi', 'ethernet', 'usb' |
| ip_address | text | YES | | For network-connected devices |
| port | int | YES | | |
| is_active | boolean | YES | true | |
| last_seen_at | timestamptz | YES | | |
| firmware_version | text | YES | | |
| created_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`
**RLS:** Tenant isolation on org_id.

---

### daily_reconciliations

End-of-day financial reconciliation snapshot.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| business_date | date | NO | | |
| gross_sales | numeric(12,2) | NO | | |
| discount_total | numeric(12,2) | YES | 0 | |
| comp_total | numeric(12,2) | YES | 0 | |
| net_sales | numeric(12,2) | NO | | |
| tax_collected | numeric(12,2) | NO | | |
| credit_card_total | numeric(12,2) | YES | 0 | |
| cash_total | numeric(12,2) | YES | 0 | |
| gift_card_total | numeric(12,2) | YES | 0 | |
| house_account_total | numeric(12,2) | YES | 0 | |
| visa_total | numeric(12,2) | YES | 0 | |
| mastercard_total | numeric(12,2) | YES | 0 | |
| amex_total | numeric(12,2) | YES | 0 | |
| discover_total | numeric(12,2) | YES | 0 | |
| cc_tips | numeric(12,2) | YES | 0 | |
| cash_tips_reported | numeric(12,2) | YES | 0 | |
| auto_gratuity_total | numeric(12,2) | YES | 0 | |
| void_total | numeric(12,2) | YES | 0 | |
| refund_total | numeric(12,2) | YES | 0 | |
| surcharge_total | numeric(12,2) | YES | 0 | |
| cash_expected | numeric(12,2) | YES | 0 | |
| cash_counted | numeric(12,2) | YES | | |
| cash_variance | numeric(12,2) | YES | | |
| estimated_processing_fee | numeric(12,2) | YES | 0 | |
| closed_by | uuid | YES | | FK → users |
| closed_at | timestamptz | YES | | |
| notes | text | YES | | |
| created_at | timestamptz | NO | now() | |

**PK:** `id`
**Unique:** `(location_id, business_date)`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `closed_by` → `users(id)`
**RLS:** Tenant isolation on org_id.

---

## 7. Tables — Modules

### mod.kds — Kitchen Display System

#### kds_stations

Kitchen display stations (Grill, Fryer, Expo, etc.).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| name | text | NO | | "Grill", "Fryer", "Cold", "Bar", "Expo" |
| station_type | text | NO | | 'prep', 'expo' |
| prep_stations | text[] | YES | | Which prep_station values route here |
| terminal_id | uuid | YES | | Assigned display device |
| display_settings | jsonb | YES | '{}' | font_size, columns, sound, color_coding |
| sort_order | int | YES | 0 | |
| is_active | boolean | YES | true | |
| created_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `terminal_id` → `terminals(id)`
**RLS:** Tenant isolation on org_id.

---

#### kds_ticket_events

Events on KDS tickets (receive, bump, recall).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | |
| station_id | uuid | NO | | FK → kds_stations |
| order_id | uuid | NO | | FK → orders |
| order_item_id | uuid | YES | | FK → order_items |
| event_type | text | NO | | 'received', 'started', 'bumped', 'recalled', 'all_day_updated' |
| performed_by | uuid | YES | | FK → users |
| created_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `station_id` → `kds_stations(id)`, `order_id` → `orders(id)`, `order_item_id` → `order_items(id)`, `performed_by` → `users(id)`
**RLS:** Tenant isolation on org_id.

---

### mod.inventory — Inventory Management

#### vendors

Supplier contacts and terms.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| name | text | NO | | |
| contact_name | text | YES | | |
| email | text | YES | | |
| phone | text | YES | | |
| address | jsonb | YES | | {line1, line2, city, state, zip} |
| payment_terms | text | YES | | 'net_30', 'net_15', 'cod', etc. |
| account_number | text | YES | | Vendor account number |
| notes | text | YES | | |
| is_active | boolean | YES | true | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`
**RLS:** Tenant isolation on org_id.

---

#### inventory_items

Tracked inventory items with par levels and costs.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| name | text | NO | | |
| sku | text | YES | | |
| category | text | YES | | |
| unit_of_measure | text | NO | | 'oz', 'lb', 'each', 'case', 'gal' |
| par_level | numeric(10,3) | YES | | Target quantity to keep on hand |
| reorder_point | numeric(10,3) | YES | | Quantity that triggers reorder alert |
| current_quantity | numeric(10,3) | YES | 0 | |
| unit_cost | numeric(10,4) | YES | | |
| vendor_id | uuid | YES | | FK → vendors |
| is_active | boolean | YES | true | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `vendor_id` → `vendors(id)`
**RLS:** Tenant isolation on org_id.

---

#### inventory_transactions

Ledger of all inventory movements (receives, waste, transfers, counts).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | |
| inventory_item_id | uuid | NO | | FK → inventory_items |
| transaction_type | text | NO | | 'receive', 'waste', 'transfer', 'count', 'sale_deduction' |
| quantity_change | numeric(10,3) | NO | | Positive or negative |
| quantity_after | numeric(10,3) | NO | | Running balance |
| unit_cost | numeric(10,4) | YES | | |
| reference_id | uuid | YES | | order_id for sales, PO id for receives |
| notes | text | YES | | |
| performed_by | uuid | YES | | FK → users |
| created_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `inventory_item_id` → `inventory_items(id)`, `performed_by` → `users(id)`
**RLS:** Tenant isolation on org_id.

---

#### recipes

Bill of materials linking menu items to inventory items.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| menu_item_id | uuid | NO | | FK → menu_items |
| inventory_item_id | uuid | NO | | FK → inventory_items |
| quantity_used | numeric(10,4) | NO | | Amount consumed per menu item sold |
| unit_of_measure | text | NO | | |
| created_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `menu_item_id` → `menu_items(id)`, `inventory_item_id` → `inventory_items(id)`
**RLS:** Tenant isolation on org_id.

---

#### purchase_orders

Vendor orders for inventory replenishment.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| vendor_id | uuid | NO | | FK → vendors |
| po_number | text | NO | | |
| status | text | NO | 'draft' | 'draft', 'submitted', 'partial', 'received', 'cancelled' |
| total_amount | numeric(12,2) | YES | | |
| ordered_at | timestamptz | YES | | |
| expected_at | timestamptz | YES | | Expected delivery |
| received_at | timestamptz | YES | | Actual receipt |
| notes | text | YES | | |
| created_by | uuid | NO | | FK → users |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `vendor_id` → `vendors(id)`, `created_by` → `users(id)`
**RLS:** Tenant isolation on org_id.

---

#### purchase_order_items

Line items on a purchase order.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| purchase_order_id | uuid | NO | | FK → purchase_orders |
| inventory_item_id | uuid | NO | | FK → inventory_items |
| quantity_ordered | numeric(10,3) | NO | | |
| quantity_received | numeric(10,3) | YES | 0 | |
| unit_cost | numeric(10,4) | NO | | |
| line_total | numeric(10,2) | NO | | |
| created_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `purchase_order_id` → `purchase_orders(id)`, `inventory_item_id` → `inventory_items(id)`

---

### mod.loyalty — Loyalty Programs

#### loyalty_programs

Loyalty program configuration.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| name | text | NO | | |
| program_type | text | NO | | 'points', 'visits', 'spend_based' |
| points_per_dollar | numeric(6,2) | YES | 1 | |
| points_per_visit | int | YES | 0 | |
| redemption_threshold | int | YES | | Points needed to redeem |
| reward_value | numeric(10,2) | YES | | Dollar value of reward |
| is_active | boolean | YES | true | |
| settings | jsonb | YES | '{}' | Additional config (tier thresholds, expiry rules, etc.) |
| created_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`
**RLS:** Tenant isolation on org_id.

---

#### loyalty_accounts

Customer enrollment in a loyalty program.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | |
| customer_id | uuid | NO | | FK → customers |
| program_id | uuid | NO | | FK → loyalty_programs |
| points_balance | int | NO | 0 | |
| lifetime_points | int | NO | 0 | |
| tier | text | YES | 'bronze' | 'bronze', 'silver', 'gold', 'platinum' |
| enrolled_at | timestamptz | YES | now() | |
| last_activity_at | timestamptz | YES | | |

**PK:** `id`
**FK:** `customer_id` → `customers(id)`, `program_id` → `loyalty_programs(id)`
**RLS:** Tenant isolation on org_id.

---

#### loyalty_transactions

Points earn/redeem/adjust ledger.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | |
| loyalty_account_id | uuid | NO | | FK → loyalty_accounts |
| transaction_type | text | NO | | 'earn', 'redeem', 'adjustment', 'expire' |
| points | int | NO | | Positive for earn, negative for redeem |
| balance_after | int | NO | | |
| order_id | uuid | YES | | FK → orders |
| description | text | YES | | |
| created_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `loyalty_account_id` → `loyalty_accounts(id)`, `order_id` → `orders(id)`
**RLS:** Tenant isolation on org_id.

---

### mod.online_ordering — Online Ordering

#### online_menus

Published online menu for a location.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| name | text | NO | | |
| slug | text | NO | | Public URL slug |
| is_active | boolean | YES | true | |
| settings | jsonb | YES | '{}' | theme, colors, logo, min_order, delivery_fee |
| created_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`
**RLS:** Tenant isolation on org_id.

---

#### online_menu_items

Items available on the online menu (may have different pricing).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| online_menu_id | uuid | NO | | FK → online_menus |
| menu_item_id | uuid | NO | | FK → menu_items |
| is_available | boolean | YES | true | |
| sort_order | int | YES | 0 | |
| online_price | numeric(10,2) | YES | | Override price; NULL = use menu_item price |
| online_description | text | YES | | Extended description |
| created_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `online_menu_id` → `online_menus(id)`, `menu_item_id` → `menu_items(id)`

---

#### online_order_queue

Acceptance workflow for incoming online orders.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| order_id | uuid | NO | | FK → orders |
| status | text | NO | 'pending' | 'pending', 'accepted', 'rejected', 'preparing' |
| estimated_ready_minutes | int | YES | | |
| accepted_by | uuid | YES | | FK → users |
| accepted_at | timestamptz | YES | | |
| rejected_reason | text | YES | | |
| customer_notified_at | timestamptz | YES | | |
| created_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `order_id` → `orders(id)`, `accepted_by` → `users(id)`
**RLS:** Tenant isolation on org_id.

---

### mod.reservations — Reservations & Waitlist

#### reservations

Guest reservations with reminder tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| customer_id | uuid | YES | | FK → customers |
| guest_name | text | NO | | |
| guest_phone | text | YES | | |
| guest_email | text | YES | | |
| party_size | int | NO | | |
| reservation_date | date | NO | | |
| reservation_time | time | NO | | |
| duration_minutes | int | YES | 90 | |
| table_id | uuid | YES | | FK → tables |
| status | text | NO | 'confirmed' | 'pending', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled' |
| notes | text | YES | | |
| special_requests | text | YES | | |
| confirmation_sent_at | timestamptz | YES | | |
| reminder_sent_at | timestamptz | YES | | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `customer_id` → `customers(id)`, `table_id` → `tables(id)`
**RLS:** Tenant isolation on org_id.

---

#### waitlist_entries

Walk-in waitlist with position tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| guest_name | text | NO | | |
| guest_phone | text | YES | | |
| party_size | int | NO | | |
| quoted_wait_minutes | int | YES | | |
| position | int | NO | | Queue position |
| status | text | NO | 'waiting' | 'waiting', 'notified', 'seated', 'cancelled', 'no_show' |
| notified_at | timestamptz | YES | | |
| seated_at | timestamptz | YES | | |
| table_id | uuid | YES | | FK → tables |
| notes | text | YES | | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `table_id` → `tables(id)`
**RLS:** Tenant isolation on org_id.

---

### mod.scheduling — Staff Scheduling

#### schedule_templates

Reusable schedule templates (e.g. "Default Week", "Holiday Week").

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| name | text | NO | | |
| is_active | boolean | YES | true | |
| created_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`
**RLS:** Tenant isolation on org_id.

---

#### scheduled_shifts

Individual scheduled shift assignments.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| template_id | uuid | YES | | FK → schedule_templates |
| user_id | uuid | NO | | FK → users |
| role | user_role | NO | | Role for this shift |
| shift_date | date | NO | | |
| start_time | time | NO | | |
| end_time | time | NO | | |
| status | text | NO | 'scheduled' | 'scheduled', 'confirmed', 'swap_requested', 'swapped', 'called_out', 'no_show' |
| notes | text | YES | | |
| published_at | timestamptz | YES | | NULL = draft, not visible to staff |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `template_id` → `schedule_templates(id)`, `user_id` → `users(id)`
**RLS:** Tenant isolation on org_id.

---

#### shift_swap_requests

Shift trade / swap approval workflow.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| scheduled_shift_id | uuid | NO | | FK → scheduled_shifts |
| requested_by | uuid | NO | | FK → users |
| swap_with_user_id | uuid | YES | | FK → users; NULL = open swap (anyone can take) |
| status | text | NO | 'pending' | 'pending', 'approved', 'denied', 'taken' |
| approved_by | uuid | YES | | FK → users |
| created_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `scheduled_shift_id` → `scheduled_shifts(id)`, `requested_by` → `users(id)`, `swap_with_user_id` → `users(id)`, `approved_by` → `users(id)`
**RLS:** Tenant isolation on org_id.

---

#### staff_availability

Recurring availability calendar for scheduling.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| user_id | uuid | NO | | FK → users |
| day_of_week | int | NO | | 0=Sunday |
| start_time | time | YES | | |
| end_time | time | YES | | |
| is_available | boolean | NO | true | |
| effective_date | date | YES | | When this availability starts |
| expiration_date | date | YES | | When this availability ends |
| created_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `user_id` → `users(id)`
**RLS:** Tenant isolation on org_id.

---

### mod.marketing — Email/SMS Campaigns

(Depends on mod.loyalty)

#### campaigns

Marketing campaign definitions.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| name | text | NO | | |
| campaign_type | text | NO | | 'email', 'sms', 'push', 'email_sms' |
| status | text | NO | 'draft' | 'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled' |
| subject | text | YES | | Email subject |
| body_html | text | YES | | Email body |
| sms_body | text | YES | | SMS body (160 char limit) |
| target_segment | jsonb | NO | | Filter criteria: {min_visits, last_visit_within_days, tags, tier} |
| target_count | int | YES | | Estimated recipients |
| scheduled_for | timestamptz | YES | | |
| sent_at | timestamptz | YES | | |
| recipients_count | int | YES | 0 | |
| opened_count | int | YES | 0 | |
| clicked_count | int | YES | 0 | |
| redeemed_count | int | YES | 0 | |
| discount_id | uuid | YES | | FK → discounts; attached offer |
| created_by | uuid | NO | | FK → users |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `discount_id` → `discounts(id)`, `created_by` → `users(id)`
**RLS:** Tenant isolation on org_id.

---

#### campaign_recipients

Per-recipient send/open/click tracking.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| campaign_id | uuid | NO | | FK → campaigns |
| customer_id | uuid | NO | | FK → customers |
| channel | text | NO | | 'email', 'sms' |
| status | text | NO | 'pending' | 'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed' |
| sent_at | timestamptz | YES | | |
| opened_at | timestamptz | YES | | |
| clicked_at | timestamptz | YES | | |
| created_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `campaign_id` → `campaigns(id)`, `customer_id` → `customers(id)`

---

### mod.delivery — Delivery Management

#### delivery_zones

GeoJSON polygons defining delivery areas with fees.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| name | text | NO | | e.g. "Zone 1 — 3 miles" |
| zone_polygon | jsonb | NO | | GeoJSON polygon |
| delivery_fee | numeric(10,2) | NO | 0 | |
| min_order_amount | numeric(10,2) | YES | | |
| estimated_minutes | int | YES | 30 | |
| is_active | boolean | YES | true | |
| created_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`
**RLS:** Tenant isolation on org_id.

---

#### deliveries

Individual delivery tracking with GPS.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| order_id | uuid | NO | | FK → orders |
| driver_id | uuid | YES | | FK → users |
| zone_id | uuid | YES | | FK → delivery_zones |
| pickup_time | timestamptz | YES | | |
| delivery_time | timestamptz | YES | | |
| estimated_delivery_at | timestamptz | YES | | |
| actual_delivery_at | timestamptz | YES | | |
| status | text | NO | 'pending' | 'pending', 'assigned', 'picked_up', 'en_route', 'delivered', 'failed' |
| delivery_address | jsonb | NO | | {line1, line2, city, state, zip, lat, lng} |
| delivery_instructions | text | YES | | |
| delivery_fee | numeric(10,2) | NO | 0 | |
| driver_tip | numeric(10,2) | YES | 0 | |
| driver_lat | numeric(10,7) | YES | | Real-time GPS |
| driver_lng | numeric(10,7) | YES | | |
| last_location_at | timestamptz | YES | | |
| proof_of_delivery_url | text | YES | | Photo URL |
| signature_url | text | YES | | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `order_id` → `orders(id)`, `driver_id` → `users(id)`, `zone_id` → `delivery_zones(id)`
**RLS:** Tenant isolation on org_id.

---

### mod.analytics — Pre-aggregated Metrics

#### daily_metrics

Pre-aggregated daily performance metrics for fast dashboard queries.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| metric_date | date | NO | | |
| total_revenue | numeric(12,2) | YES | 0 | |
| net_revenue | numeric(12,2) | YES | 0 | After discounts/comps/voids |
| order_count | int | YES | 0 | |
| average_check | numeric(10,2) | YES | 0 | |
| covers | int | YES | 0 | Guest count |
| revenue_per_cover | numeric(10,2) | YES | 0 | |
| dine_in_revenue | numeric(12,2) | YES | 0 | |
| takeout_revenue | numeric(12,2) | YES | 0 | |
| delivery_revenue | numeric(12,2) | YES | 0 | |
| online_revenue | numeric(12,2) | YES | 0 | |
| cash_total | numeric(12,2) | YES | 0 | |
| card_total | numeric(12,2) | YES | 0 | |
| gift_card_total | numeric(12,2) | YES | 0 | |
| labor_cost | numeric(12,2) | YES | 0 | |
| labor_hours | numeric(8,2) | YES | 0 | |
| labor_percentage | numeric(5,2) | YES | 0 | |
| food_cost | numeric(12,2) | YES | 0 | |
| food_cost_percentage | numeric(5,2) | YES | 0 | |
| discount_total | numeric(12,2) | YES | 0 | |
| comp_total | numeric(12,2) | YES | 0 | |
| void_total | numeric(12,2) | YES | 0 | |
| refund_total | numeric(12,2) | YES | 0 | |
| tip_total | numeric(12,2) | YES | 0 | |
| avg_ticket_time_seconds | int | YES | 0 | |
| avg_table_turn_minutes | int | YES | 0 | |
| hourly_revenue | jsonb | YES | '{}' | {"10": 450.00, "11": 1200.00, ...} |
| hourly_covers | jsonb | YES | '{}' | |
| calculated_at | timestamptz | YES | now() | |

**PK:** `id`
**Unique:** `(location_id, metric_date)`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`
**Indexes:** `idx_daily_metrics_location_date(location_id, metric_date DESC)`
**RLS:** Tenant isolation on org_id.

---

#### daily_item_metrics

Product mix (PMIX) report data per day per item.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| metric_date | date | NO | | |
| menu_item_id | uuid | NO | | FK → menu_items |
| quantity_sold | int | YES | 0 | |
| gross_revenue | numeric(10,2) | YES | 0 | |
| food_cost | numeric(10,2) | YES | 0 | |
| margin_percentage | numeric(5,2) | YES | 0 | |

**PK:** `id`
**Unique:** `(location_id, metric_date, menu_item_id)`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `menu_item_id` → `menu_items(id)`
**RLS:** Tenant isolation on org_id.

---

## 8. Tables — New (Toast & R Power Feature Parity)

### house_accounts

Corporate/VIP billing accounts (R Power feature). Allows customers to charge to an account and pay later.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| customer_id | uuid | YES | | FK → customers |
| account_name | text | NO | | Company or individual name |
| account_number | text | NO | | Unique within org |
| credit_limit | numeric(12,2) | NO | | |
| current_balance | numeric(12,2) | NO | 0 | Outstanding balance |
| billing_address | jsonb | YES | | {line1, line2, city, state, zip} |
| billing_email | text | YES | | For sending statements |
| billing_cycle | text | YES | 'monthly' | 'weekly', 'biweekly', 'monthly' |
| payment_terms | text | YES | 'net_30' | 'net_15', 'net_30', 'net_60' |
| tax_exempt | boolean | NO | false | |
| tax_exempt_id | text | YES | | Tax exemption certificate number |
| is_active | boolean | NO | true | |
| notes | text | YES | | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**Unique:** `(org_id, account_number)`
**FK:** `org_id` → `organizations(id)`, `customer_id` → `customers(id)`
**RLS:** Tenant isolation on org_id.

---

### house_account_transactions

Charges and payments on house accounts.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| house_account_id | uuid | NO | | FK → house_accounts |
| transaction_type | text | NO | | 'charge', 'payment', 'credit', 'adjustment' |
| amount | numeric(10,2) | NO | | Positive for charges, negative for payments |
| balance_after | numeric(12,2) | NO | | Running balance |
| order_id | uuid | YES | | FK → orders; for charge transactions |
| payment_id | uuid | YES | | FK → payments; for payment transactions |
| description | text | YES | | |
| performed_by | uuid | YES | | FK → users |
| created_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `house_account_id` → `house_accounts(id)`, `order_id` → `orders(id)`, `payment_id` → `payments(id)`, `performed_by` → `users(id)`
**Indexes:** `idx_house_acct_txn_account(house_account_id, created_at DESC)`
**RLS:** Tenant isolation on org_id.

---

### drive_thru_orders

Drive-thru specific tracking with lane assignment and speed-of-service metrics.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| order_id | uuid | NO | | FK → orders |
| lane | int | NO | 1 | Lane number (1, 2) |
| vehicle_description | text | YES | | Color/make for order matching |
| arrived_at | timestamptz | YES | | Vehicle detected at speaker |
| ordered_at | timestamptz | YES | | Order completed at speaker |
| paid_at | timestamptz | YES | | Payment at window |
| served_at | timestamptz | YES | | Food handed out |
| departed_at | timestamptz | YES | | Vehicle left window |
| total_seconds | int | YES | | Total speaker-to-departure time |
| order_seconds | int | YES | | Speaker-to-order-complete time |
| service_seconds | int | YES | | Window-to-departure time |
| created_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `order_id` → `orders(id)`
**Indexes:** `idx_drive_thru_location_date(location_id, created_at)`
**RLS:** Tenant isolation on org_id.

---

### digital_menu_boards

Drive-thru and in-store digital menu board configuration.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| name | text | NO | | e.g. "Drive-Thru Board 1", "Indoor Left" |
| board_type | text | NO | | 'drive_thru', 'indoor', 'outdoor' |
| display_layout | jsonb | NO | '{}' | Layout config: zones, item placement, media |
| category_ids | uuid[] | YES | | Which menu categories to display |
| rotation_interval_seconds | int | YES | 15 | For multi-screen rotation |
| brightness_schedule | jsonb | YES | | {day: 100, night: 60} |
| is_active | boolean | NO | true | |
| last_sync_at | timestamptz | YES | | When board last pulled content |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`
**RLS:** Tenant isolation on org_id.

---

### price_levels

Up to 9 pricing tiers per item (R Power feature). Enables happy hour pricing, employee pricing, etc.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| name | text | NO | | e.g. "Happy Hour", "Employee", "Catering" |
| level_number | int | NO | | 1-9 |
| description | text | YES | | |
| is_active | boolean | NO | true | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**Unique:** `(org_id, level_number)`
**FK:** `org_id` → `organizations(id)`
**RLS:** Tenant isolation on org_id.

---

### price_level_prices

Per-item prices at each price level.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| menu_item_id | uuid | NO | | FK → menu_items |
| price_level_id | uuid | NO | | FK → price_levels |
| price | numeric(10,2) | NO | | Price at this level |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**Unique:** `(menu_item_id, price_level_id)`
**FK:** `org_id` → `organizations(id)`, `menu_item_id` → `menu_items(id)`, `price_level_id` → `price_levels(id)`

---

### price_level_schedules

Automatic daypart pricing activation (e.g. happy hour 4-6pm activates price level 2).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| price_level_id | uuid | NO | | FK → price_levels |
| name | text | NO | | e.g. "Happy Hour Schedule" |
| days_of_week | int[] | NO | | 0=Sunday |
| start_time | time | NO | | |
| end_time | time | NO | | |
| start_date | date | YES | | Optional date range |
| end_date | date | YES | | |
| is_active | boolean | NO | true | |
| priority | int | NO | 0 | Higher = takes precedence when overlapping |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `price_level_id` → `price_levels(id)`
**RLS:** Tenant isolation on org_id.

---

### qr_menus

QR code menu configurations for scan-to-order.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| name | text | NO | | e.g. "Dine-In QR Menu" |
| slug | text | NO | | Public URL slug |
| qr_code_url | text | YES | | Generated QR code image URL |
| menu_categories | uuid[] | YES | | Which categories to show; NULL = all |
| allow_ordering | boolean | NO | false | true = scan-to-order; false = view only |
| require_table_number | boolean | NO | true | |
| settings | jsonb | NO | '{}' | theme, colors, payment_methods, etc. |
| is_active | boolean | NO | true | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**Unique:** `(org_id, slug)`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`
**RLS:** Tenant isolation on org_id.

---

### qr_orders

Tracking for orders placed via QR code scan-to-order.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| qr_menu_id | uuid | NO | | FK → qr_menus |
| order_id | uuid | NO | | FK → orders |
| table_id | uuid | YES | | FK → tables |
| session_id | text | NO | | Browser session identifier |
| guest_name | text | YES | | |
| guest_phone | text | YES | | |
| device_type | text | YES | | 'ios', 'android', 'desktop' |
| created_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `qr_menu_id` → `qr_menus(id)`, `order_id` → `orders(id)`, `table_id` → `tables(id)`
**RLS:** Tenant isolation on org_id.

---

### catering_events

Catering event management with timeline and pricing.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| customer_id | uuid | YES | | FK → customers |
| event_name | text | NO | | |
| event_date | date | NO | | |
| event_time | time | YES | | |
| end_time | time | YES | | |
| guest_count | int | NO | | |
| venue_name | text | YES | | |
| venue_address | jsonb | YES | | {line1, city, state, zip} |
| contact_name | text | NO | | |
| contact_phone | text | YES | | |
| contact_email | text | YES | | |
| status | text | NO | 'inquiry' | 'inquiry', 'quoted', 'confirmed', 'in_progress', 'completed', 'cancelled' |
| order_id | uuid | YES | | FK → orders; linked POS order |
| catering_menu_id | uuid | YES | | FK → catering_menus |
| subtotal | numeric(12,2) | YES | | |
| tax_total | numeric(12,2) | YES | | |
| service_charge | numeric(12,2) | YES | | |
| total | numeric(12,2) | YES | | |
| deposit_amount | numeric(12,2) | YES | | Required deposit |
| deposit_paid_at | timestamptz | YES | | |
| notes | text | YES | | |
| special_requirements | text | YES | | Dietary, equipment, staffing |
| created_by | uuid | YES | | FK → users |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`, `customer_id` → `customers(id)`, `order_id` → `orders(id)`, `catering_menu_id` → `catering_menus(id)`, `created_by` → `users(id)`
**RLS:** Tenant isolation on org_id.

---

### catering_menus

Custom pricing menus for catering (per-person, per-platter, etc.).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| name | text | NO | | e.g. "Corporate Lunch Package", "Wedding Buffet" |
| description | text | YES | | |
| pricing_model | text | NO | 'per_person' | 'per_person', 'per_platter', 'custom' |
| min_guest_count | int | YES | | |
| max_guest_count | int | YES | | |
| items | jsonb | NO | '[]' | [{menu_item_id, name, price, category, is_required}] |
| base_price_per_person | numeric(10,2) | YES | | For per_person model |
| service_charge_percentage | numeric(5,2) | YES | | |
| is_active | boolean | NO | true | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**PK:** `id`
**FK:** `org_id` → `organizations(id)`
**RLS:** Tenant isolation on org_id.

---

### franchise_royalties

Royalty calculation and reporting for franchise/multi-location groups (R Power feature).

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | NO | gen_random_uuid() | PK |
| org_id | uuid | NO | | FK → organizations |
| location_id | uuid | NO | | FK → locations |
| period_start | date | NO | | Reporting period start |
| period_end | date | NO | | Reporting period end |
| gross_sales | numeric(12,2) | NO | | |
| net_sales | numeric(12,2) | NO | | After discounts/voids |
| royalty_rate | numeric(5,4) | NO | | e.g. 0.0500 = 5% |
| royalty_amount | numeric(12,2) | NO | | Calculated royalty due |
| ad_fund_rate | numeric(5,4) | YES | | Advertising fund contribution rate |
| ad_fund_amount | numeric(12,2) | YES | | |
| total_due | numeric(12,2) | NO | | royalty + ad fund |
| status | text | NO | 'pending' | 'pending', 'invoiced', 'paid' |
| paid_at | timestamptz | YES | | |
| notes | text | YES | | |
| created_at | timestamptz | NO | now() | |

**PK:** `id`
**Unique:** `(location_id, period_start, period_end)`
**FK:** `org_id` → `organizations(id)`, `location_id` → `locations(id)`
**RLS:** Tenant isolation on org_id.

---

## 9. Key Relationships

### Parent/Child (one-to-many)

```
organizations
 ├── locations
 │    ├── terminals
 │    ├── floor_plans
 │    │    └── tables
 │    ├── shifts
 │    ├── time_entries
 │    ├── cash_drawers
 │    │    └── cash_drawer_events
 │    ├── kds_stations (mod.kds)
 │    ├── delivery_zones (mod.delivery)
 │    ├── schedule_templates (mod.scheduling)
 │    ├── scheduled_shifts (mod.scheduling)
 │    ├── reservations (mod.reservations)
 │    ├── waitlist_entries (mod.reservations)
 │    ├── online_menus (mod.online_ordering)
 │    ├── daily_metrics (mod.analytics)
 │    ├── daily_item_metrics (mod.analytics)
 │    ├── daily_reconciliations
 │    ├── settlement_batches
 │    ├── surcharge_config
 │    ├── tip_config
 │    ├── payment_devices
 │    ├── price_level_schedules
 │    ├── qr_menus
 │    ├── digital_menu_boards
 │    ├── drive_thru_orders
 │    └── franchise_royalties
 ├── users
 │    ├── time_entries
 │    ├── staff_availability (mod.scheduling)
 │    └── scheduled_shifts (mod.scheduling)
 ├── org_modules
 ├── module_migrations
 ├── menu_categories
 │    └── menu_items
 │         └── recipes (mod.inventory)
 ├── modifier_groups
 │    └── modifiers
 ├── tax_rates
 ├── discounts
 ├── customers
 │    ├── customer_addresses
 │    ├── customer_payment_methods
 │    ├── loyalty_accounts (mod.loyalty)
 │    └── house_accounts
 ├── gift_cards
 │    └── gift_card_transactions
 ├── loyalty_programs (mod.loyalty)
 ├── vendors (mod.inventory)
 │    └── inventory_items (mod.inventory)
 │         └── inventory_transactions (mod.inventory)
 ├── purchase_orders (mod.inventory)
 │    └── purchase_order_items (mod.inventory)
 ├── campaigns (mod.marketing)
 │    └── campaign_recipients (mod.marketing)
 ├── catering_menus
 ├── catering_events
 ├── price_levels
 │    └── price_level_prices
 └── audit_log
```

### Order graph

```
orders
 ├── order_items
 │    ├── order_item_modifiers
 │    └── kds_ticket_events (mod.kds)
 ├── order_modifications
 ├── order_discounts
 ├── payments
 │    └── tip_adjustments
 ├── online_order_queue (mod.online_ordering)
 ├── deliveries (mod.delivery)
 ├── drive_thru_orders
 ├── qr_orders
 └── loyalty_transactions (mod.loyalty) [via order_id]
```

### Many-to-many (through tables)

| Relationship | Through Table |
|-------------|---------------|
| menu_items ↔ modifier_groups | `menu_item_modifier_groups` |
| online_menus ↔ menu_items | `online_menu_items` |
| menu_items ↔ inventory_items | `recipes` |
| menu_items ↔ price_levels | `price_level_prices` |

---

## 10. Table Count Summary

| Category | Tables | Count |
|----------|--------|-------|
| Core (orgs, users, auth) | organizations, locations, terminals, org_modules, module_migrations, users, permissions, role_permissions, user_permission_overrides | 9 |
| Menu | menu_categories, menu_items, modifier_groups, modifiers, menu_item_modifier_groups, tax_rates | 6 |
| Orders | orders, order_items, order_item_modifiers, order_modifications, order_discounts, discounts | 6 |
| Payments | payments, tip_adjustments, tip_distributions, cash_tip_reports, settlement_batches, chargebacks, surcharge_config, tip_config, payment_devices, daily_reconciliations | 10 |
| Tables & Floor | floor_plans, tables | 2 |
| Customers | customers, customer_addresses, customer_payment_methods | 3 |
| Staff & Time | shifts, time_entries, break_entries | 3 |
| Cash | cash_drawers, cash_drawer_events | 2 |
| Gift Cards | gift_cards, gift_card_transactions | 2 |
| Audit | audit_log | 1 |
| mod.kds | kds_stations, kds_ticket_events | 2 |
| mod.inventory | vendors, inventory_items, inventory_transactions, recipes, purchase_orders, purchase_order_items | 6 |
| mod.loyalty | loyalty_programs, loyalty_accounts, loyalty_transactions | 3 |
| mod.online_ordering | online_menus, online_menu_items, online_order_queue | 3 |
| mod.reservations | reservations, waitlist_entries | 2 |
| mod.scheduling | schedule_templates, scheduled_shifts, shift_swap_requests, staff_availability | 4 |
| mod.marketing | campaigns, campaign_recipients | 2 |
| mod.delivery | delivery_zones, deliveries | 2 |
| mod.analytics | daily_metrics, daily_item_metrics | 2 |
| New — House Accounts | house_accounts, house_account_transactions | 2 |
| New — Drive-Thru | drive_thru_orders, digital_menu_boards | 2 |
| New — Price Levels | price_levels, price_level_prices, price_level_schedules | 3 |
| New — QR Ordering | qr_menus, qr_orders | 2 |
| New — Catering | catering_events, catering_menus | 2 |
| New — Franchise | franchise_royalties | 1 |
| **TOTAL** | | **80** |
