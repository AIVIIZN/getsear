# Module 10: System Settings

## Overview

The Settings module manages all configuration for organizations, locations, terminals, printers, tax rates, roles, permissions, and module enable/disable. It is the administrative control plane that governs how every other module behaves.

**Who uses it:** Owners configure organization-level settings. Managers configure location-specific settings. Admins manage terminals, printers, and modules. The system reads settings on every request for location-specific behavior.

**Why it matters:** Every restaurant operates differently. Tax rates vary by state and city. Tip rules vary by region. Business hours, receipt formats, auto-gratuity thresholds, surcharging rules — all must be configurable without code changes.

---

## Database Tables

- **`organizations`** — Org-level config. Key settings fields: `plan`, `subscription_status`, `logo_url`, `primary_color`, `owner_name/email/phone`, `settings` (jsonb: default_currency, default_timezone, receipt_header/footer, tip_percentages, etc.).
- **`locations`** — Location-level config. Fields: address, `timezone`, `currency`, `business_hours` (jsonb array), `settings` (jsonb: auto_gratuity_pct, auto_gratuity_party_size, default_tax_rate_id, receipt_printer_ip, kitchen_printer_ip, order_number_prefix, require_table_for_dine_in, stale_table_minutes, overtime_rules, break_requirements, minimum_wage, surcharge config).
- **`terminals`** — Device management. Fields: `location_id`, `name`, `terminal_type` (enum: server_station, bar, host, cashier, kds, kiosk, customer_display), `device_id`, `is_online`, `last_heartbeat_at`, `current_user_id`, `settings` (jsonb: assigned_sections, default_order_type, printer_ip).
- **`tax_rates`** — Tax rate definitions. Fields: `location_id`, `name`, `rate` (numeric 6,4), `is_inclusive`, `is_default`, `applies_to[]` (food, alcohol, merchandise), `is_active`.
- **`org_modules`** — Module enable/disable per org. Fields: `module_id`, `is_enabled`, `config` (jsonb), `location_ids[]` (null = all).
- **`permissions`** — Permission definitions.
- **`role_permissions`** — Default permissions per role.
- **`user_permission_overrides`** — Per-user permission overrides.

### New Tables (for rebuild)

- **`printer_configs`** — Printer setup. Fields: `id`, `org_id`, `location_id`, `name` (Receipt Printer 1, Kitchen Printer), `printer_type` (receipt, kitchen, label), `connection_type` (network, bluetooth, usb), `ip_address`, `port`, `model` (Star TSP143, Epson TM-82), `settings` (jsonb: paper_width, auto_cut, cash_drawer_kick), `is_active`, `created_at`.
- **`business_hour_overrides`** — Holiday/special hours. Fields: `id`, `org_id`, `location_id`, `override_date`, `is_closed`, `open_time`, `close_time`, `reason` (Holiday, Special Event), `created_at`.

---

## API Routes

### Blueprint: `/api/v1/settings/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/organization` | Get org settings | Admin+ |
| PUT | `/organization` | Update org settings | Owner+ |
| GET | `/locations` | List locations | Admin+ |
| GET | `/location/:id` | Get location settings | Admin+ |
| PUT | `/location/:id` | Update location settings | Admin+ |
| POST | `/locations` | Create location | Owner+ |
| GET | `/tax-rates` | List tax rates (for location) | Manager+ |
| POST | `/tax-rates` | Create tax rate | Admin+ |
| PUT | `/tax-rates/:id` | Update tax rate | Admin+ |
| DELETE | `/tax-rates/:id` | Deactivate tax rate | Admin+ |
| GET | `/terminals` | List terminals (for location) | Manager+ |
| POST | `/terminals` | Register terminal | Admin+ |
| PUT | `/terminals/:id` | Update terminal config | Admin+ |
| DELETE | `/terminals/:id` | Deactivate terminal | Admin+ |
| GET | `/printers` | List printers (for location) | Manager+ |
| POST | `/printers` | Add printer | Admin+ |
| PUT | `/printers/:id` | Update printer config | Admin+ |
| POST | `/printers/:id/test` | Send test print | Admin+ |
| DELETE | `/printers/:id` | Remove printer | Admin+ |
| GET | `/modules` | List available/enabled modules | Admin+ |
| POST | `/modules/:id/enable` | Enable module for org | Owner+ |
| POST | `/modules/:id/disable` | Disable module for org | Owner+ |
| PUT | `/modules/:id/config` | Update module configuration | Admin+ |
| GET | `/roles` | List roles and their permissions | Admin+ |
| PUT | `/roles/:role/permissions` | Update role permissions | Owner+ |
| GET | `/business-hours` | Get business hours for location | Manager+ |
| PUT | `/business-hours` | Update business hours | Admin+ |
| POST | `/business-hours/override` | Add holiday/special hours override | Admin+ |

---

## UI Pages / Components

### Settings Page (Back Office) — `/admin/settings`
- **Tabbed interface:**

#### Organization Tab
- Business name, logo upload, primary brand color
- Owner contact info
- Subscription plan display
- Default currency and timezone
- Receipt header/footer text (WYSIWYG)
- Tip suggestion percentages (e.g., 18%, 20%, 22%)
- Password complexity requirements

#### Locations Tab
- Location list with add/edit
- Per-location settings:
  - Address, phone, email
  - Timezone, currency
  - Business hours editor (day-of-week grid with open/close times)
  - Holiday overrides
  - Auto-gratuity: percentage and party size threshold
  - Order number prefix
  - Require table for dine-in (toggle)
  - Stale table alert minutes
  - Overtime rules (federal, California, custom)
  - Break requirements
  - Minimum wage setting

#### Tax Rates Tab
- Tax rate list with name, rate %, inclusive toggle, applies-to categories
- Add/edit/deactivate
- Default rate indicator
- Multi-rate support (state + city + county + alcohol)

#### Terminals Tab
- Terminal list with name, type, location, status (online/offline), last heartbeat
- Add/edit/deactivate
- Terminal settings: assigned sections, default order type, printer assignment
- QR code for terminal registration (scan from iPad)

#### Printers Tab
- Printer list with name, type, connection, IP/Bluetooth, status
- Add/edit/remove
- Test print button
- Printer assignment to terminals/stations

#### Modules Tab
- Grid of available modules with enable/disable toggles
- Module descriptions and pricing
- Per-module configuration (when expanded)
- Location selector (enable for all or specific locations)
- Dependency warnings (e.g., "Marketing requires Loyalty")

#### Roles & Permissions Tab
- Role list (owner, admin, manager, server, bartender, host, kitchen, cashier, kiosk, readonly)
- Permission matrix: roles across columns, permissions in rows, checkboxes at intersections
- Per-user overrides: search user, toggle individual permissions

---

## Business Rules

1. **Settings inheritance:** Organization settings are defaults. Location settings override org defaults. Terminal settings override location defaults for that device. The resolution order: terminal > location > organization > system default.

2. **Module dependency resolution:** Some modules depend on others. Enabling a module auto-enables its dependencies. Disabling a module warns if dependents are enabled. Dependency chain examples:
   - Marketing depends on Loyalty
   - Loyalty depends on Customers
   - Delivery depends on Online Ordering
   - Franchise depends on Reports

3. **Tax rate configuration:** Multiple tax rates can be active for a location. Items can be assigned specific tax rates, or inherit the location's default. Tax is calculated per-item in the order, allowing mixed-rate orders (food vs alcohol).

4. **Business hours:** Stored as jsonb array of `{day, open, close}` objects. The system uses these for: online ordering availability, daypart calculations, scheduled report timing, and stale-tab alerts.

5. **Terminal heartbeat:** Terminals send a heartbeat every 60 seconds. If a terminal misses 3 heartbeats (3 minutes), it's marked offline. Offline terminals are flagged in the terminal list.

6. **Printer configuration:** Printers can be assigned to specific terminals or stations. Receipt printers handle customer receipts. Kitchen printers handle kitchen tickets (backup for KDS). Label printers handle food labels. The `settings` jsonb stores paper width, auto-cut behavior, and cash drawer kick commands.

7. **Module hot-swap:** Modules can be enabled/disabled without restart. The module registry discovers available modules at startup and loads enabled ones. Disabling a module hides its routes, pages, and SSE channels.

8. **Role permissions:** Permissions are hierarchical by module (e.g., `orders.create`, `orders.void`, `menu.edit`, `reports.view`). Default permissions per role are sensible out-of-the-box. Per-user overrides allow granting extra permissions (trusted server gets void access) or denying (restrict a manager from reports).

9. **Multi-location:** The settings module supports multiple locations per org from day one. Each location has independent settings, tax rates, terminals, printers, and business hours. Modules can be enabled per-location or org-wide.

10. **Subscription enforcement:** The `plan` field on the organization determines terminal limits (Starter: 2, Professional: 4, Enterprise: unlimited) and available modules. Attempting to add terminals or enable modules beyond plan limits returns an error with upgrade prompt.

---

## Dependencies

- **01_auth** — Admin/owner role enforcement for settings changes
- **All modules** — Every module reads settings for configuration
- **Redis DB 3** — Settings cache for fast reads

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `settings.updated` | `events.settings` | `{entity, entity_id, changes}` | Any settings change |
| `terminal.registered` | `events.settings` | `{terminal_id, location_id}` | New terminal added |
| `terminal.offline` | `events.settings` | `{terminal_id}` | Terminal missed heartbeats |
| `module.enabled` | `events.settings` | `{module_id, org_id}` | Module activated |
| `module.disabled` | `events.settings` | `{module_id, org_id}` | Module deactivated |
| `tax_rate.changed` | `events.settings` | `{tax_rate_id, location_id}` | Tax rate created/updated |

### Subscribed Events
- None (Settings is a publisher of configuration changes)

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `terminal_heartbeat_check` | Every 2 minutes | Mark terminals offline if heartbeat missed for 3+ minutes |
| `settings_cache_refresh` | On settings change | Invalidate and refresh settings cache in Redis |
| `subscription_enforcement` | Daily | Check org subscription status, send warnings for expiring trials |

---

## Acceptance Criteria

### Organization Settings
- [ ] Owner can update org name, logo, brand color
- [ ] Owner can set receipt header/footer text
- [ ] Owner can configure default tip percentages
- [ ] Settings save and reflect immediately

### Location Settings
- [ ] Admin can create a new location with address and timezone
- [ ] Admin can configure business hours per day of week
- [ ] Admin can add holiday hour overrides
- [ ] Admin can set auto-gratuity percentage and party size
- [ ] Admin can configure overtime rules for the location

### Tax Rates
- [ ] Admin can create tax rates with name, rate, and applicability
- [ ] Multiple tax rates can be active for a location
- [ ] Default tax rate is applied when items don't specify one
- [ ] Inclusive/exclusive tax toggle works correctly

### Terminals
- [ ] Admin can register a new terminal with name, type, and location
- [ ] Terminal list shows online/offline status based on heartbeat
- [ ] Admin can configure terminal settings (sections, default order type)
- [ ] Deactivated terminals cannot be used

### Printers
- [ ] Admin can add printers with connection details
- [ ] Test print sends a test receipt to the printer
- [ ] Printers can be assigned to terminals and KDS stations

### Modules
- [ ] Admin can view all available modules with descriptions
- [ ] Owner can enable/disable modules
- [ ] Module dependencies are enforced (auto-enable deps, warn on disable)
- [ ] Module configuration is accessible when expanded
- [ ] Location-specific module enabling works

### Roles & Permissions
- [ ] Admin can view permission matrix for all roles
- [ ] Owner can modify default permissions for a role
- [ ] Admin can set per-user permission overrides (grant/deny)
- [ ] Permission changes take effect on next request (no restart needed)
