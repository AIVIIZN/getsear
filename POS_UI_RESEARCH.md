# Production iPad POS UI Research — Actionable Design Patterns

> Research conducted 2026-03-22. Covers Toast, Square, Lightspeed, TouchBistro, Apple HIG, and designer community patterns (Dribbble/Behance).

---

## Table of Contents

1. [Order Entry Screen Layouts](#1-order-entry-screen-layouts)
2. [Menu Item Display Patterns](#2-menu-item-display-patterns)
3. [Modifier Selection Patterns](#3-modifier-selection-patterns)
4. [Payment Flow Design](#4-payment-flow-design)
5. [KDS (Kitchen Display System)](#5-kds-kitchen-display-system)
6. [Apple HIG — What Makes iPad Apps Feel Native](#6-apple-hig--what-makes-ipad-apps-feel-native)
7. [iOS Typography Scale (SF Pro)](#7-ios-typography-scale-sf-pro)
8. [iOS System Colors](#8-ios-system-colors)
9. [Shadows and Elevation](#9-shadows-and-elevation)
10. [Corner Radii — Squircles](#10-corner-radii--squircles)
11. [PWA Native Feel — CSS Techniques](#11-pwa-native-feel--css-techniques)
12. [Premium Design Patterns](#12-premium-design-patterns)
13. [Implementation Checklist](#13-implementation-checklist)

---

## 1. Order Entry Screen Layouts

### Industry Standard: 2-Panel Split

Every production iPad POS uses a **left panel (order/check) + right panel (menu grid)** layout. This is universal across Square, TouchBistro, Lightspeed, and Toast.

#### Panel Proportions (iPad landscape, 1194x834pt for 11" iPad Pro)

| System | Left Panel (Order) | Right Panel (Menu) | Notes |
|--------|-------------------|-------------------|-------|
| Square for Restaurants | ~30% (358px) | ~70% (836px) | Categories as colored tabs along top of right panel |
| TouchBistro | ~30% (358px) | ~70% (836px) | 4 sections: order list, menu grid, categories, quick actions |
| Lightspeed Restaurant | ~35% (418px) | ~65% (776px) | Slightly wider order panel for fine dining detail |
| Toast | ~30% (358px) | ~70% (836px) | Color-coded columns in "open view" mode |

#### Left Panel (Order/Check) — What's Inside

From top to bottom:
1. **Header bar** (48-56px): Table number / guest name, server name, order type badge (Dine-in/Takeout/Delivery)
2. **Seat/course tabs** (36-40px): Horizontal segmented control for seat numbers (Seat 1, Seat 2, All)
3. **Order items list** (scrollable, fills remaining space): Each item row shows:
   - Item name (left-aligned, 17pt semibold)
   - Quantity badge (if > 1, circular, left of name)
   - Modifiers below item name (15pt regular, secondary color, indented 16px)
   - Price (right-aligned, 17pt regular)
   - Void/edit tap target (revealed on swipe-left)
4. **Subtotals area** (fixed bottom, ~120px):
   - Subtotal, tax, total — right-aligned numbers
   - Discount line (if applied, in red/orange)
5. **Action buttons** (fixed bottom, 48-56px): "Send" (primary blue), "Pay" (green), "Hold" (gray)

#### Right Panel (Menu Grid) — What's Inside

From top to bottom:
1. **Category bar** (48-56px): Horizontally scrollable row of colored category pills/tabs. Each pill is ~80-120px wide, 36px tall, with 8px border-radius. Active category has filled background; inactive has outline or lighter fill.
2. **Search bar** (optional, 44px): Appears above grid or in category bar. Magnifying glass icon + text field.
3. **Menu item grid** (fills remaining space): Configurable grid, typically:
   - Quick service: 4-5 columns x 4-5 rows of square tiles
   - Full service: 3-4 columns x 3-4 rows (larger tiles with images)
   - Each tile: 100-160px square
4. **Pagination dots or scroll**: Grid scrolls vertically; some systems paginate horizontally.

### Toast-Specific: "Open View" Layout
Toast uses a flattened view where all items and modifiers are displayed in color-coded columns simultaneously. Grid dimensions are configurable (e.g., 7x7). This is Android-only (Toast does not support iPad).

### TouchBistro-Specific: View Modes
TouchBistro offers three menu display modes switchable via a View icon:
- **Classic (list)**: Vertical list with item names
- **Image grid**: Tiles with food photos
- **Text grid**: Colored tiles with item names only

---

## 2. Menu Item Display Patterns

### Tile Design (Most Common)

```
┌──────────────────┐
│                  │
│   [Food Photo]   │  ← Optional, 60-70% of tile height
│                  │
├──────────────────┤
│  Item Name       │  ← 13-15pt, semibold, 1-2 lines max
│  $12.99          │  ← 13pt, regular, secondary color
└──────────────────┘
```

#### Specific Tile Values

| Property | Value |
|----------|-------|
| Tile size (QSR) | 100x100px to 120x120px |
| Tile size (FSR with images) | 140x160px to 160x180px |
| Corner radius | 12-16px (matching iOS card radius) |
| Background | White (#FFFFFF) or very light gray (#F9F9F9) |
| Border | None, or 1px solid rgba(0,0,0,0.06) |
| Shadow | 0 1px 3px rgba(0,0,0,0.08) |
| Padding | 8-12px |
| Image corner radius | Match tile radius minus padding (8-12px) |
| Font: item name | 14px/18px, weight 600 |
| Font: price | 13px/16px, weight 400, color #8E8E93 |
| Active/pressed state | Scale to 0.96, shadow reduces, background darkens slightly |
| 86'd (out of stock) | 40% opacity overlay, strikethrough text, red "86" badge |

### Category Color Coding

Production POS systems use color-coded category tabs (pills). Common palette:

| Category | Background Color | Text Color |
|----------|-----------------|------------|
| Appetizers | #FF9500 (system orange) | White |
| Entrees | #FF3B30 (system red) | White |
| Salads | #34C759 (system green) | White |
| Drinks | #007AFF (system blue) | White |
| Desserts | #AF52DE (system purple) | White |
| Sides | #5AC8FA (system teal) | White |
| Specials | #FF2D55 (system pink) | White |
| Wine/Beer | #8E8E93 (system gray) | White |

---

## 3. Modifier Selection Patterns

### Industry Standard: Modal Sheet (Bottom Sheet on iPad)

All major iPad POS systems present modifiers as a **modal overlay or slide-up sheet**, not inline.

#### Pattern: iPad Page Sheet

Based on Apple HIG sheet patterns (`.pageSheet` presentation):

```
┌─────────────────────────────────────────────┐
│ (dimmed background - order screen)          │
│                                             │
│   ┌───────────────────────────────────┐     │
│   │  ▔▔▔  (drag indicator, 36x5px)   │     │
│   │                                   │     │
│   │  Customize: Wagyu Burger    ✕     │     │  ← Header: 56px tall
│   │                                   │     │
│   │  ┌─ Size (Required) ───────────┐  │     │  ← Modifier group header
│   │  │  ○ Regular         +$0.00   │  │     │
│   │  │  ● Large           +$3.00   │  │     │  ← Radio buttons for single-select
│   │  │  ○ Extra Large     +$5.00   │  │     │
│   │  └─────────────────────────────┘  │     │
│   │                                   │     │
│   │  ┌─ Temperature (Required) ────┐  │     │
│   │  │  ○ Rare                     │  │     │
│   │  │  ● Medium Rare              │  │     │
│   │  │  ○ Medium                   │  │     │
│   │  │  ○ Well Done                │  │     │
│   │  └─────────────────────────────┘  │     │
│   │                                   │     │
│   │  ┌─ Add-Ons (Optional, max 3) ┐  │     │
│   │  │  ☐ Bacon           +$2.00  │  │     │  ← Checkboxes for multi-select
│   │  │  ☑ Avocado          +$2.50  │  │     │
│   │  │  ☐ Extra Cheese     +$1.50  │  │     │
│   │  └─────────────────────────────┘  │     │
│   │                                   │     │
│   │  [ Add to Order — $18.50 ]        │     │  ← Full-width CTA, 50px tall
│   └───────────────────────────────────┘     │
│                                             │
└─────────────────────────────────────────────┘
```

#### Modifier Sheet Specific Values

| Property | Value |
|----------|-------|
| Sheet width | 540-600px (centered on iPad landscape) |
| Sheet max height | 80% of screen height |
| Corner radius (top) | 16px (iOS standard sheet radius) |
| Background | #FFFFFF |
| Backdrop | rgba(0,0,0,0.4) |
| Drag indicator | 36px wide, 5px tall, #C7C7CC, centered, 8px from top |
| Header height | 56px |
| Header font | 20px, weight 600 |
| Close button | 30x30px circle, #F2F2F7 background, SF Symbol "xmark" |
| Group header | 15px, weight 600, uppercase, color #8E8E93, 24px bottom padding |
| Option row height | 48-52px |
| Option font | 17px, weight 400 |
| Price add-on font | 15px, weight 400, color #8E8E93, right-aligned |
| Radio/checkbox size | 24x24px |
| Selected radio color | #007AFF (system blue) |
| Selected checkbox color | #007AFF |
| CTA button height | 50px |
| CTA button radius | 12px |
| CTA button color | #007AFF, white text, 17pt semibold |
| Animation | Spring animation, 0.35s duration, slight bounce |

#### TouchBistro Modifier Behavior
- "Forced modifiers" automatically pop up when the item is added to the order
- Optional modifiers are accessed by tapping the item in the order list
- Supports custom free-text modifiers for dietary requests

---

## 4. Payment Flow Design

### Common Pattern: Full-Screen State Machine

Payment is NOT a small modal — it takes over the full screen as a multi-step flow.

#### Step 1: Payment Method Selection

```
┌──────────────────────────────────────────────────────┐
│  ← Back to Order                        Check #1042  │
│                                                      │
│  ┌──────────────────┐  ┌─────────────────────────┐   │
│  │                  │  │                         │   │
│  │  Order Summary   │  │   How would you like    │   │
│  │                  │  │   to pay?                │   │
│  │  Wagyu Burger    │  │                         │   │
│  │    Medium Rare   │  │  ┌─────┐ ┌─────┐       │   │
│  │    + Avocado     │  │  │ 💳  │ │ 💵  │       │   │
│  │           $18.50 │  │  │Card │ │Cash │       │   │
│  │                  │  │  └─────┘ └─────┘       │   │
│  │  Caesar Salad    │  │                         │   │
│  │            $9.00 │  │  ┌─────┐ ┌─────┐       │   │
│  │                  │  │  │ 🎁  │ │ ⊕   │       │   │
│  │  ──────────────  │  │  │Gift │ │Split│       │   │
│  │  Subtotal $27.50 │  │  └─────┘ └─────┘       │   │
│  │  Tax       $2.34 │  │                         │   │
│  │  ══════════════  │  │                         │   │
│  │  TOTAL   $29.84  │  │                         │   │
│  │                  │  │                         │   │
│  └──────────────────┘  └─────────────────────────┘   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### Step 2: Tip Selection (if card)

```
┌──────────────────────────────────────────────────────┐
│                   Add a Tip                          │
│                                                      │
│              ┌──────┐ ┌──────┐ ┌──────┐              │
│              │ 18%  │ │ 20%  │ │ 25%  │              │
│              │$5.37 │ │$5.97 │ │$7.46 │              │
│              └──────┘ └──────┘ └──────┘              │
│                                                      │
│              ┌──────┐ ┌──────────────┐               │
│              │ No   │ │ Custom       │               │
│              │ Tip  │ │ Amount       │               │
│              └──────┘ └──────────────┘               │
│                                                      │
│         ┌────────────────────────────┐               │
│         │     Continue — $35.81      │               │
│         └────────────────────────────┘               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### Step 3: Processing / Terminal Interaction

- Full screen with centered spinner/animation
- "Present card on terminal" message
- Terminal name and status indicator
- Cancel button at bottom

#### Step 4: Receipt Options

- "Receipt?" with three large buttons: Print, Email, Text, No Receipt
- Auto-dismiss after 10-15 seconds with "No Receipt" default

#### Payment Button Specific Values

| Property | Value |
|----------|-------|
| Payment method tiles | 120x100px, 16px corner radius |
| Tile icon size | 32-40px |
| Tile label font | 17px, weight 600 |
| Tip percentage buttons | 80x80px, 16px corner radius |
| Tip percentage font | 22px, weight 700 |
| Tip amount font | 15px, weight 400, secondary color |
| Selected tip | Blue border (3px), light blue background (#007AFF at 10%) |
| CTA button | Full width, 56px tall, 14px radius, #007AFF or #34C759 |
| Processing spinner | 44x44px, system activity indicator |
| Total amount font | 34px, weight 700 (Large Title style) |

---

## 5. KDS (Kitchen Display System)

### Layout: Grid of Ticket Cards on Dark Background

Based on Toast KDS documentation and industry patterns:

#### Grid Options

| Size | Columns x Rows | Max Tickets/Page |
|------|----------------|-----------------|
| Small | 5 x 2 | 10 |
| Medium | 4 x 2 | 8 |
| Large | 3 x 2 | 6 |

Tickets fill columns top-to-bottom, then left-to-right. Oversized tickets expand into the grid space below.

#### Ticket Card Layout

```
┌─────────────────────────┐
│ #1042  Table 5   3:42 ▶ │  ← Header: ticket number, table, timer
├─────────────────────────┤
│ Server: Maria           │
│─────────────────────────│
│ 1x Wagyu Burger         │  ← Bold, 16px
│    - Medium Rare        │  ← Modifier, 14px, secondary color
│    - Add Avocado        │
│ 1x Caesar Salad         │
│ 2x Fries                │
│                         │
│─────────────────────────│
│ COURSE 1 of 2           │  ← Course indicator
└─────────────────────────┘
```

#### Aging Timer Color Progression

| Time Range | Header Color | Meaning |
|-----------|-------------|---------|
| 0 - 5 min | #34C759 (green) | On time |
| 5 - 10 min | #FFCC00 (yellow) | Approaching target |
| 10 - 15 min | #FF9500 (orange) | Behind schedule |
| 15+ min | #FF3B30 (red) | Critical / overdue |

These thresholds are configurable per restaurant.

#### KDS Design Values

| Property | Value |
|----------|-------|
| Background | #1C1C1E (iOS dark system background) or #000000 |
| Ticket card background | #2C2C2E (dark) or #FFFFFF (light mode) |
| Ticket card corner radius | 12px |
| Ticket card shadow | 0 2px 8px rgba(0,0,0,0.3) |
| Header height | 40-48px |
| Header font | 15px, weight 700, white |
| Timer font | 17px, weight 700, monospaced (SF Mono) |
| Item font | 16px, weight 600, white |
| Modifier font | 14px, weight 400, rgba(255,255,255,0.6) |
| Card padding | 12-16px |
| Card gap | 8-12px |
| Bump action | Swipe right or tap "Done" button |
| Bump animation | Card slides right and fades out, 0.3s |
| New ticket animation | Card slides in from left, slight spring, 0.4s |
| Status indicators | Green checkmark = fulfilled, Yellow dot = partial |
| Audio alert | Chime on new ticket, escalating beep on red tickets |

#### KDS Screen Regions

| Region | Content |
|--------|---------|
| Top-left | Navigation arrow (back to POS) |
| Top-center | Station name ("Grill", "Expo", "Fry") |
| Top-right | Recall button, overflow menu |
| Center | Ticket grid (scrollable) |
| Bottom | "All Day" production counts (up to 30 items), pagination |
| Bottom-right | Average fulfillment timer |

---

## 6. Apple HIG — What Makes iPad Apps Feel Native

### 2025/2026 Design Language: Liquid Glass

Apple introduced "Liquid Glass" at WWDC 2025 — translucent, depth-focused, fluid-responsive design across iOS 26 / iPadOS 26. Key characteristics:
- Translucent materials with background blur
- Depth through layering, not just shadows
- Fluid, responsive animations

However, for a POS app targeting iPadOS 17-18 (current install base), focus on the **pre-Liquid-Glass** design language which is still the dominant paradigm.

### Core iPad Design Principles

1. **Do NOT scale up an iPhone UI** — iPad has its own interaction model
2. **Support pointer/trackpad interactions** — hover states, cursor changes
3. **Keyboard shortcuts** for power users
4. **Large touch targets** — minimum 44x44pt (Apple HIG minimum)
5. **Use the full screen** — no wasted space, multi-column layouts
6. **Support Split View and Slide Over** (less critical for POS, but good practice)

### What Makes Apple's Own Apps Feel Clean

1. **Generous whitespace** — Apple uses 2-3x the padding most web developers use
2. **Consistent 8pt grid** — All spacing is multiples of 8 (8, 16, 24, 32, 40, 48)
3. **Restrained color** — Most UI is gray/white/black. Color is used sparingly for actions and status
4. **Subtle dividers** — 0.5px lines (hairline) instead of thick borders, color: rgba(60,60,67,0.29)
5. **System materials** — Background blur (vibrancy) behind sheets, sidebars
6. **Smooth animations** — Spring-based, not linear. Duration 0.3-0.5s.
7. **Typography hierarchy** — Only 3-4 sizes per screen, differentiated by weight more than size

---

## 7. iOS Typography Scale (SF Pro)

### Complete Scale

| Style | Font | Size | Weight | Line Height | Use Case |
|-------|------|------|--------|-------------|----------|
| Large Title | SF Pro Display | 34pt | Regular | 41pt | Page titles (before scroll) |
| Title 1 | SF Pro Display | 28pt | Regular | 34pt | Section headers |
| Title 2 | SF Pro Display | 22pt | Regular | 28pt | Card titles |
| Title 3 | SF Pro Display | 20pt | Regular | 25pt | Subsection headers |
| Headline | SF Pro Text | 17pt | Semibold | 22pt | List row primary |
| Body | SF Pro Text | 17pt | Regular | 22pt | Default body text |
| Callout | SF Pro Text | 16pt | Regular | 21pt | Secondary descriptions |
| Subhead | SF Pro Text | 15pt | Regular | 20pt | Tertiary text |
| Footnote | SF Pro Text | 13pt | Regular | 18pt | Timestamps, metadata |
| Caption 1 | SF Pro Text | 12pt | Regular | 16pt | Small labels |
| Caption 2 | SF Pro Text | 11pt | Regular | 13pt | Badge text |

### Key Rules

- SF Pro Text for sizes ≤ 19pt
- SF Pro Display for sizes ≥ 20pt
- Default system size is **17pt** (Body/Headline)
- Secondary text is **15pt** (Subhead)
- Smallest recommended body text is **13pt** (Footnote)
- Tab bar labels: **10pt** (absolute minimum)
- **Weight over size**: Use semibold/bold at the same size rather than increasing font size for emphasis

### CSS Implementation

```css
/* System font stack that activates SF Pro on Apple devices */
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display',
             'Helvetica Neue', Helvetica, Arial, sans-serif;

/* Or for the newer system-ui approach */
font-family: system-ui, -apple-system, sans-serif;

/* SF Pro character spacing per size (from Apple's specs) */
/* 10pt: +1.2% tracking */
/* 12pt: +0% tracking */
/* 17pt: -0.4% tracking */
/* 20pt: +0.4% tracking */
/* 34pt: +1.1% tracking */
```

---

## 8. iOS System Colors

### Tint Colors (Light Mode / Dark Mode)

| Color Name | Light Mode RGB | Dark Mode RGB | Light Hex | Dark Hex |
|-----------|---------------|---------------|-----------|----------|
| systemBlue | 0, 122, 255 | 10, 132, 255 | #007AFF | #0A84FF |
| systemGreen | 52, 199, 89 | 48, 209, 88 | #34C759 | #30D158 |
| systemIndigo | 88, 86, 214 | 94, 92, 230 | #5856D6 | #5E5CE6 |
| systemOrange | 255, 149, 0 | 255, 159, 10 | #FF9500 | #FF9F0A |
| systemPink | 255, 45, 85 | 255, 55, 95 | #FF2D55 | #FF375F |
| systemPurple | 175, 82, 222 | 191, 90, 242 | #AF52DE | #BF5AF2 |
| systemRed | 255, 59, 48 | 255, 69, 58 | #FF3B30 | #FF453A |
| systemTeal | 90, 200, 250 | 100, 210, 255 | #5AC8FA | #64D2FF |
| systemYellow | 255, 204, 0 | 255, 214, 10 | #FFCC00 | #FFD60A |

### Gray Scale (Light Mode / Dark Mode)

| Color Name | Light Mode RGB | Dark Mode RGB |
|-----------|---------------|---------------|
| systemGray | 142, 142, 147 | 142, 142, 147 |
| systemGray2 | 174, 174, 178 | 99, 99, 102 |
| systemGray3 | 199, 199, 204 | 72, 72, 74 |
| systemGray4 | 209, 209, 214 | 58, 58, 60 |
| systemGray5 | 229, 229, 234 | 44, 44, 46 |
| systemGray6 | 242, 242, 247 | 28, 28, 30 |

### Semantic Colors (Light Mode)

| Role | Value |
|------|-------|
| Primary label | #000000 (black) |
| Secondary label | rgba(60, 60, 67, 0.60) |
| Tertiary label | rgba(60, 60, 67, 0.30) |
| Quaternary label | rgba(60, 60, 67, 0.18) |
| System background | #FFFFFF |
| Secondary system background | #F2F2F7 |
| Tertiary system background | #FFFFFF |
| Separator | rgba(60, 60, 67, 0.29) — renders as 0.5px hairline |
| Opaque separator | #C6C6C8 |
| Link | #007AFF |

### Semantic Colors (Dark Mode)

| Role | Value |
|------|-------|
| Primary label | #FFFFFF |
| Secondary label | rgba(235, 235, 245, 0.60) |
| Tertiary label | rgba(235, 235, 245, 0.30) |
| Quaternary label | rgba(235, 235, 245, 0.18) |
| System background | #000000 |
| Secondary system background | #1C1C1E |
| Tertiary system background | #2C2C2E |
| Separator | rgba(84, 84, 88, 0.65) |

---

## 9. Shadows and Elevation

### Apple-Inspired Shadow System for POS

| Level | Use Case | CSS box-shadow |
|-------|----------|---------------|
| Level 0 | Flat elements, table cells | none |
| Level 1 | Cards, menu tiles | `0 1px 3px rgba(0,0,0,0.08)` |
| Level 2 | Raised buttons, floating controls | `0 2px 8px rgba(0,0,0,0.12)` |
| Level 3 | Popovers, dropdowns | `0 4px 16px rgba(0,0,0,0.16)` |
| Level 4 | Modal sheets, slide-overs | `0 8px 32px rgba(0,0,0,0.20)` |
| Level 5 | Top-level overlays, alerts | `0 16px 48px rgba(0,0,0,0.24)` |

### Layered Shadows (More Realistic)

For premium depth, use two-layer shadows (Apple's approach):

```css
/* Card / menu tile */
box-shadow:
  0 1px 2px rgba(0, 0, 0, 0.06),
  0 2px 8px rgba(0, 0, 0, 0.08);

/* Floating action button */
box-shadow:
  0 2px 4px rgba(0, 0, 0, 0.08),
  0 8px 24px rgba(0, 0, 0, 0.12);

/* Modal sheet */
box-shadow:
  0 4px 8px rgba(0, 0, 0, 0.08),
  0 16px 48px rgba(0, 0, 0, 0.16);

/* Toast notification */
box-shadow:
  0 4px 12px rgba(0, 0, 0, 0.12),
  0 12px 32px rgba(0, 0, 0, 0.08);
```

### Inner Highlight (Apple Signature)

Apple often adds a subtle inner white border/shadow for a "glass" effect:

```css
/* Inner highlight on cards */
box-shadow:
  0 1px 3px rgba(0, 0, 0, 0.08),
  inset 0 1px 0 rgba(255, 255, 255, 0.5);
```

---

## 10. Corner Radii — Squircles

### iOS Corner Radius Values by Element

| Element Type | Corner Radius |
|-------------|--------------|
| Small buttons, badges | 6-8px |
| Text fields, search bars | 10px |
| Cards, tiles, sheets | 12-16px |
| Large cards, modal sheets | 16-20px |
| App icons (rendered by iOS) | Continuous corner (superellipse), ~22.37% of icon size |
| Bottom sheets (top corners only) | 16px |
| Full-screen modal (top corners) | 12px |
| Notification banners | 16px |
| Action sheets | 14px |

### Squircle (Continuous Corner) Implementation

iOS uses superellipse curves, not standard circular `border-radius`. The difference is subtle but crucial for premium feel.

#### CSS `corner-shape` Property (Chrome 139+, March 2026)

```css
/* Modern — Chrome/Chromium only as of March 2026 */
.card {
  border-radius: 16px;
  corner-shape: squircle;
}

/* Fine-grained control */
.card {
  border-radius: 16px;
  corner-shape: superellipse(0.5); /* Between circle and squircle */
}
```

#### Fallback for Safari/Firefox

Standard `border-radius` is acceptable — the visual difference is minor at small radii. For app icons or large radii, use:

```css
/* SVG clip-path approach for precise squircles */
.squircle {
  clip-path: url(#squircle-clip);
}

/* Or use a JavaScript library like CornerKit (5.5KB gzipped) */
/* https://bejarcode.github.io/cornerKit/ */
```

#### Practical Recommendation for Sear POS

Use standard `border-radius` with progressive enhancement:

```css
.tile {
  border-radius: 16px;
  /* Progressive enhancement for Chromium-based browsers */
  corner-shape: squircle;
}
```

---

## 11. PWA Native Feel — CSS Techniques

### Essential Meta Tags

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Sear POS">
<meta name="theme-color" content="#000000">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1,
  user-scalable=no, viewport-fit=cover">
```

### Critical CSS for Native Feel

```css
/* === FOUNDATIONAL NATIVE-FEEL RULES === */

/* 1. Prevent text selection on non-content elements */
body {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}

/* Allow selection only in text input fields */
input, textarea, [contenteditable] {
  -webkit-user-select: text;
  user-select: text;
}

/* 2. Remove tap highlight (the gray flash on tap) */
* {
  -webkit-tap-highlight-color: transparent;
}

/* 3. Enable :active states on iOS */
/* Add ontouchstart="" attribute to <body> element */
/* Then use :active for press feedback: */
.btn:active {
  transform: scale(0.97);
  opacity: 0.8;
}

/* 4. Prevent overscroll bounce */
html, body {
  overscroll-behavior: none;
  -webkit-overflow-scrolling: auto; /* Removes rubber-band on non-scrollable areas */
  position: fixed; /* Prevents body scroll entirely */
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* 5. Scrollable containers use touch scrolling */
.scroll-container {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch; /* Momentum scrolling */
  overscroll-behavior-y: contain; /* Prevents scroll chaining */
}

/* 6. Hide scrollbars (native apps don't show them persistently) */
.scroll-container::-webkit-scrollbar {
  display: none;
}
.scroll-container {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* 7. Safe area insets (for devices with notch/home indicator) */
.main-layout {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* 8. Prevent pinch-to-zoom */
html {
  touch-action: manipulation;
}

/* 9. Font smoothing (matches native rendering) */
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* 10. Prevent pull-to-refresh */
body {
  overscroll-behavior-y: none;
}
```

### Touch Feedback Patterns

```css
/* Button press — scale down slightly */
.pos-button {
  transition: transform 0.1s ease, opacity 0.1s ease;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.pos-button:active {
  transform: scale(0.96);
  opacity: 0.85;
}

/* Menu tile press — subtle scale with shadow change */
.menu-tile {
  transition: transform 0.15s cubic-bezier(0.2, 0, 0, 1),
              box-shadow 0.15s ease;
}

.menu-tile:active {
  transform: scale(0.97);
  box-shadow: 0 0 0 rgba(0, 0, 0, 0);
}

/* List row press — background highlight */
.list-row {
  transition: background-color 0.1s ease;
}

.list-row:active {
  background-color: rgba(0, 0, 0, 0.05);
}
```

### Animation Patterns (Native-Like)

```css
/* iOS spring curve approximation */
/* Apple's default spring: mass 1, stiffness 300, damping 30 */
/* CSS approximation: */
.spring-animation {
  transition-timing-function: cubic-bezier(0.2, 0.8, 0.2, 1);
  transition-duration: 0.35s;
}

/* Sheet slide-up */
.sheet-enter {
  transform: translateY(100%);
}
.sheet-enter-active {
  transform: translateY(0);
  transition: transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* Fade in */
.fade-enter {
  opacity: 0;
  transform: scale(0.95);
}
.fade-enter-active {
  opacity: 1;
  transform: scale(1);
  transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* Backdrop fade */
.backdrop-enter {
  opacity: 0;
}
.backdrop-enter-active {
  opacity: 1;
  transition: opacity 0.3s ease;
}
```

---

## 12. Premium Design Patterns

### What Separates "App-Quality" from "Web UI"

#### 1. Spacing Consistency (8pt Grid)

Every margin, padding, and gap should be a multiple of 8:
- **4px**: Icon-to-text gap (half-unit, used sparingly)
- **8px**: Tight spacing (between related elements in a group)
- **12px**: Compact lists (item rows in order panel)
- **16px**: Standard padding (card padding, section gaps)
- **24px**: Section separation
- **32px**: Major section breaks
- **48px**: Page-level padding

#### 2. Color Restraint

- **Maximum 2 accent colors** per screen (blue for primary actions, green for "Go/Confirm")
- Everything else is **gray scale** (#000, #3C3C43, #8E8E93, #C7C7CC, #F2F2F7, #FFF)
- **Red only for destructive** actions and alerts
- **Status colors** only in status indicators (KDS timers, table availability)

#### 3. Typography Discipline

- **Maximum 3 font sizes** per screen region
- Never use more than **2 font weights** in the same component
- Line length: **45-75 characters** for readability
- Use **tabular numbers** for prices and quantities: `font-variant-numeric: tabular-nums;`

#### 4. Border Restraint

- **No thick borders**. Use 0.5px hairlines or none at all.
- Prefer **shadow separation** over borders
- Separator color: `rgba(60, 60, 67, 0.29)` (iOS standard)
- Borders only on input fields: `1px solid rgba(60, 60, 67, 0.12)`

#### 5. Micro-Interactions

| Interaction | Animation |
|-------------|-----------|
| Button press | Scale 0.96 + opacity 0.85, 100ms |
| Tile tap | Scale 0.97 + shadow collapse, 150ms |
| Toggle switch | Spring slide, 300ms |
| Sheet open | Slide up + backdrop fade, 350ms spring |
| Sheet close | Slide down + backdrop fade, 250ms ease-out |
| Toast notification | Slide down from top, spring, auto-dismiss 3s |
| Item added to order | Brief green flash on item row, 200ms |
| Delete/void | Slide left to reveal red zone, then compress + fade |
| Tab switch | Cross-fade content, 200ms |
| Number increment | Scale pulse 1.05 then back, 150ms |

#### 6. Touch Targets

- **Minimum 44x44pt** for all tappable areas (Apple HIG requirement)
- For POS (speed is critical): prefer **48-56pt** tap targets
- Quick-action buttons: **minimum 64pt** height
- Number pad keys: **60-80pt** square

#### 7. Visual Hierarchy Signals

| Signal | Technique |
|--------|-----------|
| Primary action | Filled button, system blue (#007AFF), white text, full-width or prominent |
| Secondary action | Outlined button or gray fill, dark text |
| Destructive action | Filled red (#FF3B30), white text — never outline |
| Disabled | 40% opacity of normal state |
| Selected tab/segment | Bold weight + colored underline or filled background |
| Unselected tab | Regular weight, secondary color (#8E8E93) |
| Active/current table | Colored fill matching status |
| Badge/count | Circle with count, system red background, white text, 18-22pt diameter |

---

## 13. Implementation Checklist

### Must-Have for iPad POS (Non-Negotiable)

- [ ] **2-panel layout**: Order panel (30%) left, menu grid (70%) right
- [ ] **Fixed position body** with internal scroll containers (no page bounce)
- [ ] **44pt minimum touch targets** on all interactive elements
- [ ] **8pt spacing grid** for all margins and padding
- [ ] **SF Pro system font stack** (`-apple-system, system-ui`)
- [ ] **iOS system colors** for all tint/accent colors
- [ ] **Hairline separators** (0.5px, rgba(60,60,67,0.29))
- [ ] **No tap highlight** (`-webkit-tap-highlight-color: transparent`)
- [ ] **No text selection** on UI chrome (only on input fields)
- [ ] **No overscroll bounce** on non-scrollable areas
- [ ] **Momentum scrolling** on scrollable lists (`-webkit-overflow-scrolling: touch`)
- [ ] **Press feedback** on all buttons (scale 0.96-0.97)
- [ ] **Spring animations** for sheets and modals
- [ ] **Tabular numbers** for all prices (`font-variant-numeric: tabular-nums`)
- [ ] **Safe area insets** (env(safe-area-inset-*))
- [ ] **Status bar meta tag** (`black-translucent`)

### High Impact (Differentiators)

- [ ] **Modifier selection via modal sheet** (not inline, not full-page)
- [ ] **Category color-coded pills** with horizontal scroll
- [ ] **KDS aging colors** (green -> yellow -> orange -> red)
- [ ] **Payment flow as full-screen state machine** (not a modal)
- [ ] **Tip preset buttons** (18%, 20%, 25% with dollar amounts)
- [ ] **Layered shadows** (two-layer for premium depth)
- [ ] **Continuous corners** (squircle via `corner-shape: squircle` with fallback)
- [ ] **Swipe-to-delete** on order items (slide left to reveal red zone)
- [ ] **Seat/course segmented control** on order panel
- [ ] **Number pad** styled like iOS calculator (large round buttons, haptic-like feedback)

### Nice-to-Have (Polish)

- [ ] Background blur on sheets/overlays (`backdrop-filter: blur(20px)`)
- [ ] Subtle inner highlight on cards (`inset 0 1px 0 rgba(255,255,255,0.5)`)
- [ ] Item-added animation (green flash on order row)
- [ ] Pull-to-refresh on reports pages (custom, not browser default)
- [ ] Keyboard shortcuts for common actions (space=send, P=pay, Esc=cancel)
- [ ] Sound effects (subtle tap sound, order sent chime, KDS alert)
- [ ] Dark mode support with iOS semantic colors
- [ ] Drag-and-drop for table floor plan editing

---

## Sources

- [Apple HIG — Designing for iPadOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ipados)
- [Apple HIG — Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Apple HIG — Color](https://developer.apple.com/design/human-interface-guidelines/color)
- [Apple HIG — Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)
- [Apple HIG — Modality](https://developer.apple.com/design/human-interface-guidelines/modality)
- [iOS Font Size Guidelines (LearnUI)](https://www.learnui.design/blog/ios-font-size-guidelines.html)
- [iOS System Colors Gist](https://gist.github.com/lithammer/e9e68c131297c3158a654c0fdfc4111a)
- [CSS corner-shape Property (Smashing Magazine)](https://www.smashingmagazine.com/2026/03/beyond-border-radius-css-corner-shape-property-ui/)
- [CornerKit — iOS Squircle Corners](https://bejarcode.github.io/cornerKit/)
- [Designing Shadows in CSS (Josh Comeau)](https://www.joshwcomeau.com/css/designing-shadows/)
- [iOS PWA Native Feel (Netguru)](https://www.netguru.com/blog/pwa-ios)
- [Native-Like PWAs (SpiceFactory)](https://spicefactory.co/blog/2019/10/18/native-like-pwas/)
- [PWA iOS Native Design (Dev.to)](https://dev.to/oskarlarsson/designing-native-like-progressive-web-apps-for-ios-510o)
- [Toast POS — Manage Orders](https://central.toasttab.com/s/article/New-POS-Experience-Ordering-Screens?language=en_US)
- [Toast POS — KDS Overview](https://doc.toasttab.com/doc/platformguide/platformKDSOverview.html)
- [Square for Restaurants — Menu Groups](https://squareup.com/help/us/en/article/7804-organize-your-menu-with-square-for-restaurants)
- [TouchBistro POS](https://www.touchbistro.com/pos/)
- [TouchBistro — Modifier Modal](https://touchbistro.my.site.com/helpsite/s/article/Video-How-to-Access-the-Modifier-Modal-from-the-Order-Input-Screen)
- [Lightspeed Restaurant — Design Layout](https://o-series-support.lightspeedhq.com/hc/en-us/articles/31329442916891-Design-your-POS-look-and-layout)
- [Restaurant POS UI (Dribbble)](https://dribbble.com/search/restaurant-pos)
- [Restaurant POS UI (Behance)](https://www.behance.net/gallery/210280099/Restaurant-POS-System-Point-of-Sale-UIUX-Design)
- [Apple Shadow CSS Gist](https://gist.github.com/ebukva/6373353)
- [Toast POS Review 2026 (POSUSA)](https://www.posusa.com/toast-pos-review/)
- [Best iPad POS (RestaurantHQ)](https://www.therestauranthq.com/technology/best-ipad-restaurant-pos-system/)
