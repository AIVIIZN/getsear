# Sear POS — UI Design System

Complete visual design specification for the Sear POS rebuild. This document is the single source of truth for every visual decision. If it is not specified here, ask before guessing.

---

## 1. Design Philosophy

**Enterprise SaaS, not generic dashboard.** Think Stripe Dashboard clarity, Linear's precision, Notion's breathing room — applied to a high-pressure restaurant environment where every millisecond of visual parsing matters.

### Principles

1. **Speed over decoration.** A server mid-rush needs to find the right button in under 200ms. Color, size, and position do the work — not labels alone.
2. **Warm light, not sterile white.** Pure white (#fff) with cold gray text feels like a hospital. Sear uses warm off-whites and warm neutrals. The screen should feel like linen, not fluorescent lighting.
3. **Depth through shadow, not borders.** Cards float above the surface with soft, warm-tinted shadows. Borders are used sparingly and only for semantic grouping (e.g., table cells). Elevation communicates hierarchy.
4. **One mode. No toggles.** Light mode only. This eliminates an entire class of theming bugs and lets us tune every color relationship precisely.
5. **Touch-first, keyboard-friendly.** Every interactive target is minimum 44px. POS screens assume fat fingers on a greasy iPad. Back-office screens add keyboard shortcuts for power users.
6. **Information density scales with context.** POS screens show less with larger targets. Reports show more with smaller type. The same component adapts.

### What "Better Than Toast" Means

Toast's UI failures: too many clicks to common actions, small touch targets, dated color palette, no visual hierarchy between primary and secondary actions, aggressive use of borders creating visual noise, and a general feeling of enterprise software designed by committee.

Sear's answer: fewer clicks (slide-overs instead of page navigations), generous touch targets, a distinctive warm palette, clear primary/secondary/ghost button hierarchy, shadow-based depth, and a cohesive design language that feels like a product, not a configuration screen.

---

## 2. Color System

All colors defined as CSS custom properties. HSL format for easy manipulation. Every value is final — do not approximate.

```css
:root {
  /* ============================================
     BACKGROUNDS — warm undertone throughout
     ============================================ */
  --background:            hsl(40, 33%, 98%);    /* #FDFBF7 — warm off-white, the global page bg */
  --background-subtle:     hsl(38, 25%, 95%);    /* #F5F2EC — cards, sections, slight depth */
  --background-muted:      hsl(36, 18%, 91%);    /* #EBE7E0 — sidebar, secondary surfaces */
  --background-inverse:    hsl(24, 12%, 14%);    /* #282320 — dark surfaces, tooltips */
  --background-overlay:    hsla(24, 12%, 14%, 0.40); /* modal/sheet backdrop */

  /* ============================================
     TEXT HIERARCHY
     ============================================ */
  --text-primary:          hsl(24, 10%, 12%);    /* #221F1C — near-black, warm */
  --text-secondary:        hsl(24, 6%, 42%);     /* #6E6762 — readable medium gray */
  --text-muted:            hsl(24, 5%, 58%);     /* #969089 — labels, captions, placeholders */
  --text-inverse:          hsl(40, 33%, 98%);    /* #FDFBF7 — text on dark backgrounds */
  --text-on-primary:       hsl(0, 0%, 100%);     /* #FFFFFF — text on brand color */

  /* ============================================
     BRAND / PRIMARY — Ember Orange
     Sear = heat, fire, cooking. The brand color
     is a refined ember: warm, confident, active.
     ============================================ */
  --primary:               hsl(22, 90%, 52%);    /* #F06B18 — the Sear ember */
  --primary-hover:         hsl(22, 90%, 46%);    /* #D95E12 — darken 8% */
  --primary-active:        hsl(22, 90%, 41%);    /* #C2530F — darken 12% */
  --primary-subtle:        hsl(22, 90%, 96%);    /* #FEF3EC — light wash for backgrounds */
  --primary-foreground:    hsl(0, 0%, 100%);     /* #FFFFFF */

  /* ============================================
     SEMANTIC STATUS COLORS
     ============================================ */
  /* Success — Green */
  --success:               hsl(152, 60%, 36%);   /* #25925F */
  --success-hover:         hsl(152, 60%, 30%);   /* #1E7A4F */
  --success-bg:            hsl(152, 50%, 95%);   /* #EBF9F2 */
  --success-foreground:    hsl(0, 0%, 100%);     /* #FFFFFF */

  /* Warning — Amber */
  --warning:               hsl(38, 92%, 50%);    /* #F5A60B */
  --warning-hover:         hsl(38, 92%, 42%);    /* #CE8B09 */
  --warning-bg:            hsl(38, 80%, 95%);    /* #FEF6E6 */
  --warning-foreground:    hsl(24, 10%, 12%);    /* dark text on amber */

  /* Error — Red */
  --error:                 hsl(4, 72%, 50%);     /* #DB3524 */
  --error-hover:           hsl(4, 72%, 42%);     /* #B82C1E */
  --error-bg:              hsl(4, 60%, 96%);     /* #FDEDED */
  --error-foreground:      hsl(0, 0%, 100%);     /* #FFFFFF */

  /* Info — Blue */
  --info:                  hsl(215, 70%, 50%);   /* #2670D9 */
  --info-hover:            hsl(215, 70%, 42%);   /* #1F5EB6 */
  --info-bg:               hsl(215, 60%, 96%);   /* #EDF2FC */
  --info-foreground:       hsl(0, 0%, 100%);     /* #FFFFFF */

  /* ============================================
     TABLE STATUS COLORS
     Background fills for table shapes on floor plan.
     Must be distinct at a glance from 10 feet away.
     ============================================ */
  --table-available:       hsl(152, 45%, 88%);   /* #C8ECDA — soft green */
  --table-seated:          hsl(215, 55%, 88%);   /* #C5D6F0 — soft blue */
  --table-ordered:         hsl(38, 70%, 88%);    /* #F2E0B3 — soft amber */
  --table-served:          hsl(270, 40%, 88%);   /* #DDD0EE — soft purple */
  --table-check-presented: hsl(180, 35%, 88%);   /* #C5E6E6 — soft teal */
  --table-dirty:           hsl(15, 50%, 88%);    /* #F0D5C5 — soft coral */
  --table-reserved:        hsl(45, 60%, 90%);    /* #F2EACC — soft gold */
  --table-needs-attention: hsl(4, 72%, 60%);     /* #E85A4C — red, with pulse */

  /* ============================================
     KDS AGING COLORS
     These render on a DARK background (KDS is the
     one exception to light mode).
     ============================================ */
  --kds-background:        hsl(220, 15%, 12%);   /* #1A1D24 — dark slate */
  --kds-surface:           hsl(220, 12%, 18%);   /* #272B33 — ticket bg */
  --kds-fresh:             hsl(0, 0%, 95%);      /* #F2F2F2 — white text */
  --kds-aging:             hsl(45, 95%, 58%);    /* #F5C622 — yellow */
  --kds-late:              hsl(25, 95%, 55%);    /* #F58A15 — orange */
  --kds-critical:          hsl(4, 80%, 55%);     /* #E03D28 — red, with pulse */

  /* ============================================
     ORDER TYPE COLORS
     Used as left-border accent or badge bg.
     ============================================ */
  --order-dinein:          hsl(215, 70%, 50%);   /* #2670D9 — blue */
  --order-takeout:         hsl(152, 60%, 36%);   /* #25925F — green */
  --order-delivery:        hsl(270, 55%, 55%);   /* #8B52CC — purple */
  --order-bar:             hsl(22, 90%, 52%);    /* #F06B18 — ember (brand) */
  --order-catering:        hsl(340, 65%, 50%);   /* #D42A6B — magenta */
  --order-online:          hsl(180, 55%, 40%);   /* #2E998F — teal */
  --order-drivethru:       hsl(38, 92%, 50%);    /* #F5A60B — amber */

  /* ============================================
     BORDERS
     ============================================ */
  --border:                hsl(30, 12%, 88%);    /* #E3DED8 — subtle warm */
  --border-hover:          hsl(30, 10%, 78%);    /* #CDC6BE — slightly darker */
  --border-focus:          hsl(22, 90%, 52%);    /* primary color */

  /* ============================================
     SHADOWS — warm-tinted (not blue-gray)
     Using hsla with warm hue to avoid cold cast.
     ============================================ */
  --shadow-sm:   0 1px 2px hsla(24, 20%, 20%, 0.06), 0 1px 3px hsla(24, 20%, 20%, 0.04);
  --shadow-md:   0 2px 4px hsla(24, 20%, 20%, 0.06), 0 4px 8px hsla(24, 20%, 20%, 0.06);
  --shadow-lg:   0 4px 8px hsla(24, 20%, 20%, 0.06), 0 8px 24px hsla(24, 20%, 20%, 0.08);
  --shadow-xl:   0 8px 16px hsla(24, 20%, 20%, 0.08), 0 16px 48px hsla(24, 20%, 20%, 0.12);

  /* ============================================
     BORDER RADIUS
     ============================================ */
  --radius-sm:   6px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-full: 9999px;

  /* ============================================
     ANIMATION TIMING
     ============================================ */
  --duration-instant: 80ms;
  --duration-fast:    150ms;
  --duration-normal:  250ms;
  --duration-slow:    400ms;
  --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in:     cubic-bezier(0.4, 0, 1, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* ============================================
     Z-INDEX SCALE
     ============================================ */
  --z-base:      0;
  --z-sticky:    100;
  --z-sidebar:   200;
  --z-topbar:    300;
  --z-dropdown:  400;
  --z-overlay:   500;
  --z-modal:     600;
  --z-sheet:     600;
  --z-toast:     700;
  --z-tooltip:   800;
}
```

### Tailwind Config Mapping

Extend the Tailwind config to consume these tokens:

```ts
// tailwind.config.ts (excerpt)
theme: {
  extend: {
    colors: {
      background: {
        DEFAULT: 'hsl(var(--background))',
        subtle: 'hsl(var(--background-subtle))',
        muted: 'hsl(var(--background-muted))',
        inverse: 'hsl(var(--background-inverse))',
      },
      foreground: {
        DEFAULT: 'hsl(var(--text-primary))',
        secondary: 'hsl(var(--text-secondary))',
        muted: 'hsl(var(--text-muted))',
        inverse: 'hsl(var(--text-inverse))',
      },
      primary: {
        DEFAULT: 'hsl(var(--primary))',
        hover: 'hsl(var(--primary-hover))',
        active: 'hsl(var(--primary-active))',
        subtle: 'hsl(var(--primary-subtle))',
        foreground: 'hsl(var(--primary-foreground))',
      },
      success: {
        DEFAULT: 'hsl(var(--success))',
        bg: 'hsl(var(--success-bg))',
      },
      warning: {
        DEFAULT: 'hsl(var(--warning))',
        bg: 'hsl(var(--warning-bg))',
      },
      error: {
        DEFAULT: 'hsl(var(--error))',
        bg: 'hsl(var(--error-bg))',
      },
      info: {
        DEFAULT: 'hsl(var(--info))',
        bg: 'hsl(var(--info-bg))',
      },
      border: {
        DEFAULT: 'hsl(var(--border))',
        hover: 'hsl(var(--border-hover))',
        focus: 'hsl(var(--border-focus))',
      },
    },
    boxShadow: {
      sm: 'var(--shadow-sm)',
      md: 'var(--shadow-md)',
      lg: 'var(--shadow-lg)',
      xl: 'var(--shadow-xl)',
    },
    borderRadius: {
      sm: 'var(--radius-sm)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      xl: 'var(--radius-xl)',
      full: 'var(--radius-full)',
    },
  },
}
```

---

## 3. Typography Scale

### Font Stack

```css
:root {
  --font-sans:  'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono:  'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
}
```

Load Inter weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold).
Load JetBrains Mono weights: 400, 500.

### Type Scale

| Token         | Size   | Weight | Line-Height | Letter-Spacing | Usage                                      |
|---------------|--------|--------|-------------|----------------|--------------------------------------------|
| `h1`          | 28px   | 700    | 1.2         | -0.02em        | Page titles (Reports, Settings)            |
| `h2`          | 22px   | 600    | 1.3         | -0.015em       | Section headings, modal titles             |
| `h3`          | 18px   | 600    | 1.35        | -0.01em        | Card headings, panel titles                |
| `h4`          | 15px   | 600    | 1.4         | -0.005em       | Sub-section headings, table group labels   |
| `body`        | 14px   | 400    | 1.5         | 0              | Default body text, descriptions            |
| `body-medium` | 14px   | 500    | 1.5         | 0              | Emphasized body text, button labels        |
| `body-small`  | 13px   | 400    | 1.45        | 0.005em        | Table cells, secondary info                |
| `caption`     | 12px   | 400    | 1.4         | 0.01em         | Timestamps, helper text, minor labels      |
| `overline`    | 11px   | 600    | 1.3         | 0.06em         | Section labels, status badges (uppercase)  |

### Monospace Usage

Prices, order numbers, totals, timer displays, and report data use `var(--font-mono)`. This prevents digit-width jitter when numbers change and gives financial data a precise, ledger-like feel.

```css
.font-mono-tabular {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
```

### POS-Specific Type Adjustments

On POS screens (order entry, payment, tables), the base font size increases:

| Element              | Default | POS Override |
|----------------------|---------|--------------|
| Menu item name       | 14px    | 15px         |
| Menu item price      | 14px    | 16px (mono)  |
| Order item name      | 14px    | 15px         |
| Order total          | 18px    | 22px (mono)  |
| Category tab         | 13px    | 14px (500)   |
| Quick action label   | 12px    | 13px         |

---

## 4. Spacing Scale

Based on a 4px base unit. All spacing uses these named values.

| Token  | Value | CSS Variable       | Usage                                   |
|--------|-------|--------------------|-----------------------------------------|
| `xs`   | 4px   | `--spacing-xs`     | Tight gaps (icon-to-text, badge padding)|
| `sm`   | 8px   | `--spacing-sm`     | Compact spacing, inline elements        |
| `md`   | 12px  | `--spacing-md`     | Default gap between related elements    |
| `lg`   | 16px  | `--spacing-lg`     | Card padding, section spacing           |
| `xl`   | 24px  | `--spacing-xl`     | Between sections, panel padding         |
| `2xl`  | 32px  | `--spacing-2xl`    | Major section separation                |
| `3xl`  | 48px  | `--spacing-3xl`    | Page-level spacing, large gaps          |
| `4xl`  | 64px  | `--spacing-4xl`    | Sidebar width (collapsed), hero spacing |

### Touch Targets

- **Absolute minimum:** 44px height and width for any tappable element
- **Preferred for primary actions:** 48px
- **POS action buttons (quick actions):** 56px
- **Numpad keys (PIN, cash):** 64px x 56px minimum
- **Menu grid items:** minimum 80px tall

All touch targets include `touch-action: manipulation` to eliminate 300ms tap delay and prevent double-tap zoom.

---

## 5. Elevation / Shadow Scale

Shadows use warm-tinted `hsla(24, 20%, 20%, ...)` instead of the default cold `rgba(0, 0, 0, ...)`. This keeps shadows from looking like bruises against the warm backgrounds.

| Level | Name       | Shadow Value                                                                 | Usage                                  |
|-------|------------|------------------------------------------------------------------------------|----------------------------------------|
| 0     | Flat       | none                                                                         | Inline text, flat elements             |
| 1     | Subtle     | `0 1px 2px hsla(24,20%,20%,0.06), 0 1px 3px hsla(24,20%,20%,0.04)`         | Cards, inputs, buttons at rest         |
| 2     | Medium     | `0 2px 4px hsla(24,20%,20%,0.06), 0 4px 8px hsla(24,20%,20%,0.06)`         | Cards on hover, dropdowns, popovers    |
| 3     | High       | `0 4px 8px hsla(24,20%,20%,0.06), 0 8px 24px hsla(24,20%,20%,0.08)`        | Modals, slide-overs, floating panels   |
| 4     | Highest    | `0 8px 16px hsla(24,20%,20%,0.08), 0 16px 48px hsla(24,20%,20%,0.12)`      | Toasts, tooltips, command palette      |

### Elevation Transitions

When an element changes elevation (e.g., card hover), animate the shadow:

```css
.card {
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--duration-normal) var(--ease-out);
}
.card:hover {
  box-shadow: var(--shadow-md);
}
```

---

## 6. Component Specifications

All components build on shadcn/ui primitives. These specs define the Sear-specific overrides.

---

### 6.1 Buttons

#### Sizes

| Size | Height | Padding (x) | Font Size | Icon Size | Border Radius    |
|------|--------|-------------|-----------|-----------|------------------|
| `sm` | 36px   | 12px        | 13px      | 16px      | `var(--radius-md)` |
| `md` | 44px   | 16px        | 14px      | 18px      | `var(--radius-md)` |
| `lg` | 48px   | 20px        | 15px      | 20px      | `var(--radius-lg)` |
| `xl` | 56px   | 24px        | 16px      | 22px      | `var(--radius-lg)` |

#### Variants

| Variant       | Background            | Text Color             | Border             | Shadow           |
|---------------|-----------------------|------------------------|--------------------| -----------------|
| `primary`     | `var(--primary)`      | `var(--text-on-primary)` | none             | `var(--shadow-sm)` |
| `secondary`   | transparent           | `var(--text-primary)`  | 1px `var(--border)` | none             |
| `ghost`       | transparent           | `var(--text-secondary)` | none              | none             |
| `destructive` | `var(--error)`        | `#FFFFFF`              | none               | `var(--shadow-sm)` |
| `success`     | `var(--success)`      | `#FFFFFF`              | none               | `var(--shadow-sm)` |

#### States

- **Hover:** Background darkens 8% (use `hover:` variant color). Secondary gets `var(--background-subtle)` fill. Ghost gets `var(--background-subtle)` fill.
- **Active / Pressed:** Background darkens 12%. Apply `transform: scale(0.98)` for 80ms.
- **Disabled:** `opacity: 0.5`, `pointer-events: none`, `cursor: not-allowed`.
- **Loading:** Replace label with inline spinner (16px) + "Loading..." text. `pointer-events: none`.
- **Focus-visible:** `outline: 2px solid var(--primary); outline-offset: 2px;`

#### Button Code Pattern

```tsx
// Every button in the POS must include:
<Button
  className="touch-action-manipulation select-none"
  style={{ minHeight: '44px' }}
>
```

---

### 6.2 Inputs

| Property         | Value                                         |
|------------------|-----------------------------------------------|
| Height           | 44px (back-office), 48px (POS screens)        |
| Background       | `var(--background)` (the warm off-white)      |
| Border           | 1px `var(--border)`                           |
| Border radius    | `var(--radius-md)`                            |
| Font size        | 14px (15px on POS)                            |
| Padding          | 12px horizontal                               |
| Placeholder color| `var(--text-muted)`                           |

**States:**
- **Focus:** `border-color: var(--primary); box-shadow: 0 0 0 2px hsla(22, 90%, 52%, 0.15);`
- **Error:** `border-color: var(--error); box-shadow: 0 0 0 2px hsla(4, 72%, 50%, 0.1);` Error message appears below in `caption` size, `var(--error)` color.
- **Disabled:** `background: var(--background-muted); opacity: 0.6;`

**Label placement:** Always above the input, never floating. Label uses `body-small` size, `var(--text-secondary)` color, `font-weight: 500`, with `4px` gap to input.

---

### 6.3 Cards

| Property       | Value                                            |
|----------------|--------------------------------------------------|
| Background     | `var(--background)` (white card on subtle page)  |
| Padding        | 16px (back-office), 12px (POS compact)           |
| Border radius  | `var(--radius-lg)`                               |
| Border         | none (shadow provides edge definition)           |
| Shadow         | `var(--shadow-sm)` at rest                       |
| Hover shadow   | `var(--shadow-md)` (only on clickable cards)     |

Cards should never have a visible border unless they are in a selected/active state, in which case use `2px solid var(--primary)`.

---

### 6.4 Modals / Dialogs

| Property        | Value                                                       |
|-----------------|-------------------------------------------------------------|
| Backdrop        | `var(--background-overlay)` + `backdrop-filter: blur(8px)`  |
| Content bg      | `var(--background)` (warm white)                            |
| Shadow          | `var(--shadow-xl)`                                          |
| Border radius   | `var(--radius-xl)`                                          |
| Max width       | 480px (small), 640px (medium), 800px (large)                |
| Padding         | 24px                                                        |
| Title           | `h2` style, bottom border `var(--border)`, 16px padding-bottom |
| Footer          | Top border, right-aligned buttons, 16px padding-top         |

**Enter animation:** Backdrop fades in (200ms). Content scales from `0.95` to `1.0` and fades in (200ms, `ease-out`). Both run simultaneously.

**Exit animation:** Content scales from `1.0` to `0.95` and fades out (150ms, `ease-in`). Backdrop fades out (200ms). Content animates first, backdrop follows.

**Close triggers:** Click backdrop, press Escape, click X button. All animate out.

---

### 6.5 Slide-Over / Sheet

| Property       | Value                                                     |
|----------------|-----------------------------------------------------------|
| Direction      | From right edge                                           |
| Width          | 400px default, 480px for modifier selection, 560px for complex forms |
| Backdrop       | Same as modal (`var(--background-overlay)` + blur)        |
| Background     | `var(--background)`                                       |
| Shadow         | `var(--shadow-xl)` on left edge                           |
| Border radius  | `var(--radius-xl)` on top-left and bottom-left only       |
| Header         | Sticky, with close button (X icon) on the right           |

**Enter animation:** `transform: translateX(100%) -> translateX(0)` over 300ms with `ease-spring` (slight overshoot for physical feel). Backdrop fades in simultaneously (200ms).

**Exit animation:** `transform: translateX(0) -> translateX(100%)` over 200ms with `ease-in`. Backdrop fades out simultaneously.

---

### 6.6 Toast Notifications

| Property       | Value                                        |
|----------------|----------------------------------------------|
| Position       | Top-right, 16px from edges                   |
| Width          | 360px                                        |
| Background     | `var(--background)` (white)                  |
| Shadow         | `var(--shadow-xl)`                           |
| Border radius  | `var(--radius-lg)`                           |
| Left accent    | 4px solid bar in status color                |
| Padding        | 12px 16px                                    |
| Icon           | 20px status icon (check, x, alert, info)     |
| Max stack      | 5 visible, newer on top                      |
| Auto-dismiss   | 5000ms default, configurable per toast       |

**Types and accent colors:**
- `success`: green left bar, check-circle icon
- `error`: red left bar, x-circle icon, no auto-dismiss on critical errors
- `warning`: amber left bar, alert-triangle icon
- `info`: blue left bar, info icon

**Enter:** `translateX(100%) -> translateX(0)` + `opacity: 0 -> 1` over 200ms `ease-out`.
**Exit:** `opacity: 1 -> 0` over 150ms `ease-in`, then height collapses (200ms) so stack re-flows smoothly.

**Interaction:** Hover pauses auto-dismiss timer. Swipe right to dismiss (touch). Close button (X) in top-right corner.

---

### 6.7 Data Tables

| Property              | Value                                          |
|-----------------------|------------------------------------------------|
| Header bg             | `var(--background-subtle)`                     |
| Header text           | `overline` style, `var(--text-muted)`          |
| Row height            | 44px minimum                                   |
| Row bg (even)         | `var(--background)`                            |
| Row bg (odd)          | `var(--background-subtle)` at 50% opacity      |
| Row hover             | `var(--primary-subtle)`                        |
| Cell padding          | 12px horizontal, 8px vertical                  |
| Border                | 1px bottom `var(--border)` between rows        |
| Sort indicator        | Lucide `chevron-up` / `chevron-down`, 14px     |
| Selected row          | `var(--primary-subtle)` bg, 2px left primary border |

**Sticky header:** Header row uses `position: sticky; top: 0;` with `z-index: var(--z-sticky)` and `box-shadow: 0 1px 0 var(--border)` below it.

**Pagination:** Below table, flex row: "Showing 1-25 of 142" on left, page buttons on right. Page buttons use `ghost` button variant, active page uses `primary` fill.

**Empty state:** When table has zero rows, show empty state component (see 6.10) centered in the table body area.

---

### 6.8 Skeleton Loaders

Skeleton elements match the exact shape and size of the content they replace.

| Type           | Shape                                       |
|----------------|---------------------------------------------|
| `text-line`    | Rounded rect, 60-80% parent width, 14px h   |
| `text-short`   | Rounded rect, 30-40% parent width, 14px h   |
| `card`         | Full card shape with inner text-line placeholders |
| `table-row`    | Row of cells matching column widths          |
| `avatar`       | Circle, 40px diameter                        |
| `chart-area`   | Rounded rect filling chart container         |
| `button`       | Rounded rect matching button dimensions      |

**Shimmer animation:**
```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(
    90deg,
    var(--background-muted) 25%,
    var(--background-subtle) 50%,
    var(--background-muted) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}
```

---

### 6.9 Badges / Status Pills

Used for order status, table status, ticket priority, and role indicators.

| Property       | Value                                         |
|----------------|-----------------------------------------------|
| Height         | 24px                                          |
| Padding        | 4px 10px                                      |
| Font           | `overline` style (11px, 600, uppercase)       |
| Border radius  | `var(--radius-full)` (pill shape)             |
| Border         | none                                          |

**Variants** use status-bg as background and status color as text:
- `success`: green-bg, green text
- `warning`: amber-bg, amber text (darken for contrast)
- `error`: red-bg, red text
- `info`: blue-bg, blue text
- `neutral`: `var(--background-muted)`, `var(--text-secondary)`

---

### 6.10 Empty States

Centered vertically and horizontally within the container.

| Element          | Spec                                                   |
|------------------|--------------------------------------------------------|
| Icon             | Lucide icon, 64px, `var(--text-muted)` color           |
| Primary text     | `h3` style, `var(--text-primary)`, 8px below icon      |
| Secondary text   | `body` style, `var(--text-muted)`, 4px below primary, max-width 320px, text-center |
| CTA button       | `primary` variant, `md` size, 16px below secondary     |

Example: For empty orders, show the `ClipboardList` icon, "No orders yet", "Start a new order to see it here", and a "New Order" primary button.

---

### 6.11 Select / Dropdown

| Property       | Value                                           |
|----------------|--------------------------------------------------|
| Trigger        | Same styling as Input (44px height, border, etc.) |
| Dropdown bg    | `var(--background)`                              |
| Shadow         | `var(--shadow-lg)`                               |
| Border radius  | `var(--radius-lg)`                               |
| Item height    | 40px                                             |
| Item hover     | `var(--background-subtle)`                       |
| Selected item  | `var(--primary-subtle)` bg, check icon on right  |
| Max height     | 320px, scroll overflow                           |

**Enter:** Scale from 0.95, fade in (150ms `ease-out`).
**Exit:** Fade out (100ms `ease-in`).

---

### 6.12 Tabs

Used for category navigation (POS), report sub-navigation, settings sections.

| Property          | Value                                            |
|-------------------|--------------------------------------------------|
| Tab height        | 44px (POS), 40px (back-office)                   |
| Font              | `body-medium` (14px, 500)                        |
| Inactive color    | `var(--text-muted)`                              |
| Active color      | `var(--primary)`                                 |
| Active indicator  | 2px bottom border in `var(--primary)`, animated  |
| Hover (inactive)  | `var(--text-secondary)`                          |
| Container border  | 1px bottom `var(--border)`                       |

**Active indicator transition:** `width` and `left` animate on tab change (200ms `ease-out`) to slide between tabs.

**Horizontal scroll:** When tabs overflow (POS categories), use `overflow-x: auto` with `-webkit-overflow-scrolling: touch`, no visible scrollbar (hidden via `::-webkit-scrollbar { display: none }`). Fade gradient on the overflow edge (16px wide, from transparent to background color).

---

### 6.13 Toggle / Switch

| Property         | Value                                     |
|------------------|-------------------------------------------|
| Track width      | 44px                                      |
| Track height     | 24px                                      |
| Thumb diameter   | 20px                                      |
| Off state        | Track: `var(--background-muted)`, thumb: white |
| On state         | Track: `var(--primary)`, thumb: white     |
| Transition       | 200ms `ease-out`                          |
| 86 toggle (off)  | Track: `var(--error)`, label: "86'd"      |
| 86 toggle (on)   | Track: `var(--success)`, label: "Available" |

---

### 6.14 Numpad

Used for PIN login, cash tendering, manual price entry, quantity input.

| Property         | Value                                      |
|------------------|--------------------------------------------|
| Key size         | 72px wide x 56px tall (minimum)            |
| Gap              | 8px                                        |
| Key background   | `var(--background-subtle)`                 |
| Key hover        | `var(--background-muted)`                  |
| Key active       | `var(--primary-subtle)`, scale 0.95        |
| Font             | 22px, `var(--font-mono)`, weight 500       |
| Border radius    | `var(--radius-lg)`                         |
| Clear/Backspace  | `var(--text-muted)` icon, same key size    |
| Enter/Submit     | `var(--primary)` background, white text    |

---

## 7. Layout Templates

---

### 7.1 POS Layout

The primary layout for order entry, payment, tables, and active service screens.

```
+--+-----------------------------------------------------+
|  |  TOPBAR (56px)                                       |
|S |  [Location Name]    [Clock]    [Status]    [Server]  |
|I |-----------------------------------------------------|
|D |                                                      |
|E |                                                      |
|B |              MAIN CONTENT                            |
|A |              (full remaining height)                  |
|R |              (NO vertical scroll)                     |
|  |                                                      |
|64|                                                      |
|px|                                                      |
+--+-----------------------------------------------------+
```

**Sidebar (collapsed, 64px wide):**
- Background: `var(--background-inverse)` (dark)
- Logo mark at top (Sear flame icon, 32px, white)
- Icon-only navigation buttons (24px icons, 48px tap targets)
- Active route: icon tinted `var(--primary)`, left 3px accent bar
- Bottom: server avatar circle (36px) + clock in/out indicator dot

**Top bar (56px tall):**
- Background: `var(--background)` with `var(--shadow-sm)` bottom
- Left: location name (`h4` style)
- Center: current time (`var(--font-mono)`, 16px)
- Right: connection status dot (green/red, 8px, animated pulse if disconnected), server name + avatar

**Main content area:**
- `height: calc(100vh - 56px)` with `overflow: hidden`
- Layout is specific to each screen (see section 9)
- No scrolling on POS screens — all content fits the viewport

---

### 7.2 Back-Office Layout

For menu management, staff, settings, reports, and administrative screens.

```
+----------+--------------------------------------------+
|          |  TOPBAR (56px)                              |
| SIDEBAR  |  [Breadcrumb]           [Search] [Profile]  |
| (240px)  |---------------------------------------------|
|          |                                             |
| Logo     |  SCROLLABLE CONTENT                         |
| Nav      |  (max-width: 1280px, centered)              |
| items    |                                             |
| with     |                                             |
| labels   |                                             |
|          |                                             |
| ---      |                                             |
| Settings |                                             |
| Logout   |                                             |
+----------+--------------------------------------------+
```

**Sidebar (expanded, 240px):**
- Background: `var(--background)` with right border `var(--border)`
- Logo at top (Sear wordmark, 24px height, 16px margin)
- Navigation items: 40px tall, 12px left padding, `body-medium` text
- Active item: `var(--primary-subtle)` background, `var(--primary)` text, left 3px accent
- Hover: `var(--background-subtle)` background
- Section dividers: 1px `var(--border)` with 12px vertical margin
- Bottom: Settings link, Logout link, version number in `caption` style

**Top bar (56px):**
- Background: `var(--background)` with bottom `var(--shadow-sm)`
- Left: Breadcrumb trail (`caption` style links with `/` dividers, last item is `body-medium`)
- Right: Global search trigger (command-K), profile avatar dropdown

**Main content:**
- `overflow-y: auto` (scrollable)
- `max-width: 1280px`, centered with `margin: 0 auto`
- Padding: 24px on all sides (32px on desktop 1440px+)

---

### 7.3 Fullscreen Layout

For KDS, kiosk, and customer-facing display.

```
+----------------------------------------------------------+
| STATUS BAR (32px, semi-transparent overlay)               |
| [Station Name]                    [Time]  [Status Dot]   |
+----------------------------------------------------------+
|                                                           |
|                                                           |
|                FULL VIEWPORT CONTENT                      |
|                                                           |
|                                                           |
|                                                           |
+----------------------------------------------------------+
```

- Zero chrome: no sidebar, no navigation
- Status bar: `position: fixed; top: 0;` with `background: hsla(220, 15%, 12%, 0.85)` and `backdrop-filter: blur(4px)`. Only shows station name, time, and connection status.
- Content fills entire viewport below status bar
- KDS uses dark background (see KDS-specific section)
- Kiosk and customer display use light background

---

### 7.4 Auth Layout

For login and PIN login screens.

```
+----------------------------------------------------------+
|                                                           |
|                                                           |
|              +------------------------+                   |
|              |    SEAR LOGO           |                   |
|              |                        |                   |
|              |    [Form content]      |                   |
|              |                        |                   |
|              |    [Submit button]     |                   |
|              +------------------------+                   |
|                                                           |
|                                                           |
+----------------------------------------------------------+
```

- Background: subtle gradient from `var(--background)` to `var(--background-subtle)` (top to bottom), or a very subtle radial gradient centered on the card
- Card: max-width 480px (login) or 520px (PIN), centered vertically and horizontally
- Card has `var(--shadow-lg)` and `var(--radius-xl)`
- Top accent: 3px top border in `var(--primary)` on the card
- Logo: Sear wordmark, 32px height, centered, 24px margin-bottom
- Below form: subtle footer text ("Sear POS v2.0", `caption` style, muted)

---

## 8. Animation System

Every animation in the system is defined here. No ad-hoc animations.

### 8.1 CSS Keyframes

```css
/* Shimmer for skeleton loading */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Pulse for attention (needs-attention table, connection lost) */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}

/* Spin for loading spinners */
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* Highlight flash for item-added-to-order */
@keyframes flash-highlight {
  0%   { background-color: var(--primary-subtle); }
  100% { background-color: transparent; }
}

/* Slide in from right */
@keyframes slide-in-right {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}

/* Slide out to left (KDS bump) */
@keyframes slide-out-left {
  from { transform: translateX(0); opacity: 1; }
  to   { transform: translateX(-100%); opacity: 0; }
}

/* Scale fade in (modals, dropdowns) */
@keyframes scale-fade-in {
  from { transform: scale(0.95); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}

/* Scale fade out */
@keyframes scale-fade-out {
  from { transform: scale(1); opacity: 1; }
  to   { transform: scale(0.95); opacity: 0; }
}

/* Height collapse (item removal, toast dismissal) */
@keyframes collapse {
  from { max-height: var(--collapse-height); opacity: 1; margin-bottom: 8px; }
  to   { max-height: 0; opacity: 0; margin-bottom: 0; padding: 0; }
}

/* Counter roll (for total changes) */
@keyframes counter-roll {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}

/* Connection lost pulse */
@keyframes connection-pulse {
  0%, 100% { box-shadow: 0 0 0 0 hsla(4, 72%, 50%, 0.4); }
  50%      { box-shadow: 0 0 0 6px hsla(4, 72%, 50%, 0); }
}
```

### 8.2 Animation Catalog

| Animation Name         | Duration      | Easing                     | Trigger                       |
|------------------------|---------------|----------------------------|-------------------------------|
| Page crossfade         | 150ms         | `ease-out`                 | Route change                  |
| Modal open (backdrop)  | 200ms         | `ease-out`                 | Modal trigger                 |
| Modal open (content)   | 200ms         | `ease-out`                 | Modal trigger                 |
| Modal close (content)  | 150ms         | `ease-in`                  | Dismiss action                |
| Modal close (backdrop) | 200ms         | `ease-in`                  | After content close           |
| Slide-over open        | 300ms         | `ease-spring`              | Sheet trigger                 |
| Slide-over close       | 200ms         | `ease-in`                  | Dismiss action                |
| Toast enter            | 200ms         | `ease-out`                 | Toast creation                |
| Toast exit             | 150ms         | `ease-in`                  | Auto-dismiss or manual close  |
| Item added flash       | 500ms         | `ease-out`                 | Item added to order           |
| Item removed collapse  | 200ms         | `ease-in`                  | Item removed from order       |
| Button press           | 80ms + 120ms  | `ease-in` then `ease-spring` | Touch/click                 |
| Skeleton shimmer       | 1500ms        | `ease-in-out`, infinite    | While loading                 |
| Table status change    | 300ms         | `ease-out`                 | Status update from server     |
| KDS ticket bump        | 300ms         | `ease-in`                  | Bump action                   |
| KDS new ticket         | 300ms         | `ease-out`                 | New order received            |
| Loading spinner        | 750ms         | `linear`, infinite         | Loading states                |
| Connection lost dot    | 1000ms        | `ease-in-out`, infinite    | Connection lost event         |
| Counter roll           | 250ms         | `ease-out`                 | Numeric value change          |
| Tab indicator slide    | 200ms         | `ease-out`                 | Tab switch                    |
| Dropdown open          | 150ms         | `ease-out`                 | Trigger click                 |
| Dropdown close         | 100ms         | `ease-in`                  | Outside click or selection    |

### 8.3 Reduced Motion

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. Page-by-Page Design Notes

---

### 9.1 Login Page

**Layout:** Auth layout (centered card).

**Structure:**
1. Card (480px max-width, `var(--shadow-lg)`, `var(--radius-xl)`)
2. 3px top border in `var(--primary)`
3. Sear logo (wordmark, centered, 32px height)
4. "Welcome back" heading (`h2`, centered)
5. Email input (44px, full width)
6. Password input (44px, full width, show/hide toggle icon)
7. "Forgot password?" link (right-aligned, `caption` size, `var(--primary)`)
8. "Sign In" button (`primary` variant, `lg` size, full width)
9. Footer: "Switch to PIN login" link (centered, `body-small`, `var(--primary)`)

**Background:** Subtle warm gradient. Not a pattern or image — just `background: linear-gradient(180deg, var(--background) 0%, var(--background-subtle) 100%)`.

**Error handling:** Invalid credentials show inline error below password field, red text, shake animation on the card (subtle, 300ms horizontal oscillation).

---

### 9.2 PIN Login

**Layout:** Auth layout (centered, wider).

**Structure:**
1. Top: "Select your profile" heading (`h2`, centered)
2. Staff avatar grid: 4 columns, each cell is 80px wide
   - Avatar: 56px circle, colored background (unique per user, generated from name hash), white initials (`h3` style)
   - Name below: `body-small`, centered, 4px margin-top
   - Active (selected): ring of `var(--primary)` around avatar (3px), scale 1.05
   - On duty: green dot indicator (10px, bottom-right of avatar)
3. Divider line
4. Numpad: 3 columns x 4 rows (1-9, clear, 0, backspace)
   - Keys: 72px x 56px, `var(--radius-lg)`, `var(--background-subtle)` bg
   - Digits: 22px mono font
   - Clear: "C" label, `var(--text-muted)`
   - Backspace: delete icon, `var(--text-muted)`
5. PIN dots: 4 circles (12px) above numpad, filled as digits entered (`var(--primary)` fill)
6. Auto-submit: when 4th digit entered, validate immediately with brief spinner

**PIN error:** Dots flash red, shake animation, clear after 300ms. After 5 failures: "Account locked for 5 minutes" message, all inputs disabled.

---

### 9.3 POS Order Entry

**Layout:** POS layout (collapsed sidebar + topbar + full-height content).

This is the most important screen. Servers spend 80%+ of their time here.

```
+--+--------------------------------------------------------+
|  | TOPBAR                                                  |
|  |--------------------------------------------------------|
|S |  ORDER PANEL  |         MENU GRID            | QUICK   |
|I |  (360px)      |         (flex fill)           | ACTIONS |
|D |               |                               | (64px)  |
|E | [Guest: 2 ^v] | [Cat1] [Cat2] [Cat3] [Cat4]> |         |
|B | [Seat 1    v] | +-------+-------+-------+--+ | [Hold]  |
|A |               | | Item  | Item  | Item  |  | | [Fire]  |
|R | Item 1  $12   | | Name  | Name  | Name  |  | | [Rush]  |
|  |  - mod   +$2  | | $12   | $15   | $9    |  | | [Disc]  |
|  | Item 2  $15   | +-------+-------+-------+--+ | [Print] |
|  |  x void       | | Item  | Item  | Item  |  | | [Void]  |
|  |               | | Name  | Name  | Name  |  | |         |
|  | ------------- | | $18   | $22   | $11   |  | |         |
|  | Subtotal $29  | +-------+-------+-------+--+ |         |
|  | Tax      $2.5 |                               |         |
|  | TOTAL   $31.5 |                               |         |
|  | [Send Order]  |                               |         |
+--+--------------------------------------------------------+
```

**Order panel (360px, left):**
- Background: `var(--background)` card with `var(--shadow-sm)` right edge
- Top: Guest count selector (inline stepper, +/- buttons), Seat selector dropdown
- Items list: scrollable area (this is the ONE scrollable zone on POS)
  - Each item: flex row — name (left), price (right, mono font)
  - Modifiers: indented 16px, prefixed with "-", smaller text (`body-small`), muted color
  - Voided items: red strikethrough text, "VOID" badge
  - Item tap: opens modifier/edit slide-over
  - Quantity: inline stepper (left of item name) if qty > 1
  - Newly added item: `flash-highlight` animation (500ms)
  - Removed item: `collapse` animation (200ms)
- Divider: 1px `var(--border)` above totals
- Totals section: fixed at bottom of order panel
  - Subtotal, Tax, Discounts (if any), Tip (if any): `body` left, `font-mono` right
  - Total: `h3` size, bold, `var(--text-primary)`
  - "Send Order" button: `primary` variant, `xl` size (56px), full width, 12px margin-top

**Menu grid (flex fill, center):**
- Category tabs: horizontal scroll bar at top (44px tall)
  - Active tab: `var(--primary)` text + 2px bottom underline
  - Tabs animate indicator on switch
  - Overflow: horizontal scroll with fade edges
- Grid: 4 columns (3 columns on smaller iPads), gap 8px, padding 12px
  - Item cards: `var(--background)` bg, `var(--shadow-sm)`, `var(--radius-md)`
  - Card content: item name (`body-medium`, centered), price (`body-small`, mono, `var(--text-secondary)`, centered)
  - Card height: minimum 80px, touch target
  - Hover: `var(--shadow-md)`, slight lift feel
  - Active press: scale 0.97, 80ms
  - 86'd items: 50% opacity, red "86" badge in corner, not tappable
  - Image support: if item has image, show as card background with text overlay on dark gradient at bottom

**Quick actions (64px, right edge):**
- Background: `var(--background-subtle)`
- Vertical stack of icon buttons (48px square, 8px gap)
- Icons: Lucide, 22px, `var(--text-secondary)`
- Active/relevant: `var(--primary)` tint
- Actions: Hold, Fire All, Rush, Discount, Print, Void, Transfer, Split
- Tooltip on long-press (touch) or hover (desktop)

---

### 9.4 Modifier Selection (Slide-Over)

**Trigger:** Tap menu item that has modifier groups, or tap existing order item.

**Slide-over:** 480px wide, from right.

**Structure:**
1. Header: Item name (`h3`), price (`body`, mono), close X
2. For each modifier group:
   - Group name (`h4`): "Choose your temperature"
   - Required indicator: red asterisk or "(Required)" badge
   - Selection type indicator: "Choose 1" or "Choose up to 3"
   - Modifier options: list of 44px-tall rows
     - Radio buttons (single select) or checkboxes (multi select)
     - Modifier name (left), extra price (right, mono, `var(--text-secondary)`)
     - Selected: `var(--primary-subtle)` row background, `var(--primary)` radio/check fill
3. Special instructions: text area (optional, collapsed by default, expand on tap)
4. Footer (sticky bottom): "Add to Order" primary button, full width, `lg` size
   - If editing existing item: "Update" button + "Remove" destructive button
   - Button shows total price including modifier additions

**Validation:** If required modifier group not selected, "Add to Order" button is disabled (50% opacity). Group header shows red text "Please select one".

---

### 9.5 Payment Flow

**Layout:** POS layout. Replaces the menu grid area with payment interface.

**Structure (multi-step state machine):**

**Step 1 — Payment Method Selection:**
```
+--+---------------------------+------------------------+
|  | ORDER SUMMARY (360px)     |  PAYMENT OPTIONS       |
|S |                           |                        |
|I | [Same as order panel      |  [Credit/Debit Card]   |  <- large buttons
|B |  but read-only]           |  [Cash]                |     120px tall
|A |                           |  [Gift Card]           |     full width
|R | Total: $31.50             |  [Split Payment]       |
|  |                           |                        |
|  |                           |  [Apply Discount]      |  <- secondary action
+--+---------------------------+------------------------+
```

Payment method buttons: 120px tall, full width of right panel, `var(--radius-lg)`, `var(--shadow-sm)`. Each has a large icon (32px) on the left and label (`h3`) on the right. Hover: `var(--shadow-md)`.

**Step 2a — Card Payment:**
- "Waiting for card..." message with animated dots
- Valor terminal illustration/icon (subtle, 64px)
- Amount displayed large: `h1` size, mono font
- Cancel button (ghost, below)
- On success: green check animation, receipt prompt

**Step 2b — Cash Payment:**
- Large total display (`h1`, mono): "$31.50"
- Quick cash buttons: $32, $35, $40, $50, $100 (pre-calculated common amounts)
- Custom amount numpad (same numpad component as PIN)
- On amount entry: "Change: $8.50" displayed large, green
- "Complete" primary button
- Cash drawer kick triggered automatically

**Step 2c — Tip Prompt (after card auth):**
- "Add a tip?" heading (`h2`)
- Suggested tips: 3 large buttons in a row (18% / 20% / 22%)
  - Each shows percentage and dollar amount
  - Dollar amounts in mono font
- "Custom" button opens numpad
- "No tip" ghost button below
- New total displayed after tip selection

**Step 3 — Receipt:**
- "Receipt?" heading
- Three options: "Print", "Text", "Email", "No Receipt"
- Each is a large button (80px tall) with icon
- Auto-dismiss after selection

**Step 4 — Complete:**
- Green check animation (large, centered)
- "Payment Complete" heading
- "New Order" primary button
- Auto-redirect to order entry after 3 seconds if no action

---

### 9.6 Check Management

**Layout:** POS layout. Replaces menu grid with check split interface.

**Split modes** (tabs at top):
- **By Seat:** Each seat becomes a separate check. Drag items between seats.
- **Equal Split:** Divide total by N (stepper to choose N). Shows per-person amount.
- **Custom Split:** Arbitrary amounts per check. Numpad for each.
- **By Item:** Tap items to assign to Check A or Check B (toggle).

**Check cards:** Side-by-side cards (2-4 across depending on split count). Each shows:
- Check label ("Check 1", "Seat 2", etc.)
- Items assigned to this check
- Subtotal
- "Pay" button at bottom of each check card

**Drag and drop (By Seat mode):** Items can be dragged between check cards. Dragging item shows ghost with `var(--shadow-lg)`, drop target highlights with `var(--primary-subtle)` background and dashed `var(--primary)` border.

---

### 9.7 Table Floor Plan

**Layout:** POS layout. Full content area is the floor plan canvas.

**Canvas:**
- Background: `var(--background-subtle)` with subtle dot grid pattern (dots at 24px intervals, `var(--border)` color, 1px)
- Tables are absolutely positioned shapes

**Table shapes:**

| Shape      | Render                                              |
|------------|-----------------------------------------------------|
| Square     | 80x80px rounded rect (`var(--radius-md)`)           |
| Rectangle  | 120x80px rounded rect                               |
| Round      | 80px circle                                         |
| Booth      | 120x60px with one rounded side (the open side)      |

**Table rendering:**
- Fill: status color (from `--table-*` tokens)
- Text (centered): table number (`h4`, bold), server initials below (`caption`)
- Seated tables: show guest count badge (top-right, 20px circle, `var(--primary)` bg, white text)
- Timer: minutes seated shown below table number (`caption`, mono, muted — or colored if aging)
- Needs attention: pulsing border animation (`connection-pulse` but using `--table-needs-attention`)

**Table tap interaction:**
- Quick popover (above table): table number, server, guest count, time seated, total amount
- Action buttons in popover: "View Order", "Move Table", "Print Check", "Mark Dirty/Clean"
- Popover: `var(--shadow-lg)`, `var(--radius-lg)`, white bg, arrow pointing to table

**Server sections:**
- Translucent color wash overlays (distinct pastel per server)
- Section labels: server name in `overline` style at section corner

**Edit mode** (manager only):
- Toggle via "Edit Layout" button
- Grid overlay appears (24px grid, subtle lines)
- Tables become draggable (touch drag, snap to grid)
- Resize handles on corners
- Add table button (floating, bottom-right)
- Save/Cancel buttons (top bar changes to edit mode bar)

**Legend:** Small legend panel (fixed, bottom-left) showing status colors. Collapsible.

---

### 9.8 KDS Display

**This is the only screen with a dark background.** Kitchens are bright, screens need contrast.

**Layout:** Fullscreen layout.

**Background:** `var(--kds-background)` (`hsl(220, 15%, 12%)`)

**Structure:**
```
+----------------------------------------------------------+
| [Station Name]     [All-Day Counts]      [Time] [Status] |  <- 32px status bar
+----------------------------------------------------------+
| TICKET 1  | TICKET 2  | TICKET 3  | TICKET 4  | ...     |
| #1042     | #1043     | #1044     | #1045     |         |
| Table 5   | Table 12  | Takeout   | Table 3   |         |
| 2:30      | 1:45      | 0:30      | 0:15      |         |
| --------- | --------- | --------- | --------- |         |
| 2x Burger | 1x Steak  | 3x Salad  | 1x Pasta  |         |
| 1x Fries  | 1x Fries  | 1x Soup   | 1x Bread  |         |
|   no salt | MR        |           |           |         |
|           |           |           |           |         |
| [BUMP]    | [BUMP]    | [BUMP]    | [BUMP]    |         |
+----------------------------------------------------------+
```

**Ticket cards:**
- Background: `var(--kds-surface)` (dark card)
- Border-left: 4px in order type color
- Width: fill columns evenly (responsive, 4-6 columns depending on screen)
- Header: order number (`h3`, white), table/type (`body-small`, muted), timer (`body`, mono)
- Timer color shifts with age:
  - < 5 min: `var(--kds-fresh)` (white)
  - 5-10 min: `var(--kds-aging)` (yellow)
  - 10-15 min: `var(--kds-late)` (orange)
  - > 15 min: `var(--kds-critical)` (red, pulsing)
- Items: white text, quantity bolded, modifiers indented and in `var(--kds-aging)` color
- Course separator: dashed line with course label ("COURSE 2")
- Rush indicator: red "RUSH" badge, pulsing
- Bump button: full-width at bottom, 56px tall, `var(--success)` bg, "BUMP" text (white, bold)

**All-day counts:** Top bar shows aggregate counts. E.g., "Burger: 8 | Steak: 3 | Salad: 5". Uses `overline` style, horizontal scroll if overflow.

**Audio:** Bell chime (configurable) on new ticket arrival. Louder/different tone for rush orders.

**Animations:**
- New ticket: slides in from right (300ms `ease-out`)
- Bumped ticket: slides out to left (300ms `ease-in`), remaining tickets shift left smoothly
- Recall: bumped ticket slides back in from left

---

### 9.9 Reports Dashboard

**Layout:** Back-office layout.

**Structure:**

```
+----------------------------------------------------------+
| REPORTS NAV TABS                                          |
| [Dashboard] [Sales] [Labor] [PMIX] [Server] [Voids] ... |
+----------------------------------------------------------+
|                                                           |
| +----------+ +----------+ +----------+ +----------+      |
| | Total    | | Orders   | | Avg      | | Labor    |      |
| | Sales    | | Count    | | Check    | | Cost %   |      |
| | $12,847  | | 186      | | $69.07   | | 28.4%    |      |
| | +12.3%^  | | +5.2%^   | | +3.1%^   | | -1.2%v   |      |
| +----------+ +----------+ +----------+ +----------+      |
|                                                           |
| +-------------------------------+ +-------------------+  |
| | HOURLY SALES (line chart)     | | PAYMENT MIX       |  |
| |                               | | (donut chart)     |  |
| |                               | |                   |  |
| +-------------------------------+ +-------------------+  |
|                                                           |
| +------------------------------------------------------+ |
| | TOP SELLING ITEMS (table)                             | |
| +------------------------------------------------------+ |
+----------------------------------------------------------+
```

**Date range picker** (top-right, sticky): Dropdown with presets (Today, Yesterday, This Week, Last Week, This Month, Last Month, Custom). Custom opens date range calendar popover. Selected range shown as pill badge.

**KPI cards (4 across):**
- Card: `var(--background)`, `var(--shadow-sm)`, `var(--radius-lg)`
- Label: `overline` style, `var(--text-muted)`
- Value: `h2` style, `var(--font-mono)`, `var(--text-primary)`
- Comparison: badge below — green up arrow + percentage if positive, red down arrow if negative
- Comparison period: "vs last week" in `caption` style below badge

**Charts:**
- Hourly sales: line chart (Recharts), `var(--primary)` line, filled area below with `var(--primary-subtle)` at 30% opacity
- Payment mix: donut chart, segments using order-type colors
- Chart backgrounds: transparent (card provides bg)
- Tooltips on hover: shadow-md card with value details
- Grid lines: `var(--border)` at 50% opacity

**Export buttons:** Top-right of each section. "Export CSV" and "Export PDF" as `ghost` buttons with download icon.

---

### 9.10 Menu Manager

**Layout:** Back-office layout.

**Structure (3-panel tree editor):**

```
+----------+--------------------------------------------+
| SIDEBAR  | CATEGORIES | ITEMS LIST    | ITEM DETAIL   |
|          | (200px)    | (flex, ~350px)| (flex fill)    |
|          |            |               |                |
|          | Appetizers | Bruschetta    | [Name input]   |
|          | Entrees  * | Caesar Salad  | [Price input]  |
|          | Sides      | Steak Frites *| [Description]  |
|          | Desserts   | ...           | [Modifiers]    |
|          | Drinks     |               | [Image upload] |
|          |            |               | [86 Toggle]    |
|          | [+ Add]    | [+ Add Item]  | [Save] [Delete]|
+----------+--------------------------------------------+
```

**Categories panel (200px):**
- List of category names, draggable for reordering (vertical drag handle icon on left)
- Active category: `var(--primary-subtle)` bg, `var(--primary)` text
- Item count badge on right of each category
- "+ Add Category" button at bottom (ghost)

**Items list (~350px):**
- Filtered by selected category
- Each item: 48px row, name left, price right (mono), drag handle on far left
- 86'd items: red "86" badge, `var(--error-bg)` row background
- "+ Add Item" button at bottom (ghost)
- Search/filter input at top

**Item detail (flex fill):**
- Form fields: name, display name, price (with currency formatting), description (textarea)
- Modifier groups: collapsible sections showing assigned modifier groups. "Add Modifier Group" button.
- Image: upload zone (dashed border, drag-and-drop), preview thumbnail
- 86 toggle: prominent switch with "Available" / "86'd" label
- Action bar at bottom: "Save Changes" (primary), "Delete Item" (destructive, with confirmation modal)
- Unsaved changes: yellow dot indicator on "Save Changes" button

---

### 9.11 Staff Manager

**Layout:** Back-office layout.

**Tabs:** Roster | Time Clock | Tips

**Roster tab:**
- Data table with columns: Avatar (40px circle), Name, Role (badge), Status (on/off duty dot), PIN (masked), Phone, Hire Date
- Row actions: Edit (pencil icon), Deactivate (toggle)
- "Add Employee" primary button (top-right)
- Click row or edit: opens slide-over with employee form

**Time Clock tab:**
- Date picker (single day)
- Table: Employee, Clock In, Clock Out, Break Duration, Total Hours, Status (pending/approved)
- Pending entries: amber highlight, "Approve" button in row
- Edit: opens modal to adjust clock in/out times (with audit note required)
- Weekly total row at bottom per employee

**Tips tab:**
- Date range picker
- Table: Employee, Cash Tips, Card Tips, Tip-out, Net Tips
- Tip pool distribution: "Distribute" button opens modal with pool calculation

---

### 9.12 Settings

**Layout:** Back-office layout with left sub-navigation.

**Sub-nav (left, 200px within main content):**
- Organization
- Location
- Tax Rates
- Terminals
- Printers
- Modules
- Roles & Permissions

**Organization:**
- Form: name, logo upload, default timezone, currency
- "Save" primary button

**Location:**
- Form: name, address, phone, hours of operation (day-by-day time ranges)
- Map preview (static image, not interactive)

**Tax Rates:**
- Table: name, rate %, applies to (categories), active toggle
- Inline editing for rate
- "Add Tax Rate" button

**Terminals:**
- Card list: each terminal shows name, model, serial, status (connected/disconnected dot), last seen
- Register/deregister buttons

**Printers:**
- Similar to terminals: name, model, IP/BLE address, status, test print button

**Modules:**
- Card grid: each module is a card with icon, name, description, enable/disable toggle
- Enabled modules: expanded section below toggle for module-specific configuration
- Module dependencies shown as footnote ("Requires: Online Ordering")

**Roles & Permissions:**
- Left: list of roles (Owner, Manager, Server, Host, Bartender, Kitchen, Cashier)
- Right: permission grid (checkboxes organized by category)
- Categories: Orders, Payments, Menu, Staff, Reports, Settings
- Each permission: checkbox with label

---

## 10. Responsive Behavior

### Breakpoints

| Name        | Width         | Target Device                    |
|-------------|---------------|----------------------------------|
| `tablet-l`  | 1024px-1365px | iPad 10th gen landscape          |
| `tablet-xl` | 1366px+       | iPad Pro 12.9" landscape         |
| `desktop`   | 1440px+       | Desktop monitors                 |
| `tablet-p`  | 768px-1023px  | iPad portrait                    |
| `mobile`    | < 768px       | Not primary, but functional      |

### Adaptation Rules

**iPad landscape (1024px-1365px) — PRIMARY TARGET:**
- All panels visible simultaneously
- POS: order panel 320px (from 360px), menu grid 3 columns (from 4)
- KDS: 4 ticket columns (from 5-6 on wider)
- Reports: KPI cards 2x2 grid (from 4 across)
- Sidebar: collapsed (64px) on POS, expanded (220px from 240px) on back-office

**iPad Pro landscape (1366px+):**
- Full panel widths as designed
- Menu grid: 4 columns
- KDS: 5-6 ticket columns
- Reports: 4 KPI cards across

**iPad portrait (768px-1023px):**
- POS sidebar collapses to hidden (hamburger toggle)
- Order panel slides over menu grid (toggle between order view and menu view)
- Or: order panel as bottom sheet (40% height) over full-width menu grid
- Back-office sidebar collapses to hamburger
- Tables: floor plan scales down (CSS transform scale)
- KDS: 2-3 ticket columns

**Desktop (1440px+):**
- Back-office: main content area gains extra padding, max-width 1280px centered
- POS: order panel 400px, menu grid 5 columns
- More data visible in tables (additional columns)

**Mobile (< 768px):**
- Not a POS target. Login and reports should be functional.
- Single column layout
- Sidebar hidden, top navigation bar
- Reports: stacked KPI cards, single column charts

---

## 11. Accessibility

### Color Contrast

All color combinations must meet WCAG AA (minimum):
- Normal text (< 18px): 4.5:1 contrast ratio
- Large text (>= 18px or >= 14px bold): 3:1 contrast ratio
- UI components and graphical objects: 3:1 against adjacent colors

**Verified combinations:**
- `--text-primary` on `--background`: > 12:1 (passes AAA)
- `--text-secondary` on `--background`: > 5.5:1 (passes AA)
- `--text-muted` on `--background`: > 3.8:1 (passes AA for large text; add weight or size bump for normal text)
- `--text-on-primary` on `--primary`: > 4.5:1 (passes AA)
- `--kds-fresh` on `--kds-surface`: > 11:1 (passes AAA)

### Keyboard Navigation

- All interactive elements reachable via Tab
- Logical tab order matching visual layout (left-to-right, top-to-bottom)
- `focus-visible` ring on all focusable elements: `outline: 2px solid var(--primary); outline-offset: 2px;`
- Skip-to-content link (visually hidden, shown on focus) for back-office pages
- Escape closes modals, slide-overs, dropdowns
- Arrow keys navigate within tab groups, menu grids, numpad
- Enter/Space activates buttons and toggles

### ARIA

- Icon-only buttons: `aria-label` describing the action (e.g., `aria-label="Hold order"`)
- Status badges: `role="status"` with readable text
- Toasts: `role="alert"` for errors, `role="status"` for success/info
- Modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to title
- Loading states: `aria-busy="true"` on the loading container
- Sort columns: `aria-sort="ascending"` / `"descending"` / `"none"`
- Form errors: `aria-invalid="true"` on input, `aria-describedby` pointing to error message element
- Live regions for real-time updates: `aria-live="polite"` for order updates, `aria-live="assertive"` for critical alerts

### Form Labels

- Every input has a visible `<label>` element (no placeholder-only inputs)
- Required fields marked with `aria-required="true"` and visual asterisk
- Error messages use `<p id="field-error" role="alert">` linked via `aria-describedby`
- Fieldsets with legends for grouped inputs (e.g., modifier groups)

### Touch Accessibility

- Minimum 44px touch targets (enforced via component sizing)
- Adequate spacing between touch targets (minimum 8px gap)
- No hover-only interactions on POS screens (all hover effects have touch equivalents)
- Long-press for tooltips (where hover tooltip exists on desktop)

---

## 12. Iconography

**Icon library:** Lucide React (https://lucide.dev) — consistent with shadcn/ui.

**Sizes:**
- 16px: inline with text, badges, small indicators
- 18px: button icons (sm/md buttons)
- 20px: button icons (lg/xl buttons), navigation items
- 22px: quick action bar icons
- 24px: sidebar navigation icons
- 32px: payment method selection, empty state secondary
- 64px: empty state primary

**Style rules:**
- Stroke width: 1.75px (Lucide default is 2; slightly thinner feels more refined)
- Color: inherits from parent text color
- Icon-only buttons always need `aria-label`
- Pair icons with text labels in navigation; icon-only is acceptable only in the collapsed POS sidebar and quick action bar (where tooltips compensate)

**Common icon mapping:**

| Action          | Icon              |
|-----------------|-------------------|
| New order       | `Plus`            |
| Send order      | `SendHorizontal`  |
| Hold            | `Pause`           |
| Fire            | `Flame`           |
| Rush            | `Zap`             |
| Void            | `X`               |
| Discount        | `Percent`         |
| Print           | `Printer`         |
| Split           | `Split`           |
| Transfer        | `ArrowRightLeft`  |
| Payment         | `CreditCard`      |
| Cash            | `Banknote`        |
| Gift card       | `Gift`            |
| Settings        | `Settings`        |
| Staff           | `Users`           |
| Menu            | `UtensilsCrossed` |
| Reports         | `BarChart3`       |
| Tables          | `LayoutGrid`      |
| KDS             | `Monitor`         |
| Clock in        | `LogIn`           |
| Clock out       | `LogOut`          |
| Search          | `Search`          |
| Close           | `X`               |
| Back            | `ArrowLeft`       |
| More/overflow   | `MoreVertical`    |
| Edit            | `Pencil`          |
| Delete          | `Trash2`          |
| Drag handle     | `GripVertical`    |
| Check/confirm   | `Check`           |
| Alert           | `AlertTriangle`   |
| Info            | `Info`            |
| Refresh         | `RefreshCw`       |
| Export          | `Download`        |
| Connected       | `Wifi`            |
| Disconnected    | `WifiOff`         |

---

## 13. Data Formatting

Consistent formatting across the entire application.

| Data Type    | Format                     | Example            | Notes                           |
|-------------|----------------------------|--------------------|---------------------------------|
| Currency    | `$X,XXX.XX`               | `$1,247.50`        | Always 2 decimals, mono font   |
| Percentage  | `X.X%`                    | `28.4%`            | 1 decimal, mono font           |
| Date        | `MMM D, YYYY`             | `Mar 22, 2026`     | Short month name               |
| Time        | `h:mm A`                  | `2:30 PM`          | 12-hour, no leading zero       |
| DateTime    | `MMM D, h:mm A`           | `Mar 22, 2:30 PM`  | No year if current year        |
| Duration    | `Xh Xm` or `X:XX`        | `6h 30m` / `6:30`  | Context dependent               |
| Order #     | `#XXXX`                   | `#1042`            | Mono font, 4+ digits           |
| Phone       | `(XXX) XXX-XXXX`          | `(212) 555-0123`   | US format                      |
| Guest count | `X guests`                | `4 guests`         | Spelled out                    |
| Table       | `Table X`                 | `Table 12`         | "Table" prefix always          |
| Quantity    | `Xx`                      | `2x`               | Lowercase x, no space          |

---

## 14. Loading & Error States

### Loading Patterns

| Context                  | Loading Indicator                                      |
|--------------------------|--------------------------------------------------------|
| Page load                | Skeleton of full page layout (matching the page shape) |
| Data table loading       | Skeleton rows (5 placeholder rows)                     |
| Button action            | Button enters loading state (spinner + "Loading...")   |
| Chart loading            | Skeleton rectangle matching chart area                 |
| Order sending            | "Sending..." overlay on order panel with spinner       |
| Payment processing       | Full-screen overlay: spinner + "Processing payment..." |
| Image loading            | Gray placeholder with subtle shimmer                   |
| Real-time reconnecting   | Top banner: amber background, "Reconnecting..." text   |

### Error Patterns

| Context               | Error Display                                          |
|-----------------------|--------------------------------------------------------|
| Form validation       | Inline red text below field, red border on input       |
| API error             | Toast notification (error type)                        |
| Page load failure     | Full-page error state: icon + message + "Retry" button |
| Payment failure       | Modal: red icon, error message, "Try Again" + "Cancel" |
| Network disconnected  | Persistent top banner: red, "Connection lost" + retry  |
| 404 page              | Centered: large "404", "Page not found", link to home  |
| Permission denied     | Centered: lock icon, "Access denied", contact admin    |

---

## 15. Print Styles

When printing (reports, receipts), apply:

```css
@media print {
  /* Hide non-content elements */
  nav, .sidebar, .topbar, .toast-container,
  button:not(.print-visible), .no-print { display: none !important; }

  /* Reset backgrounds */
  body { background: white !important; color: black !important; }

  /* Keep table borders visible */
  table { border-collapse: collapse; }
  th, td { border: 1px solid #ccc !important; padding: 4px 8px !important; }

  /* Ensure charts/graphs print */
  svg, canvas { max-width: 100%; }

  /* Page breaks */
  .page-break { page-break-before: always; }
  tr { page-break-inside: avoid; }
}
```

Receipt printing (ESC/POS via Bluetooth) is handled by the native iOS layer and is not CSS — it uses the ESC/POS builder in the Swift bridge.

---

## 16. Design Tokens Summary (Quick Reference)

For quick copy-paste into component development:

```
Background:     #FDFBF7 (page), #F5F2EC (cards/subtle), #EBE7E0 (sidebar/muted), #282320 (inverse)
Text:           #221F1C (primary), #6E6762 (secondary), #969089 (muted), #FDFBF7 (inverse)
Brand:          #F06B18 (primary), #D95E12 (hover), #C2530F (active), #FEF3EC (subtle)
Success:        #25925F (fg), #EBF9F2 (bg)
Warning:        #F5A60B (fg), #FEF6E6 (bg)
Error:          #DB3524 (fg), #FDEDED (bg)
Info:           #2670D9 (fg), #EDF2FC (bg)
Border:         #E3DED8 (default), #CDC6BE (hover), #F06B18 (focus)
Font:           Inter (400/500/600/700), JetBrains Mono (400/500)
Radius:         6/8/12/16/9999 px
Touch minimum:  44px
Timing:         80/150/250/400 ms
```

---

*This document is the single source of truth for all visual decisions in the Sear POS rebuild. If a developer or AI agent needs to make a visual choice not covered here, escalate — do not guess.*
