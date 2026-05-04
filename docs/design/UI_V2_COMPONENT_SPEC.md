# Sear POS UI v2 Component Spec

**Source of truth for V6 batch 6.1 agents.** Every ui-v2 component MUST conform to these rules. Tokens live in `src/styles/tokens.css`.

## Universal rules (apply to every component)

1. **Tokens only** — no hardcoded hex, no arbitrary spacing (`p-[17px]` etc.). Use `var(--color-*)`, `var(--space-*)`, `var(--type-*)`, `var(--radius-*)`, `var(--shadow-*)`, `var(--ease-*)`, `var(--duration-*)`.
2. **Touch targets ≥ 44pt** on any tappable surface. Apply `.touch-target` utility OR set `min-height: var(--touch-min)` explicitly.
3. **iOS press feedback** — buttons/cards have `.btn-press` class (subtle scale-down on `:active`).
4. **Focus visible** — every interactive element has a visible focus ring using `outline: 2px solid var(--color-border-focus); outline-offset: 2px;` (or Tailwind `focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]`).
5. **Hover state** — every interactive element has a distinct hover state. Cards/rows: `bg-[var(--color-surface-hover)]`. Buttons: variant-specific (see below).
6. **Disabled state** — `opacity-40 cursor-not-allowed pointer-events-none` (use the disabled-token pattern, not arbitrary opacity).
7. **Animation** — all transitions use one of the three timings: `var(--duration-instant) var(--ease-out)` for press, `var(--duration-quick) var(--ease-out)` for hover/focus, `var(--duration-base) var(--ease-spring)` for spring-y entrances (modals, sheets).
8. **No emojis in source.**
9. **Accept `className` prop** for caller composition; use `cn()` from `src/lib/utils` to merge.
10. **Storybook** — every component ships with `<Component>.stories.tsx` covering all variants × states (the `@storybook/*` packages aren't installed yet; create stories AS IF they were — they'll get rendered when 6.1 wires Storybook in or in V7 reliability batch).

## Component contracts

### Button (`Button.tsx`)
- **Variants:** `primary` (filled blue), `secondary` (outlined), `ghost` (text only), `destructive` (red filled)
- **Sizes:** `sm` (32pt height — back-office only, never POS), `md` (40pt — back-office default), `lg` (44pt — POS default + Apple HIG min), `xl` (52pt — primary CTAs on POS)
- **States:** default, hover, active, focus-visible, disabled, loading (with spinner)
- **Loading:** `disabled + spinner icon + label unchanged`
- **Press animation:** `.btn-press` (scale 0.96 active, 100ms instant)

### Card (`Card.tsx`)
- **Variants:** `flat` (no shadow), `elevated` (shadow-low), `interactive` (shadow-low + hover surface change)
- **Padding:** `compact` (var(--space-4)), `default` (var(--space-6)), `spacious` (var(--space-8))
- **Radius:** `var(--radius-md)` always
- **Border:** 1px var(--color-border) on flat; transparent on elevated

### Modal (`Modal.tsx`)
- **Backdrop:** `.frosted-backdrop` (24px blur + 72% white fill); fades in 280ms ease-out
- **Container:** spring-in from 0.94 scale + 0px Y offset → 1.0 scale, 420ms ease-spring
- **Radius:** `var(--radius-lg)`
- **Shadow:** `var(--shadow-modal)`
- **Sizes:** `sm` (max-w-sm), `md` (max-w-md, default), `lg` (max-w-2xl), `full` (max-w-[90vw])
- **Dismiss:** Escape key, backdrop click, ✕ icon button (top-right). All require focus-trap.
- **Header:** title (var(--type-title-2-size) var(--weight-semibold)) + description (var(--type-body-size) var(--color-text-muted))
- **Footer:** right-aligned button row, secondary then primary

### Input (`Input.tsx` + family in `inputs/` subdirectory)
- **Family:** Text, Email, Number, Select, Textarea, Checkbox, Radio, Toggle, Segmented, Slider
- **Sizes:** `md` (40pt) default, `lg` (44pt) for POS
- **States:** default, focus, error, disabled, read-only
- **Focus ring:** 2px var(--color-border-focus), 2px offset
- **Error:** border becomes var(--color-danger), helper text below in var(--color-danger)
- **Label:** above input, var(--type-subhead-size) var(--weight-medium)
- **Helper text:** below input, var(--type-footnote-size) var(--color-text-muted)
- **Required indicator:** `*` after label in var(--color-danger)

### Tabs (`Tabs.tsx`)
- **Variant 1 (line):** underline animates between active tab, 280ms ease-out
- **Variant 2 (segmented):** iOS-style pill background, active tab gets var(--color-bg) + var(--shadow-low)
- **Sizes:** `md` (40pt) for back-office, `lg` (44pt) for POS

### Sheet (`Sheet.tsx`)
- **Anchor:** right (default), bottom, left
- **Width (right):** `sm` (320), `md` (400, default), `lg` (560)
- **Slide-in:** translateX(100%) → 0, 420ms ease-spring
- **Backdrop:** same as Modal
- **Header:** title + ✕ icon
- **Body:** scrollable; reserve safe-area-inset-bottom on mobile

### Select (`Select.tsx`)
- **Trigger:** Input-style appearance with chevron-down on right
- **Dropdown:** anchored to trigger, var(--shadow-mid), var(--radius-md)
- **Selected option:** primary color check on right
- **Search:** optional, when options.length > 8

### Toast (`Toast.tsx`)
- **Position:** top-right (desktop), top-center (mobile)
- **Variants:** `success` (green), `info` (blue), `warning` (amber), `danger` (red)
- **Spring in:** translateY(-20px) + opacity 0 → 0 + 1, 420ms ease-spring
- **Auto-dismiss:** 4s for success/info, 6s for warning/danger
- **Manual dismiss:** ✕ on hover OR swipe-right on touch
- **Aria:** `role="status"` + `aria-live="polite"` (success/info), `role="alert"` + `aria-live="assertive"` (warning/danger)
- **Stack:** newest on top, max 3 visible, older queue

## File conventions

- One component per file. Filename matches component name (`Button.tsx`).
- Default export the component; named exports for sub-parts (e.g., `Card`, `CardHeader`, `CardBody`, `CardFooter`).
- Co-locate stories in `<Component>.stories.tsx`.
- Compound components use sub-folder: `inputs/Text.tsx`, `inputs/Select.tsx`.
- TypeScript: every prop typed; ref-forwarded with `forwardRef` if it wraps a native element.

## Dark mode (KDS only)

- Wrap KDS root in `<div className="kds-dark">`. All `var(--color-*)` tokens automatically swap.
- Test every component in BOTH modes when building.
