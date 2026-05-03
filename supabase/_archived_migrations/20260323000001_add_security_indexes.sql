-- Phase 12: Security & Performance Hardening — Database Indexes
-- These indexes optimize the most common query patterns across all modules.

-- 1. Orders: Filter active orders by location (POS order screen, KDS)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_location_status_created
  ON orders (location_id, status, created_at DESC);

-- 2. Orders: Server performance reports
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_server_created
  ON orders (server_id, created_at DESC);

-- 3. Order items: Prevent N+1 on order item lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
  ON order_items (order_id);

-- 4. Order items: Product mix (PMIX) reports
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_menu_item_created
  ON order_items (menu_item_id, created_at DESC);

-- 5. Payments: Payment lookup by order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_order_id
  ON payments (order_id);

-- 6. Payments: Payment reports by location and date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_location_created
  ON payments (location_id, created_at DESC);

-- 7. Tables: Table status queries for floor plan view
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tables_location_status
  ON tables (location_id, status);

-- 8. Reservations: Availability checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservations_location_date_status
  ON reservations (location_id, reservation_date, status);

-- 9. Time entries: Staff time queries and labor reports
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_entries_user_clock_in
  ON time_entries (user_id, clock_in DESC);

-- 10. KDS tickets: Ticket queue queries per station
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kds_tickets_station_status_created
  ON kds_tickets (station_id, status, created_at DESC);

-- 11. Inventory: Low stock alerts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_items_location_quantity
  ON inventory_items (location_id, current_stock);

-- 12. Customers: Phone lookup (CRM, loyalty)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_org_phone
  ON customers (org_id, phone)
  WHERE phone IS NOT NULL;

-- 13. Customers: Email lookup (CRM, loyalty)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_org_email
  ON customers (org_id, email)
  WHERE email IS NOT NULL;
