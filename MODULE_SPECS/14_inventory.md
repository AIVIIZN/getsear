# Module 14: Inventory & Food Cost Management

## Overview

The Inventory module tracks ingredient stock levels, manages vendor relationships, processes purchase orders, depletes inventory via recipe-based sales tracking, monitors waste, and calculates actual vs theoretical food cost. It transforms food cost from a guess into a measurable, manageable number.

**Who uses it:** Kitchen managers do daily counts and receiving. Managers create purchase orders and review food cost reports. The system automatically depletes inventory when menu items sell. Owners review food cost percentage trends.

**Why it matters:** Food cost is typically 28-35% of restaurant revenue. Most independent restaurants don't track it accurately. A 2% improvement on $1M annual revenue = $20K straight to profit. This module provides the visibility to achieve that.

---

## Database Tables

### Existing Tables

- **`inventory_items`** — Ingredient records. Fields: `location_id`, `name`, `sku`, `category`, `unit_of_measure` (oz, lb, each, case, gal), `par_level`, `reorder_point`, `current_quantity`, `unit_cost`, `vendor_id`, `is_active`.
- **`inventory_transactions`** — Stock movement ledger. Fields: `inventory_item_id`, `transaction_type` (receive, waste, transfer, count, sale_deduction), `quantity_change`, `quantity_after`, `unit_cost`, `reference_id` (order_id or PO_id), `notes`, `performed_by`.
- **`recipes`** — Menu item to ingredient mapping. Fields: `menu_item_id`, `inventory_item_id`, `quantity_used`, `unit_of_measure`.
- **`vendors`** — Supplier records. Fields: `name`, `contact_name`, `email`, `phone`, `address` (jsonb), `payment_terms`, `notes`, `is_active`.
- **`purchase_orders`** — PO records. Fields: `location_id`, `vendor_id`, `po_number`, `status` (draft, submitted, partial, received, cancelled), `total_amount`, `ordered_at`, `expected_at`, `received_at`, `notes`, `created_by`.
- **`purchase_order_items`** — PO line items. Fields: `purchase_order_id`, `inventory_item_id`, `quantity_ordered`, `quantity_received`, `unit_cost`, `line_total`.

### New Tables

- **`waste_logs`** — Waste tracking. Fields: `id`, `org_id`, `location_id`, `inventory_item_id`, `quantity`, `unit_of_measure`, `waste_reason` (spoilage, overproduction, dropped, expired, quality, other), `estimated_cost`, `logged_by`, `logged_at`, `notes`, `created_at`.
- **`count_sheets`** — Inventory count sessions. Fields: `id`, `org_id`, `location_id`, `count_date`, `status` (in_progress, completed, approved), `counted_by`, `approved_by`, `approved_at`, `variance_total`, `created_at`.
- **`count_sheet_items`** — Individual item counts. Fields: `id`, `count_sheet_id`, `inventory_item_id`, `expected_quantity`, `counted_quantity`, `variance`, `variance_cost`, `unit_cost`.
- **`food_cost_reports`** — Pre-calculated food cost data. Fields: `id`, `org_id`, `location_id`, `period_start`, `period_end`, `beginning_inventory_value`, `purchases_value`, `ending_inventory_value`, `theoretical_food_cost`, `actual_food_cost`, `variance`, `variance_percentage`, `created_at`.

---

## API Routes

### Blueprint: `/api/v1/inventory/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/items` | List inventory items (filter: category, low-stock, vendor) | Yes |
| POST | `/items` | Create inventory item | Manager+ |
| GET | `/items/:id` | Get inventory item detail with transaction history | Yes |
| PUT | `/items/:id` | Update inventory item | Manager+ |
| DELETE | `/items/:id` | Deactivate inventory item | Manager+ |
| POST | `/items/:id/count` | Record inventory count for an item | Yes |
| POST | `/items/:id/adjust` | Manual stock adjustment | Manager+ |
| GET | `/items/low-stock` | Items below par level or reorder point | Yes |
| GET | `/vendors` | List vendors | Yes |
| POST | `/vendors` | Create vendor | Manager+ |
| GET | `/vendors/:id` | Get vendor detail | Yes |
| PUT | `/vendors/:id` | Update vendor | Manager+ |
| GET | `/purchase-orders` | List purchase orders (filter: status, vendor, date) | Yes |
| POST | `/purchase-orders` | Create purchase order | Manager+ |
| GET | `/purchase-orders/:id` | Get PO detail with items | Yes |
| PUT | `/purchase-orders/:id` | Update PO | Manager+ |
| POST | `/purchase-orders/:id/submit` | Submit PO to vendor | Manager+ |
| POST | `/purchase-orders/:id/receive` | Receive PO items (partial or full) | Yes |
| DELETE | `/purchase-orders/:id` | Cancel PO | Manager+ |
| GET | `/recipes` | List recipes (menu item to ingredient mapping) | Yes |
| POST | `/recipes` | Create recipe | Manager+ |
| PUT | `/recipes/:id` | Update recipe | Manager+ |
| DELETE | `/recipes/:id` | Delete recipe | Manager+ |
| POST | `/waste` | Record waste | Yes |
| GET | `/waste-log` | Waste report (filter: date range, reason, item) | Manager+ |
| POST | `/count-sheets` | Start an inventory count session | Manager+ |
| GET | `/count-sheets/:id` | Get count sheet with items | Yes |
| PUT | `/count-sheets/:id` | Update counts on a sheet | Yes |
| POST | `/count-sheets/:id/complete` | Complete and reconcile count | Manager+ |
| GET | `/food-cost` | Food cost report (actual vs theoretical) | Manager+ |

---

## UI Pages / Components

### Inventory Dashboard — `/admin/inventory`
- **Summary cards:** Total inventory value, items below par, pending POs, today's waste
- **Low stock alerts:** List of items at or below reorder point with vendor and last PO date
- **Quick links:** Count Sheet, New PO, Waste Log, Recipes, Food Cost Report

### Inventory Items — `/admin/inventory/items`
- Searchable table: Name, category, current qty, par level, unit cost, vendor, status
- Color indicators: Green (above par), Yellow (at par), Red (below reorder point)
- Item detail: Full history of transactions (receives, sales, waste, adjustments, counts)
- Bulk import (CSV) for initial setup

### Purchase Orders — `/admin/inventory/purchase-orders`
- PO list with status, vendor, total, order/expected/received dates
- Create PO: Select vendor, add items from inventory catalog, set quantities and costs
- Auto-suggest: Based on items below reorder point for the selected vendor
- Receive PO: Enter received quantities (partial receiving supported), unit cost adjustments
- PO status flow: Draft → Submitted → Partial → Received (or Cancelled)

### Recipe Manager — `/admin/inventory/recipes`
- Menu items list with "Edit Recipe" action
- Recipe editor: Menu item at top, list of ingredients with quantity and unit
- Cost preview: Shows calculated plate cost based on ingredient unit costs
- Margin preview: Shows food cost % for the item at current price

### Waste Log — `/admin/inventory/waste`
- Date range filtered table: Item, quantity, reason, cost, logged by, date
- Quick-log form: Select item, enter quantity, select reason, add notes
- Waste summary chart: By reason category, by item, trending over time

### Count Sheet — `/admin/inventory/count`
- Start new count: Select items to count (all, by category, by storage area)
- Count entry: Table with item name, expected qty, count entry field, variance display
- Submit count: Review variances, approve adjustments
- Count history: Previous count sheets with variance totals

### Food Cost Report — `/admin/inventory/food-cost`
- Period selector (week, month, custom)
- **Actual food cost:** Beginning inventory + purchases - ending inventory
- **Theoretical food cost:** Sum of (items sold x recipe cost)
- **Variance:** Actual - theoretical (represents waste, theft, portioning errors)
- Trend chart over multiple periods
- Breakdown by category

---

## Business Rules

1. **Recipe-based depletion:** When a menu item sells (order closed), the system depletes ingredient quantities based on the recipe. If item "Cheeseburger" uses 8oz ground beef + 1 bun + 1 slice cheese, selling one burger decrements each ingredient. This happens asynchronously via Celery task.

2. **Par levels and reorder points:** `par_level` = ideal quantity to have on hand. `reorder_point` = quantity at which to reorder. When `current_quantity <= reorder_point`, the item appears on the low-stock alert list.

3. **Purchase order flow:** Draft → (add items) → Submit → (vendor ships) → Receive (partial or full). Receiving updates `current_quantity` on inventory items and creates `inventory_transactions` of type `receive`.

4. **Partial receiving:** POs can be partially received. `quantity_received` tracks what's been received per line item. When all items are fully received, PO status moves to `received`.

5. **Waste tracking:** All waste must be logged with a reason category. Waste creates negative `inventory_transactions`. Waste cost is estimated from unit cost. This data feeds the actual vs theoretical variance report.

6. **Count reconciliation:** Inventory counts compare `expected_quantity` (system's tracked quantity) vs `counted_quantity` (physical count). Variances are recorded. On count approval, `current_quantity` is adjusted to match the physical count. This is the only way to correct accumulated drift.

7. **Food cost calculation:**
   - **Theoretical:** Sum of (quantity_sold x recipe_cost) for all items in the period
   - **Actual:** Beginning inventory value + purchases - ending inventory value
   - **Variance:** Actual - theoretical. Positive variance = more cost than expected (waste, theft, portioning). Negative = less (indicates recipe inaccuracy).

8. **Unit cost tracking:** Unit costs are tracked per receive, not averaged. However, `current_quantity` uses weighted average cost for valuation. Receiving at a different cost updates the weighted average.

9. **Automatic PO suggestions:** The system can auto-generate a draft PO for a vendor based on all items from that vendor below their reorder point, with quantities to reach par level.

10. **Cross-module integration:** Inventory depletion is triggered by the Orders module. Food cost data feeds the Reports module. Low-stock can trigger 86ing via the Menu module (configurable: auto-86 when quantity reaches 0).

---

## Dependencies

- **01_auth** — Authentication
- **02_menu** — Menu items for recipe mapping, 86 auto-trigger
- **03_orders** — Order close triggers recipe depletion
- **09_reports** — Food cost data feeds report module
- **10_settings** — Location config

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `inventory.low_stock` | `events.inventory` | `{item_id, item_name, current_qty, reorder_point}` | Item drops below reorder point |
| `inventory.out_of_stock` | `events.inventory` + `events.86` | `{item_id, item_name}` | Item reaches 0 (auto-86 if configured) |
| `inventory.received` | `events.inventory` | `{po_id, items_received}` | PO items received |
| `inventory.counted` | `events.inventory` | `{count_sheet_id, variance_total}` | Count sheet completed |

### Subscribed Events
| Event | Action |
|-------|--------|
| `order.closed` | Trigger recipe-based inventory depletion |
| `order.item_voided` | Reverse recipe depletion for voided item |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `inventory_depletion` | On-demand (Celery task) | Deplete inventory per recipe when order closes |
| `low_stock_check` | Every 30 minutes | Check all items against par/reorder levels, publish alerts |
| `food_cost_calculation` | Daily at 3 AM | Calculate daily food cost actual vs theoretical |
| `auto_po_suggestion` | Daily at 6 AM | Generate draft POs for items below reorder point |
| `auto_86_check` | Every 15 minutes | Auto-86 items with 0 quantity (if configured) |

---

## Acceptance Criteria

### Inventory Items
- [ ] Manager can create inventory items with name, unit, par level, vendor
- [ ] Current quantity updates on receive, waste, count, and sale depletion
- [ ] Low-stock items highlighted when below reorder point
- [ ] Item detail shows full transaction history

### Purchase Orders
- [ ] Manager can create PO, add items, submit to vendor
- [ ] Auto-suggest populates items below reorder point for selected vendor
- [ ] Partial receiving supported (track received vs ordered per item)
- [ ] Receiving updates inventory quantities and creates transactions

### Recipes
- [ ] Manager can define recipe for a menu item (ingredients + quantities)
- [ ] Recipe cost calculated from ingredient unit costs
- [ ] Selling a menu item depletes ingredients per recipe (async)

### Waste Tracking
- [ ] Staff can log waste with item, quantity, reason, and notes
- [ ] Waste creates negative inventory transaction
- [ ] Waste log filterable by date, reason, item

### Count Sheets
- [ ] Manager can start a count session (select items to count)
- [ ] Staff can enter counted quantities
- [ ] Variance (expected vs counted) calculated and displayed
- [ ] Completing a count adjusts current_quantity to match physical count

### Food Cost Report
- [ ] Theoretical food cost calculated from sales x recipe costs
- [ ] Actual food cost calculated from beginning + purchases - ending inventory
- [ ] Variance displayed (actual - theoretical)
- [ ] Trend chart shows food cost % over time

### Alerts
- [ ] Low-stock alert published when item drops below reorder point
- [ ] Out-of-stock triggers auto-86 (if configured)
