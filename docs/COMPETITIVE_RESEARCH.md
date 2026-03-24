# Competitive Research — Toast & R Power (March 2026)

## Toast POS — The Market Leader

### Order Screen
- **Two-panel layout**: Menu grid LEFT (~70%), order/check RIGHT (~30%)
- **Default grid**: 8 rows x 5 columns (configurable — more columns = smaller buttons)
- **Two modes**: Focus View (drill-down categories) and Open View (everything visible)
- **Action buttons**: Send / Stay / Hold / Pay — that's it. Clean.
- **Modifier indicators**: Red X = required unfulfilled, Green check = satisfied

### Colors (EXACT hex codes from developer docs)
- **Light mode background**: `#f7f7f7` (NOT white)
- **Dark mode background**: `#1a1c23` (NOT black — dark blue-gray)
- **Brand**: Deep blue `#2B4FB9` (NOT orange — orange is only in marketing)
- **28 button color pairings** across 7 families at 4 intensities:
  - Terracotta: `#ffe6e9` → `#e45a4e`
  - Orange: `#fbd9b6` → `#e56f1a`
  - Yellow: `#fbf5b6` → `#c78605`
  - Grass: `#e8f7d4` → `#32a206`
  - Sky/Blue: `#e3f0fb` → `#558edd`
  - Lavender: `#f1e3fd` → `#a270db`
  - Gray: `#d0d0d0` → `#989898`
- **Key insight**: Light mode buttons are PASTELS — soft pinks, pale yellows, light blues
- **Status**: Success `#45C65A`, Error `#EA001E`, Warning `#FE9339`

### Backoffice (Toast Web)
- **Sidebar width**: 240px expanded / 64px collapsed
- **Header height**: 44px
- **Sections**: Home, Menus, Front of House, Employees, Payments, Reporting, Payroll, Kitchen, Integrations, Setup
- **Background**: White/light gray
- **Accent**: Deep blue `#2B4FB9`
- **Card shadows**: `0px 15px 75px rgba(0,0,0,0.07), 0px 4px 100px rgba(0,0,0,0.05)`
- **Border radius**: 8px on cards
- **Font**: Source Sans Pro, weights 300-700
- **Typography scale**: 10/12/14/16/20/24/32px
- **Spacing**: 4px base grid (4, 8, 12, 16, 24, 32, 48px)

### Table Management
- Drag-and-drop floor plan editor
- Shapes: round, square, rectangle, booth, high-top
- Real-time status with color coding
- Table timers (time since seating)
- Server assignments visible
- Dark mode support
- Quick actions on tap

### KDS
- Grid: Dynamic/Small(5x2)/Medium(4x2)/Large(3x2)
- Color-aging headers (green → yellow → red)
- Fulfillment indicators: green check, yellow dot
- Flash animation for new tickets
- Sound notifications
- Dark mode

### Payment
- Tip: 3 percentage options + 3 dollar options (configurable)
- Combined tip + signature screen
- Card contactless < 1 second
- Quick cash presets

---

## R Power POS — The Enterprise Incumbent

### Order Screen
- Windows-based traditional interface
- Left/right-handed configurable per server
- 64,000 menu items + modifiers capacity
- Shortcut keys + touchscreen + color coding
- Forced modifier prompts (can't skip required mods)
- Fast-bar mode for bartenders

### Table/Floor Plan
- Bird's-eye view replicating physical layout
- Color-coded status (filter by color)
- COLOR LEGEND button shows what each color means
- Quick-action buttons: print check, pay, close, fire held, duplicate round
- Shows: guest counts, table totals, availability, reservations
- Transfer entire tables, guests, orders, or individual items

### Backoffice
- Web-based real-time dashboard
- 70+ report types
- SQL-based reporting
- CSV/XLS/PDF export
- Filter by store, server, room, table
- Light theme with corporate blue

### What Makes R Power Different
- Built 1994, 30+ years of depth
- Windows-native (not cloud-first)
- Dealer distribution model
- Extreme customization
- Takes "4 months to figure out the basics" per reviewers
- Maximum feature depth, minimum visual polish

---

## Design Decisions for Sear POS

Based on this research:

| Decision | Value | Rationale |
|----------|-------|-----------|
| Primary accent | `#007AFF` (iOS blue) | Toast uses blue, Square uses blue, Apple uses blue |
| Background (light) | `#F2F2F7` | Apple iPadOS standard, close to Toast's #f7f7f7 |
| Background (dark) | `#1C1C1E` | Apple dark mode standard |
| Card background | `#FFFFFF` | Industry standard |
| Card shadow | `0 1px 3px rgba(0,0,0,0.08)` | Subtle, Apple-style |
| Card radius | 12px | Apple HIG standard (Toast uses 8px) |
| Sidebar width | 240px expanded / 64px collapsed | Toast standard |
| Header height | 48px | Between Toast (44px) and Material (56px) |
| Body font size | 15px (backoffice), 17px (POS) | Apple HIG: 15pt subhead, 17pt body |
| Menu grid default | 5 columns | Appropriate for iPad landscape |
| Category colors | Pastels (Toast-style) | NOT saturated colors |
| Table status | Green/Blue/Yellow/Red (traffic light) | Industry universal |
| Touch targets | 44px minimum, 48px preferred | Apple HIG |
| Spacing grid | 4px base | Industry consensus |
