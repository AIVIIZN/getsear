# Sear POS — getsear.com

## Project Overview
Modern, modular restaurant point-of-sale system for independent operators and multi-location groups. Month-to-month, no contracts, runs on iPads. Valor Payments with Dual Pricing.

## Tech Stack
- **Backend:** Python 3.12, Flask, Jinja2
- **Frontend:** htmx + Alpine.js + Tailwind CSS (Progressive Web App)
- **Database:** Supabase (PostgreSQL 17.6) with Row-Level Security
- **Real-Time:** SSE via Redis pub/sub (DB 4), event bus bridge
- **Task Queue:** Celery + Redis
- **Hosting:** Google Cloud VM (Compute Engine)
- **IDs:** UUIDv7 (time-sortable)
- **Timestamps:** All `timestamptz` in UTC
- **SMS:** Twilio
- **Email:** SendGrid
- **Payments:** Valor PayTech (exclusive processor, Dual Pricing model)

## Infrastructure
- **GCP Project:** getsear-pos (project number: 91896714758)
- **VM:** getsear — us-central1-a, e2-standard-2, Ubuntu 24.04 LTS
- **VM External IP:** 34.132.111.219
- **Supabase Project:** lbekiyxqemxozmghgmtp (us-east-1, org: CAM/fuarjlihvirlggelgtnc)
- **Supabase URL:** https://lbekiyxqemxozmghgmtp.supabase.co
- **Supabase DB Host:** db.lbekiyxqemxozmghgmtp.supabase.co
- **GitHub:** github.com/AIVIIZN/getsear
- **Domain:** getsear.com via GoDaddy, DNS on Google Cloud DNS (zone: getsear-zone)
- **DNS:** A record → 34.132.111.219, www CNAME → getsear.com
- **Nameservers:** ns-cloud-b1/b2/b3/b4.googledomains.com
- **Firewall:** getsear-allow-http (tcp:80, 443, 8000)
- **Billing Account:** 0197EC-37F13C-C5CC10

## Architecture Doc
Full system architecture is in `SEAR_POS_ARCHITECTURE.md` (782KB, 17,935 lines). Read this before building anything.

## Coding Rules
- Python: f-strings, type hints on function signatures, pathlib over os.path
- Always use `load_dotenv(explicit_path)` — never rely on auto-discovery
- `google-genai` SDK (NOT `google-generativeai`) for any Gemini usage
- ES modules (import/export) for any JS, not CommonJS
- DB stores money as numeric(10,2) (dollars). Python API layer uses integer cents. Conversion at service boundary.
- All database IDs are UUIDv7
- All timestamps are `timestamptz` stored in UTC, displayed in restaurant's local timezone
- PINs hashed with bcrypt (not SHA-256) — standardized across entire codebase
- Auth uses local JWT verification (not Supabase Auth API calls) — supports both email and PIN login

## Deploy
- Railway is NOT used for this project — GCP VM only
- Supervisor for process management (gunicorn workers)
- Nginx as reverse proxy, terminates SSL
- Redis for Celery task queue, caching, rate limiting, sessions, pub/sub (5 DBs: 0-4)

## Git
- Don't commit unless asked
- Don't push unless asked
- Never amend, force push, or --no-verify without permission
- Branch protection on main (require PRs)

## Key Integrations
- **Valor PayTech:** Payment processing via Valor Connect (MQTT) + REST API. Card data never touches Sear servers. Supported hardware: VP800, VP550, VP300 Pro, RCKT. Mock mode via VALOR_MOCK=true.
- **Supabase Realtime:** Kitchen display, order status, table management live updates
- **Twilio:** SMS notifications (order ready, reservation reminders)
- **SendGrid:** Transactional email (receipts, reports, alerts)

## Build Status — CODE COMPLETE (2026-03-21)

### Final Numbers
- **169 API routes** across 14 blueprints
- **149 source files** (~42,400 lines)
- **24 SQL migrations** (50+ tables, 10 enums, RLS policies, indexes, triggers)
- **41 HTML templates** + 8 JS files + Tailwind design system
- **Zero TODOs, zero stubs, zero placeholders**

### What's Built
| Blueprint | Routes | Coverage |
|-----------|--------|----------|
| Auth | 10 | email login, PIN login, JWT, manager PIN verify, terminal registration, profile update |
| Menu | 17 | categories CRUD + reorder, items CRUD + 86 toggle + reorder, modifier groups CRUD, full menu tree |
| Orders (POS) | 22 | CRUD, add/update/void items, send, fire course, transfer, move table, split, merge, reopen, discount, comp |
| Payments | 10 | card/cash/gift card processing, capture, void, refund, tip adjust, preauth, settlement report |
| Tables | 14 | floor plans CRUD + get by ID, tables CRUD, seat, clear, status, history, sections, status summary |
| Staff | 15 | CRUD, clock in/out, breaks, time entries + edit + approve, on-duty, tips, tip pool distribute |
| Reports | 13 | daily/weekly/monthly/hourly/custom sales, PMIX, category mix, server perf, labor, discounts, payments, tax, export |
| Settings | 18 | org, location, tax rates CRUD, terminals, printers, modules enable/disable/config, roles, permissions |
| Customers | 9 | CRUD, order history, loyalty, lookup (POST), merge |
| KDS | 7 | stations CRUD, tickets, bump, bump-all, recall |
| SSE | 4 | real-time streams: orders, KDS, tables, 86 |
| Reconciliation | 3 | close day, daily report, match deposit |
| Pages | 22 | all HTML page routes (POS, tables, checks, KDS, reports x8, admin x3, payment, cash drawer, customer display, kiosk) |

### Payment Flows
- Standard card (auth + capture via Valor terminal or token)
- Cash (tendering, change calc, denomination breakdown, drawer kick)
- Bar tabs (hold, incremental auth, close with tip, walkout auto-gratuity, stale tab auto-close)
- Split payments (equal, by-item, custom amounts, mixed tender)
- Refunds (void pre-settlement, full/partial refund, unlinked refund)
- Gift cards (activate, balance, redeem partial, reload — SHA-256 hashed numbers)
- Tips (suggested, auto-gratuity as IRS service charge, distribution: direct/pool/points, Form 8027)
- Surcharging/Dual Pricing (state laws, network caps, cash discount calc)

### Frontend Screens
- Login (email + password), PIN login (avatar grid + numpad), Clock in/out
- POS order entry (3-panel: order, menu grid, quick actions)
- Modifier selection (slide-over with validation)
- Payment flow (full state machine: card/cash/gift card/tip/receipt)
- Check management (split by seat/equal/custom, drag-and-drop)
- Table floor plan (positioned shapes, status colors, drag edit mode, detail popovers)
- KDS (fullscreen tickets, aging colors, bump/recall, all-day counts, audio alerts)
- Reports dashboard + 7 subpages (sales, labor, PMIX, server perf, voids, cash, speed)
- Menu manager (3-panel tree editor), Staff manager (roster + time clock), Settings
- Customer-facing display, Kiosk self-ordering (portrait), Cash drawer count

### Reviewed & Fixed
- 4 adversarial reviewers (backend, frontend, DB/security, integration) found ~90 issues
- All critical, medium, and low issues fixed
- Key fixes: payments blueprint registration, PIN hash standardization (bcrypt), CSRF exemption, auth decorator (local JWT), SSE bridge wiring, template inheritance, page route rewiring, column name alignment, Celery tasks created, cookie-based page auth, PIN brute-force lockout, password complexity, order number race condition fix

### Deployment — COMPLETE (2026-03-21)
- 24 SQL migrations applied to Supabase (72 tables, RLS policies, indexes, triggers)
- SSL certificate via certbot (https://getsear.com + www)
- Gunicorn gthread workers (gevent had SSL conflicts with Supabase SDK)
- Supabase anon key for auth, service_role key for data operations
- Seed data: 6 categories, 30 menu items, 3 modifier groups, 15 modifiers, 10 tables, 1 floor plan, tax rate

### iOS Native Wrapper — COMPLETE (2026-03-21)
- SwiftUI app at ios/SearPOS/ — WKWebView wrapping getsear.com
- CoreBluetooth: Valor RCKT terminal + Star Micronics printers
- ESC/POS builder for receipt printing + cash drawer kick
- JS bridge: native_bridge.js with postMessage/evaluateJavaScript
- iPad landscape, iOS 17+, Swift 6, all files parse clean
- Valor BLE UUIDs are placeholders pending ISV credentials

### Remaining
- Valor ISV credentials (only thing blocking real payment processing)

### Credentials
- `demo@getsear.com` / `demo1234` (PIN: 0000) — owner role
- `ian@cyberactiveconsulting.com` / `SearAdmin2026!` (PIN: 1234) — owner role

## Project Structure
```
app/
├── __init__.py              # App factory (169 routes)
├── config.py                # 5 environment classes, ProductionConfig enforces secrets
├── extensions.py            # Redis (5 DBs), Celery, Supabase, Limiter, CORS
├── celery_worker.py         # Celery + 5-task beat schedule
├── tasks.py                 # 9 Celery task implementations
├── core/
│   ├── auth/                # Login, PIN, JWT, middleware, cookie auth
│   ├── pos/                 # Orders, tables, payments, SSE, reconciliation
│   │   └── payments/        # Valor integration, flows (cash/card/bar/split/refund/gift)
│   │       └── flows/       # Standard, cash, bar_tab, split, refund, tips
│   ├── menu/                # Categories, items, modifiers, 86 toggle
│   ├── staff/               # CRUD, clock in/out, breaks, tips
│   ├── reports/             # All report endpoints + CSV export
│   ├── settings/            # Org, location, tax, terminals, modules
│   ├── customers/           # CRM, lookup, merge, order history
│   └── pages/               # 22 HTML page routes
├── modules/
│   └── kds/                 # Kitchen display module (routes, hooks, tasks)
├── shared/
│   ├── module_registry.py   # Hot-swap modules with dependency resolution
│   ├── event_bus.py         # Pub/sub event system (sync + async via Celery)
│   ├── sse_bridge.py        # Event bus → Redis pub/sub → SSE streams
│   ├── audit.py             # Audit logging to audit_log table
│   ├── cache.py             # Redis cache (menu, floor plan, modules)
│   ├── decorators.py        # @require_auth, @require_permission, @require_role, @require_module, @require_manager_approval, @require_location
│   ├── responses.py         # api_success, api_error, api_paginated (orjson)
│   ├── validators.py        # UUID, money, required fields, enum validation
│   └── tenant.py            # TenantContext dataclass, g.current_user helpers
├── static/
│   ├── css/                 # input.css (Tailwind source), output.css, pos-overrides.css
│   └── js/                  # app.js, alpine-stores.js, pos.js, numpad.js, kds.js, tables.js, reports.js, backoffice.js
└── templates/
    ├── base.html            # Master layout (sidebar + topbar + content)
    ├── base_pos.html         # POS: collapsed sidebar, no-scroll, touch-optimized
    ├── base_backoffice.html  # Back office: expanded sidebar, scrollable
    ├── base_fullscreen.html  # KDS/kiosk/customer display: no chrome
    ├── auth/                 # login, pin_login, clock_in
    ├── pos/                  # order_entry, modifiers, payment, checks, cash_drawer + partials
    ├── tables/               # floor_plan
    ├── kds/                  # display (fullscreen)
    ├── reports/              # dashboard, sales, labor, product_mix, server_performance, voids, cash, speed + _reports_nav partial
    ├── backoffice/           # menu_manager, staff_manager, settings
    ├── customer_display/     # display
    ├── kiosk/                # order (portrait)
    ├── components/           # _sidebar, _topbar, _toast, _modal, _connection_status
    ├── partials/             # _date_range_picker
    ├── errors/               # 400, 401, 403, 404, 500
    └── pages/                # admin, reports (nav shells)
migrations/                   # 001-024 SQL + run_migrations.py
```
