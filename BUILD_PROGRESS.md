# Sear POS v2 — Build Progress

This file is the single source of truth for what's been built, what's in progress, and what's next. Updated after every coding session.

## Current Status: PRE-BUILD (Infrastructure Setup)

## Infrastructure Checklist
- [ ] Supabase wiped (drop all tables, enums, policies)
- [ ] Supabase schema applied (SCHEMA.md → SQL migrations)
- [ ] Supabase seed data loaded
- [ ] VM cleaned (remove old Flask app, Python, Gunicorn, Supervisor)
- [ ] VM: Node.js 22 LTS installed
- [ ] VM: PM2 installed globally
- [ ] VM: Nginx reconfigured for Next.js (port 3000)
- [ ] VM: Redis verified working (5 DBs)
- [ ] VM: SSL certificate renewed/verified
- [ ] Next.js project initialized (create-next-app with TypeScript + Tailwind + App Router)
- [ ] shadcn/ui initialized (components installed)
- [ ] Zustand, BullMQ, Supabase SDK, zod, react-hook-form installed
- [ ] Design system implemented (globals.css with tokens from UI_DESIGN.md)
- [ ] Base layouts created (POS, back-office, fullscreen, auth)
- [ ] shadcn/ui components customized to match UI_DESIGN.md
- [ ] First deploy to VM (blank app, proves pipeline works)
- [ ] Git pushed with clean initial commit

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
(updated each session with what was accomplished and any blockers)

## Known Issues
(none yet)

## Deploy Log
| Date | What | Commit | Notes |
|------|------|--------|-------|
| | | | |
