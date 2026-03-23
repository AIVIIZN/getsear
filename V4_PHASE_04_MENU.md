# Sear POS v4 — Phase 4: Menu Management Full Depth

**Build Brief (MASTER_TEMPLATE Part 1)**
**Date:** 2026-03-23
**Priority:** HIGH — Week 1
**Estimated Sessions:** 2-3

---

## 1.1 What is this?

A production-depth rebuild of the Sear POS menu management system. The current state has basic CRUD: categories list, item list, modifier group assignment. What's missing is everything that makes a menu system actually usable by a restaurant operator — visual 3-panel builder, drag-and-drop reorder, photo management, modifier nesting with 5 pricing types, daypart pricing engine, seasonal rotation, ingredient-level 86 cascade, auto-86 from inventory, allergen/dietary tagging, price levels, PLU/barcode support, quick-add specials, and CSV import/export.

This phase transforms the back-office menu page from a database admin form into a visual menu builder that matches or exceeds Toast's menu management.

**Read these files BEFORE planning:**
- `CLAUDE.md` — project config, tech stack, naming conventions
- `SEAR_POS_ARCHITECTURE.md` sections: Menu Hierarchy (line 3390), Modifier Complexity (line 3452), Forced vs Optional Modifiers (line 3651), Modifier Pricing Models (line 3675), Happy Hour / Daypart Pricing (line 3717), Seasonal Menu Rotation (line 3748), 86 Cascade Logic (line 3806), Dietary & Allergen Tagging (line 3884), Menu Item Data Model (line 3423), Scenario 4: Kitchen Runs Out of Salmon (line 2776), Scenario 15: New Menu Item (line 3200), Menu Management UI (line 14330)
- `UI_DESIGN.md` — design system tokens
- `BUSINESS_RULES.md` — operational logic for 86, allergens, pricing
- `SCHEMA.md` — existing menu_items, menu_categories, modifier_groups, modifiers tables


## 1.2 Tech stack

Already built. Do not change:
- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- **Components:** shadcn/ui (heavily customized to match design system)
- **State:** Zustand v5 + Immer
- **Database:** Supabase (PostgreSQL) — menu_items, menu_categories, modifier_groups, modifiers tables exist
- **Drag & Drop:** @dnd-kit (already in project dependencies)
- **Photo Upload:** Supabase Storage (bucket: `menu-photos`)
- **Real-Time:** Supabase Realtime for 86 propagation
- **Icons:** Lucide React


## 1.3 User roles

Relevant roles for menu management:
- **Owner** (demo@getsear.com / demo1234): full menu editing — create/edit/delete items, categories, modifiers, set prices, manage allergens, import/export, configure dayparts
- **General Manager**: full menu editing for their location. Can add daily specials, 86 items, adjust pricing within approved ranges
- **Shift Manager**: can 86/un-86 items. Cannot change prices or add new menu items
- **Kitchen Manager**: can 86/un-86 any item with cascade logic, flag items as "Running Low"
- **Server**: view-only. Can see menu with pricing, see 86'd items, view allergen info. Cannot edit.
- **Line Cook**: can flag items as "Running Low" (sends alert to kitchen manager). Cannot 86 without kitchen manager approval.


## 1.4 Pages and features

### Page: Menu Builder (3-Panel Layout)
- **Who:** Owner, GM, Kitchen Manager
- **Route:** `/menu` (back-office)
- **Layout:** 3-panel — Nav Tree (240px left), Item Grid (center, flexible), Detail Editor (400px right)
- **Panel 1 — Nav Tree:**
  - Hierarchical tree: Menu > Category > Subcategory
  - Drag-and-drop reorder of categories and subcategories
  - Right-click context menu: Rename, Duplicate, Delete, Add Subcategory
  - "+" button at top to create new category
  - Active category highlighted with primary color
  - Badge showing item count per category
  - 86'd item count badge (red) when items in category are 86'd
  - Search/filter field at top of tree
  - Collapse/expand all toggle
- **Panel 2 — Item Grid:**
  - Grid of item cards (4 columns, 120-140px tiles)
  - Each card shows: name, price, photo thumbnail (if exists), dietary icons (V, VG, GF, DF), 86'd overlay if unavailable, "LOW" badge if running low
  - Drag-and-drop to reorder within category
  - Drag items between categories (drop on nav tree node)
  - Multi-select mode (checkbox on each card) for bulk actions: Move to Category, Bulk 86, Bulk Delete, Bulk Price Change
  - "+" card at end to add new item
  - Search bar with filter pills: All, Active, 86'd, Low Stock, Has Photo, No Photo
  - Sort options: Name A-Z, Price Low-High, Price High-Low, Recently Added, Sort Order
  - View toggle: Grid view / List view (list shows more data per item)
- **Panel 3 — Detail Editor:**
  - Opens when an item is selected from the grid
  - Tabbed interface: General, Modifiers, Pricing, Availability, Allergens, Photos
  - **General tab:** Name, Short Name (KDS), Description, Category, Subcategory, Tax Class dropdown, Revenue Class dropdown, Station Routing multi-select, Prep Time (minutes), PLU code, Barcode, Online Ordering Visible toggle, Kiosk Visible toggle, Active/Inactive toggle
  - **Modifiers tab:** List of assigned modifier groups with drag-to-reorder. "Add Modifier Group" button opens group picker/creator. Each group shows: name, type (Forced/Optional), min/max selections, modifier count. Inline expand to see/edit modifiers within group. Nested sub-modifiers supported (modifier > sub-modifier group)
  - **Pricing tab:** Base price input. Price type selector (Fixed, Market Price, Open Price, Weight-Based, Size-Based). Price levels grid (9 rows): Regular, Happy Hour, Employee, Early Bird, Late Night, Kids, Catering, Online, Custom. Each level shows current price with edit. Daypart assignments per price level
  - **Availability tab:** Availability type: Always, Specific Dayparts, Specific Days, Date Range, Until 86'd, Quantity Limited. Daypart selector (checkboxes for configured dayparts). Day-of-week selector. Date range picker (for seasonal items). Quantity field (with auto-86 at 0). "86 This Item" prominent toggle at top
  - **Allergens tab:** 14 EU allergens as toggle switches with icons (Celery, Gluten, Crustaceans, Eggs, Fish, Lupin, Milk, Molluscs, Mustard, Tree Nuts, Peanuts, Sesame, Soy, Sulphites). 4 additional US allergens (Coconut, Shellfish, Corn, Latex-reactive fruits). Two modes per allergen: CONTAINS / MAY CONTAIN. Dietary tags as toggle pills: Vegetarian, Vegan, GF, DF, Nut-Free, Keto, Paleo, Halal, Kosher, Low-Sodium, Heart-Healthy, Raw. Cross-contamination warning toggle. Ingredient list editor (for automatic allergen inheritance)
  - **Photos tab:** Photo upload area (drag & drop or file picker). Crop tool (16:9 and 1:1 ratios). Multiple photos per item (first = primary). Photo preview at POS tile size. Delete/reorder photos. Max 5MB per image, auto-compress on upload
- **Empty state:** "No categories yet — create your first menu category to get started" with illustration and CTA button

### Page: Modifier Group Manager (Modal or Drawer)
- **Who:** Owner, GM
- **Triggered from:** Detail Editor > Modifiers tab > "Manage Modifier Groups"
- **Layout:** Full-width modal with list of all modifier groups
- **Features:**
  - List all modifier groups with: name, type (Forced/Optional), item count using it, modifier count
  - Create new group: Name, Selection Type (Radio = select one, Checkbox = select multiple), Min selections, Max selections, Is Forced toggle, Default selection
  - Within each group: list of modifiers with drag-to-reorder
  - Each modifier: Name, Price (with pricing type selector), Is Default toggle, Nested Sub-Group toggle
  - **Modifier pricing types (5):**
    1. Included — $0, no extra charge
    2. Upcharge — fixed additional cost (e.g., +$2.50)
    3. Replacement — swap at no charge
    4. Replacement with Upcharge — swap with price difference
    5. Quantity-Based — first N included, additional at cost (configurable N and per-extra price)
  - Duplicate group button (copies group and all modifiers)
  - "Used by" list showing which menu items reference this group

### Page: Daypart Configuration
- **Who:** Owner, GM
- **Route:** `/settings/dayparts` or accessible from Menu Builder toolbar
- **Features:**
  - List of dayparts: Name, Time Range, Days Active, Applicable Sections (Bar/Dining/All)
  - Default dayparts seeded: Breakfast (6-11 AM), Lunch (11 AM-3 PM), Happy Hour (4-6 PM), Dinner (5-10 PM), Late Night (10 PM-2 AM), Brunch (Sat-Sun 9 AM-2 PM)
  - Create/edit daypart: Name, Start Time, End Time, Days of Week, Location Sections, Holiday Override toggle
  - Pricing priority display: Manual Override > Promotion > Daypart > Menu-Specific > Base Price
  - Preview: "What prices are active right now?" button showing current effective prices

### Page: Seasonal Menu Manager
- **Who:** Owner, GM
- **Route:** Accessible from Menu Builder toolbar
- **Features:**
  - Calendar view showing seasonal items by date range
  - Create seasonal item: select existing item or create new, set Start Date, End Date, Replaces Item (optional)
  - "Clone from last year" button for seasonal rotation planning
  - Active vs Upcoming vs Expired tabs
  - Auto-activate and auto-deactivate based on dates

### Feature: Ingredient-Level 86 Cascade
- **Who:** Kitchen Manager, Shift Manager, Owner, GM
- **Triggered from:** Menu Builder 86 toggle, dedicated "86 Manager" button in toolbar, KDS 86 button
- **Workflow:**
  1. User selects ingredient to 86 (e.g., "Salmon")
  2. System shows cascade preview: all menu items affected, with checkboxes
  3. User selects which items to 86 (might keep some if ingredient is minor/substitutable)
  4. "Apply 86" with confirmation
  5. All selected items immediately grey out on all POS terminals (< 3 seconds via Supabase Realtime)
  6. Audible notification on all server devices: "[Ingredient] has been 86'd"
  7. Alert to any server with unsent orders containing 86'd items
  8. "Running Low" pre-86 status: quantity threshold configurable per item
  9. Un-86 workflow: select item > restore > instant sync

### Feature: Auto-86 from Inventory
- **Who:** System (automatic), Kitchen Manager (override)
- **Triggered from:** Inventory count reaching 0 or configured threshold
- **Workflow:**
  1. Inventory item quantity decrements with each order
  2. When count hits configurable "Running Low" threshold: item shows yellow "LOW" badge on POS, kitchen gets alert
  3. When count hits 0: auto-86, item greys out on POS, notification sent
  4. Kitchen manager can manually 86 at any time regardless of count (quality/freshness reasons)
  5. 86 tracking log: what was 86'd, when, who did it, when restored, estimated lost revenue

### Feature: Quick-Add Special
- **Who:** Kitchen Manager, GM, Owner
- **Triggered from:** "+" button in Menu Builder toolbar, or "Quick Add Special" speed button
- **Workflow:**
  1. Minimal form: Name, Price, Category (dropdown), Description (optional)
  2. Optional: Allergens (quick-tag), Quantity Limit, Station Routing, Photo (camera or upload)
  3. Availability defaults: "Tonight Only" or "Until 86'd"
  4. Allergens and modifiers can inherit from category defaults
  5. **Must complete in under 30 seconds** — 4 required fields only
  6. Item appears on POS immediately

### Feature: Menu Import/Export CSV
- **Who:** Owner, GM
- **Triggered from:** Menu Builder toolbar > Import/Export button
- **Features:**
  - **Export:** Downloads CSV with columns: Name, Short Name, Category, Subcategory, Price, Tax Class, Revenue Class, PLU, Barcode, Description, Allergens (comma-separated), Dietary Tags, Station Routing, Active, 86'd
  - **Import:** Upload CSV, preview with validation (missing required fields, duplicate names, invalid prices), row-by-row error display, option to skip errors or fix inline, create new categories automatically if they don't exist, merge with existing (match by PLU or Name)
  - **Template download:** Empty CSV template with all columns and example row


## 1.5 Look and feel

- **Mode:** Light-first (matches overall POS design system)
- **Vibe:** Professional back-office tool, efficient, information-dense but organized
- **Reference products:** Toast Menu Builder, Square Menu Manager, Notion's database views
- **Layout:** 3-panel builder fills full viewport below topbar. No wasted space.
- **Nav Tree panel:** Subtle warm-gray background (#F5F3EF), 240px width, resizable
- **Item Grid panel:** White background, items in card grid with warm shadows
- **Detail Editor panel:** White background, 400px width, scrollable, tabs at top
- **Drag feedback:** Ghost preview of dragged item, drop target highlighted with primary color border, smooth spring animation on drop
- **86'd items:** Desaturated card with red diagonal "86" stamp overlay, rotated -12deg, semi-transparent
- **"Running Low" items:** Yellow "LOW" badge on card, yellow left border
- **Allergen icons:** Small colored circles with 2-letter abbreviation (matching EU standard colors)
- **Photo thumbnails:** Rounded 8px corners, 64x64 in grid view, full-width in detail editor
- **Touch targets:** 48px minimum for all interactive elements
- **Empty states:** Every panel has a designed empty state with helpful message and illustration


## 1.6 Business rules

- **86 propagation:** Must reach all terminals in < 3 seconds via Supabase Realtime broadcast channel `86:{locationId}`
- **Modifier forced validation:** Order CANNOT be sent to kitchen without completing all forced modifier groups. POS blocks with: "Please select [Group Name] for [Item Name]"
- **Modifier pricing:** 5 pricing types (Included, Upcharge, Replacement, Replacement+Upcharge, Quantity-Based). Price calculations must be exact to the cent using integer arithmetic.
- **Daypart auto-switch:** Prices change automatically at daypart start/end times. Order timestamp determines pricing, not payment time.
- **Daypart pricing priority:** Manual Override > Promotion/Coupon > Daypart > Menu-Specific > Base Price
- **Seasonal auto-activate/deactivate:** Items auto-appear and auto-disappear based on date range. Deactivated items retain history for next year planning.
- **Price levels:** 9 configurable levels (Regular, Happy Hour, Employee, Early Bird, Late Night, Kids, Catering, Online, Custom). Each item can have different prices per level.
- **Allergen inheritance:** If recipe/ingredient list includes an allergen-containing ingredient, item is auto-tagged. Manual override possible.
- **Photo upload:** Max 5MB per image, auto-compress to WebP, store in Supabase Storage bucket `menu-photos`, serve via CDN.
- **PLU uniqueness:** PLU codes must be unique within a location. Barcode scanner input triggers item lookup.
- **CSV import validation:** Must validate all required fields, check for duplicates, validate price format, validate allergen codes before importing.
- **Multi-location menu inheritance:** Corporate can lock items (cannot be removed/price-changed locally). Locations can have "Flexible" items (price adjustable within range) and "Local" items (location-specific additions).
- **Same item, multiple contexts:** The same base recipe can appear in multiple categories at different prices with different modifiers (e.g., chicken as entrée $24, salad add-on $8, kids item $10).


## 1.7 Integrations

- **Supabase Storage:** Photo upload/management for menu item images
- **Supabase Realtime:** 86 broadcast channel for instant propagation to all POS terminals
- **Inventory module:** Auto-86 triggered when inventory count reaches 0; "Running Low" at configurable threshold
- **KDS module:** Station routing configuration determines which kitchen printer/KDS station receives each item
- **POS MenuGrid component:** Menu builder changes must reflect immediately on the POS order entry screen


## 1.8 Modules planned but not for this phase

- Multi-location menu inheritance (corporate menu templates, location overrides) — Phase 11 with Franchise module
- Menu versioning / audit log of all changes — Phase 12 security hardening
- AI-powered menu pricing recommendations — future
- Recipe costing integration (food cost % per item) — Phase 11 with Inventory module
- Online ordering menu customization (separate display for web) — Phase 11 with Online Ordering module


## 1.9 Files to create or modify

### New Files
| File | Purpose |
|------|---------|
| `src/app/(backoffice)/menu/layout.tsx` | 3-panel layout wrapper for menu builder |
| `src/components/menu/MenuBuilder.tsx` | Main 3-panel orchestrator component |
| `src/components/menu/NavTree.tsx` | Left panel: hierarchical category tree with drag-and-drop |
| `src/components/menu/NavTreeNode.tsx` | Individual tree node (category/subcategory) |
| `src/components/menu/ItemCard.tsx` | Grid tile for a single menu item |
| `src/components/menu/ItemListRow.tsx` | List view row for a single menu item |
| `src/components/menu/DetailEditor.tsx` | Right panel: tabbed item editor |
| `src/components/menu/tabs/GeneralTab.tsx` | Detail editor General tab |
| `src/components/menu/tabs/ModifiersTab.tsx` | Detail editor Modifiers tab |
| `src/components/menu/tabs/PricingTab.tsx` | Detail editor Pricing tab with price levels grid |
| `src/components/menu/tabs/AvailabilityTab.tsx` | Detail editor Availability tab with daypart/date config |
| `src/components/menu/tabs/AllergensTab.tsx` | Detail editor Allergens + Dietary tags tab |
| `src/components/menu/tabs/PhotosTab.tsx` | Detail editor Photos tab with upload/crop |
| `src/components/menu/ModifierGroupEditor.tsx` | Full modifier group management modal |
| `src/components/menu/ModifierRow.tsx` | Single modifier within a group (editable) |
| `src/components/menu/PricingTypeSelector.tsx` | Dropdown for 5 modifier pricing types |
| `src/components/menu/QuickAddSpecial.tsx` | Minimal 4-field quick-add form |
| `src/components/menu/ImportExportDialog.tsx` | CSV import/export dialog with preview/validation |
| `src/components/menu/EightySixManager.tsx` | 86 cascade UI — ingredient select, preview, apply |
| `src/components/menu/EightySixBadge.tsx` | Red "86" overlay badge component |
| `src/components/menu/RunningLowBadge.tsx` | Yellow "LOW" badge component |
| `src/components/menu/AllergenBadge.tsx` | Small allergen icon badge (colored circle + abbreviation) |
| `src/components/menu/DietaryTagPill.tsx` | Dietary tag pill (V, VG, GF, DF, etc.) |
| `src/components/menu/DaypartConfig.tsx` | Daypart configuration editor |
| `src/components/menu/SeasonalManager.tsx` | Seasonal item calendar view |
| `src/components/menu/PhotoUploader.tsx` | Drag-drop photo upload with crop tool |
| `src/components/menu/BulkActionsBar.tsx` | Floating bar for multi-select bulk operations |
| `src/app/api/menu/items/import/route.ts` | CSV import endpoint |
| `src/app/api/menu/items/export/route.ts` | CSV export endpoint |
| `src/app/api/menu/items/bulk/route.ts` | Bulk operations (move, 86, delete, price change) |
| `src/app/api/menu/dayparts/route.ts` | CRUD for daypart configuration |
| `src/app/api/menu/dayparts/[id]/route.ts` | Individual daypart CRUD |
| `src/app/api/menu/dayparts/active/route.ts` | Get currently active daypart and effective prices |
| `src/app/api/menu/ingredients/route.ts` | CRUD for ingredient database |
| `src/app/api/menu/ingredients/[id]/86/route.ts` | 86 an ingredient with cascade |
| `src/app/api/menu/seasonal/route.ts` | Seasonal menu item CRUD |
| `src/app/api/menu/photos/route.ts` | Photo upload endpoint (Supabase Storage) |
| `src/app/api/menu/photos/[id]/route.ts` | Photo delete/reorder |
| `src/lib/menu/daypart-engine.ts` | Daypart pricing resolution logic |
| `src/lib/menu/eighty-six-cascade.ts` | 86 cascade logic (ingredient → items) |
| `src/lib/menu/price-resolver.ts` | Price level + daypart + override resolution |
| `src/lib/menu/csv-parser.ts` | CSV import parsing and validation |
| `src/lib/menu/csv-exporter.ts` | CSV export formatting |
| `src/lib/menu/allergen-constants.ts` | 14 EU + 4 US allergen definitions, icons, colors |
| `src/stores/menu-builder-store.ts` | Zustand store for menu builder UI state |

### Modified Files
| File | Changes |
|------|---------|
| `src/app/(backoffice)/menu/page.tsx` | Replace current basic CRUD with MenuBuilder 3-panel layout |
| `src/components/menu/CategoryPanel.tsx` | Refactor into NavTree component |
| `src/components/menu/ItemGrid.tsx` | Refactor to support drag-and-drop, multi-select, view toggle |
| `src/components/menu/ItemDetailSheet.tsx` | Replace with full tabbed DetailEditor |
| `src/components/menu/ModifierGroupManager.tsx` | Rebuild with 5 pricing types, nesting, drag-reorder |
| `src/components/pos/MenuGrid.tsx` | Integrate with daypart pricing, 86 badges, allergen icons |
| `src/app/api/menu/items/route.ts` | Add price levels, allergens, dietary tags, ingredient links |
| `src/app/api/menu/items/[id]/route.ts` | Support photo URLs, price levels, availability config |
| `src/app/api/menu/items/[id]/86/route.ts` | Add cascade logic, broadcast to realtime, quantity tracking |
| `src/app/api/menu/categories/reorder/route.ts` | Support subcategory nesting |
| `src/app/api/menu/modifier-groups/route.ts` | Add pricing type field, nesting support |
| `src/app/api/menu/modifier-groups/[id]/route.ts` | Add pricing type, sub-group CRUD |
| `src/hooks/use-realtime.ts` | Add 86 broadcast channel subscription |

### Database Migrations (if needed)
| Migration | Changes |
|-----------|---------|
| `add_menu_dayparts` | Create `menu_dayparts` table (id, name, start_time, end_time, days, sections, location_id) |
| `add_menu_price_levels` | Create `menu_item_price_levels` table (item_id, level_name, price, daypart_id) |
| `add_menu_ingredients` | Create `ingredients` table and `menu_item_ingredients` junction table |
| `add_menu_allergens` | Add `allergens jsonb`, `dietary_tags text[]`, `may_contain jsonb` to menu_items |
| `add_menu_photos` | Create `menu_item_photos` table (item_id, storage_path, sort_order, is_primary) |
| `add_seasonal_items` | Create `seasonal_menu_items` table (item_id, start_date, end_date, replaces_item_id) |
| `add_item_quantity` | Add `quantity_available int`, `quantity_low_threshold int`, `is_running_low boolean` to menu_items |


## Acceptance Criteria

### Menu Builder 3-Panel Layout
- [ ] Menu builder page loads with 3-panel layout: Nav Tree (240px), Item Grid (flexible), Detail Editor (400px, hidden until item selected)
- [ ] Nav tree shows category hierarchy (Menu > Category > Subcategory) with item counts
- [ ] Clicking a category in nav tree filters the item grid to that category's items
- [ ] Detail editor panel slides open when an item card is clicked, closes on click-away or X button
- [ ] All 3 panels scroll independently
- [ ] Layout renders correctly at iPad landscape (1194x834) and desktop (1440px+)

### Drag-and-Drop Reorder
- [ ] Categories in nav tree can be dragged to reorder — sort_order persists to database via PATCH /api/menu/categories/reorder
- [ ] Items in grid can be dragged to reorder within category — sort_order persists via PATCH /api/menu/items/reorder
- [ ] Items can be dragged from grid and dropped on a different category in the nav tree — item moves to new category
- [ ] Drag preview shows ghost of item card at 50% opacity, drop target highlighted with ember-orange border
- [ ] Reorder changes reflect immediately on POS menu grid (optimistic UI + database persist)

### Photo Upload/Management
- [ ] Photos tab in detail editor shows upload area (drag-and-drop or file picker)
- [ ] Uploaded photo auto-compresses to WebP, stored in Supabase Storage bucket `menu-photos`
- [ ] Crop tool available with 16:9 and 1:1 ratio presets
- [ ] Multiple photos per item supported (first = primary, shown on POS tile)
- [ ] Photos can be reordered (drag), deleted (with confirmation)
- [ ] Max 5MB per image enforced with clear error message
- [ ] Photo thumbnail appears on item card in grid view

### Modifier Nesting and Pricing Types
- [ ] Modifiers tab shows all assigned modifier groups with drag-to-reorder
- [ ] Each modifier group displays: name, type (Forced/Optional), selection limits (min/max), modifier count
- [ ] "Add Modifier Group" opens group picker showing all existing groups, or "Create New" option
- [ ] Modifier group editor supports 5 pricing types per modifier: Included ($0), Upcharge (+$X.XX), Replacement ($0 swap), Replacement+Upcharge (+$X.XX swap), Quantity-Based (first N free, +$X each additional)
- [ ] Nested sub-modifier groups supported: a modifier can trigger a sub-modifier group (e.g., Size modifier triggers Shot Count sub-group)
- [ ] Forced modifier groups prevent order submission if not completed — POS shows validation error: "Please select [Group] for [Item]"
- [ ] Default modifiers are pre-selected in POS modifier sheet

### Daypart Pricing Engine
- [ ] Daypart configuration page lists all dayparts with name, time range, days, sections
- [ ] New daypart can be created with: name, start time, end time, day-of-week checkboxes, applicable sections (Bar/Dining/All)
- [ ] Menu items can have different prices per daypart (set in Pricing tab of detail editor)
- [ ] When 5:00 PM hits and Happy Hour starts, bar POS terminals automatically show happy hour prices — no manual action required
- [ ] When happy hour ends at 6:00 PM, prices revert to regular pricing automatically
- [ ] Order timestamp determines pricing (guest who ordered at 5:58 PM during happy hour gets happy hour price even if payment is at 6:05 PM)
- [ ] Price priority resolves correctly: Manual Override > Promotion > Daypart > Menu-Specific > Base Price
- [ ] "What prices are active now?" preview button shows current effective prices for all items

### Seasonal Menu Rotation
- [ ] Seasonal manager shows calendar view of seasonal items by date range
- [ ] Seasonal item can be created: select item, set start date, end date, optionally replaces another item
- [ ] When start date arrives, seasonal item auto-appears on POS menu
- [ ] When end date passes, seasonal item auto-deactivates (not deleted — keeps history)
- [ ] "Clone from last year" button copies last year's seasonal items with dates shifted forward 1 year
- [ ] Active, Upcoming, and Expired tabs filter the seasonal items list

### Ingredient-Level 86 Cascade
- [ ] 86 Manager accessible from menu builder toolbar and KDS
- [ ] Selecting an ingredient to 86 shows cascade preview: all menu items affected, with checkboxes pre-checked
- [ ] User can uncheck items to exclude from 86 (e.g., item where ingredient is minor/substitutable)
- [ ] "Apply 86" immediately greys out all selected items on all POS terminals in < 3 seconds
- [ ] Audible notification plays on all connected server devices: "[Ingredient] has been 86'd"
- [ ] If a server has an unsent order containing an 86'd item, they get an alert: "[Item] on [Table] has been 86'd. Remove or substitute."
- [ ] Un-86 workflow: select ingredient > restore > items return to active > instant sync
- [ ] 86 tracking log records: what was 86'd, when, by whom, when restored

### Auto-86 from Inventory
- [ ] Items with quantity tracking show remaining count on POS (e.g., "Only 5 left")
- [ ] When count hits configurable "Running Low" threshold, item shows yellow "LOW" badge on POS and kitchen gets notification
- [ ] When count hits 0, item auto-86's — greys out on POS, notification sent
- [ ] Kitchen manager can manually 86 at any time regardless of count
- [ ] Each order that includes a quantity-tracked item decrements the count by the ordered quantity

### Allergen Tagging
- [ ] Allergens tab shows 14 EU allergens and 4 US allergens as toggle switches with icons
- [ ] Each allergen supports two modes: CONTAINS and MAY CONTAIN
- [ ] Dietary tags displayed as toggle pills: V, VG, GF, DF, Nut-Free, Keto, Paleo, Halal, Kosher, Low-Sodium, Heart-Healthy, Raw
- [ ] If ingredient list contains an allergen-tagged ingredient, item auto-tags with that allergen (with manual override)
- [ ] Allergen badges appear on POS menu tiles and in order panel
- [ ] Cross-contamination warning toggle adds blanket warning
- [ ] When customer has logged allergens (from customer profile), conflicting items show RED warning on POS

### Price Levels (9 Levels)
- [ ] Pricing tab shows grid of 9 price levels: Regular, Happy Hour, Employee, Early Bird, Late Night, Kids, Catering, Online, Custom
- [ ] Each level can have a different price for each menu item
- [ ] POS resolves correct price level based on: daypart + order type + customer type
- [ ] Employee discount automatically applies employee price level when server is logged in as employee
- [ ] Price level names are configurable in settings

### PLU/Barcode Support
- [ ] PLU code field in General tab with uniqueness validation within location
- [ ] Barcode field in General tab
- [ ] USB barcode scanner input triggers item lookup on POS — scanned PLU adds item to order
- [ ] PLU/Barcode visible in CSV export and editable in CSV import

### Quick-Add Special
- [ ] Quick-add button opens minimal form: Name, Price, Category (dropdown), Description (optional)
- [ ] Optional quick fields: Allergens, Quantity Limit, Station Routing, Photo
- [ ] "Tonight Only" and "Until 86'd" availability presets
- [ ] Item appears on POS immediately after save
- [ ] Entire quick-add flow completable in under 30 seconds (measured)

### Menu Import/Export CSV
- [ ] Export button downloads CSV with all item data (name, prices, categories, allergens, PLU, etc.)
- [ ] Import uploads CSV with preview showing all rows and validation status
- [ ] Validation catches: missing required fields (name, price), invalid price format, duplicate PLU codes
- [ ] Row-by-row error display with option to skip errors or fix inline
- [ ] New categories created automatically from CSV if they don't exist
- [ ] Merge mode: match existing items by PLU or Name, update fields
- [ ] Template download provides empty CSV with all columns and one example row


## Workflow Tests

### Workflow 1: Build a Dinner Menu from Scratch
1. Owner opens Menu Builder → sees empty state with "Create your first category" CTA
2. Creates "Appetizers" category → creates "Entrees" category → creates "Desserts" category
3. Drags "Desserts" above "Entrees" → reorder persists → drags back below
4. Clicks "+" in Appetizers → creates "Bruschetta" ($14, assigned to Cold station)
5. Adds photo → crops to 1:1 → photo appears on item card
6. Adds allergens: Contains Gluten, Contains Milk → badges appear on card
7. Adds dietary tags: Vegetarian → green V badge appears
8. Creates modifier group "Add-Ons" (Optional, multi-select): Prosciutto (+$4), Extra Mozzarella (+$2)
9. Creates "Wagyu Burger" in Entrees ($28, Grill station)
10. Adds forced modifier group "Temperature" (MR/Med/MW/WD) — no prices (Included type)
11. Adds optional modifier group "Cheese" with quantity-based pricing: first cheese included, additional +$1.50 each
12. Switches to POS → all items appear in correct categories with correct prices, allergen badges, and photo thumbnails

### Workflow 2: Happy Hour Daypart Pricing
1. Owner opens Daypart Configuration → creates "Happy Hour" (Mon-Fri, 4-6 PM, Bar section only)
2. Opens "House Wine" item → Pricing tab → sets Happy Hour price to $6.00 (regular $11.00)
3. Opens "Well Cocktails" → sets Happy Hour price to $5.00 (regular $9.00)
4. Clicks "What prices are active now?" → verifies correct prices shown based on current time
5. At 4:00 PM Monday, bartender opens POS at bar terminal → House Wine shows $6.00, Well Cocktails shows $5.00
6. At 6:01 PM, bartender refreshes → prices back to $11.00 and $9.00
7. Guest orders House Wine at 5:58 PM → price is $6.00 → pays at 6:03 PM → price remains $6.00 (order timestamp rules)

### Workflow 3: Kitchen Runs Out of Salmon — 86 Cascade
1. Kitchen manager opens 86 Manager
2. Selects ingredient "Salmon"
3. System shows cascade: Grilled Salmon Entree, Salmon Caesar Salad, Salmon Tartare, Kids Salmon Fingers — all pre-checked
4. Kitchen manager unchecks "Seafood Tower" (salmon is minor component, can substitute)
5. Clicks "Apply 86" → confirmation dialog
6. Within 3 seconds: all 4 items grey out on all POS terminals with red "86" badge
7. Server on iPad 2 hears notification sound, sees "[Salmon] has been 86'd" toast
8. Server on iPad 3 has unsent order with Grilled Salmon for Table 7 → gets alert: "Grilled Salmon on Table 7 has been 86'd. Remove or substitute."
9. At 9:30 PM, prep cook brings salmon from backup freezer → kitchen manager un-86s salmon → all 4 items return to active on all terminals

### Workflow 4: Quick-Add Tonight's Special
1. Kitchen manager taps "Quick Add Special" button
2. Enters: Name "Pan-Seared Halibut", Price $38, Category "Entrees"
3. Taps allergen quick-tags: Fish, Dairy
4. Sets quantity: 24 portions (auto-86 at 0)
5. Taps Save → item appears on POS within 1 second
6. Servers see new item with "24 left" indicator
7. After 20 orders, "4 left" shows yellow LOW badge
8. After 24 orders, item auto-86's → grey with red badge → notification sent

### Workflow 5: CSV Import for New Location
1. Owner downloads CSV template from Menu Builder
2. Fills in 45 items with names, prices, categories, allergens, PLU codes
3. Uploads CSV → preview shows 45 rows, all green (valid)
4. Row 23 has duplicate PLU → row highlighted red with error: "PLU 1234 already exists"
5. Owner fixes PLU inline in preview → row turns green
6. Clicks "Import" → 45 items created across 6 auto-created categories
7. Opens POS → all 45 items appear correctly with categories, prices, and allergens

### Workflow 6: Modifier Pricing — Build Your Own Burger
1. Owner creates "Build Your Own Burger" ($16 base)
2. Adds forced modifier group "Patty" (Radio, select 1): Single (Included), Double (+$4 Upcharge), Beyond (+$3 Upcharge)
3. Adds forced modifier group "Temperature" (Radio, select 1): Rare, MR, Med (Default), MW, WD — all Included
4. Adds optional modifier group "Cheese" (Checkbox, max 3): Quantity-Based pricing — first 1 included, additional +$1.50 each. Options: American, Cheddar, Swiss, Pepper Jack, Blue
5. Adds optional modifier group "Premium Add-Ons" (Checkbox): Bacon (+$2.50 Upcharge), Fried Egg (+$2.00 Upcharge), Guac (+$2.50 Upcharge)
6. Server builds order on POS: Double patty (+$4) + Medium + American + Swiss (first free, second +$1.50) + Bacon (+$2.50) = $16 + $4 + $1.50 + $2.50 = $24.00
7. Order panel shows item at $24.00 with all modifiers listed, prices correct to the cent
