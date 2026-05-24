# Cross-Cutting Design Review — main @ 77aa1e1

**Date:** 2026-05-05
**Scope:** premium-feel audit of the entire UI vs Toast/R Power tier and the V6 design tokens (`src/styles/tokens.css`).
**Verdict:** **CONCERNS — large polish backlog.** No P0 (Rule-18 lying buttons not detected; sidebar still light). But **880 hardcoded hex literals across components**, two competing EmptyState components, generic Tailwind color usage on POS/menu/payments, and ~99 raw `animate-spin` spinners. The new ui-v2 surfaces are premium; the legacy surfaces are still default-Tailwind ugly. V6's "Visual & Feel" theme is half-shipped — tokens exist, adoption is partial.

---

## P0 — none

(No Rule-18 button violations, no dark sidebar regression, no broken-rendering issues found in code review.)

---

## P1 — high-impact polish gaps (premium-feel blockers)

### P1-1. V7.2.3 reviewer's `#7C3AED` flag is **NOT FIXED** — still in production
- **File:** `src/components/reports/ServerComparisonChart.tsx:52`
  - `<Bar yAxisId="right" dataKey="avg_check" name="Avg Check" fill="#7C3AED" radius={[4, 4, 0, 0]} maxBarSize={40} />`
  - Inconsistent — line 51 above it uses `fill="var(--color-primary)"` correctly. Line 52 hardcodes Tailwind violet-600. Looks like a different palette mid-chart.
- **Also:** `src/components/reports/PMIXScatter.tsx:37` — `Puzzle: '#7C3AED'` quadrant color (same orphan violet).
- **Fix:** define `--color-chart-secondary` (or `--color-accent-purple`) in tokens.css, point both to it. Toast/R Power use a curated 5-color chart palette; we should do the same. Reference doc: `docs/COMPETITIVE_RESEARCH.md` §"Chart palettes."

### P1-2. **880 hardcoded hex literals** across `src/components/`
- Counted: `grep -rn '#[0-9a-fA-F]\{3,6\}' src/components/ src/app/ | grep -v tokens.css | wc -l` → **880 hits**.
- Worst offenders by file (interactive code, not decorative):
  - `src/components/kds/KdsAllDay.tsx`, `KdsMessagePanel.tsx`, `KdsRecallDrawer.tsx`, `KdsQuickMessages.tsx` — entire dark-mode KDS surface uses `bg-[#1a1a1a]`, `bg-[#2a2a2a]`, `text-[#888]`, etc. literally. Should consume `--color-kds-bg`, `--color-kds-surface`, `--color-kds-text-muted` from the `.dark` scope already in tokens.css.
  - `src/components/tables/TableShape.tsx:38-110` — every status pill color hardcoded (8+ palette entries).
  - `src/components/tables/SectionColorPicker.tsx:17-24` — eight hex pairs for section colors (this one is borderline ok — they ARE the picker's content, not styling — but should still live in a constants file with named tokens).
  - `src/components/tables/TablePopover.tsx:161,180,190,211` — gradient buttons hardcode `from-[#1a8aff] to-[#0066e6]` four times (should be one CSS class `.btn-primary-gradient` driven by `--color-primary` lighten/darken).
  - `src/components/menu/DaypartConfig.tsx:312,328,572` and `SeasonalManager.tsx:328,471` — `bg-[#007AFF] hover:bg-[#E05A0D]` ⚠️ **the hover color is the wrong brand entirely** (orange `#E05A0D`, not blue). Probably copy-pasted from a previous orange theme. **This will look broken on hover.**
  - `src/components/menu/CategoryPanel.tsx:30-31` and `NavTree.tsx:52-53` — duplicated 8-color palette literal (DRY violation; should be one shared `CATEGORY_PALETTE` constant).
  - `src/components/marketing/CTASection.tsx:20,32` — landing page CTA hardcodes `#007AFF`. Marketing surfaces also break if we ever rebrand.
  - `src/components/ai/InlineChart.tsx:33,37` and `ai/PredictionChart.tsx:96,115,118,126,128` — chart palette hardcodes `#007AFF`, `#34C759`, etc.
- **Fix:** mass-codemod to replace literals with token consumption. Target the gradient buttons + the `#007AFF` literals first (those alone are 100+ instances). Spec: `docs/design/UI_V2_COMPONENT_SPEC.md` already mandates token-only.

### P1-3. **Two competing EmptyState components** — legacy usage drags down 3 surfaces
- Modern: `src/components/ui-v2/feedback/EmptyState.tsx` — token-driven, custom SVG illustrations (240×200 viewBox, 1.2-1.6 KB ✓), focus-visible, hover-active states, primary CTA. Premium.
- Legacy: `src/components/shared/EmptyState.tsx` — Lucide icon in a gray circle, default shadcn `<Button>`, no illustration. **Generic Tailwind ugly.**
- Pages still importing legacy:
  - `src/app/(backoffice)/drive-thru/page.tsx:53`
  - `src/app/(backoffice)/franchise/page.tsx:47`
  - `src/app/(backoffice)/settings/terminals/page.tsx:10`
- **Fix:** delete `shared/EmptyState.tsx`, migrate the 3 pages to `ui-v2/feedback/EmptyState`, pick appropriate `illustration={'no-orders' | 'no-customers' | …}`. Note the `no-customers` illustration could be reused for franchise; `no-orders` for drive-thru; we may need `no-terminals` (add to `EMPTY_STATE_ILLUSTRATIONS`).

### P1-4. Generic Tailwind colors on POS/Menu/Payments — bypassing semantic tokens
- `src/components/pos/OrderPanel.tsx:247,458,633,668` — `bg-green-50`, `bg-blue-50`, `bg-red-100`, `text-amber-700` literal classes for status pills. Should be `bg-[var(--color-success-bg)]`, `bg-[var(--color-warning-bg)]`, etc.
- `src/components/pos/ItemEditPopover.tsx:347-348,415,428` — Allergy / Comp buttons use `bg-red-50/100`, `bg-amber-50/100`. Same fix.
- `src/components/pos/MultiTenderPayment.tsx:65,395-397,432` — Gift card flow hardcodes purple. Doesn't tie to brand.
- `src/components/payments/CardProcessing.tsx:279,285` — `text-blue-600` spinner — disconnected from brand.
- `src/components/payments/GiftCardFlow.tsx:180,243` and `HouseAccountFlow.tsx:256` — `border-purple-200 border-t-purple-600`, `border-amber-200 border-t-amber-600`.
- `src/components/menu/SeasonalManager.tsx:103-104` — `bg-blue-50 text-blue-600 border-blue-200` and `bg-emerald-50 text-emerald-600 border-emerald-200` for upcoming/active tags. Should be `--color-info-bg/fg/border` and `--color-success-bg/fg/border` (info token doesn't exist yet — add it).
- **Fix:** add `--color-info-*`, `--color-purple-*` (gift-card brand variant) tokens; codemod the literals; for status semantic colors use `--color-success/warning/danger-bg/fg/border`.

### P1-5. **99 `animate-spin` spinners — most should be skeletons**
Standing rule: spinner only allowed for blocking modal actions. Survey:
- `src/components/tables/CapacityDashboard.tsx:246`, `WaitlistPanel.tsx:218`, `ServerSectionPanel.tsx:232` — page-level spinners. Should be skeletons matching the final shape.
- `src/components/printing/PrintJobHistory.tsx:324` — table-loading spinner. Should be skeleton rows.
- `src/components/printing/KitchenRoutingConfig.tsx:164` — config-tab spinner. Should be skeleton form.
- Acceptable spinners (blocking modal/inline action): `pos/MultiTenderPayment`, `payments/CardProcessing`, `auth/MFA*`, `settings/WorkstationTerminalsTab` save buttons, `printing/TestPrintButton`, sonner toast loader.
- **Fix:** the 5–8 page-level spinners listed above need skeletons. Skeletons already exist in `src/components/ui/skeleton` (used in `WorkstationTerminalsTab`, `WeeklyGrid`).

### P1-6. PhotosTab empty-state and `<img>` regression
- `src/components/menu/tabs/PhotosTab.tsx:278-282`:
  ```
  {photos.length === 0 && (
    <p className="text-xs text-muted-foreground text-center">
      No photos yet. Upload the first photo above.
    </p>
  )}
  ```
  Generic small muted text — exactly the "default Tailwind ugly" pattern. Should use the ui-v2 EmptyState with a `<ImageIcon>` glyph.
- Line 81-85: existing photos use raw `<img>` tag, not `next/image`. Cycle-2 fix made the **preview** use `next/image unoptimized` (line 232) — but the gallery thumbnails reverted to plain `<img>`. Lighthouse will flag this; performance regresses on busy menu items with 5+ photos.
- Line 89: `bg-[#007AFF]` hardcoded for the Primary star badge — token regression.

### P1-7. Sidebar uses literal `#F2F2F7` and `#3C3C43` — token bypass at the most-visible surface
- `src/components/layout/Sidebar.tsx:107,113,143,155,198,224,225,233,265,274,276,277,281` — entire sidebar bypasses `--color-sidebar`, `--color-text`, `--color-text-muted`. The literal `#F2F2F7` IS the right color, but if Ian ever asks to A/B test (e.g. ever-so-slightly warmer gray), we'd have to grep-and-replace dozens of sites.
- `Topbar.tsx:41,73,87,91,92,95,111,118` — same pattern.
- **Fix:** swap to token consumption. This is purely a maintainability concern (the visual outcome IS correct); but per rule "zero hardcoded hex in component files" it's a P1.

### P1-8. ManagerPinDialog close button — touch target too small
- `src/components/pos/ManagerPinDialog.tsx:143` — `h-8 w-8` close button (32×32). Standing rule: ≥ 44×44 on POS. Manager PIN dialogs are tapped during voids/comps with greasy fingers.
- Similar: `OrderTemplates.tsx:106` (h-8 w-8 close), `ItemEditPopover.tsx:258` (h-8 w-8 close), `ItemEditPopover.tsx:319` (h-7 w-7 modifier-remove × button — **even worse**).
- **Fix:** standardize a `<DialogCloseButton>` primitive at touch-target size.

---

## P2 — polish (post-launch is acceptable)

- **P2-1.** Arbitrary text sizes: 20+ uses of `text-[10px]` and `text-[11px]` (mostly KDS + tables). These should map to `--type-caption-2-size` (11px) and a new `--type-overline-size` (10px) if we keep using 10. Currently undocumented in tokens.
- **P2-2.** `Topbar.tsx:41` uses `text-[15px]` literal — should be `text-[length:var(--type-subhead-size)]`.
- **P2-3.** `src/components/integrations/EmailTemplatePreview.tsx:27-29` — macOS traffic-light dots `#FF605C #FFBD44 #00CA4E` are hardcoded. Decorative, low priority, but should live in a `mac-window-chrome.css` block.
- **P2-4.** `PasswordStrength.tsx:27,63` falls back to literal hex inside a `var(--…, fallback)` — fallback color is fine, but should be the token's primitive (`--green-500`) not a fresh literal `#22C55E`.
- **P2-5.** `LoyaltyTierEditor.tsx:21-24` — Bronze/Silver/Gold/Platinum hex are domain data (medal colors), so OK to be literal — but extract to a `LOYALTY_TIER_COLORS` constants file for clarity.
- **P2-6.** `src/components/menu/ItemCard.tsx:18` — `bg-blue-100 text-blue-700` for "Dairy Free" diet badge. Should be `bg-[var(--color-info-bg)] text-[var(--color-info)]` once the info token lands.
- **P2-7.** `disabled:opacity-50` used in 8 POS files — standing rule says `opacity-40`. Audit and bump.
- **P2-8.** Reports pages use the gradient banner ("Owner Mobile Dashboard" — `reports/page.tsx:79`) — the gradient is `from-[color:var(--color-primary)] to-[color:var(--color-primary-hover)]` ✓ correct. Leave it. (Actually this is one of the few premium-feeling surfaces.)
- **P2-9.** No focus-visible outline on the sidebar `<Link>` rows (`Sidebar.tsx:100-128`) — keyboard nav users see only the browser default. Add `focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-focus)]`.

---

## P3 — nice-to-have

- **P3-1.** `tokens.css` has no `--color-info-*` family. Toast uses cool-blue for info notices distinct from primary brand. Add it.
- **P3-2.** No documented `--color-chart-1` … `--color-chart-5` palette. Reports has 7 chart components — they each pick their own colors. A shared 5-color sequence would unify the look.
- **P3-3.** `src/components/menu/tabs/PhotosTab.tsx` is missing a skeleton state during `isUploading`. Today it just freezes the upload area. A 2-photo skeleton + progress bar would feel premium.
- **P3-4.** No `prefers-reduced-motion` test coverage. `useReducedMotion` is wired in 4 sites; verify each site actually checks the value before triggering Framer animations.
- **P3-5.** Sidebar section headers (`Sidebar.tsx:194-201`) are non-keyboard-collapsible — the chevron rotation hint is gone. Add a chevron icon next to "POS" / "Management" / "Modules" / "Admin" that rotates 90° when the section collapses. Apple iPadOS Settings has this.

---

## Benchmark gap vs Toast / R Power

- Toast's KDS uses **OKLCH-defined dark-mode tokens** (their dark surface lightness is mathematically harmonized — not eight bespoke `#1a1a1a` / `#2a2a2a` / `#333` shades the way our KDS does). Our 200+ literal-hex KDS classes look "designed by committee" rather than "designed by a designer."
- R Power's **chart suite** has a single 6-color qualitative palette they reuse across every report (verified screenshots in `docs/COMPETITIVE_RESEARCH.md`). Our 7 charts each pick their own — mostly blue, with one rogue `#7C3AED`. Looks unfinished.
- Toast's **empty states** are illustrated and brand-specific (a stylized order ticket, a stylized customer card). Our `ui-v2/EmptyState` matches this — the legacy `shared/EmptyState` does not. Three pages (drive-thru, franchise, settings/terminals) are still on the legacy.
- Toast's **buttons** all have a 1-pixel inner highlight on top edge (subtle 3D feel). Our `OrderPanel.tsx:761,774` and `TablePopover.tsx:161-211` actually emulate this with the 2-stop gradient (`from-[#1a8aff] to-[#0066e6]`) — good — but it's hardcoded literally rather than expressed as a `--shadow-button-inner-highlight` token, so it's hard to reuse.

---

## Recommended next ticket

**Spec:** "V6.6 Token Adoption Sweep" — one focused phase to:
1. Codemod `bg-[#007AFF]` and the four-shade gradient → `--color-primary` and `.btn-primary-gradient` utility.
2. Codemod `bg-red-{50,100,500,600}`, `bg-amber-*`, `bg-green-*`, `bg-blue-*`, `bg-emerald-*`, `bg-purple-*` → semantic tokens (`--color-{success,warning,danger,info,purple}-{bg,fg,border}`).
3. Add the missing tokens (`--color-info-*`, `--color-chart-1..5`, `--color-purple-*`) to `tokens.css`.
4. Fix the `hover:bg-[#E05A0D]` orange-on-blue typos in `DaypartConfig.tsx` and `SeasonalManager.tsx`.
5. Migrate 3 pages to `ui-v2/EmptyState` and delete `shared/EmptyState.tsx`.
6. Replace 5–8 page-level spinners with skeletons.
7. Bump the 4 `h-8 w-8` POS dialog close buttons to `h-11 w-11`.

Estimated 1 cycle. After this, hardcoded-hex count drops from 880 → < 50 (the irreducible domain-data colors: section-color picker, loyalty-tier medals, allergen palette).

— end —
