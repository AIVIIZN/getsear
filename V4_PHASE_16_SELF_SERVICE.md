# Sear POS v4 — Phase 16: Self-Service Onboarding & Owner Empowerment

**Build Brief (MASTER_TEMPLATE Part 1)**
**Date:** 2026-03-23
**Priority:** MEDIUM — reduces support cost, increases adoption
**Estimated Sessions:** 2
**Depends On:** Phase 4 (Menu), Phase 5 (Hardware), Phase 6 (Staff), Phase 10 (Tables)

---

## 1.1 What is this?

A self-service onboarding and configuration system that lets a restaurant owner go from signup to taking real orders without calling support. Every competitor requires onboarding calls, installation visits, or extensive hand-holding. The #1 unsolved pain point from competitive research: "Operators want to do it themselves, instantly, without calling support or paying for a service visit."

This phase builds:
1. **Guided setup wizard** — Step-by-step first-time setup (org details, location, tax rates, menu, floor plan, staff, printers, payment terminal)
2. **Interactive tutorials** — Contextual walkthroughs on every major page (first time only)
3. **Demo data seeding** — One-click "Load sample restaurant" for immediate exploration
4. **Self-serve menu import** — Upload existing menu from photo, CSV, or competitor export
5. **Hardware setup wizard** — Step-by-step printer and terminal pairing with troubleshooting
6. **Help center** — Searchable in-app help with video snippets

**Read these files BEFORE planning:**
- `CLAUDE.md` — project config
- `UI_DESIGN.md` — design system
- Phase briefs for Menu (4), Hardware (5), Staff (6), Tables (10)


## 1.2 Tech stack

- **Framework:** Next.js 15, TypeScript, Tailwind CSS v4
- **Tour/Walkthrough:** Custom lightweight implementation (positioned tooltips with backdrop)
- **Video:** Embedded Loom or similar (self-hosted MP4 fallback)
- **Menu from photo:** Claude Vision API (Anthropic) — photograph a paper menu, AI extracts items/prices/categories


## 1.3 User roles

| Role | Access |
|------|--------|
| **Owner** | Full setup wizard, all configuration, help center |
| **Manager** | Can run setup wizard for new location, help center |
| **Server** | Interactive tutorials on POS screens, help center |


## 1.4 Pages and features

### Feature: Setup Wizard (`/setup`)
- **Who:** Owner (triggered on first login after org creation)
- **Steps:**
  1. **Welcome** — "Let's set up your restaurant in 10 minutes" with progress bar (8 steps)
  2. **Restaurant Details** — Name, address, phone, timezone, logo upload, cuisine type
  3. **Location** — Location name (if multi-unit), dining sections (Bar, Dining Room, Patio)
  4. **Tax Rates** — State/local tax rates with auto-lookup by zip code, separate food/alcohol/takeout rates
  5. **Menu** — Three import paths:
     - "Upload a photo of your menu" → Claude Vision extracts items → review/edit → save
     - "Upload a CSV" → parse and preview → save
     - "Build from scratch" → opens menu builder
     - "Load sample menu" → seeds a realistic demo restaurant menu (50 items, 8 categories)
  6. **Floor Plan** — Drag-and-drop table layout OR "Use a template" (choose from: Fine Dining 20-seat, Casual 40-seat, Bar 15-seat, Quick-Service counter)
  7. **Staff** — Add first employees: Name, Role (dropdown), PIN. Minimum: 1 manager. "Add more later" skip option.
  8. **Hardware** — "Do you have printers and payment terminals?" Yes → hardware setup sub-wizard. No → "You can set these up later in Settings."
  9. **Done!** — "Your restaurant is ready. Take your first order." CTA: "Open POS" / "Explore Back-Office"

- **Each step:** Can be skipped (with "Complete later" link). Progress persists — returning to `/setup` resumes where you left off. Steps show green checkmark when complete.
- **Design:** Full-screen modal overlay. Clean, focused. One thing at a time. Large touch targets for iPad.

### Feature: Menu from Photo (AI-Powered)
- **Who:** Owner, GM
- **Where:** Setup wizard step 5, also accessible from Menu Builder toolbar ("Import from Photo")
- **How:**
  1. User takes photo of paper menu or uploads image/PDF
  2. Image sent to Claude Vision API with prompt: "Extract all menu items with names, descriptions, prices, and categories from this restaurant menu image"
  3. Claude returns structured JSON: `[{category, name, description, price}]`
  4. Preview screen shows extracted items in editable table
  5. User reviews, fixes any errors, confirms
  6. Items created in database
- **Fallback:** If extraction quality is low, show warning: "We couldn't read everything clearly. Please review and fix any errors."
- **Limit:** Max 5 pages/photos per import

### Feature: Interactive Tutorials (First-Time Tooltips)
- **Who:** All roles on their first visit to each major page
- **Where:** POS orders page, Menu builder, Tables, KDS, Staff, Reports
- **How:** Positioned tooltip chain that highlights key UI elements one at a time:
  - "Tap a category to see items" → "Tap an item to add to order" → "View your order here" → "Tap Send to Kitchen when ready"
  - Each tooltip: 280px max width, arrow pointing to target element, "Next" / "Skip Tutorial" buttons
  - Tutorial completes → sets flag in localStorage: `tutorial_completed_{page}`
  - "Replay tutorial" button in page header for re-access
- **Design:** Semi-transparent backdrop with spotlight on target element. Tooltip in white with warm shadow.

### Feature: Demo Data Seeding
- **Who:** Owner (during setup or from settings)
- **Where:** Setup wizard ("Load sample menu"), Settings → "Reset Demo Data"
- **What it seeds:**
  - 50 menu items across 8 categories (Appetizers, Salads, Entrees, Seafood, Burgers, Sides, Desserts, Beverages)
  - 12 modifier groups (Temperature, Size, Dressing, Toppings, etc.)
  - 24 tables across 3 sections (Dining Room, Bar, Patio)
  - 8 staff members (2 servers, 1 bartender, 1 host, 2 line cooks, 1 expo, 1 manager)
  - 3 dayparts (Lunch, Happy Hour, Dinner)
  - Sample tax rates (8.875% food, 8.875% alcohol)
  - 5 sample orders in various states (open, sent to kitchen, paid)
  - 1 floor plan with realistic table layout
- **Warning on production data:** If org already has real data, show warning: "This will add demo items alongside your existing data. Demo items will be marked and can be bulk-deleted later."

### Feature: Hardware Setup Sub-Wizard
- **Where:** Setup wizard step 8, also accessible from Settings → Printers
- **Steps:**
  1. "What printers do you have?" — Brand picker (Star Micronics / Epson / Other)
  2. "How is it connected?" — Network (WiFi/Ethernet) / USB / Bluetooth
  3. Auto-discovery: scan local network for Star/Epson printers
  4. Found printer → "Test Print" button → prints test receipt
  5. Assign printer role: Receipt printer / Kitchen printer / Bar printer
  6. Payment terminal: "Valor terminal model?" → VP800 / VP550 / VP300 Pro / RCKT
  7. Terminal pairing instructions (step-by-step with illustrations)
  8. Test transaction (void immediately)
- **Troubleshooting:** Each step has a "Having trouble?" expandable with common solutions

### Page: Help Center (`/help`)
- **Who:** All roles
- **Layout:** Search bar at top, categorized article grid below
- **Categories:** Getting Started, Taking Orders, Kitchen Display, Menu Management, Payments, Staff & Labor, Reports, Hardware, Troubleshooting
- **Articles:** Short, focused (200-400 words), with screenshots and optional video embed
- **Search:** Client-side fuzzy search across article titles and content
- **Contextual:** "Help" button on every page links to the relevant help category
- **Priority articles:** "How to take your first order", "How to process a payment", "How to add a menu item", "What to do when the internet goes down"


## 1.5 Look and feel

- **Setup wizard:** Full-screen, minimal, one step at a time. Progress bar at top. Large illustrations for each step.
- **Tutorials:** Spotlight effect (darken everything except target). White tooltip with warm shadow. Ember orange "Next" button.
- **Help center:** Clean article layout. Left sidebar navigation. Screenshots in device mockups.
- **Animations:** Wizard step transitions slide left-to-right. Tutorial tooltips fade in with subtle spring.


## 1.6 Business rules

- **Setup wizard persistence:** Progress saves after each step. User can leave and return anytime.
- **Demo data is flagged:** All seeded items have `is_demo: true` flag. Can be bulk-deleted from settings.
- **Tutorial only shows once:** Per-page, per-user. Stored in localStorage. "Replay" always available.
- **Menu from photo cost:** Claude Vision API calls tracked in AI usage (Phase 14). Max 5 photos per import to control cost.
- **Time target:** Setup wizard should be completable in under 15 minutes for a simple restaurant. Under 30 minutes with full menu import.


## 1.7 Integrations

- **Claude Vision API:** Menu photo extraction (Anthropic)
- **Supabase:** All data storage
- **Phase 5 Hardware:** Printer discovery and test print


## 1.9 Files to create or modify

### New Files
| File | Purpose |
|------|---------|
| `src/app/(setup)/setup/page.tsx` | Setup wizard main page |
| `src/app/(setup)/setup/layout.tsx` | Setup wizard layout (full-screen, no sidebar) |
| `src/components/setup/SetupWizard.tsx` | Multi-step wizard orchestrator |
| `src/components/setup/StepRestaurantDetails.tsx` | Step 1: Restaurant info |
| `src/components/setup/StepLocation.tsx` | Step 2: Location config |
| `src/components/setup/StepTaxRates.tsx` | Step 3: Tax rates with zip auto-lookup |
| `src/components/setup/StepMenu.tsx` | Step 4: Menu import (photo/CSV/scratch/demo) |
| `src/components/setup/StepFloorPlan.tsx` | Step 5: Floor plan from template or custom |
| `src/components/setup/StepStaff.tsx` | Step 6: Add first employees |
| `src/components/setup/StepHardware.tsx` | Step 7: Printer/terminal setup |
| `src/components/setup/StepComplete.tsx` | Step 8: Done! |
| `src/components/setup/MenuFromPhoto.tsx` | Photo upload + Claude Vision extraction + review |
| `src/components/setup/HardwareSubWizard.tsx` | Printer discovery + test + assignment |
| `src/components/tutorial/TutorialOverlay.tsx` | Spotlight + tooltip chain system |
| `src/components/tutorial/TutorialTooltip.tsx` | Individual positioned tooltip |
| `src/components/tutorial/tutorials.ts` | Tutorial definitions per page (target selectors, text, order) |
| `src/app/(backoffice)/help/page.tsx` | Help center main page |
| `src/app/(backoffice)/help/[category]/page.tsx` | Help category page |
| `src/app/(backoffice)/help/[category]/[article]/page.tsx` | Individual help article |
| `src/app/api/setup/seed-demo/route.ts` | POST: seed demo data for org |
| `src/app/api/setup/menu-from-photo/route.ts` | POST: upload photo → Claude Vision → return extracted items |
| `src/app/api/setup/progress/route.ts` | GET/PUT: setup wizard progress |
| `src/lib/setup/demo-data.ts` | Demo restaurant seed data (50 items, 24 tables, 8 staff, etc.) |
| `src/lib/setup/tax-lookup.ts` | Zip code → tax rate lookup |


## Acceptance Criteria

### Setup Wizard
- [ ] New owner signs up → redirected to `/setup` → sees "Let's set up your restaurant in 10 minutes"
- [ ] Each step can be completed or skipped → progress bar updates → green checkmarks on completed steps
- [ ] Leaving mid-wizard and returning resumes at last incomplete step
- [ ] "Load sample menu" seeds 50 items across 8 categories in under 5 seconds
- [ ] Floor plan template selection creates tables with realistic layout
- [ ] Full wizard completable in under 15 minutes (measured)
- [ ] After completing wizard, POS page shows the menu and tables just configured

### Menu from Photo
- [ ] Upload photo of a menu → Claude Vision extracts items → preview table shows items with names, prices, categories
- [ ] User can edit any extracted field before confirming
- [ ] Confirm → items created in database → appear on POS immediately
- [ ] Poor quality photo → warning message → items still shown but with "Low confidence" indicator on uncertain fields

### Interactive Tutorials
- [ ] First visit to POS orders page → tutorial starts automatically with spotlight on category bar
- [ ] 4-step tutorial completes → "Tutorial complete!" → never auto-shows again
- [ ] "Replay tutorial" button in page header restarts the tutorial
- [ ] Tutorial works correctly at iPad landscape viewport (1194x834)

### Help Center
- [ ] Help center shows categorized articles with search
- [ ] Search finds relevant articles by keyword
- [ ] Every major page has a "Help" button linking to the relevant category
