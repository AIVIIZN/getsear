# V4 START HERE — Read This First

**You are building Sear POS, a restaurant point-of-sale system competing with Toast and R Power.**

---

## Current State (as of 2026-03-23)

- **300+ API endpoints** across 22 modules
- **46+ UI pages** — core modules at production depth
- **60+ database tables** in Supabase (+ 10 new from Phases 4-5)
- **Core workflow works:** order → kitchen → payment → reports (production depth)
- **Tech stack:** Next.js 15, TypeScript, Tailwind v4, shadcn/ui, Supabase, Zustand
- **Deployed at:** getsear.com (GCP VM, PM2, Nginx)
- **Login:** demo@getsear.com / demo1234

### Phases Complete (deployed to production)
- **Phase 1:** Order Entry — modifier sheets, combos, split checks, multi-tender
- **Phase 2:** Valor Payments — pre-auth, bar tabs, dual pricing, settlement
- **Phase 3:** KDS — expo screen, multi-station, re-fire, allergen alerts, audio
- **Phase 4:** Menu Management — 3-panel builder, @dnd-kit DnD, photo upload, daypart pricing, 9 price levels, seasonal rotation, 86 cascade with Realtime, allergens, CSV import/export
- **Phase 5:** Hardware — ESC/POS driver (Star+Epson), receipt/kitchen printing, cash drawer, barcode scanner, print queue with retry, KDS failover, print relay service
- **Phase 6:** Staff & Labor — 7-tab management hub (roster, time clock, permissions, tips with 4 pool models, cash drawers with denomination counter, DnD schedule with shift marketplace, payroll export ADP/Gusto/Paychex), overtime engine (Federal/CA/CO), break compliance, POS clock-in overlay
- **Phase 7:** Reports — All reports live Supabase queries (no mocks), 6 new reports (cash, speed-of-service, food cost, void/comp, P&L waterfall, 13-week trends), owner mobile dashboard, reports hub, BullMQ daily aggregation + SendGrid email

- **Phase 8:** Integrations — Twilio SMS (order-ready, reservation reminders, waitlist, opt-out), SendGrid email (receipts, daily reports, marketing, CAN-SPAM), QuickBooks Online (OAuth 2.0, daily journal entry sync), webhook system (14 events, HMAC-SHA256, 3x retry), 12 settings pages, integration hub
- **Phase 9:** Offline Mode — Service Worker (Workbox), Dexie.js IndexedDB cache, sync queue engine, store-and-forward Valor card payments, offline orders/cash/clock-in, reconnection manager, conflict resolution, cache warming, 8-hour offline support

- **Phase 10:** Tables & Reservations — Three-tab tables page (Floor Plan/List/Capacity), server section assignments, turn time tracking, reservation seating flow, waitlist with SMS, capacity dashboard, public reservation widget at /reserve/[slug]
- **Phase 11:** All 10 Optional Modules — Inventory (waste, food cost, prep list, auto-86), Loyalty (phone enrollment, tiers, cross-location), Online Ordering (public /order/[slug], QR, throttle), Marketing (campaign builder, segments, real sends), Delivery (GPS, proof of delivery), Catering (BEO/proposal/invoice PDF), Scheduling (weekly grid, labor forecast, marketplace), Drive-Thru (lanes, speed metrics), House Accounts (statements, auto-billing, credit limits), Franchise (menu push, consolidated P&L, royalties)

- **Phase 12:** Security & Performance — Zod validation on all API routes, Redis-backed rate limiting (5 tiers), location-level authorization, MFA/TOTP for owner/admin, password reset flow, 13 database indexes, load test scripts (k6)
- **Phase 13:** Visual QA & Polish — 25 empty state variants, 13 loading skeleton variants, error states, branded 404, design token enforcement (111 color fixes), button press feedback, spring animations, prefers-reduced-motion support, audit script
- **Phase 14:** AI Intelligence — Sear Ask (Claude API + 10 query tools), Sear Insights (daily BullMQ generation, dashboard cards), Sear Predict (13-week demand forecasting), chat UI with inline charts/tables, AI settings page, cost tracking
- **Phase 15:** Website & Pricing — Public marketing landing page, pricing plans ($69/$129/$199), ROI calculator with animated sliders, 14-dimension competitor comparison table (vs Toast/Square/SpotOn/Clover), demo request form with SendGrid
- **Phase 16:** Self-Service Onboarding — 8-step setup wizard, menu from photo (Claude Vision), interactive tutorials with spotlight overlay, demo data seeding (50 items, 24 tables, 8 staff), hardware sub-wizard, searchable help center (32 articles), tax lookup by zip code

### ALL 16 PHASES COMPLETE

## The Problem

Everything is scaffolding. API routes insert rows. Pages render tables. But nothing is production-depth — no edge cases, no real integrations, no hardware, no offline mode. A real restaurant cannot open with this.

## The Plan

**16 phases, ~49 sessions.** Each session has a copy-paste prompt in V4_SESSION_RUNBOOK.md.

## Files to Read (in order)

| File | Purpose | Read When |
|------|---------|-----------|
| `CLAUDE.md` | Project config, tech stack, coding rules | Always |
| `V4_PHASE_OUTLINE.md` | Overview of all 13 phases | Before starting any phase |
| `V4_SESSION_RUNBOOK.md` | All 40 session prompts | To find the next session to run |
| `V4_PHASE_XX_*.md` | Detailed build brief for that phase | When starting that phase |
| `MASTER_TEMPLATE.md` | Build rules (especially Rules 17-21) | When starting any session |
| `SEAR_POS_ARCHITECTURE.md` | Full 17,935-line spec (reference only) | When you need deep detail |
| `INVENTORY.md` | Spec vs reality gap analysis | For context on what's done vs not |
| `POS_UI_RESEARCH.md` | iPad POS design specs | When building any UI |

## How to Run a Session

1. Open fresh Claude Code in /Users/ianrakow/Desktop/getsear
2. Open V4_SESSION_RUNBOOK.md
3. Find the next session (e.g., Session 1.1)
4. Copy the entire prompt block
5. Paste it into Claude Code
6. Let it build
7. Test against the acceptance criteria in the phase brief
8. Commit and deploy:
```bash
git add -A && git commit -m "V4 Phase X.Y — [description]" && git push origin main
ssh -i ~/.ssh/google_compute_engine ianrakow@34.132.111.219 \
  "cd /opt/sear/app && git pull origin main && npm run build && \
   cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/ && \
   pm2 reload sear-pos --update-env"
```

## Phase Order (by priority)

| Phase | Sessions | What | Why First |
|-------|----------|------|-----------|
| 1 | 1.1–1.4 | Order Entry depth | Can't take orders without this |
| 2 | 2.1–2.4 | Valor Payments | Can't charge cards without this |
| 3 | 3.1–3.3 | KDS depth | Kitchen can't cook without this |
| 4 | 4.1–4.3 | Menu Management | Can't build menus without this |
| 5 | 5.1–5.3 | Hardware | Can't print receipts without this |
| 6 | 6.1–6.3 | Staff & Labor | Can't manage employees without this |
| 7 | 7.1–7.3 | Reports | Owner needs to see numbers |
| 8 | 8.1–8.2 | Integrations | SMS, email, QuickBooks |
| 9 | 9.1–9.3 | Offline Mode | Internet goes down during dinner |
| 10 | 10.1–10.2 | Tables & Reservations | Deep table/reservation integration |
| 11 | 11.1–11.5 | Optional Modules | All 10 modules to production depth |
| 12 | 12.1–12.2 | Security | Production hardening |
| 13 | 13.1–13.2 | Polish | Visual QA, accessibility |
| 14 | 14.1–14.4 | AI Intelligence | Beat ToastIQ — holistic AI |
| 15 | 15.1–15.3 | Website & Pricing | Transparent pricing, ROI calculator |
| 16 | 16.1–16.2 | Self-Service Onboarding | Signup to first order, no support needed |

## Critical Rules (from MASTER_TEMPLATE.md)

- **Rule 17:** Depth before breadth. Finish one module 100% before starting the next.
- **Rule 18:** A toast("coming soon") is a bug, not a feature.
- **Rule 19:** Every feature needs a workflow test (end-to-end, not just "does it compile").
- **Rule 20:** Design skills are mandatory. Use /frontend-design and /ui-ux-pro-max.
- **Rule 21:** Read the full module spec before building.

## Design Rules

- **Light mode only** (KDS is dark-only)
- **Background:** #F2F2F7 (Apple system grouped background)
- **Sidebar:** Light (#F2F2F7), Apple iOS Settings style
- **Brand:** Ember orange #F06B18
- **Font:** System font stack (-apple-system, SF Pro)
- **Touch targets:** 48px minimum, 56px for primary actions
- **Reference:** Apple Design Resources Figma kit, iOS 18 HIG
- **Never:** dark sidebars, glassmorphism, gradient backgrounds, icons without labels

## Infrastructure

- **GCP VM:** 34.132.111.219 (SSH key: ~/.ssh/google_compute_engine)
- **App path on VM:** /opt/sear/app
- **Supabase:** lbekiyxqemxozmghgmtp (us-east-1)
- **GitHub:** github.com/AIVIIZN/getsear
- **PM2 process:** sear-pos
