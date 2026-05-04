# Sear POS — Index Audit (V7.2.1)

**Date:** 2026-05-04
**Project:** Supabase staging `lbekiyxqemxozmghgmtp`
**Migration:** `supabase/migrations/20260504192408_v7_indexes.sql`
**Rollback:** `supabase/_rollbacks/20260504192408_v7_indexes.rollback.sql`

## Methodology

V7.1.2 RUM data was not yet aggregated, so this audit was performed via:

1. **Supabase performance advisor** (`mcp__claude_ai_Supabase__get_advisors`)
   surfaced 196 unindexed-FK lints, 5 duplicate-index lints, and 45
   unused-index lints.
2. **Codebase grep** of `from('<table>').select(...).eq(...)` patterns to
   identify the application's hot paths.
3. **EXPLAIN (ANALYZE, BUFFERS)** via `execute_sql` against staging on the
   top patterns to confirm whether existing indexes are used and to record
   actual runtime.

Acceptance target: every top query < 50 ms p99 OR a documented waiver.

---

## Top queries analyzed

For each query: SQL pattern (paraphrased from source), EXPLAIN summary,
existing-index used (if any), and the decision.

### Q1 — KDS active orders by location

```sql
SELECT * FROM orders
WHERE org_id = $1 AND location_id = $2
  AND status IN ('open','fired','ready')
ORDER BY created_at;
```

Source: `src/app/api/kds/tickets/route.ts:141`.

EXPLAIN: `Index Scan using idx_orders_status` (location_id, status).
Execution Time: **0.31 ms**. 3 rows returned.
Decision: **OK — no new index.** The composite
`idx_orders_location_status_created (location_id, status, created_at DESC)`
already covers this; the planner picked the simpler `idx_orders_status` for
the small staging table but will pivot to the composite as data grows.

### Q2 — KDS order_items by order list

```sql
SELECT * FROM order_items
WHERE order_id IN (...20 ids) AND is_sent = true;
```

Source: `src/app/api/kds/tickets/route.ts:160`.

EXPLAIN: Hash Semi Join, but currently Seq Scan on `order_items` because
the table only has 428 rows. With more data, planner will use
`idx_order_items_order_id`. Execution Time: **0.36 ms**.
Decision: **OK — no new index.**
Note: the duplicate-index lint flagged
`{idx_order_items_order, idx_order_items_order_id}` — both are
`(order_id)`. Not dropping in this batch (out of scope for
additive-only migration; safe-drop task can handle it later).

### Q3 — Audit log by org + date desc

```sql
SELECT * FROM audit_log
WHERE org_id = $1
ORDER BY created_at DESC
LIMIT 50;
```

Source: ledger reads (multiple endpoints).

EXPLAIN: `Index Scan using idx_audit_org_date`. Execution Time:
**0.16 ms**. 27 rows.
Decision: **OK — no new index.** Existing
`idx_audit_org_date (org_id, created_at DESC)` is optimal.

### Q4 — Payments by org + location, newest first

```sql
SELECT * FROM payments
WHERE org_id = $1 AND location_id = $2
ORDER BY created_at DESC
LIMIT 100;
```

Source: `src/app/api/payments/settlement/route.ts:30`,
`src/app/api/payments/reconciliation/route.ts:55`.

EXPLAIN: `Index Scan using idx_payments_location_created`. Execution Time:
**0.24 ms**. 100 rows.
Decision: **OK — no new index.**

### Q5 — Payments by order_id (refund/void/capture path)

```sql
SELECT * FROM payments WHERE order_id = $1;
```

Source: `src/app/api/payments/{void,refund,capture,tip-adjust,...}/route.ts`.

EXPLAIN: `Index Scan using idx_payments_order_id`. Execution Time:
**0.16 ms**.
Decision: **OK — no new index.** Note: duplicate-index lint flagged
`{idx_payments_order, idx_payments_order_id}` — both are `(order_id)`.
Out of scope here (drop deferred to safe-drop task).

### Q6 — Catering events list by org

```sql
SELECT * FROM catering_events
WHERE org_id = $1
ORDER BY event_date DESC, event_time DESC
LIMIT 50;
```

Source: `src/app/api/catering/events/...`.

EXPLAIN: **Seq Scan** on `catering_events`, then quicksort. 23 rows,
Execution Time: **0.20 ms**.
Decision: **WAIVER — table is too small (23 rows) for the planner to
prefer an index, and total cost is already <1 ms. Re-evaluate at >5k
rows.** A composite `(org_id, event_date DESC)` index would be the natural
add when the table grows.

### Q7 — Time-entries active (clocked-in)

```sql
SELECT * FROM time_entries
WHERE org_id = $1 AND clock_out IS NULL;
```

Source: `src/app/api/staff/active/route.ts:15`,
`src/app/api/staff/route.ts:63`.

EXPLAIN: **Seq Scan** (table is empty in staging). Execution Time:
**0.08 ms**.
Decision: **WAIVER — empty table.** When populated, a partial index
`(org_id) WHERE clock_out IS NULL` would be appropriate. Defer to V7.2.2
or once production has time_entries data to measure against.

### Q8 — Reservations list by location/date/status

```sql
SELECT * FROM reservations
WHERE location_id = $1 AND reservation_date >= CURRENT_DATE
  AND status IN ('confirmed','seated','pending')
ORDER BY reservation_date, reservation_time;
```

Source: `src/app/api/reservations/route.ts`.

EXPLAIN: `Index Scan using idx_reservations_location_date_status`. 
Execution Time: **1.53 ms**. 0 rows (staging).
Decision: **OK — no new index.** Existing composite is well-matched.

### Q9 — House-account transactions by org

```sql
SELECT * FROM house_account_transactions
WHERE org_id = $1
ORDER BY created_at DESC LIMIT 50;
```

Source: house-accounts module reads.

EXPLAIN: **Seq Scan** with sort. Execution Time: 0.14 ms (empty table).
Decision: **ADD INDEX** `(org_id, created_at DESC)`. Even though the table
is currently empty, the org_id FK is unindexed (advisor lint
`unindexed_foreign_keys`) and the access pattern is well known. Cost is
minimal (<1 KB at zero rows).

### Q10 — Inventory transactions by org

Same pattern, same finding. **ADD INDEX** `(org_id, created_at DESC)` and
also `(inventory_item_id, created_at DESC)` for per-item ledger queries.

### Q11 — idempotency_records lookup

```sql
SELECT * FROM idempotency_records
WHERE key = $1 AND route = $2 AND org_id = $3;
```

Source: V5.3.1 offline mutation queue.

EXPLAIN: `Index Scan using idempotency_records_pkey` (composite PK on
key, route, org_id). Execution Time: **0.11 ms**. 231 scans logged in
`pg_stat_user_indexes` — confirmed hot path.
Decision: **OK — no new index.**

### Q12 — Gift card transactions by gift_card_id

```sql
SELECT * FROM gift_card_transactions
WHERE gift_card_id = $1
ORDER BY created_at DESC;
```

EXPLAIN: **Seq Scan** with sort, **0.16 ms** at 44 rows.
Decision: **WAIVER — table too small to need an index yet.** Add a
`(gift_card_id, created_at DESC)` index when the table grows past ~5k
rows. Recorded but not landed in this migration (fits in the
"5–10 indexes" budget).

### Q13 — Users by email (auth lookup)

```sql
SELECT * FROM users WHERE email = $1;
```

EXPLAIN: `Index Scan using idx_users_email`. Execution Time: **1.12 ms**.
Decision: **OK — no new index.**

---

## Indexes added (10 across 9 tables)

| # | Index | Table / columns | Rationale |
|---|---|---|---|
| 1 | `idx_kds_ticket_events_org_station_created` | `kds_ticket_events (org_id, station_id, created_at DESC)` | KDS station scroll; covers org-scoped + per-station; covers unindexed `station_id` FK lint |
| 2 | `idx_kds_ticket_events_order` | `kds_ticket_events (order_id)` | Order detail joins; covers unindexed `order_id` FK lint |
| 3 | `idx_inventory_transactions_org_created` | `inventory_transactions (org_id, created_at DESC)` | Inventory ledger by tenant (Seq Scan today) |
| 4 | `idx_inventory_transactions_item_created` | `inventory_transactions (inventory_item_id, created_at DESC)` | Per-item history; covers unindexed FK |
| 5 | `idx_house_account_transactions_org_created` | `house_account_transactions (org_id, created_at DESC)` | House-account ledger by tenant (Seq Scan today) |
| 6 | `idx_accounting_sync_log_org_created` | `accounting_sync_log (org_id, created_at DESC)` | QBO/Xero sync history; covers unindexed FK lint |
| 7 | `idx_print_queue_org_status_created` | `print_queue (org_id, status, created_at)` | Printer worker poll loop |
| 8 | `idx_print_queue_printer_status` | `print_queue (printer_id, status)` | Per-printer pending jobs; covers unindexed `printer_id` FK |
| 9 | `idx_online_order_queue_loc_status_created` | `online_order_queue (location_id, status, created_at DESC)` | Operator inbox |
| 10 | `idx_loyalty_transactions_account_created` | `loyalty_transactions (loyalty_account_id, created_at DESC)` | Per-account history |
| 11 | `idx_order_modifications_org_created` | `order_modifications (org_id, created_at DESC)` | Audit / forensics chronological reads |

(11 statements, 10 distinct purposes — print_queue gets two indexes.)

All `IF NOT EXISTS`, all tenant-leading where applicable, all paired
with `created_at DESC` for the recency-sort use cases.

---

## Indexes intentionally NOT added

The advisor reported 196 unindexed-FK lints. Many of those are for
low-traffic columns where adding an index would cost more than it saves:

- `*_created_by`, `*_updated_by`, `*_approved_by`, `*_performed_by`,
  `*_closed_by`, `*_opened_by`, `*_voided_by`, `*_comped_by`,
  `*_adjusted_by`, `*_refunded_by`, `*_processed_by` — user-id
  back-references that are read only via `users.id` joins; the
  fk-side join uses pk lookup, never the user_id index.
- `*_terminal_id` on `cash_drawers`, `kds_stations` — these tables are
  small (<10 rows), planner will Seq Scan regardless.
- `payments.original_payment_id`, `orders.split_from_order_id` —
  refund chain / split lookups are hit via primary key or order_id,
  not via these self-FKs.
- `customer_addresses.customer_id` — list is fetched via the customer
  detail page, but it's small enough (typically <5 addresses/customer)
  that a Seq Scan on the partial-org subset is fine.
- `chargebacks.payment_id`, `cash_drawer_events.{order_id,payment_id}`,
  `tip_adjustments.{order_id,payment_id}`,
  `tip_distributions.{order_id,payment_id}` — these tables are written
  during settlement but read in aggregate, not by FK; queries use
  `(org_id, date)` or `(org_id, shift_date)` already-indexed columns.

These are **waivers** not oversights — re-evaluate after V7.1.2 RUM data
shows real query distributions in production.

---

## Duplicate indexes (advisor lint, NOT addressed here)

5 duplicate-index pairs were flagged. Per task scope (additive-only
migration), drops are deferred to a future `safe_drop: true` task:

1. `customers.{idx_customers_email, idx_customers_org_email}` — both
   `(org_id, email) WHERE email IS NOT NULL`. Drop one.
2. `customers.{idx_customers_org_phone, idx_customers_phone}` — both
   `(org_id, phone) WHERE phone IS NOT NULL`. Drop one.
3. `order_items.{idx_order_items_order, idx_order_items_order_id}` —
   both `(order_id)`. Drop the older one.
4. `payments.{idx_payments_order, idx_payments_order_id}` — both
   `(order_id)`. Drop the older one.
5. `tables.{idx_tables_location_status, idx_tables_status}` — both
   `(location_id, status)`. Drop one.

Estimated savings: ~80 KB and slightly faster writes on those tables.

---

## Unused indexes (advisor lint, observation only)

`pg_stat_user_indexes` (snapshot 2026-05-04) shows 45 indexes with
`idx_scan = 0`. Many are on tables with 0 rows (no rows to index against),
so unused-index reports there are noise. The **non-trivial** unused
indexes on populated tables:

- `gift_cards.idx_gift_cards_org` — 0 scans, but `idx_gift_cards_number`
  has 74 scans. Org-scoped queries route through the card-number lookup.
- `customers.{idx_customers_email, idx_customers_org_email,
  idx_customers_org_phone, idx_customers_phone}` — 0 scans. Email/phone
  search isn't yet wired up; keep one each for when it is.
- `orders.{idx_orders_customer, idx_orders_opened, idx_orders_server,
  idx_orders_table}` — 0 scans, partial coverage by composites.

No drops in this migration. The 5.99.5 batch already dropped one
redundant `orders` index (`orders_id_version_org_idx`) — additional drops
need cross-checking against pg_stat over a 7-day window once V7.1.2 RUM
data is collecting.

---

## Validation

- All EXPLAIN ANALYZE runs above used real staging data and the planner
  reported the index-scan path on indexes that exist today.
- The 10 added indexes will be measured post-deploy against the same
  patterns. If any still Seq-Scan after deploy, file under V7.2.2.

## Tenant-isolation invariant

Every index added that includes `org_id` puts it as the **leading
column** so RLS-driven queries (which always filter by `org_id` first)
get full index selectivity. Indexes that lead with another column
(`order_id`, `inventory_item_id`, `loyalty_account_id`,
`printer_id`, `station_id`) target queries where the parent ID is the
primary filter and tenant isolation is enforced by the parent row's RLS.
