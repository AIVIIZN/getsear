# Sear POS v2 — Build Progress

This file is the single source of truth for what's been built, what's in progress, and what's next. Updated after every coding session.

## Current Status: INFRASTRUCTURE COMPLETE — Ready to build Batch 1

## Infrastructure Checklist
- [x] Supabase wiped (drop all tables, enums, policies) — 2026-03-22
- [ ] Supabase schema applied (SCHEMA.md → SQL migrations)
- [ ] Supabase seed data loaded
- [x] VM cleaned (remove old Flask app, Supervisor configs) — 2026-03-22
- [x] VM: Node.js 22.22.1 LTS installed — 2026-03-22
- [x] VM: PM2 6.0.14 installed globally — 2026-03-22
- [x] VM: Nginx reconfigured for Next.js (port 3000) — 2026-03-22
- [x] VM: Redis verified working (PONG) — 2026-03-22
- [x] VM: SSL certificate verified (certbot, getsear.com + www) — 2026-03-22
- [x] Next.js 16.2.1 project initialized (App Router + TypeScript + Tailwind v4) — 2026-03-22
- [x] shadcn/ui initialized (24 components installed) — 2026-03-22
- [x] All deps installed (Zustand, BullMQ, Supabase SDK, zod, react-hook-form, Recharts, dnd-kit, etc.) — 2026-03-22
- [x] Design system implemented (globals.css with Sear tokens: ember orange, warm neutrals, animations) — 2026-03-22
- [ ] Base layouts created (POS, back-office, fullscreen, auth)
- [ ] shadcn/ui components customized to match UI_DESIGN.md
- [x] First deploy to VM (https://getsear.com returns 200) — 2026-03-22
- [x] Git pushed (commit ce1a073) — 2026-03-22

## Module Build Order (dependency-resolved)
Build in this exact sequence. Each module must be 100% complete before marking done.

### Batch 1 — Foundation (no dependencies)
- [ ] **01 Auth** — login, PIN login, JWT, middleware, terminal registration
- [ ] **10 Settings** — org, location, tax rates, terminals, printers, roles, permissions

### Batch 2 — Core Data (depends on auth + settings)
- [ ] **02 Menu** — categories, items, modifiers, 86, price levels, allergens
- [ ] **07 Staff** — CRUD, clock in/out, breaks, time entries, tips
- [ ] **08 Customers** — profiles, lookup, merge, tags, VIP

### Batch 3 — Core POS (depends on menu + staff + customers)
- [ ] **03 Orders** — full order lifecycle, all 9 types, coursing, split/merge
- [ ] **05 Tables** — floor plans, status management, sections, real-time
- [ ] **06 KDS** — stations, tickets, bump/recall, aging, expo, dark theme

### Batch 4 — Payments (depends on orders)
- [ ] **04 Payments** — Valor, cash, gift cards, house accounts, bar tabs, tips, splits

### Batch 5 — Revenue Features (depends on core POS)
- [ ] **11 Online Ordering** — portal, QR code, throttling, scheduled orders
- [ ] **12 Loyalty** — programs, accounts, earn/redeem, tiers
- [ ] **13 Reservations** — reservations, waitlist, SMS, table assignment
- [ ] **21 House Accounts** — corporate billing, credit limits, statements

### Batch 6 — Operations (depends on core POS + staff)
- [ ] **14 Inventory** — items, recipes, vendors, POs, waste, food cost
- [ ] **15 Scheduling** — templates, shifts, availability, swaps, labor forecast
- [ ] **17 Delivery** — zones, drivers, tracking, third-party hooks

### Batch 7 — Growth Features (depends on customers + orders)
- [ ] **16 Marketing** — campaigns, segmentation, email/SMS, tracking
- [ ] **18 Catering** — events, BEOs, menus, invoicing

### Batch 8 — Vertical & Enterprise (depends on everything)
- [ ] **19 Drive-Thru** — lanes, speed tracking, menu boards
- [ ] **20 Franchise** — multi-location sync, royalties, consolidated reports
- [ ] **09 Reports** — all report types, dashboard, charts, CSV/PDF export

### Batch 9 — Polish
- [ ] Seed data script (realistic demo restaurant)
- [ ] PWA manifest + service worker + offline mode
- [ ] E2E tests (Playwright: login, order, payment, KDS bump)
- [ ] Visual QA pass (every page, every empty state, every loading state)
- [ ] Performance audit (Lighthouse, bundle size)
- [ ] Security audit (auth guards, RLS, CSRF, rate limiting)

## Completed Modules
(none yet)

## Current Session Notes
**Session 1 (2026-03-22):** Full infrastructure setup. Deleted old Flask codebase. Created all architecture docs (SCHEMA.md, API_SPEC.md, UI_DESIGN.md, BUSINESS_RULES.md, 21 MODULE_SPECS). Initialized Next.js 16 + shadcn/ui + design system. Wiped Supabase. Installed Node.js 22 + PM2 on VM. Deployed blank app to getsear.com. Next: Apply Supabase schema, build base layouts, start Batch 1 (Auth + Settings).

## Known Issues
(none yet)

## Deploy Log
| Date | What | Commit | Notes |
|------|------|--------|-------|
| 2026-03-22 | v2 foundation: Next.js + shadcn/ui + design system | ce1a073 | Blank app, proves full pipeline works |

## Deploy Commands (for reference)
```bash
# SSH
ssh -i ~/.ssh/google_compute_engine ianrakow@34.132.111.219

# Deploy sequence on VM
cd /opt/sear/app && git pull origin main && npm ci && npm run build && \
cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/ && \
pm2 reload sear-pos

# Supabase
supabase db execute --project-ref lbekiyxqemxozmghgmtp "SQL HERE"
```
