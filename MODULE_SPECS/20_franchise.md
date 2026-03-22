# Module 20: Franchise & Multi-Location

## Overview

The Franchise module provides centralized management tools for restaurant groups, franchise operations, and multi-location operators. It enables menu template push from corporate to locations, consolidated cross-location reporting, royalty calculation and reporting, location comparison analytics, and a hierarchical role system (franchise owner > regional director > store manager).

**Who uses it:** Franchise owners and corporate teams manage menus, view consolidated reports, and track royalties. Regional directors oversee clusters of locations. Store managers operate individual locations. The system calculates royalties and generates compliance reports.

**Why it matters:** Multi-location operators need enterprise-grade tools that don't exist in most mid-market POS systems. Toast Enterprise charges $200+/location. R Power's franchise module is its key differentiator. Sear targets $65-99/location for enterprise — one-third of Toast — with equivalent functionality.

---

## Database Tables

### Existing Tables

- **`organizations`** — Top-level org (the franchise/group entity).
- **`locations`** — Individual restaurant locations within the org.
- **`users`** — Staff with `location_ids[]` for multi-location access.
- **`menu_categories`** / **`menu_items`** — With `location_id` (null = org-wide template).
- **`daily_metrics`** — Pre-aggregated metrics per location.

### New Tables

- **`franchise_config`** — Franchise-level settings. Fields: `id`, `org_id`, `royalty_percentage` (numeric 5,4), `marketing_fund_percentage` (numeric 5,4), `royalty_period` (weekly, biweekly, monthly), `royalty_basis` (gross_sales, net_sales), `menu_push_mode` (template, mandatory), `allow_local_menu_additions`, `allow_local_price_overrides`, `consolidated_reporting_enabled`, `created_at`, `updated_at`.
- **`franchise_royalties`** — (Also in Reports) Royalty calculations. Fields: `id`, `org_id`, `location_id`, `period_start`, `period_end`, `gross_sales`, `net_sales`, `royalty_percentage`, `royalty_amount`, `marketing_fund_percentage`, `marketing_fund_amount`, `total_due`, `status` (calculated, invoiced, paid), `paid_at`, `payment_reference`, `created_at`.
- **`location_groups`** — Regional groupings. Fields: `id`, `org_id`, `name` (East Region, West Region), `location_ids[]`, `director_user_id`, `created_at`.
- **`menu_push_log`** — Track menu pushes from corporate. Fields: `id`, `org_id`, `push_type` (full, incremental), `pushed_by`, `target_location_ids[]`, `items_pushed`, `status` (pending, completed, partial, failed), `error_log` (jsonb), `created_at`.
- **`franchise_compliance_checks`** — Compliance tracking. Fields: `id`, `org_id`, `location_id`, `check_type` (menu_adherence, pricing_compliance, hours_compliance), `status` (passed, warning, failed), `details` (jsonb), `checked_at`.

---

## API Routes

### Blueprint: `/api/v1/franchise/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/config` | Get franchise configuration | Owner+ |
| PUT | `/config` | Update franchise config | Owner+ |
| GET | `/locations` | List all locations with summary metrics | Owner+ |
| GET | `/locations/:id/detail` | Detailed location performance | Owner+ |
| GET | `/location-groups` | List regional groups | Owner+ |
| POST | `/location-groups` | Create location group | Owner+ |
| PUT | `/location-groups/:id` | Update location group | Owner+ |
| GET | `/comparison` | Cross-location comparison dashboard | Owner+ |
| GET | `/comparison/metrics` | Side-by-side metrics for selected locations | Owner+ |
| GET | `/comparison/rankings` | Rank locations by selected metric | Owner+ |
| POST | `/menu/push` | Push menu from org template to locations | Owner+ |
| GET | `/menu/push-log` | View menu push history | Owner+ |
| GET | `/menu/compliance` | Check location menu adherence | Owner+ |
| GET | `/royalties` | List royalty calculations (filter: period, location, status) | Owner+ |
| POST | `/royalties/calculate` | Calculate royalties for a period | Owner+ |
| PUT | `/royalties/:id` | Update royalty status (mark as paid) | Owner+ |
| GET | `/royalties/summary` | Royalty summary by period | Owner+ |
| POST | `/royalties/export` | Export royalty report | Owner+ |
| GET | `/compliance` | Franchise compliance dashboard | Owner+ |
| POST | `/compliance/run` | Run compliance checks across locations | Owner+ |
| GET | `/consolidated-report` | Consolidated P&L across all locations | Owner+ |

---

## UI Pages / Components

### Franchise Dashboard — `/admin/franchise`
- **Organization overview:**
  - Total locations count
  - Total combined revenue (current period)
  - Average location revenue
  - Total royalties due/collected
  - System-wide metrics: avg check, labor %, food cost %
- **Location cards grid:** Each location shows: name, revenue, orders, labor %, status indicator (healthy/warning/attention)
- **Map view:** Locations plotted on map with performance color-coding

### Location Comparison — `/admin/franchise/comparison`
- **Select locations** (multi-select or select group)
- **Metrics comparison table:** Revenue, order count, avg check, covers, labor %, food cost %, tip avg, speed of service — side by side
- **Rankings:** Sort locations by any metric
- **Trend comparison chart:** Selected metric over time for selected locations (overlaid lines)
- **Period selector:** Daily, weekly, monthly, custom

### Menu Push — `/admin/franchise/menu`
- **Org-level menu template** editor (categories, items, modifiers)
- **Push controls:**
  - Select target locations (all or specific)
  - Push mode: Full (overwrite) or Incremental (add/update only)
  - Preview changes: Show what will be added/modified/removed at each location
  - Confirm and push
- **Push history:** Log of pushes with status, item count, errors
- **Compliance view:** Per-location menu adherence:
  - Items added locally (allowed or not based on config)
  - Local price overrides (allowed or not)
  - Missing required items
  - Non-compliant modifications

### Royalty Management — `/admin/franchise/royalties`
- **Period selector:** Current and past periods
- **Royalty table:** Location, gross sales, net sales, royalty %, royalty amount, marketing fund, total due, status
- **Summary cards:** Total royalties due, total collected, total outstanding
- **Mark as paid:** Per-location payment recording
- **Export:** PDF/CSV royalty statement per location or consolidated
- **Royalty calculator:** Adjust percentages and preview impact

### Regional Groups — `/admin/franchise/groups`
- Create/edit groups (name, locations, regional director)
- Group-level reporting (aggregate metrics for the region)
- Director assignment (user with regional director role)

### Consolidated Reporting — `/admin/franchise/reports`
- Consolidated P&L: Revenue, COGS, labor, other expenses, profit — combined across all locations
- Per-location P&L comparison
- Trending: Combined performance over time
- Export to PDF/CSV

---

## Business Rules

1. **Role hierarchy:**
   - `platform_admin`: Sear internal admin (super admin)
   - `owner`: Franchise owner / CEO — sees everything across all locations
   - `admin`: Corporate admin — configures franchise settings, pushes menus
   - `regional_director`: (New role or permission set) — sees assigned location group only
   - `manager`: Store manager — sees own location only
   - Standard roles below manager see only their assigned location

2. **Menu push modes:**
   - **Template mode:** Org-level menu is a template. Locations can have local additions and price overrides (configurable). Template pushes merge with local items.
   - **Mandatory mode:** Org-level menu is authoritative. Pushes overwrite location menus entirely. Local additions are not allowed.

3. **Royalty calculation:**
   - `royalty_amount = basis_sales * royalty_percentage`
   - `marketing_fund_amount = basis_sales * marketing_fund_percentage`
   - `total_due = royalty_amount + marketing_fund_amount`
   - Basis configurable: `gross_sales` or `net_sales` (net = gross - discounts - comps - voids - refunds)
   - Period configurable: weekly, biweekly, monthly

4. **Royalty status flow:** Calculated → Invoiced → Paid. Payment reference (check number, wire reference) recorded.

5. **Consolidated reporting:** Reports aggregate data from `daily_metrics` across all locations (or selected group). Filters available by location group, date range, and metric type.

6. **Location comparison:** Side-by-side comparison of any number of locations on standardized metrics. Rankings highlight top and bottom performers on each metric. This enables data-driven operational improvement.

7. **Franchise compliance checks:** Automated checks run to verify:
   - Menu adherence (required items present, pricing within allowed variance)
   - Business hours compliance (locations operating within required hours)
   - Operational standards (configurable checks)
   - Results feed a compliance dashboard with pass/warning/fail status per location

8. **Multi-currency support (future):** For international franchises, locations may operate in different currencies. Revenue aggregation uses exchange rates. Not in v1 — all locations assumed USD.

9. **Data isolation:** Even within a franchise, location-level data (orders, payments, staff) is isolated by `location_id` with RLS. Franchise-level views aggregate but do not expose individual transaction details to other locations.

10. **Location onboarding:** Adding a new location to the franchise: create location record, push org menu template, configure local settings (tax, timezone, address), register terminals. The module provides a guided setup flow.

---

## Dependencies

- **01_auth** — Role hierarchy enforcement
- **02_menu** — Menu templates, push functionality
- **09_reports** — Daily metrics for consolidated reporting
- **10_settings** — Org and location config
- **All modules** — Franchise reporting aggregates data from all modules

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `franchise.menu_pushed` | `events.menu` | `{push_id, target_locations, items_count}` | Menu push completed |
| `franchise.royalty_calculated` | Internal | `{period, location_id, amount}` | Royalties calculated |
| `franchise.compliance_alert` | Internal | `{location_id, check_type, status}` | Compliance check failed |

### Subscribed Events
| Event | Action |
|-------|--------|
| `metrics.daily_aggregated` | Update consolidated reports cache |
| `menu.updated` (at location) | Check menu compliance against template |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `royalty_calculation` | Per configured period (weekly/biweekly/monthly) | Calculate royalties for all locations |
| `franchise_compliance_check` | Weekly | Run compliance checks across all locations |
| `consolidated_report_cache` | Daily at 4 AM | Pre-calculate consolidated report data |
| `location_health_check` | Every hour | Check location status (online, reporting, terminal health) |
| `menu_compliance_check` | Daily at 5 AM | Verify location menus match corporate template |

---

## Acceptance Criteria

### Franchise Configuration
- [ ] Owner can set royalty percentage and period
- [ ] Owner can set marketing fund percentage
- [ ] Owner can choose royalty basis (gross or net sales)
- [ ] Owner can configure menu push mode (template or mandatory)

### Location Comparison
- [ ] Owner can view side-by-side metrics for multiple locations
- [ ] Rankings sort locations by selected metric
- [ ] Trend chart shows metric comparison over time
- [ ] Regional group filtering works

### Menu Push
- [ ] Owner/admin can push menu from org template to all or selected locations
- [ ] Preview shows what changes will be applied per location
- [ ] Push log records history with status
- [ ] Template mode allows local additions; mandatory mode does not
- [ ] Menu compliance report shows adherence per location

### Royalty Management
- [ ] Royalties calculated correctly per configured period and percentage
- [ ] Royalty table shows all locations with amounts due
- [ ] Royalties can be marked as paid with reference
- [ ] Royalty report exportable as PDF/CSV

### Consolidated Reporting
- [ ] Combined revenue across all locations displayed
- [ ] Per-location P&L comparison available
- [ ] Data aggregated from daily_metrics correctly
- [ ] Export to PDF/CSV works

### Compliance
- [ ] Automated compliance checks run on schedule
- [ ] Results displayed per location with pass/warning/fail
- [ ] Non-compliant locations flagged with details

### Role Hierarchy
- [ ] Owner sees all locations and franchise data
- [ ] Regional director sees only assigned location group
- [ ] Store manager sees only their location
- [ ] Data isolation enforced by RLS
