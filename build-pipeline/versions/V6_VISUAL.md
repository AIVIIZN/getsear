# V6 — Visual & Feel (Beat Toast)

## Theme
By the end of V6, a chef looking at Sear and Toast side-by-side picks Sear in 30 seconds for *feel*. We invoke `/frontend-design` and `/ui-ux-pro-max` properly this time. Every page gets the same skill-output treatment — not a spec doc, real component code with real polish.

## Exit criteria
- ✅ All 21 modules use a unified design system, custom components, no default shadcn-with-color-swap.
- ✅ Every menu item has a real photograph (or AI-generated photo) on the POS grid.
- ✅ iOS spring physics on every transition; 17pt body / 22pt headline / 13pt footnote typography scale used consistently.
- ✅ Frosted-blur modals; light-mode POS + dark-mode KDS both polished.
- ✅ 6 custom illustrations (empty states): no orders, no menu items, no customers, no reservations, no inventory, no reports data.
- ✅ Skeleton loaders on every async load — match the layout shape of the final content.
- ✅ Haptic feedback on iPad for: order item add, payment success, KDS bump, manager-PIN approve.
- ✅ Visual regression baseline locked in Chromatic or Percy.

## Batch 6.0 — Design foundation (sequential, ~6 hours)

### 6.0.1 — Invoke `/ui-ux-pro-max` skill
**How:** Use Skill tool with `ui-ux-pro-max`, providing: audit findings, competitive research path, target device (iPad landscape primary, mobile secondary), brand colors (#007AFF primary).
**Output:** Design tokens v2 file, component spec doc, page layout templates.
**Acceptance:** Skill output saved as artifacts; reviewed for distinctive (not generic) direction.

### 6.0.2 — Invoke `/frontend-design` skill
**How:** Skill tool with `frontend-design`, providing the spec from 6.0.1.
**Output:** Production component code for Button, Card, Modal, Input, Tabs, Sheet, Select, Toast.
**Acceptance:** Real working code, not just spec.

### 6.0.3 — Consolidate into ui-v2
**Files:** `src/components/ui-v2/` (new directory tree), `src/styles/tokens.css` (new), `src/app/globals.css` (updated to import tokens)
**Acceptance:** 8 base components ready; tokens cover color, spacing, typography, shadow, radius, z-index, animation timing.

## Batch 6.1 — Component library (parallel, ~8 hours)

### 6.1.1 — Buttons
**Files:** `src/components/ui-v2/Button.tsx`, `Button.stories.tsx`
**Acceptance:** 4 sizes × 4 variants × default/hover/active/disabled/loading states. iOS-style press animation < 100ms. All combos render in Storybook.

### 6.1.2 — Form inputs
**Files:** `src/components/ui-v2/inputs/{Text,Email,Number,Select,Textarea,Checkbox,Radio,Toggle,Segmented,Slider}.tsx`
**Acceptance:** Each has default/focus/error/disabled states; iOS-style focus ring; label + helper text + error text composition.

### 6.1.3 — Cards/Sheets/Modals/Popovers
**Files:** `src/components/ui-v2/{Sheet,Modal,Popover,Card}.tsx`
**Acceptance:** Frosted backdrop blur 24px; corner radius 16; spring open/close at 60fps on iPad; backdrop tap-to-dismiss; ESC handler.

### 6.1.4 — Data display
**Files:** `src/components/ui-v2/data/{Table,Badge,Pill,Avatar,Stat,Progress,Skeleton}.tsx`
**Acceptance:** Skeleton has 5 variants matching common layouts (text, card, table-row, avatar, chart). Shimmer animation.

### 6.1.5 — Navigation
**Files:** `src/components/ui-v2/navigation/{Sidebar,Topbar,Breadcrumbs,Tabs,SegmentedControl}.tsx`
**Acceptance:** Sidebar light (#F2F2F7) per memory feedback. Topbar 56pt. Safe-area aware on iPad.

### 6.1.6 — Feedback
**Files:** `src/components/ui-v2/feedback/{Toast,Alert,EmptyState,ConfirmDialog}.tsx`
**Acceptance:** Toasts spring in from top-right; auto-dismiss 4s; haptic on success/error.

## Batch 6.2 — Page-by-page rewrite (parallel, ~12 hours, 7 agents)

### 6.2.1 — POS pages
**Files:** `src/app/(pos)/orders/page.tsx`, `tables/page.tsx`, `payments/page.tsx`, `checks/page.tsx`
**Acceptance:** Every screen uses ui-v2 only; matches POS layout template; iPad landscape primary.

### 6.2.2 — KDS
**Files:** `src/app/(fullscreen)/kds/**`
**Acceptance:** Dark theme polished. Tickets have aging color gradient (green → yellow → red). Bump animation springs.

### 6.2.3 — Backoffice core
**Files:** `src/app/(backoffice)/{menu,staff,customers,settings}/**`
**Acceptance:** Each page native-feeling; light sidebar; consistent header.

### 6.2.4 — Backoffice history
**Files:** `src/app/(backoffice)/{orders,payments,audit-log,reports}/**`
**Acceptance:** Tables use ui-v2 Table; filter bars consistent.

### 6.2.5 — Revenue modules
**Files:** `src/app/(backoffice)/{online-ordering,loyalty,reservations,house-accounts}/**`
**Acceptance:** Multi-tab pages adopt ui-v2 Tabs.

### 6.2.6 — Operations modules
**Files:** `src/app/(backoffice)/{inventory,scheduling,marketing,delivery,catering}/**`
**Acceptance:** Forms use ui-v2 inputs; sheets replace modals where appropriate.

### 6.2.7 — Enterprise modules
**Files:** `src/app/(backoffice)/{drive-thru,franchise,reports}/detail/**`
**Acceptance:** Charts restyled with custom palette; lane display feels premium.

## Batch 6.3 — Photography & illustrations (parallel, ~6 hours)

### 6.3.1 — Menu photo pipeline
**Files:** `src/lib/menu/photo-pipeline.ts`, `src/app/api/menu/items/[id]/photo/generate/route.ts`, `scripts/generate-seed-photos.mjs`
**Acceptance:** All 60 seed items have AI-generated photos. Menu builder has "Generate" + "Upload" buttons. Photos served via Next/Image.
**Needs:** OPENAI_API_KEY.

### 6.3.2 — 6 custom illustrations
**Files:** `public/illustrations/{no-orders,no-menu-items,no-customers,no-reservations,no-inventory,no-reports}.svg`, `src/components/ui-v2/feedback/EmptyState.tsx`
**Acceptance:** SVGs in repo (AI-generated then refined OK). EmptyState component takes `illustration` prop. All empty states use them.

## Batch 6.4 — Animation system (parallel, ~4 hours)

### 6.4.1 — Framer Motion integration
**Files:** `src/lib/motion/transitions.ts`, applied across ui-v2 and key pages
**Acceptance:** Page transitions, modal opens, item-add, KDS spawn, payment success — all spring animated. Respects `prefers-reduced-motion`. 60fps on iPad.

## Batch 6.5 — Haptic feedback (parallel, ~2 hours)

### 6.5.1 — Web Vibration + iOS bridge
**Files:** `src/lib/haptics.ts`
**Acceptance:** iPad gives haptic feedback on order add, payment success, KDS bump, manager-PIN approve. Gracefully no-op on desktop.

## Batch 6.6 — Demo + ship (sequential, ~3 hours)

- Side-by-side demo recording (Sear vs Toast trial or screenshots).
- Optional: blind A/B with 10 chef contacts via form.
- Tag `v6.0.0`.
- Lock visual regression baseline.

## Bonus batches

### Bonus Batch 6.7 — Internationalization (parallel, ~5h)

#### 6.7.1 — next-intl setup
**Files:** `src/i18n/`, `next.config.ts`, `src/app/layout.tsx`
**Acceptance:** All UI strings keyed; locale switcher in topbar.

#### 6.7.2 — Spanish translation pass
**Files:** `src/i18n/es.json`
**Acceptance:** Native-quality Spanish on POS + KDS. Restaurant terms reviewed.

#### 6.7.3 — Per-user locale
**Files:** migration `add_users_locale.sql`, middleware
**Acceptance:** Each user sees their preferred language regardless of device.

### Bonus Batch 6.8 — Accessibility audit (parallel, ~4h)

#### 6.8.1 — axe-core CI
**Files:** CI config, ARIA across ui-v2
**Acceptance:** Zero axe violations.

#### 6.8.2 — Keyboard nav audit
**Files:** All pages
**Acceptance:** Tab through every page possible.

#### 6.8.3 — High-contrast mode
**Files:** `src/app/globals.css`, settings UI
**Acceptance:** Owner can enable; persists per user.
