# Module 09: Reporting & Analytics

## Overview

The Reports module provides business intelligence for restaurant operators. It transforms raw transaction data into actionable insights through pre-aggregated daily metrics, real-time KPI dashboards, and exportable reports. It covers sales, labor, menu engineering (PMIX), server performance, payment mix, tax liability, speed of service, and franchise royalty calculations.

**Who uses it:** Owners review daily/weekly/monthly performance. Managers monitor real-time KPIs and labor costs. Accountants export tax and payment reports. Franchise operators review consolidated cross-location data.

**Why it matters:** Data-driven decisions separate profitable restaurants from struggling ones. The top customer complaint about POS reporting is insufficient customization. Sear's reporting must provide granular, actionable data — not just revenue totals.

---

## Database Tables

- **`daily_metrics`** — Pre-aggregated daily data. Fields: `location_id`, `metric_date`, sales (`total_revenue`, `net_revenue`, `order_count`, `average_check`, `covers`, `revenue_per_cover`), by-type (`dine_in_revenue`, `takeout_revenue`, `delivery_revenue`, `online_revenue`), payment mix (`cash_total`, `card_total`, `gift_card_total`), labor (`labor_cost`, `labor_hours`, `labor_percentage`), food cost (`food_cost`, `food_cost_percentage`), adjustments (`discount_total`, `comp_total`, `void_total`, `refund_total`), tips (`tip_total`), timing (`avg_ticket_time_seconds`, `avg_table_turn_minutes`), hourly breakdown (`hourly_revenue`, `hourly_covers` as jsonb).
- **`daily_item_metrics`** — Per-item daily data for PMIX. Fields: `location_id`, `metric_date`, `menu_item_id`, `quantity_sold`, `gross_revenue`, `food_cost`, `margin_percentage`.
- **`orders`** — Source for sales data.
- **`payments`** — Source for payment and tip data.
- **`time_entries`** — Source for labor data.
- **`order_items`** — Source for product mix data.
- **`order_discounts`** — Source for discount/comp/void data.
- **`settlement_batches`** — Source for reconciliation data.

### New Tables (for rebuild)

- **`report_exports`** — Track export jobs. Fields: `id`, `org_id`, `report_type`, `parameters` (jsonb), `format` (csv, pdf), `status` (pending, generating, ready, failed, expired), `file_url`, `requested_by`, `created_at`, `expires_at`.
- **`saved_reports`** — User-saved report configurations. Fields: `id`, `org_id`, `user_id`, `name`, `report_type`, `parameters` (jsonb), `is_shared`, `created_at`.
- **`franchise_royalties`** — Royalty calculations (R Power feature). Fields: `id`, `org_id`, `location_id`, `period_start`, `period_end`, `gross_sales`, `net_sales`, `royalty_percentage`, `royalty_amount`, `marketing_fund_percentage`, `marketing_fund_amount`, `total_due`, `status` (calculated, invoiced, paid), `created_at`.

---

## API Routes

### Blueprint: `/api/v1/reports/`

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/sales/daily` | Daily sales summary | Manager+ |
| GET | `/sales/weekly` | Weekly sales summary | Manager+ |
| GET | `/sales/monthly` | Monthly sales summary | Manager+ |
| GET | `/sales/hourly` | Hourly breakdown (heatmap data) | Manager+ |
| GET | `/sales/custom` | Custom date range sales | Manager+ |
| GET | `/product-mix` | Product mix (PMIX) report | Manager+ |
| GET | `/category-mix` | Category sales breakdown | Manager+ |
| GET | `/server-performance` | Sales and metrics by server | Manager+ |
| GET | `/labor` | Labor cost report | Manager+ |
| GET | `/discount-summary` | Discount/comp/void summary | Manager+ |
| GET | `/payment-summary` | Payment method breakdown | Manager+ |
| GET | `/tax-report` | Tax liability report by rate | Manager+ |
| GET | `/speed-of-service` | Ticket times, table turns, throughput | Manager+ |
| GET | `/cash-management` | Cash drawer activity and reconciliation | Manager+ |
| GET | `/franchise/royalties` | Franchise royalty report | Owner+ |
| GET | `/franchise/comparison` | Location comparison analytics | Owner+ |
| POST | `/export` | Export report as CSV/PDF (returns job ID) | Manager+ |
| GET | `/export/:job_id` | Check export status / download file | Manager+ |
| GET | `/dashboard/kpis` | Real-time KPI dashboard data | Manager+ |
| GET | `/saved` | List user's saved report configurations | Manager+ |
| POST | `/saved` | Save a report configuration | Manager+ |
| DELETE | `/saved/:id` | Delete saved report | Manager+ |

---

## UI Pages / Components

### Reports Dashboard — `/reports`
- **KPI cards (top row):** Today's revenue, order count, average check, covers, labor %. Each shows value + trend arrow vs same day last week.
- **Revenue chart:** Line/bar chart showing last 7 days or 30 days (toggle)
- **Hourly heatmap:** Revenue by hour (rows) by day-of-week (columns), color intensity
- **Quick links:** Tiles linking to each sub-report (Sales, Labor, PMIX, Server, Voids, Cash, Speed)
- **Date range picker:** Shared component for all reports
- **Location selector:** For multi-location orgs, dropdown to select single or all locations

### Sales Report — `/reports/sales`
- Date range selector: Today, Yesterday, This Week, Last Week, This Month, Custom
- Summary cards: Gross Sales, Net Sales, Discounts, Tax, Tips, Order Count, Avg Check
- Breakdown by order type (dine-in, takeout, delivery, online, kiosk)
- Revenue trend chart
- Hourly breakdown table/chart
- Comparison to prior period (absolute and percentage change)

### Product Mix (PMIX) — `/reports/product-mix`
- Table: Item name, category, quantity sold, gross revenue, food cost, profit margin %, contribution to total sales %
- Sort by any column
- **Menu engineering matrix (Boston Matrix):**
  - Stars: High popularity + high profit
  - Plowhorses: High popularity + low profit
  - Puzzles: Low popularity + high profit
  - Dogs: Low popularity + low profit
- Filter by category, date range
- Identify items to promote, reprice, or remove

### Server Performance — `/reports/server-performance`
- Table: Server name, shifts worked, hours, sales, avg check, covers, tips, upsell rate
- Compare servers on same metrics
- Filter by date range

### Labor Report — `/reports/labor`
- Labor cost vs revenue (percentage)
- Hours by role breakdown
- Overtime hours and cost
- Labor cost by day of week
- Staffing efficiency metrics

### Voids/Comps/Discounts — `/reports/voids`
- Void summary: Count, total value, by reason, by user
- Comp summary: Count, total value, by reason, by user
- Discount summary: Count, total value, by discount name
- Drill-down to individual transactions

### Cash Management — `/reports/cash`
- Cash drawer open/close history
- Paid-in/paid-out log
- Over/short history
- Cash sales vs drawer count reconciliation

### Speed of Service — `/reports/speed`
- Avg ticket time by station
- Avg table turn time
- Avg time per order phase (draft→sent, sent→ready, ready→served, served→closed)
- Trend over time
- Outlier identification

### Export
- Export button on every report page
- Format selection: CSV, PDF
- Async generation for large reports
- Download ready notification
- Export history with re-download

---

## Business Rules

1. **Pre-aggregation:** Raw transaction data is aggregated into `daily_metrics` and `daily_item_metrics` by a nightly Celery job. Dashboard queries read pre-aggregated data for speed. Real-time KPIs query raw data only for the current day.

2. **Timezone handling:** All aggregation respects the location's timezone. A "day" in `daily_metrics` corresponds to midnight-to-midnight in the location's timezone, even though timestamps are stored in UTC.

3. **Net revenue calculation:** `net_revenue = total_revenue - discount_total - comp_total - void_total - refund_total`. This is the true revenue after all adjustments.

4. **Labor percentage:** `labor_percentage = (labor_cost / net_revenue) * 100`. Industry target: 25-35%.

5. **Food cost percentage:** `food_cost_percentage = (food_cost / net_revenue) * 100`. Industry target: 28-35%. Requires Inventory module for accurate food cost data.

6. **PMIX / Menu Engineering:** Each item is classified by relative popularity (% of total items sold) and relative profitability (margin vs average margin). This produces the Stars/Plowhorses/Puzzles/Dogs matrix.

7. **Server performance metrics:**
   - Sales: Total sales attributed to server
   - Avg check: Total sales / order count
   - Covers: Total guests served
   - Upsell rate: (Items with modifiers / total items) or (avg items per check)
   - Tips: Total tips received

8. **Export limits:** CSV exports are limited to 100,000 rows. PDF exports are limited to date ranges of 1 year. Larger exports use async job processing.

9. **Franchise royalty calculation (R Power feature):** Royalty = `net_sales * royalty_percentage`. Marketing fund = `net_sales * marketing_fund_percentage`. Calculated per location per period. Period is configurable (weekly, biweekly, monthly).

10. **Location comparison:** Cross-location reports show key metrics side-by-side: revenue, labor %, food cost %, avg check, covers, speed of service. Rankings by each metric.

11. **Data retention:** Pre-aggregated metrics are retained indefinitely. Raw order data follows configurable retention (default: 7 years for financial data per IRS requirements).

12. **Report access control:** Reports are gated by role. Servers see only their own performance. Managers see location-level reports. Owners see org-wide and cross-location reports.

---

## Dependencies

- **01_auth** — Role-based report access
- **03_orders** — Order data (sales, items, timing)
- **04_payments** — Payment and tip data
- **07_staff** — Labor hours and costs
- **14_inventory** — (Optional) Food cost data for margin calculations
- **20_franchise** — (Optional) Royalty config for franchise reports

---

## Real-Time Events

### Published Events
| Event | Channel | Payload | Trigger |
|-------|---------|---------|---------|
| `report.export_ready` | `events.reports` | `{export_id, user_id, file_url}` | Export generation complete |
| `metrics.daily_aggregated` | Internal | `{location_id, date}` | Nightly aggregation complete |

### Subscribed Events
| Event | Action |
|-------|--------|
| `order.closed` | Update today's running KPIs (real-time dashboard) |
| `payment.completed` | Update today's payment mix data |
| `settlement.closed` | Trigger reconciliation report data update |

---

## Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `daily_metrics_aggregation` | Daily at 3 AM (per location TZ) | Aggregate previous day's data into `daily_metrics` and `daily_item_metrics` |
| `weekly_summary_email` | Monday at 7 AM | Send weekly performance summary to owners/managers via SendGrid |
| `report_export_cleanup` | Daily at 4 AM | Delete expired export files (>7 days old) |
| `franchise_royalty_calc` | Per configured period | Calculate royalties for franchise locations |
| `kpi_cache_refresh` | Every 5 minutes | Refresh cached KPI data for dashboard |

---

## Acceptance Criteria

### Dashboard
- [ ] Dashboard shows today's revenue, order count, avg check, covers, labor %
- [ ] Each KPI shows trend comparison to same day last week
- [ ] Revenue chart shows last 7/30 days
- [ ] Hourly heatmap renders with color intensity
- [ ] Dashboard loads in under 2 seconds

### Sales Reports
- [ ] Daily/weekly/monthly sales reports show correct totals
- [ ] Custom date range works with arbitrary dates
- [ ] Breakdown by order type shows correct amounts
- [ ] Comparison to prior period shows absolute and percentage change
- [ ] Hourly breakdown shows revenue by hour

### Product Mix
- [ ] PMIX report lists all items with qty sold, revenue, cost, margin
- [ ] Menu engineering matrix classifies items correctly
- [ ] Filter by category works
- [ ] Sort by any column works

### Server Performance
- [ ] Report shows sales, avg check, covers, tips per server
- [ ] Date range filter works
- [ ] Only managers+ can see all servers; servers see only themselves

### Labor
- [ ] Labor cost vs revenue percentage calculated correctly
- [ ] Overtime hours and cost displayed
- [ ] Hours by role breakdown accurate

### Export
- [ ] CSV export generates correct file for any report
- [ ] PDF export generates formatted report
- [ ] Large exports use async job with progress notification
- [ ] Export files expire after 7 days

### Franchise
- [ ] Royalty calculation uses configured percentage
- [ ] Location comparison shows side-by-side metrics
- [ ] Franchise reports accessible to owner+ only

### Performance
- [ ] Pre-aggregated queries return in under 500ms
- [ ] Real-time KPI queries for current day return in under 1 second
- [ ] Export generation for 30-day report completes in under 30 seconds
