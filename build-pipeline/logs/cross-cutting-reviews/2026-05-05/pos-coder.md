# POS UI Audit — pos-coder review @ commit 77aa1e1

Read-only audit. No source modifications. All file paths absolute.

## Summary

POS surface is broadly in good shape. Rule 18 (lying buttons) is **clean** — no `toast('coming soon')`, no empty `onClick`, no orphan TODOs in `pos/`, `kds/`, `tables/`, `ui-v2/`. EmptyState migration is complete and consistent. V6.4.1 animations are wired correctly in OrderPanel + Modal + PaymentComplete. V6.5.1 haptics are wired at all 5 declared sites with correct iOS-Safari graceful degradation.

The big gaps: a regression that the V7.2.3 reviewer already flagged is **still unfixed** (P1 hex token), three POS components exceed the 500-line budget (P2 file-size), and KDS components use a dark theme via raw hex `bg-[#1a1a1a]`-style classes that bypass tokens entirely (P2 — historical, dark sidebar exemption applies, but not tokenized).

---

## P0 — none

No lying buttons, no orphan handlers, no shipping-blocking issues.

---

## P1

### P1-1. V7.2.3 reviewer flag still unfixed: `#7C3AED` in ServerComparisonChart
- `/Users/ianrakow/Desktop/getsear/src/components/reports/ServerComparisonChart.tsx:52`
  ```tsx
  <Bar yAxisId="right" dataKey="avg_check" name="Avg Check" fill="#7C3AED" radius={[4, 4, 0, 0]} maxBarSize={40} />
  ```
- The same purple is also hardcoded in:
  - `/Users/ianrakow/Desktop/getsear/src/components/menu/CategoryPanel.tsx:31`
  - `/Users/ianrakow/Desktop/getsear/src/components/menu/NavTree.tsx:53`
  - `/Users/ianrakow/Desktop/getsear/src/components/reports/PMIXScatter.tsx:37`
- Should resolve to `var(--chart-purple)` (or a tokens.css addition) — same fix pattern as the prior cycle. Reviewer flagged this in V7.2.3 and it was not addressed.

---

## P2

### P2-1. Three POS components over the 500-line CLAUDE.md budget
- `/Users/ianrakow/Desktop/getsear/src/components/pos/MultiTenderPayment.tsx` — 929 lines
- `/Users/ianrakow/Desktop/getsear/src/components/pos/SplitCheckView.tsx` — 893 lines
- `/Users/ianrakow/Desktop/getsear/src/components/pos/OrderPanel.tsx` — 796 lines

These three are the heaviest components in the entire POS surface and all are central to the order/payment flow. CLAUDE.md says "files <500 lines. Split if larger." Splitting suggestions:
- `MultiTenderPayment` → extract gift-card lookup, change-due display, account-charge sub-flows.
- `SplitCheckView` → extract drag-and-drop check item movement, per-check totals card.
- `OrderPanel` → extract the seat-grouped item list (lines ~513–700) into `OrderPanelItemList.tsx`.

### P2-2. KDS components do not use design tokens — entirely raw hex
KDS is intentionally dark (the one approved exception to the `#F2F2F7` sidebar rule) but every shade is inlined as `bg-[#1a1a1a]`, `bg-[#2a2a2a]`, `text-[#888]`, etc. across 6+ KDS files instead of a `--kds-bg`, `--kds-surface`, `--kds-text-secondary` token group. Examples:
- `/Users/ianrakow/Desktop/getsear/src/components/kds/KdsAllDay.tsx:29` — `bg-[#1a1a1a]`
- `/Users/ianrakow/Desktop/getsear/src/components/kds/KdsAllDay.tsx:30,40,49,59,73,81,86,98,107,114,119`
- `/Users/ianrakow/Desktop/getsear/src/components/kds/KdsQuickMessages.tsx` — 12+ inline hex
- `/Users/ianrakow/Desktop/getsear/src/components/kds/KdsMessagePanel.tsx` — 15+ inline hex
- `/Users/ianrakow/Desktop/getsear/src/components/kds/KdsTicket.tsx:124,128,343,399`
- `/Users/ianrakow/Desktop/getsear/src/components/kds/KdsAllergenBanner.tsx:22` — `bg-[#FF0000]` (raw red, should be `--color-destructive`)
- `/Users/ianrakow/Desktop/getsear/src/components/kds/KdsPriorityBanner.tsx:25,52,62` — `#FF2D55`, `#FF3B30`, `#FFD700` for refire/rush/VIP
- `/Users/ianrakow/Desktop/getsear/src/components/kds/KdsCapacityIndicator.tsx:37–44` — raw `bg-red-900/60`, `bg-yellow-900/60`, `bg-green-900/60` Tailwind palette
- `/Users/ianrakow/Desktop/getsear/src/components/kds/KdsExpoTicket.tsx:44–63` — `bg-blue-600`, `bg-green-600`, `bg-red-700`, etc. for order types and station colors

This is technically code that works, but it violates "Color tokens in `src/styles/tokens.css` … NEVER hardcode hex." The KDS-dark-mode override block in tokens.css (line ~244 region) should define `--kds-bg-primary: #1a1a1a;`, `--kds-bg-elevated: #2a2a2a;`, `--kds-text-secondary: #888;` and KDS files should consume those.

### P2-3. POS sidebar/topbar Tailwind palette classes that should be semantic tokens
Pattern violations in POS:
- `/Users/ianrakow/Desktop/getsear/src/components/pos/ItemEditPopover.tsx:319,321,347,348,415` — `hover:bg-red-50`, `text-red-500`, `bg-red-50 text-red-600` for the allergy/delete affordances.
- `/Users/ianrakow/Desktop/getsear/src/components/pos/OrderPanel.tsx:247` — `bg-green-50 text-green-700` (course-fired).
- `/Users/ianrakow/Desktop/getsear/src/components/pos/OrderPanel.tsx:458,633` — `bg-blue-50 text-blue-700`, `bg-red-100 text-red-600`.
- `/Users/ianrakow/Desktop/getsear/src/components/pos/StaffClockButton.tsx:130,133,197,217` — `text-green-600 bg-green-50`, `text-red-600 bg-red-50`.
- `/Users/ianrakow/Desktop/getsear/src/components/pos/AllergenWarningDialog.tsx:25,26,57,62,110` — heavy `bg-red-50/100/600/700 text-red-700/800/100` cluster.
- `/Users/ianrakow/Desktop/getsear/src/components/pos/VoidReasonDialog.tsx:144` — `hover:bg-red-600` next to a `bg-(--destructive)` (mixed system).

These should resolve to `--success-bg`/`--success-text`/`--destructive-bg`/`--destructive-text` etc. The destructive token already exists; the success/info token surface needs filling out.

### P2-4. Inline shadow + gradient hex in OrderPanel CTA buttons
- `/Users/ianrakow/Desktop/getsear/src/components/pos/OrderPanel.tsx:761` — `from-[#1a8aff] to-[#0066e6] … shadow-[0_2px_8px_rgba(0,122,255,0.3)] hover:shadow-[0_4px_16px_rgba(0,122,255,0.4)]`
- Same component line 774 — green CTA with the same pattern (`#3dd47e`, `#28b862`, `rgba(52,199,89,0.3)`).
- `/Users/ianrakow/Desktop/getsear/src/components/tables/TablePopover.tsx:161,180,190,211` — same `from-[#1a8aff] to-[#0066e6]` gradient repeated 4x.

These primary-CTA gradients are visually correct (premium iPadOS-style depth) but the gradient stops + shadow rgba are hex/numeric, not tokens. Add `--btn-primary-gradient-from/to`, `--btn-primary-shadow-rest/hover` and consume.

### P2-5. PhotoUploader sortable grid still uses raw `<img>`
The cycle-2 V6.3.1 fix migrated the *generated preview* (line 232–240, `next/image` with `unoptimized`) but the **pre-existing sortable grid** still uses raw `<img>`:
- `/Users/ianrakow/Desktop/getsear/src/components/menu/tabs/PhotosTab.tsx:81–85`
  ```tsx
  <img src={photo.url} alt="Menu item photo" className="size-full object-cover" />
  ```
For consistency with the cycle-2 fix, this grid should also use `next/image fill unoptimized`. Same regression-shape exists at:
- `/Users/ianrakow/Desktop/getsear/src/components/menu/MenuBuilder.tsx:881`
- `/Users/ianrakow/Desktop/getsear/src/components/menu/PhotoUploader.tsx:306`

Not P0/P1 because they work and lint doesn't flag them, but it's a stylistic inconsistency the reviewer asked about.

### P2-6. KDS card spawn animation absent (V6.4.1 spec called for it)
`/Users/ianrakow/Desktop/getsear/src/components/kds/KdsTicket.tsx:138` uses CSS `animate-slide-in-left` (defined in `globals.css`) for new-ticket entrance. There is no Framer Motion `AnimatePresence`/`motion.div` in any KDS component, no `kdsCardSpawn` preset in `transitions.ts`. CSS-only animation works but doesn't match the OrderPanel's framer-motion approach, and crucially it does not respect `prefers-reduced-motion` (the CSS keyframe always plays). Add a `@media (prefers-reduced-motion: reduce)` block disabling `kds-bump-out` + `animate-slide-in-left`, or migrate KDS to motion presets.

### P2-7. SectionColorPicker / TableShape — large palette hex map outside tokens.css
- `/Users/ianrakow/Desktop/getsear/src/components/tables/SectionColorPicker.tsx:17–24` — 8 named server-section colors (`#FF6B6B`, `#2EC4B6`, `#B39DDB`, …) as `SECTION_COLOR_MAP`.
- `/Users/ianrakow/Desktop/getsear/src/components/tables/TableShape.tsx:38–110` — 8 status palettes (available/seated/ordering/served/check-dropped/dirty/reserved/blocked) with `bg`, `border`, `text`, `badge` per status, all inline hex.
- `/Users/ianrakow/Desktop/getsear/src/components/pos/MenuGrid.tsx:30–39` — 10-color category palette inline.

These are domain palettes (they need to be configurable + addressable by name) but the hex literals should still come from a `tokens.css` `--color-section-coral` group, mapped through.

---

## P3

### P3-1. Spinner used in places where skeleton would match final shape
CLAUDE.md says "Loading: skeleton matching final shape, never spinner." Spinner sites in POS surface that load a list/table:
- `/Users/ianrakow/Desktop/getsear/src/components/tables/ServerSectionPanel.tsx:232` — `Loader2` instead of section-card skeletons.
- `/Users/ianrakow/Desktop/getsear/src/components/tables/CapacityDashboard.tsx:246` — `Loader2` instead of capacity-tile skeletons.
- `/Users/ianrakow/Desktop/getsear/src/components/tables/WaitlistPanel.tsx:218` — `Loader2` instead of waitlist-row skeletons.
- `/Users/ianrakow/Desktop/getsear/src/components/pos/TableMoveDialog.tsx:89` — table grid loading.
- `/Users/ianrakow/Desktop/getsear/src/components/pos/OrderTransferDialog.tsx:77` — server list loading.
- `/Users/ianrakow/Desktop/getsear/src/components/kds/KdsRecallDrawer.tsx:88` — recent-tickets loading.

The other `Loader2` usages (in-button while submitting, e.g. `WaitlistPanel.tsx:478`, `ReservationSeatingFlow.tsx:163`, `MultiTenderPayment.tsx:277`) are correct — those are action-in-flight indicators, not list loading.

### P3-2. ServerComparisonChart, CategoryPanel, NavTree, PMIXScatter color sets are duplicated
Same 4-color palette (`#7C3AED`, `#D97706`, `#0891B2`, `#EC4899`) appears in 3 files. Centralize as `CHART_PALETTE` constant in `src/lib/charts/palette.ts` (or tokens) so a future palette change is one edit.

### P3-3. Sidebar uses `#F2F2F7` directly rather than a token
- `/Users/ianrakow/Desktop/getsear/src/components/layout/Sidebar.tsx:224,277` — `background: "#F2F2F7"` and `boxShadow: "0 0 0 2px #F2F2F7"`. The value is correct (Apple iPadOS standard), but should resolve to `--sidebar-bg` defined in `tokens.css`. Cosmetic.

### P3-4. `console.warn` in SegmentedControl
- `/Users/ianrakow/Desktop/getsear/src/components/ui-v2/navigation/SegmentedControl.tsx:129` — single `console.warn`. Probably fine for dev-only assertion but worth confirming.

---

## Verified clean (no findings)

- **Rule 18 / lying buttons**: zero `toast('coming soon')`. Zero empty `onClick={() => {}}`. All `disabled` attributes correlate with `isProcessing`/`isLoading` state and have visual disabled styling. Spot-checked OrderTemplates, StaffClockButton, ItemEditPopover, ManagerPinDialog, OrderTransferDialog, ModifierSheet — every CTA does its full job.
- **EmptyState migration**: 32+ pages use `@/components/ui-v2/feedback/EmptyState`. All 6 illustrations exist at `/Users/ianrakow/Desktop/getsear/public/illustrations/{no-orders,no-menu-items,no-customers,no-reservations,no-inventory,no-reports}.svg`. POS surface usage in `MenuGrid.tsx:194`, `OrderQueuePanel.tsx:120`, `CapacityDashboard.tsx:250`, `MemberLookup.tsx:141`. No custom-div empty states detected.
- **V6.4.1 animations**:
  - `OrderPanel` cart items: `AnimatePresence initial={false}` + `motion.div` with `itemSpawn` preset, `reduced` gate at `OrderPanel.tsx:407,581–584` (initial/animate/exit/transition all respect `useReducedMotion`).
  - `Modal` (`ui-v2/Modal.tsx`): scaleIn pattern with reduced-motion gate at line 66, motion.div at 86.
  - `PaymentComplete`: `checkmarkPop` preset at line 7, reduced gate at line 29, transition gates at 82+87.
  - No `layout` prop anywhere on KDS cards — confirmed safe (the cycle-2 removal stuck).
- **V6.5.1 haptics**: All 5 declared sites wired:
  1. `MenuGrid.tsx:108` — `haptics.orderAdd()`
  2. `PaymentComplete.tsx:41` — `haptics.paymentSuccess()`
  3. `KdsPageContent.tsx:402,423,486` — three KDS bump handlers (`haptics.kdsBump()`)
  4. `KdsPageContent.tsx:548` — `handleBumpAll`
  5. `ManagerPinDialog.tsx:75` — `haptics.managerApprove()`
  - `src/lib/haptics.ts` correctly guards `typeof navigator === 'undefined'` and `'vibrate' in navigator` so iOS Safari silently no-ops. Wrapped in try/catch. 37 lines total — clean.
- **V6.3.1 PhotosTab core**: Generate + Upload buttons are both wired (lines 200–217), Generate handler awaits `onGenerate()` and surfaces error in component-local `generateError` state, generated preview uses `next/image fill unoptimized` per cycle-2 fix.
- **Sidebar light theme**: `Sidebar.tsx:224` correctly sets `background: "#F2F2F7"` (Apple iPadOS). Not regressed.
- **Touch targets**: Spot checks across POS dialogs use `h-11`/`h-12`/`h-14`/`touch-target-lg`/`touch-target-xl`. The `h-8 w-8` and `h-9 w-9` cases I inspected (`ManagerPinDialog.tsx:143` close button, `OrderTemplates.tsx:106` close button) are 32×32/36×36 close buttons — under 44pt minimum. Minor — these are peripheral close affordances, not primary CTAs, but worth noting.
- **OrderPanel empty cart**: Renders `ArrowRight` + "Tap a menu item to start" copy at line 515–521. Not the EmptyState component but the visual treatment is intentional (tiny, centered, low-emphasis hint inside a working surface, not a full-page empty state). Acceptable.
- **ModifierSheet**: One usage site (`orders/page.tsx:871`), modifier toggle handler at line 291 of ModifierSheet correctly delegates to `toggleModifier(group.id, mod.id, group.max_selections)`. Sheet shows + applies choices. No issue.
- **No `<PageTransition>` consumers**: `src/components/shared/PageTransition.tsx` is defined but not imported anywhere. Either dead code or pending wire-up. Mention only — not blocking.

---

## Recommendation

Ship as-is for V7.2.x cosmetic polish. Open three follow-up tickets:
1. **P1 — chart hex tokenization** (`#7C3AED` cluster) — same task that V7.2.3 reviewer raised; ~15 min.
2. **P2 — KDS dark-theme tokens** — define `--kds-bg-*` group in `tokens.css`, refactor 6 KDS files; ~2 hr.
3. **P2 — file-size split** for the three 700+ line POS components; ~3 hr.

Word count: ~1,260.
