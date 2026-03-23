# V4 START HERE — Read This First

**You are building Sear POS, a restaurant point-of-sale system competing with Toast and R Power.**

---

## Current State (as of 2026-03-23)

- **280+ API endpoints** across 22 modules
- **37+ UI pages** — core modules at production depth
- **60+ database tables** in Supabase (+ 10 new from Phases 4-5)
- **Core workflow works:** order → kitchen → payment (production depth)
- **Tech stack:** Next.js 15, TypeScript, Tailwind v4, shadcn/ui, Supabase, Zustand
- **Deployed at:** getsear.com (GCP VM, PM2, Nginx)
- **Login:** demo@getsear.com / demo1234

### Phases Complete (deployed to production)
- **Phase 1:** Order Entry — modifier sheets, combos, split checks, multi-tender
- **Phase 2:** Valor Payments — pre-auth, bar tabs, dual pricing, settlement
- **Phase 3:** KDS — expo screen, multi-station, re-fire, allergen alerts, audio
- **Phase 4:** Menu Management — 3-panel builder, @dnd-kit DnD, photo upload, daypart pricing, 9 price levels, seasonal rotation, 86 cascade with Realtime, allergens, CSV import/export
- **Phase 5:** Hardware — ESC/POS driver (Star+Epson), receipt/kitchen printing, cash drawer, barcode scanner, print queue with retry, KDS failover, print relay service

### Next Phase: 6 (Staff & Labor)

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
