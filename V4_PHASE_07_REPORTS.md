# Sear POS v4 — Phase 7: Reports Production Depth (MASTER_TEMPLATE Part 1)

Paste this ENTIRE file + MASTER_TEMPLATE.md into a fresh Claude Code session.
Then say: "Follow the MASTER_TEMPLATE. Start at Phase 1."

---

## 1.1 What is this?

A production-depth rebuild of the Sear POS reporting system. The current state has 13 API route files under `/api/reports/` and 5 page files under `/(backoffice)/reports/`, but they return mock data from `src/lib/reports/mock-data.ts` and display basic Recharts visualizations with no real database queries. None of the reports query live order, payment, or labor data. There is no PDF export, no email delivery, no background aggregation, and no real-time dashboard.

This phase replaces every mock report with live Supabase queries, adds 6 new production reports (cash, speed-of-service, food cost, void/comp/discount, P&L, 13-week trend), builds an owner mobile dashboard, wires up auto-email daily summaries via SendGrid, adds PDF export for every report, and creates a BullMQ daily metrics aggregation job that runs at 4 AM.

**Read these files BEFORE planning:**
- CLAUDE.md — project config, tech stack, all 21 modules
- SCHEMA.md — database tables (especially: orders, order_items, payments, time_entries, inventory_counts, menu_items, voids, comps, discounts)
- API_SPEC.md — existing report route contracts
- BUSINESS_RULES.md — operational logic for voids, comps, discounts, labor
- SEAR_POS_ARCHITECTURE.md — sections 4 (Restaurant Operations Deep Dive: the owner's daily report needs), 9 (Integration Ecosystem: accounting/reporting)
- UI_DESIGN.md — design system tokens
- V4_PHASE_OUTLINE.md — phase 7 scope

---

## 1.2 Tech stack

Already built. Do not change:
- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- **Components:** shadcn/ui (customized per UI_DESIGN.md)
- **State:** Zustand v5 + Immer
- **Database:** Supabase (PostgreSQL) — live queries, no mock data
- **Charts:** Recharts (already installed)
- **PDF Generation:** @react-pdf/renderer (new dependency)
- **Email:** SendGrid (@sendgrid/mail — new dependency)
- **Background Jobs:** BullMQ v5 + Redis (already configured)
- **Hosting:** GCP VM (standalone Next.js + PM2 + Nginx)

---

## 1.3 User roles

Reports are gated by role:
- **Owner** (Marcus Rivera, demo@getsear.com / demo1234): All reports, all locations, mobile dashboard, receives daily email
- **Manager**: All reports for their location, can export PDF, does NOT receive auto-email unless configured
- **Server/Bartender**: Can view their own server checkout report only (sales, tips, cash owed)
- **Kitchen**: No report access

---

## 1.4 Pages and features

### Page: Reports Hub (`/reports`)
- Who: Owner, Manager
- What: Grid of report cards — each card shows report name, icon, one-line description, and a sparkline preview of the last 7 days. Cards are grouped into sections: Daily Operations, Financial, Staff Performance, Trends.
- Actions: Click any card to navigate to that report's full page. "Email All Reports" button in header. "Export All as PDF" button.
- Empty state: "No sales data yet — reports will populate after your first day of orders."

### Page: Daily Sales Report (`/reports/sales`)
- Who: Owner, Manager
- What: Replaces current mock. Queries live `orders`, `order_items`, `payments` tables. Shows: total revenue, total orders, average check size, covers, revenue by category (food/beverage/retail), revenue by order type (dine-in/takeout/delivery/bar), revenue by hour (bar chart), payment method breakdown (pie chart), comparison to same day last week and same day last year.
- Controls: Date picker (single day, default today), location selector (multi-location owners)
- Actions: Export PDF, Email report, Print

### Page: Cash Report (`/reports/cash`)
- Who: Owner, Manager
- What: NEW REPORT. Shows cash drawer reconciliation by employee per shift. Opening count, cash sales received, cash payouts, expected closing balance, actual closing count, over/short amount. Color-coded: green if within $5, yellow if $5-$20, red if >$20 discrepancy.
- Data source: `cash_drawer_counts` table (opening/closing), `payments` table (cash payments), `cash_payouts` table
- Controls: Date picker, shift selector (AM/PM/all), employee filter
- Summary row: Total across all drawers for the day
- Actions: Export PDF, drill into individual drawer count details

### Page: Speed of Service Report (`/reports/speed-of-service`)
- Who: Owner, Manager
- What: NEW REPORT. Measures time from order creation to KDS bump (kitchen time) and from KDS bump to order served/closed (expo time). Shows: average ticket time by KDS station, average ticket time by daypart (breakfast/lunch/dinner/late night), average ticket time by day of week, outlier tickets (>2x average), trend chart (rolling 7-day average).
- Data source: `orders.created_at`, `kds_tickets.bumped_at`, `kds_tickets.created_at`, station assignments
- Controls: Date range picker (default: last 7 days), station filter, daypart filter
- Visualization: Heatmap grid (station x daypart), line chart (daily average over time), histogram of ticket times
- Actions: Export PDF

### Page: Food Cost Report (`/reports/food-cost`)
- Who: Owner, Manager
- What: NEW REPORT. Theoretical food cost (recipe cost x items sold) vs actual food cost (inventory purchased - inventory remaining). Shows variance by menu item, variance by category, overall food cost percentage. Flags items where actual cost exceeds theoretical by >10%.
- Data source: `menu_items.cost`, `order_items` (quantity sold), `inventory_counts`, `purchase_orders`
- Controls: Date range picker (default: current month), category filter
- Visualization: Bar chart comparing theoretical vs actual by category, table of items sorted by highest variance
- Actions: Export PDF

### Page: Void/Comp/Discount Report (`/reports/voids-comps`)
- Who: Owner, Manager
- What: NEW REPORT. Patterns and totals for voids, comps, and discounts. Shows: total dollar amount voided/comped/discounted, count by type, breakdown by employee (who is voiding/comping the most?), breakdown by reason code, breakdown by time of day, comparison to prior period. Flags employees with void rates >2x average.
- Data source: `order_items` (voided/comped flags), `discounts` applied, `void_reasons`, `comp_reasons`, linked employee IDs
- Controls: Date range picker (default: last 7 days), employee filter, reason filter
- Visualization: Stacked bar chart by day (void/comp/discount), employee comparison table, reason code pie chart
- Actions: Export PDF, drill into individual transactions

### Page: P&L Summary (`/reports/pnl`)
- Who: Owner only
- What: NEW REPORT. Monthly profit & loss statement auto-calculated from POS data. Revenue (food sales + beverage sales + retail + online orders + catering - refunds). Cost of goods (theoretical food cost from recipe costing). Labor cost (hours x rates from time entries). Gross profit. Net margin. Comparison to previous month and same month last year.
- Data source: Aggregated from `orders`, `payments`, `time_entries`, `menu_items.cost`, `order_items`
- Controls: Month picker (default: current month), location selector
- Visualization: Waterfall chart (revenue → COGS → labor → gross profit), trend line for 12-month P&L history
- Actions: Export PDF, email to owner

### Page: 13-Week Trend Analysis (`/reports/trends`)
- Who: Owner, Manager
- What: NEW REPORT. Rolling 13-week comparison of key metrics: total revenue, average check, covers, labor percentage, food cost percentage, void/comp percentage. Each week shows actual vs. 13-week average. Highlights weeks that deviate >10% from the rolling average.
- Data source: Pre-aggregated `daily_metrics` table (populated by BullMQ job)
- Controls: Metric selector (dropdown), location selector
- Visualization: Multi-line chart with shaded average band, data table below with week-over-week change arrows
- Actions: Export PDF

### Page: Owner Mobile Dashboard (`/reports/dashboard`)
- Who: Owner
- What: NEW PAGE. Designed for phone viewport (375px wide). Shows 5 things (per SEAR_POS_ARCHITECTURE.md owner requirements): (1) Today's total revenue — one big number, (2) Today vs same day last week — up/down arrow with percentage, (3) Current labor cost percentage — red if >30%, (4) Active alerts — voids >$50, cash discrepancy, overtime, failed transactions, (5) Open checks count and total value.
- Data source: Live queries against `orders`, `payments`, `time_entries`, open checks
- Auto-refresh: Polls every 60 seconds (or uses Supabase Realtime subscription)
- Design: Large typography, thumb-friendly tap targets, dark mode option for nighttime viewing
- Actions: Tap any metric to drill into the full report

### Page: Existing Reports (UPGRADED)

**Labor Report (`/reports/labor`)** — Already exists, upgrade to live queries. Show: total labor hours, total labor cost, labor cost as % of revenue, breakdown by role, overtime hours and cost, break compliance (who didn't take their break).

**Product Mix Report (`/reports/product-mix`)** — Already exists, upgrade to live queries. Show: every item sold with quantity, revenue, % of total, food cost %, contribution margin. Sortable by any column. Highlight top 10 and bottom 10.

**Server Performance Report (`/reports/server-performance`)** — Already exists, upgrade to live queries. Show: per-server sales total, average check, covers, tips (cash + card), upsell rate (add-ons/mods as % of base), speed (average order-to-close time).

**Payment Summary (`/reports/payments`)** — Already exists, upgrade to live queries. Show: total by payment method (cash, card, gift card, house account), tip totals, refund totals, Valor settlement reconciliation.

**Tax Report (`/reports/tax`)** — Already exists, upgrade to live queries. Show: taxable vs non-taxable sales, tax collected by jurisdiction (city/county/state), ready for accountant handoff.

### Background: Daily Metrics Aggregation Job
- What: BullMQ job that runs at 4:00 AM local time every day. Queries all orders, payments, labor, voids/comps/discounts for the previous business day. Writes aggregated row to `daily_metrics` table. This table powers the 13-week trend report and prevents expensive historical queries.
- Columns: `location_id`, `business_date`, `total_revenue`, `total_orders`, `avg_check`, `covers`, `food_revenue`, `beverage_revenue`, `labor_hours`, `labor_cost`, `labor_pct`, `food_cost_theoretical`, `food_cost_actual`, `food_cost_pct`, `void_total`, `comp_total`, `discount_total`, `cash_over_short`, `avg_ticket_time_seconds`

### Background: Auto-Email Daily Summary
- What: Triggered by the daily metrics aggregation job. After aggregation completes, renders an HTML email with the daily summary (same data as the daily sales report) and sends via SendGrid to all users with `receive_daily_report = true` in their profile.
- Email template: Branded Sear header, key metrics in large text, comparison to last week, mini bar chart (hourly sales), link to full report in the app.

### PDF Export Engine
- What: Shared service that takes any report's data + a report template and generates a branded PDF. Sear logo at top, report title, date range, location name, data tables and charts rendered as static images. Uses @react-pdf/renderer on the server side.
- Every report page has an "Export PDF" button that triggers this.

---

## 1.5 Look and feel

Already defined in UI_DESIGN.md. Report-specific additions:
- **Mode:** Light mode only (professional enterprise reports)
- **Charts:** Use Sear brand palette — primary ember orange (#F06B18) for the main series, warm grays for secondary data, red for negative/alerts, green for positive comparisons
- **Tables:** Zebra-striped with warm gray alternating rows, sticky headers, sortable columns with arrow indicators
- **KPI cards:** Large number (32-40px font), label below (14px muted), trend arrow with percentage, subtle colored left border indicating health (green/yellow/red)
- **Mobile dashboard:** Larger touch targets (56px+), card-based layout, swipeable sections
- **PDF output:** Clean, print-optimized — no gradients, no shadows, black-on-white with ember accent for headers
- **Loading states:** Skeleton loaders for every chart and table, never blank white
- **Empty states:** Illustration + "No data for this period" + suggestion to change date range

---

## 1.6 Business rules and special behavior

1. **Business day cutoff:** The "day" for reporting purposes ends at the close-of-day time configured in location settings (default 4:00 AM). Orders at 1:00 AM Saturday count as Friday's business.
2. **Labor cost calculation:** Sum of (hours_worked x hourly_rate) for all time_entries in the period. Overtime hours (>40/week or >8/day, configurable) calculated at 1.5x rate.
3. **Food cost percentage:** (theoretical food cost / food revenue) x 100. Industry target: 28-35%. Flag anything over 35% in red.
4. **Void rate threshold:** If an employee's void dollar amount exceeds 2x the location average, flag them in the void/comp report. This is an employee theft indicator.
5. **Cash over/short tolerance:** Within $5 is green (normal), $5-$20 is yellow (investigate), >$20 is red (requires manager follow-up).
6. **13-week rolling average:** Always uses the most recent 13 completed weeks. Current (incomplete) week is excluded from the average but shown as a data point.
7. **Multi-location:** Owner sees a location selector dropdown. "All Locations" shows aggregated totals. Individual location shows that location's data. Manager role is locked to their assigned location.
8. **Auto-email timing:** Daily summary email sends 30 minutes after the metrics aggregation job completes (approximately 4:30 AM). Uses the location's configured timezone.
9. **PDF branding:** Every PDF includes Sear logo, location name and address, date range, page numbers, and "Generated by Sear POS" footer.
10. **Real-time dashboard:** The owner mobile dashboard queries live data, NOT the aggregated daily_metrics table. It must reflect orders and payments that happened in the last 60 seconds.

---

## 1.7 Integrations

- **SendGrid:** @sendgrid/mail for daily summary email delivery. Requires `SENDGRID_API_KEY` env var. Use dynamic templates with Handlebars for the email body.
- **BullMQ + Redis:** Already configured. Add new `daily-metrics-aggregation` queue and `daily-email-summary` queue. Cron trigger at 4:00 AM using BullMQ's repeat option.
- **Supabase:** All report data comes from live Supabase queries. No mock data. Use RPC functions for complex aggregations (e.g., food cost variance, speed of service histograms).
- **@react-pdf/renderer:** Server-side PDF generation. New dependency.

---

## 1.8 Modules and features planned but not for this phase

- QuickBooks journal entry export (Phase 8: Integrations)
- Franchise consolidated reports across all franchisees (Phase 11: Optional Modules)
- AI-powered anomaly detection on reports (future)
- Scheduled report delivery (weekly/monthly auto-email) — only daily is in scope
- Custom report builder (drag-and-drop report creation) — future

---

## 1.9 Anything else

**Existing files to modify (not replace from scratch):**
- `src/app/(backoffice)/reports/page.tsx` — Upgrade to reports hub with card grid
- `src/app/(backoffice)/reports/sales/page.tsx` — Replace mock with live queries
- `src/app/(backoffice)/reports/labor/page.tsx` — Replace mock with live queries
- `src/app/(backoffice)/reports/product-mix/page.tsx` — Replace mock with live queries
- `src/app/(backoffice)/reports/server-performance/page.tsx` — Replace mock with live queries
- `src/app/(backoffice)/reports/layout.tsx` — Add subnav for all report pages
- `src/app/api/reports/daily/route.ts` — Replace mock with live Supabase query
- `src/app/api/reports/labor/route.ts` — Replace mock with live query
- `src/app/api/reports/pmix/route.ts` — Replace mock with live query
- `src/app/api/reports/server-performance/route.ts` — Replace mock with live query
- `src/app/api/reports/payments/route.ts` — Replace mock with live query
- `src/app/api/reports/tax/route.ts` — Replace mock with live query
- `src/app/api/reports/discounts/route.ts` — Replace mock with live query
- `src/app/api/reports/export/route.ts` — Wire to real PDF engine
- `src/components/reports/KPICard.tsx` — Upgrade with trend arrows, color coding
- `src/components/reports/DateRangePicker.tsx` — Keep, enhance with presets
- `src/components/reports/HourlySalesChart.tsx` — Replace mock data source
- `src/components/reports/CategoryMixChart.tsx` — Replace mock data source
- `src/components/reports/TopItemsChart.tsx` — Replace mock data source
- `src/components/reports/PaymentMixChart.tsx` — Replace mock data source
- `src/lib/reports/mock-data.ts` — DELETE this file entirely after migration

**New files to create:**
- `src/app/(backoffice)/reports/cash/page.tsx` — Cash report page
- `src/app/(backoffice)/reports/speed-of-service/page.tsx` — Speed of service page
- `src/app/(backoffice)/reports/food-cost/page.tsx` — Food cost report page
- `src/app/(backoffice)/reports/voids-comps/page.tsx` — Void/comp/discount page
- `src/app/(backoffice)/reports/pnl/page.tsx` — P&L summary page
- `src/app/(backoffice)/reports/trends/page.tsx` — 13-week trend page
- `src/app/(backoffice)/reports/dashboard/page.tsx` — Owner mobile dashboard
- `src/app/api/reports/cash/route.ts` — Cash report API
- `src/app/api/reports/speed-of-service/route.ts` — Speed of service API
- `src/app/api/reports/food-cost/route.ts` — Food cost API
- `src/app/api/reports/voids-comps/route.ts` — Void/comp/discount API
- `src/app/api/reports/pnl/route.ts` — P&L API
- `src/app/api/reports/trends/route.ts` — 13-week trend API
- `src/app/api/reports/dashboard/route.ts` — Owner mobile dashboard API
- `src/app/api/reports/email-daily/route.ts` — Manual trigger for daily email
- `src/components/reports/CashDrawerTable.tsx` — Cash over/short table component
- `src/components/reports/SpeedHeatmap.tsx` — Station x daypart heatmap
- `src/components/reports/TicketTimeHistogram.tsx` — Ticket time distribution
- `src/components/reports/FoodCostVarianceChart.tsx` — Theoretical vs actual bars
- `src/components/reports/VoidCompTrendChart.tsx` — Stacked void/comp/discount bars
- `src/components/reports/PLWaterfallChart.tsx` — Waterfall chart for P&L
- `src/components/reports/TrendLineChart.tsx` — 13-week multi-line with average band
- `src/components/reports/OwnerDashboardCard.tsx` — Large KPI card for mobile
- `src/components/reports/ReportPDFTemplate.tsx` — @react-pdf/renderer template
- `src/components/reports/ReportCard.tsx` — Card for reports hub grid
- `src/components/reports/EmployeeFlagBadge.tsx` — Red flag indicator for anomalies
- `src/components/reports/ComparisonArrow.tsx` — Up/down trend indicator
- `src/lib/reports/queries.ts` — All Supabase report query functions (shared)
- `src/lib/reports/aggregation.ts` — Daily metrics aggregation logic
- `src/lib/reports/pdf-generator.ts` — PDF generation utility
- `src/lib/reports/email-templates.ts` — SendGrid email template builder
- `src/lib/reports/constants.ts` — Report thresholds, daypart definitions, config
- `src/workers/daily-metrics.worker.ts` — BullMQ worker for 4 AM aggregation
- `src/workers/daily-email.worker.ts` — BullMQ worker for email delivery
- `supabase/migrations/XXXXXX_daily_metrics_table.sql` — daily_metrics table migration
- `supabase/migrations/XXXXXX_report_rpc_functions.sql` — PostgreSQL RPC functions for complex aggregations

---

## Acceptance Criteria

Every checkbox must pass before this phase is complete:

### Live Data (no mocks)
- [ ] Daily sales report queries `orders` + `payments` tables and returns real totals for a given business date
- [ ] Labor report queries `time_entries` table and calculates hours, cost, and labor % against revenue
- [ ] Product mix report queries `order_items` joined with `menu_items` and returns quantity, revenue, cost, margin for every item sold
- [ ] Server performance report queries orders grouped by server and returns real sales, tips, check average, covers
- [ ] Payment summary queries `payments` table grouped by method and returns real totals
- [ ] Tax report queries orders with tax breakdowns by jurisdiction
- [ ] `src/lib/reports/mock-data.ts` is deleted and no component imports from it

### New Reports
- [ ] Cash report shows opening count, closing count, expected balance, actual balance, and over/short for each employee's drawer for a given date
- [ ] Cash report color-codes over/short: green (<$5), yellow ($5-$20), red (>$20)
- [ ] Speed of service report shows average ticket time by KDS station with real timestamps from `kds_tickets`
- [ ] Speed of service report shows a heatmap of station x daypart with color-coded cells
- [ ] Speed of service report identifies outlier tickets (>2x average) and lists them
- [ ] Food cost report calculates theoretical cost (recipe cost x qty sold) and actual cost (purchases - remaining inventory)
- [ ] Food cost report shows variance by item and flags items where actual exceeds theoretical by >10%
- [ ] Void/comp/discount report shows totals by type, by employee, and by reason code
- [ ] Void/comp/discount report flags employees whose void rate exceeds 2x the location average
- [ ] P&L summary calculates revenue, COGS, labor, and gross profit from live data for a given month
- [ ] P&L summary shows a waterfall chart and comparison to previous month
- [ ] 13-week trend report shows rolling averages for selected metrics using pre-aggregated `daily_metrics` data
- [ ] 13-week trend highlights weeks deviating >10% from the rolling average

### Owner Mobile Dashboard
- [ ] Dashboard page renders in a phone viewport (375px) with 5 key metrics
- [ ] Today's total revenue displays as a single large number
- [ ] Today vs same day last week shows an up/down arrow with percentage change
- [ ] Labor cost percentage shows and turns red when >30%
- [ ] Active alerts section shows voids >$50, cash discrepancies, overtime, and failed transactions
- [ ] Open checks count and total value display
- [ ] Dashboard data refreshes every 60 seconds via polling or Realtime subscription

### PDF Export
- [ ] Every report page has an "Export PDF" button
- [ ] Clicking "Export PDF" downloads a branded PDF with Sear logo, location name, date range, and the report data
- [ ] PDF tables render correctly with proper alignment and column headers
- [ ] PDF charts render as static images (not interactive)

### Daily Email
- [ ] BullMQ worker runs at 4:00 AM and aggregates the previous business day's metrics into `daily_metrics`
- [ ] After aggregation, a branded HTML email is sent via SendGrid to all configured recipients
- [ ] Email contains: total revenue, total orders, avg check, labor %, food %, comparison to last week
- [ ] Email includes a "View Full Report" link to the app
- [ ] Manual trigger endpoint (`/api/reports/email-daily`) allows re-sending for a specific date

### Reports Hub
- [ ] `/reports` page shows a grid of report cards with names, descriptions, and sparkline previews
- [ ] Cards are grouped into sections: Daily Operations, Financial, Staff Performance, Trends
- [ ] Each card navigates to the correct report page on click

### Loading & Empty States
- [ ] Every report page shows skeleton loaders while data is loading
- [ ] Every report page shows an empty state with helpful message when no data exists for the selected period
- [ ] Date range picker has preset buttons: Today, Yesterday, This Week, Last Week, This Month, Last Month, Custom

---

## Workflow Tests

### Workflow 1: Owner Reviews Yesterday's Performance
1. Owner logs in on their phone browser
2. Navigates to `/reports/dashboard`
3. Sees today's revenue ($4,250), up 12% from last Tuesday
4. Sees labor at 28% (green)
5. Sees 1 alert: "Cash drawer short $18.50 — Sarah M."
6. Taps the alert → navigates to `/reports/cash` filtered to today
7. Sees Sarah's drawer: opening $200, cash sales $387, payouts $0, expected $587, actual $568.50, short $18.50 (yellow)
8. Taps "Export PDF" → PDF downloads with full cash report

### Workflow 2: Manager Investigates Void Patterns
1. Manager opens `/reports/voids-comps` with date range "Last 7 Days"
2. Sees total voids: $892, total comps: $234, total discounts: $1,105
3. Notices employee "Jake T." has $412 in voids — flagged red (2.3x average)
4. Filters by employee: Jake T.
5. Sees breakdown: 8 voids, mostly "Customer changed mind" (5), "Wrong item" (3)
6. Sees voids concentrated in the 8-10 PM shift
7. Exports PDF for HR file

### Workflow 3: Owner Reviews Monthly P&L
1. Owner opens `/reports/pnl` for February 2026
2. Sees waterfall: Revenue $125,400 → COGS -$38,870 (31%) → Labor -$37,620 (30%) → Gross Profit $48,910 (39%)
3. Comparison shows revenue up 5% from January, but labor cost up 8% (overtime issue)
4. Clicks through to labor report for February details
5. Exports P&L as PDF for accountant

### Workflow 4: Kitchen Manager Optimizes Speed
1. Kitchen manager opens `/reports/speed-of-service` for last 7 days
2. Sees heatmap: Grill station averages 14 min (green), Fry station 8 min (green), but Sauté station is 22 min during dinner (red)
3. Drills into Sauté dinner outliers: sees 3 tickets over 35 minutes
4. Notes these tickets all had "Lobster Risotto" — identifies the bottleneck
5. Uses this data to adjust prep workflow

### Workflow 5: Auto-Email Delivery
1. At 4:00 AM, BullMQ cron fires the `daily-metrics-aggregation` job
2. Job queries all orders, payments, labor for March 22's business day (4 AM March 22 to 4 AM March 23)
3. Job writes aggregated row to `daily_metrics` table
4. Job triggers `daily-email-summary` job
5. Email worker renders HTML template with the day's numbers
6. SendGrid sends the email to owner's configured email address
7. Owner opens email at 7 AM — sees yesterday's summary, taps "View Full Report" → opens app

### Workflow 6: 13-Week Trend Spots a Problem
1. Owner opens `/reports/trends` and selects "Revenue" metric
2. Sees 13-week line chart with shaded average band
3. Notices weeks 10 and 11 are below the band (highlighted red)
4. Switches to "Labor %" metric — sees those same weeks have labor at 33% (above 30% threshold)
5. Concludes: revenue dipped but didn't cut labor fast enough
6. Exports trend report as PDF for partner meeting

### Workflow 7: Server Checkout
1. Manager opens `/reports/server-performance` filtered to today
2. Sees each server's totals: sales, tips (cash + card), tip-out owed, net cash owed to house
3. Server "Emily R." has: $1,850 sales, $312 tips ($87 cash + $225 card), tip-out $47 to busser, net cash owed $87
4. Prints server checkout slip for Emily to sign
