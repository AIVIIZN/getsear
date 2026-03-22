# Sear POS v2 — getsear.com

## Project Overview
Enterprise restaurant point-of-sale system for independent operators and multi-location groups. Month-to-month, no contracts, runs on iPads and Android. Valor Payments with Dual Pricing. Competing directly with Toast and R Power.

## Tech Stack
- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui
- **State Management:** Zustand v5 + Immer
- **Backend:** Next.js Route Handlers (TypeScript)
- **Database:** Supabase (PostgreSQL 17.6) with Row-Level Security
- **Auth:** Supabase Auth + @supabase/ssr (cookie-based, works with Server Components)
- **Real-Time:** Supabase Realtime (WebSocket) for KDS, orders, tables, 86
- **Background Jobs:** BullMQ v5 + Redis
- **Process Manager:** PM2 (cluster mode, 2 workers)
- **Reverse Proxy:** Nginx with SSL termination (certbot)
- **Hosting:** Google Cloud VM (Compute Engine) — NOT Vercel, NOT Cloud Run
- **IDs:** UUIDv7 (time-sortable)
- **Timestamps:** All `timestamptz` in UTC
- **SMS:** Twilio
- **Email:** SendGrid
- **Payments:** Valor PayTech (Dual Pricing model)
- **Icons:** Lucide React
- **Charts:** Recharts
- **Drag & Drop:** @dnd-kit
- **Forms:** react-hook-form + zod
- **Testing:** Vitest + Playwright

## Infrastructure
- **GCP Project:** getsear-pos (project number: 91896714758)
- **VM:** getsear — us-central1-a, e2-standard-2, Ubuntu 24.04 LTS
- **VM External IP:** 34.132.111.219
- **Supabase Project:** lbekiyxqemxozmghgmtp (us-east-1)
- **Supabase URL:** https://lbekiyxqemxozmghgmtp.supabase.co
- **GitHub:** github.com/AIVIIZN/getsear
- **Domain:** getsear.com (Google Cloud DNS)
- **DNS:** A record -> 34.132.111.219
- **Firewall:** getsear-allow-http (tcp:80, 443)

## Architecture Documents (READ BEFORE BUILDING)
| Document | Purpose | Lines |
|----------|---------|-------|
| `SCHEMA.md` | Database tables, columns, types, constraints, RLS | 2,610 |
| `API_SPEC.md` | All 267 routes with types and auth | 3,204 |
| `UI_DESIGN.md` | Design system, colors, components, animations | 1,684 |
| `BUSINESS_RULES.md` | All operational logic and state machines | 1,303 |
| `MODULE_SPECS/` | 21 module specifications (one file each) | 4,703 |
| `MASTER_TEMPLATE.md` | Build framework (11-phase autonomous pipeline) | 684 |
| `SEAR_POS_ARCHITECTURE.md` | Original reference architecture (legacy, for context) | 17,935 |

## Coding Rules
- TypeScript strict mode — no `any` types except at explicit boundaries
- All components use named exports (not default exports)
- Server Components by default, `'use client'` only when needed
- Zod schemas for ALL API request/response validation
- All money stored as numeric(10,2) in DB, integer cents in TypeScript
- All database IDs are UUIDv7
- All timestamps are `timestamptz` stored in UTC, displayed in restaurant's local timezone
- PINs hashed with bcrypt (never SHA-256)
- CSS uses design tokens from UI_DESIGN.md (never hardcode colors, spacing, shadows)
- shadcn/ui components are the base — customize via CSS variables, don't rebuild from scratch
- Use Zustand stores for client state, not React Context
- Error boundaries on every route segment
- Loading.tsx and error.tsx for every route group

## Naming Conventions (canonical glossary)
- Organization: `org` (not `organization`)
- ID columns: `entity_id` (e.g., `org_id`, `user_id`, `order_id`)
- Timestamps: end with `_at` (e.g., `created_at`, `updated_at`, `deleted_at`)
- Booleans: start with `is_` (e.g., `is_active`, `is_taxable`)
- Route prefix: `/api/` (e.g., `/api/orders`, `/api/menu/categories`)
- Component files: PascalCase (e.g., `OrderEntry.tsx`, `MenuGrid.tsx`)
- Utility files: camelCase (e.g., `formatMoney.ts`, `useRealtimeOrders.ts`)
- CSS classes: shadcn/ui conventions (cn utility, cva variants)

## Deploy
- Next.js standalone output behind Nginx
- PM2 cluster mode (2 workers) with auto-restart
- Redis for BullMQ, caching, rate limiting, pub/sub
- `pm2 reload sear-pos --update-env` for zero-downtime deploy

## Git
- Don't commit unless asked
- Don't push unless asked
- Never amend, force push, or --no-verify without permission

## Scope — 21 Modules (ALL fully implemented, no empty shells)
| # | Module | Routes | Key Features |
|---|--------|--------|-------------|
| 01 | Auth | 10 | Email login, PIN login, JWT, terminal registration, manager overrides |
| 02 | Menu | 17 | Categories, items, modifiers, 86 toggle, 9 price levels, allergens |
| 03 | Orders | 22 | Full POS order lifecycle, 9 order types, coursing, split/merge |
| 04 | Payments | 10 | Valor card, cash, gift cards, house accounts, bar tabs, tips |
| 05 | Tables | 14 | Floor plans, status management, sections, history |
| 06 | KDS | 7 | Stations, tickets, bump/recall, aging, expo mode |
| 07 | Staff | 15 | CRUD, clock in/out, breaks, tips, tip pool, overtime |
| 08 | Customers | 9 | CRM, lookup, merge, VIP, allergens |
| 09 | Reports | 13 | Sales, labor, PMIX, server perf, speed, franchise royalties |
| 10 | Settings | 18 | Org, location, tax, terminals, printers, modules, roles |
| 11 | Online Ordering | 10 | Commission-free ordering, throttling, scheduled orders, QR |
| 12 | Loyalty | 10 | Points/visits/spend, tiers, rewards, cross-location |
| 13 | Reservations | 14 | Reservations, waitlist, SMS reminders, table assignment |
| 14 | Inventory | 14 | Par levels, recipes, vendors, POs, waste, food cost |
| 15 | Scheduling | 10 | Templates, shifts, availability, swaps, labor forecast |
| 16 | Marketing | 10 | Email/SMS campaigns, segmentation, tracking |
| 17 | Delivery | 8 | Zones, drivers, GPS tracking, third-party hooks |
| 18 | Catering | 10 | Events, BEOs, menus, invoicing, deposits |
| 19 | Drive-Thru | 6 | Lanes, speed tracking, confirmation boards, menu boards |
| 20 | Franchise | 6 | Multi-location sync, royalties, consolidated reports |
| 21 | House Accounts | 7 | Corporate billing, credit limits, statements |
| **TOTAL** | | **267** | |

## Design System
- **Light mode only** — professional enterprise SaaS
- **Brand color:** Ember orange (#F06B18)
- **Background:** Warm off-white, not pure white
- **Shadows:** Warm-tinted, not blue-gray
- **Touch targets:** 44px minimum, 48px for primary actions
- **Animations:** Purposeful micro-interactions (see UI_DESIGN.md)
- **See UI_DESIGN.md for full specification**

## Key Integrations
- **Valor PayTech:** Payment processing (MQTT + REST). Card data never touches Sear servers.
- **Supabase Realtime:** KDS, order status, table management live updates
- **Twilio:** SMS (order ready, reservations, waitlist, marketing)
- **SendGrid:** Email (receipts, reports, marketing campaigns)
- **BullMQ:** Background jobs (reports, notifications, reconciliation, stale tab close)

## Hardware Strategy (NO proprietary hardware — competitive advantage)
- iPad (Safari PWA, landscape primary)
- Android tablets (Chrome PWA)
- Any receipt printer (Star Micronics, Epson — ESC/POS)
- Any cash drawer (RJ-11 trigger)
- Valor terminals: VP800, VP550, VP300 Pro, RCKT (Bluetooth)
- Generic barcode scanners
- Generic customer-facing displays
