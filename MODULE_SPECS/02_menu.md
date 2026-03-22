# Module 02: Menu Management

## Overview

The Menu module manages the restaurant's product catalog: categories, items, modifiers, and pricing. It powers the POS order entry grid, online ordering menus, kiosk displays, and KDS routing. Menu data is the most frequently read data in the system — every order entry screen loads it.

**Who uses it:** Managers and owners edit the menu via the back-office Menu Manager. Servers and cashiers consume the menu on the POS order entry screen. Online ordering and kiosk modules read the menu via API. Kitchen staff see item/modifier names on KDS tickets.

**Why it matters:** The menu defines what can be sold, at what price, with what modifications, routed to which kitchen station, and available during which hours. Incorrect menu data causes wrong orders, wrong pricing, and kitchen confusion.

---

## Database Tables

### Core Tables

- **`menu_categories`** — Category groupings (Appetizers, Entrees, Drinks, Desserts). Fields: `name`, `description`, `sort_order`, `is_active`, `available_start_time`, `available_end_time`, `available_days[]`, `color`, `image_url`, `location_id` (NULL = org-wide template). Soft delete via `deleted_at`.
- **`menu_items`** — Individual menu items. Fields: `name`, `short_name` (for kitchen tickets), `description`, `price` (numeric 10,2), `cost` (food cost), `tax_rate_id`, `is_taxable`, `prep_station`, `prep_time_minutes`, `course`, `is_active`, `is_86d`, `available_start_time`, `available_end_time`, `available_days[]`, `color`, `image_url`, `sort_order`, `nutrition` (jsonb), `allergens[]`, `plu_code`, `barcode`, `location_id`. Soft delete.
- **`modifier_groups`** — Groups of modifiers (Temperature, Sides, Add-ons). Fields: `name`, `min_selections`, `max_selections`, `is_required_prompt`, `sort_order`. Soft delete.
- **`modifiers`** — Individual modifier options. Fields: `name`, `short_name`, `price_adjustment` (numeric 10,2), `is_default`, `is_active`, `sort_order`. Soft delete.
- **`menu_item_modifier_groups`** — Join table linking items to modifier groups. Fields: `menu_item_id`, `modifier_group_id`, `sort_order`.
- **`tax_rates`** — Tax rate definitions referenced by items.

### New Tables (for rebuild)

- **`price_levels`** — Up to 9 pricing tiers per item (from R Power). Fields: `id`, `org_id`, `menu_item_id`, `level_name` (e.g., "Happy Hour", "Lunch", "Catering"), `price` (numeric 10,2), `is_active`, `sort_order`, `created_at`.
- **`daypart_schedules`** — Named daypart windows. Fields: `id`, `org_id`, `location_id`, `name` (e.g., "Breakfast", "Lunch", "Dinner", "Late Night"), `start_time`, `end_time`, `days_of_week[]`, `is_active`, `created_at`.
- **`menu_item_dayparts`** — Join table controlling which items are available during which dayparts. Fields: `menu_item_id`, `daypart_schedule_id`, `price_level_id` (optional — use a specific price during this daypart).

---

## API Routes

### Blueprint: `/api/v1/menu/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/categories` | List categories (filtered by location, daypart) | Yes |
| POST | `/categories` | Create category | Manager+ |
| PUT | `/categories/:id` | Update category | Manager+ |
| DELETE | `/categories/:id` | Soft-delete category | Manager+ |
| PATCH | `/categories/reorder` | Reorder categories (array of `{id, sort_order}`) | Manager+ |
| GET | `/items` | List items (filtered by category, location, active/86d) | Yes |
| POST | `/items` | Create item | Manager+ |
| GET | `/items/:id` | Get item with modifier groups and modifiers | Yes |
| PUT | `/items/:id` | Update item | Manager+ |
| DELETE | `/items/:id` | Soft-delete item | Manager+ |
| PATCH | `/items/:id/86` | Toggle 86 status | Manager+ (or kitchen with permission) |
| PATCH | `/items/reorder` | Reorder items within a category | Manager+ |
| GET | `/modifier-groups` | List modifier groups | Yes |
| POST | `/modifier-groups` | Create modifier group | Manager+ |
| PUT | `/modifier-groups/:id` | Update modifier group | Manager+ |
| DELETE | `/modifier-groups/:id` | Delete modifier group | Manager+ |
| GET | `/modifiers` | List modifiers (filtered by group) | Yes |
| POST | `/modifiers` | Create modifier | Manager+ |
| PUT | `/modifiers/:id` | Update modifier | Manager+ |
| DELETE | `/modifiers/:id` | Delete modifier | Manager+ |
| GET | `/tree` | Full menu tree (categories > items > modifier groups > modifiers) for POS | Yes |
| GET | `/price-levels/:item_id` | Get all price levels for an item | Yes |
| PUT | `/price-levels/:item_id` | Set/update price levels for an item | Manager+ |
| GET | `/dayparts` | List daypart schedules for location | Yes |
| POST | `/dayparts` | Create daypart schedule | Manager+ |
| PUT | `/dayparts/:id` | Update daypart schedule | Manager+ |
| DELETE | `/dayparts/:id` | Delete daypart schedule | Manager+ |

---

## UI Pages / Components

### Menu Manager (Back Office) — `/admin/menu`
- **3-panel layout:**
  - Left panel: Category tree (draggable for reorder)
  - Center panel: Items grid for selected category (draggable for reorder)
  - Right panel: Item detail editor (name, price, description, modifiers, allergens, image, tax, station, course, availability, price levels)
- **Category editor:** Name, color picker, image upload, availability windows, sort order
- **Item editor:** All fields from `menu_items` table, plus:
  - Modifier group assignment (drag from available groups)
  - Price levels editor (up to 9 tiers)
  - Daypart availability toggles
  - Allergen checkboxes (gluten, dairy, nuts, shellfish, soy, eggs, fish, sesame)
  - Dietary tags (vegetarian, vegan, gluten-free, keto)
  - Nutrition info (calories, fat, protein, carbs — optional)
  - Image upload with preview
- **86 toggle:** Red/green indicator on each item, one-click toggle
- **Bulk actions:** Select multiple items for category move, price change, 86 toggle
- **Empty state:** "No menu items yet — create your first category to get started"

### POS Order Entry Grid (component within Orders module)
- Category tabs across the top (color-coded)
- Item grid below (configurable columns: 3, 4, 5, 6)
- 86'd items shown grayed out with strikethrough, not clickable
- Items outside availability window hidden or marked "(Not Available)"
- Quick search bar for item lookup by name or PLU
- Color-coded item buttons matching category or custom item color

### Modifier Selection Slide-Over (component)
- Triggered when adding an item with required modifier groups
- Shows modifier groups in order, with selection rules displayed ("Choose 1", "Choose up to 3")
- Required groups prevent closing until satisfied
- Price adjustments shown next to each modifier
- Default modifiers pre-selected
- "Add to Order" button at bottom with running price total

---

## Business Rules

1. **86 propagation:** When an item is marked 86'd, it immediately propagates to all channels: POS grids, online ordering, kiosk, customer-facing display. The SSE event `item.86d` is broadcast. When un-86'd, the same propagation occurs with `item.available`.

2. **Price levels (R Power feature):** Items can have up to 9 named price levels. The active price is determined by: (a) the current daypart schedule, (b) the order type, or (c) manual selection. Default price (`menu_items.price`) is always level 0. Price levels override the default.

3. **Daypart scheduling:** Categories and items can be restricted to specific dayparts. During breakfast daypart, lunch items are hidden from POS grid and online ordering. Daypart transitions happen automatically based on time and location timezone.

4. **Modifier validation:** When an order item is created, modifier selections must satisfy the `min_selections` and `max_selections` constraints of each required modifier group. The API rejects invalid modifier combinations.

5. **Soft deletes:** Menu items, categories, modifiers, and modifier groups are never hard-deleted. They are soft-deleted (`deleted_at` set). This preserves historical order data integrity — past orders reference these items.

6. **Org-wide vs location-specific:** If `location_id` is NULL, the category/item is an org-wide template visible at all locations. Location-specific entries override the template. This supports centralized menu management for multi-location groups.

7. **Price storage:** Prices stored as `numeric(10,2)` (dollars) in the database. The API layer converts to integer cents for calculations, converting back at the boundary. This prevents floating-point rounding errors.

8. **Sort order:** Categories and items maintain explicit `sort_order` integers. The reorder endpoint accepts an array of `{id, sort_order}` pairs and updates in a single transaction.

9. **Allergen display:** If allergens are set on an item, they display as icons/badges on the POS grid, modifier selection, and online ordering. Allergen info is included in KDS ticket notes.

10. **Cache:** The full menu tree is cached in Redis (DB 3) with a TTL of 5 minutes. Any menu mutation invalidates the cache for that location.

---

## Dependencies

- **01_auth** — All routes require authentication; manager+ for mutations
- **10_settings** — Tax rates referenced by items; location timezone for daypart calculation
- **Supabase** — Data storage
- **Redis DB 3** — Menu cache

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `item.86d` | `events.86` | `{item_id, item_name, location_id}` | Item marked as 86'd |
| `item.available` | `events.86` | `{item_id, item_name, location_id}` | Item un-86'd |
| `menu.updated` | `events.menu` | `{location_id, change_type}` | Any menu change (category/item/modifier CRUD) |
| `menu.cache_invalidated` | Internal | `{location_id}` | Cache cleared after mutation |

### Subscribed Events
| Event | Action |
|-------|--------|
| `order.item_sold` | Update daily_item_metrics (for PMIX reporting) |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `daypart_transition` | Every 1 minute | Check if any location has crossed a daypart boundary; if so, invalidate menu cache and publish `menu.updated` |
| `menu_cache_warmup` | On app start | Pre-load menu tree cache for all active locations |

---

## Acceptance Criteria

### Categories
- [ ] Manager can create a category with name, color, and availability window
- [ ] Manager can edit category name, color, and availability
- [ ] Manager can soft-delete a category (items remain, become uncategorized)
- [ ] Manager can reorder categories via drag-and-drop
- [ ] Categories display in sort_order on POS grid and menu manager

### Items
- [ ] Manager can create an item with name, price, description, category, tax rate, station, and course
- [ ] Manager can edit all item fields
- [ ] Manager can soft-delete an item
- [ ] Manager can reorder items within a category
- [ ] Item creation validates required fields (name, price, category)
- [ ] Item price stored as numeric(10,2) in database

### 86 Toggle
- [ ] Manager or authorized kitchen user can toggle 86 status with one click
- [ ] 86'd items immediately appear grayed/strikethrough on POS grid
- [ ] 86'd items publish SSE event `item.86d` to all connected terminals
- [ ] 86'd items are hidden/marked unavailable on online ordering and kiosk

### Modifiers
- [ ] Manager can create modifier groups with name, min/max selections
- [ ] Manager can add modifiers to groups with name and price adjustment
- [ ] Manager can assign modifier groups to menu items
- [ ] POS modifier slide-over enforces min/max selection rules
- [ ] Required modifier groups block "Add to Order" until satisfied
- [ ] Price adjustments display correctly and update running total

### Price Levels
- [ ] Manager can define up to 9 price levels for an item
- [ ] Active price level is determined by current daypart
- [ ] Default price is used when no price level matches

### Dayparts
- [ ] Manager can create daypart schedules with name, time window, and days
- [ ] Items restricted to a daypart are hidden outside that window
- [ ] Daypart transitions happen automatically based on location timezone

### Allergens & Dietary
- [ ] Manager can set allergens on items (checkboxes)
- [ ] Manager can set dietary tags (vegetarian, vegan, GF, keto)
- [ ] Allergen icons display on POS item buttons
- [ ] Allergen info included in KDS ticket notes

### Performance
- [ ] Full menu tree loads from cache in under 200ms
- [ ] Menu cache invalidates within 5 seconds of any mutation
- [ ] POS grid renders within 1 second of page load
