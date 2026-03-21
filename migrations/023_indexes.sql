-- ============================================================
-- 023_indexes.sql
-- Performance indexes for ALL tables
-- Includes: composite indexes, foreign key indexes, unique constraints
-- ============================================================

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_deleted ON organizations(id) WHERE deleted_at IS NULL;

-- ============================================================
-- LOCATIONS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_locations_org ON locations(org_id);
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(org_id, is_active) WHERE is_active = true;

-- ============================================================
-- TERMINALS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_terminals_location ON terminals(location_id);
CREATE INDEX IF NOT EXISTS idx_terminals_org ON terminals(org_id);
CREATE INDEX IF NOT EXISTS idx_terminals_active ON terminals(location_id, is_active) WHERE is_active = true;

-- ============================================================
-- ORG_MODULES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_org_modules_org ON org_modules(org_id);
CREATE INDEX IF NOT EXISTS idx_org_modules_enabled ON org_modules(org_id, is_enabled) WHERE is_enabled = true;

-- ============================================================
-- USERS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_pin ON users(org_id, pin_hash) WHERE pin_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_active ON users(org_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(org_id, role);

-- ============================================================
-- TAX_RATES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tax_rates_org ON tax_rates(org_id);
CREATE INDEX IF NOT EXISTS idx_tax_rates_location ON tax_rates(location_id);

-- ============================================================
-- MENU_CATEGORIES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_menu_categories_org ON menu_categories(org_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_location ON menu_categories(location_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_sort ON menu_categories(org_id, sort_order);

-- ============================================================
-- MENU_ITEMS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_menu_items_org ON menu_items(org_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_location ON menu_items(location_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_plu ON menu_items(org_id, plu_code) WHERE plu_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_menu_items_active ON menu_items(org_id, is_active) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_menu_items_barcode ON menu_items(org_id, barcode) WHERE barcode IS NOT NULL;

-- ============================================================
-- MODIFIER_GROUPS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_modifier_groups_org ON modifier_groups(org_id);

-- ============================================================
-- MODIFIERS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_modifiers_group ON modifiers(modifier_group_id);
CREATE INDEX IF NOT EXISTS idx_modifiers_org ON modifiers(org_id);

-- ============================================================
-- ORDERS (primary performance-critical table)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_org ON orders(org_id);
CREATE INDEX IF NOT EXISTS idx_orders_location ON orders(location_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(location_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_server ON orders(server_id);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id) WHERE table_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_opened ON orders(location_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(location_id, order_number);
CREATE INDEX IF NOT EXISTS idx_orders_closed ON orders(location_id, closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_open_status ON orders(location_id, status) WHERE status NOT IN ('closed', 'voided', 'refunded');
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(org_id, source);
CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(location_id, order_type);

-- ============================================================
-- ORDER_ITEMS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_org ON order_items(org_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(order_id, is_sent, is_voided);
CREATE INDEX IF NOT EXISTS idx_order_items_kitchen ON order_items(prep_station, is_sent, is_fired) WHERE is_voided = false;

-- ============================================================
-- ORDER_ITEM_MODIFIERS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_order_item_modifiers_item ON order_item_modifiers(order_item_id);

-- ============================================================
-- ORDER_MODIFICATIONS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_order_mods_order ON order_modifications(order_id);
CREATE INDEX IF NOT EXISTS idx_order_mods_org ON order_modifications(org_id);
CREATE INDEX IF NOT EXISTS idx_order_mods_type ON order_modifications(modification_type);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_processor_txn ON payments(processor_transaction_id)
    WHERE processor_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(org_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(org_id, payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_processed_at ON payments(org_id, processed_at);
CREATE INDEX IF NOT EXISTS idx_payments_gift_card ON payments(gift_card_id) WHERE gift_card_id IS NOT NULL;

-- ============================================================
-- TIP_ADJUSTMENTS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tip_adjustments_payment ON tip_adjustments(payment_id);
CREATE INDEX IF NOT EXISTS idx_tip_adjustments_order ON tip_adjustments(order_id);
CREATE INDEX IF NOT EXISTS idx_tip_adjustments_server ON tip_adjustments(server_id);

-- ============================================================
-- PAYMENT_TRANSACTIONS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_txn_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_txn_org_date ON payment_transactions(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_txn_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_txn_batch ON payment_transactions(processor_batch_id);
CREATE INDEX IF NOT EXISTS idx_txn_split_group ON payment_transactions(split_group_id) WHERE split_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_txn_processor_id ON payment_transactions(processor_transaction_id) WHERE processor_transaction_id IS NOT NULL;

-- ============================================================
-- RESTAURANT_PROCESSORS
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_rp_org_processor ON restaurant_processors(org_id, processor_name);

-- ============================================================
-- PAYMENT_DEVICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_payment_devices_org ON payment_devices(org_id);
CREATE INDEX IF NOT EXISTS idx_payment_devices_processor ON payment_devices(processor_id);
CREATE INDEX IF NOT EXISTS idx_payment_devices_serial ON payment_devices(device_serial);

-- ============================================================
-- SETTLEMENT_BATCHES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_batch_org_date ON settlement_batches(org_id, batch_closed_at);
CREATE INDEX IF NOT EXISTS idx_batch_unreconciled ON settlement_batches(org_id, reconciled) WHERE reconciled = false;

-- ============================================================
-- CHARGEBACKS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_chargebacks_org ON chargebacks(org_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_txn ON chargebacks(transaction_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_status ON chargebacks(org_id, status);
CREATE INDEX IF NOT EXISTS idx_chargebacks_respond_by ON chargebacks(respond_by) WHERE status = 'open';

-- ============================================================
-- SURCHARGE_CONFIG
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_surcharge_config_org ON surcharge_config(org_id);

-- ============================================================
-- TIP_CONFIG
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tip_config_org ON tip_config(org_id);

-- ============================================================
-- DAILY_RECONCILIATIONS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_daily_recon_org_date ON daily_reconciliations(org_id, business_date);
CREATE INDEX IF NOT EXISTS idx_daily_recon_location_date ON daily_reconciliations(location_id, business_date);

-- ============================================================
-- DISCOUNTS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_discounts_org ON discounts(org_id);
CREATE INDEX IF NOT EXISTS idx_discounts_promo ON discounts(org_id, promo_code) WHERE promo_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_discounts_active ON discounts(org_id, is_active) WHERE is_active = true AND deleted_at IS NULL;

-- ============================================================
-- ORDER_DISCOUNTS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_order_discounts_order ON order_discounts(order_id);
CREATE INDEX IF NOT EXISTS idx_order_discounts_discount ON order_discounts(discount_id);

-- ============================================================
-- FLOOR_PLANS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_floor_plans_location ON floor_plans(location_id);
CREATE INDEX IF NOT EXISTS idx_floor_plans_org ON floor_plans(org_id);

-- ============================================================
-- TABLES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tables_location ON tables(location_id);
CREATE INDEX IF NOT EXISTS idx_tables_floor_plan ON tables(floor_plan_id);
CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(location_id, status);
CREATE INDEX IF NOT EXISTS idx_tables_section ON tables(location_id, section);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(org_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(org_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(org_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(org_id, last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_customers_last_visit ON customers(org_id, last_visit_at DESC);

-- ============================================================
-- CUSTOMER_ADDRESSES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);

-- ============================================================
-- CUSTOMER_PAYMENT_METHODS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cpm_customer ON customer_payment_methods(customer_id);
CREATE INDEX IF NOT EXISTS idx_cpm_org ON customer_payment_methods(org_id);

-- ============================================================
-- SHIFTS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_shifts_location_date ON shifts(location_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_org ON shifts(org_id);

-- ============================================================
-- TIME_ENTRIES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_location_date ON time_entries(location_id, clock_in);
CREATE INDEX IF NOT EXISTS idx_time_entries_org ON time_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_shift ON time_entries(shift_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_unapproved ON time_entries(org_id, is_approved) WHERE is_approved = false;

-- ============================================================
-- BREAK_ENTRIES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_break_entries_time_entry ON break_entries(time_entry_id);

-- ============================================================
-- CASH_DRAWERS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cash_drawers_location ON cash_drawers(location_id);
CREATE INDEX IF NOT EXISTS idx_cash_drawers_org ON cash_drawers(org_id);
CREATE INDEX IF NOT EXISTS idx_cash_drawers_open ON cash_drawers(location_id, is_open) WHERE is_open = true;

-- ============================================================
-- CASH_DRAWER_EVENTS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cash_events_drawer ON cash_drawer_events(cash_drawer_id);
CREATE INDEX IF NOT EXISTS idx_cash_events_org ON cash_drawer_events(org_id);

-- ============================================================
-- TIP_DISTRIBUTIONS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tips_staff_date ON tip_distributions(staff_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_tips_org_date ON tip_distributions(org_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_tips_order ON tip_distributions(order_id);

-- ============================================================
-- CASH_TIP_REPORTS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cash_tips_staff ON cash_tip_reports(staff_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_cash_tips_org ON cash_tip_reports(org_id);

-- ============================================================
-- GIFT_CARDS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_gift_cards_org ON gift_cards(org_id);
CREATE INDEX IF NOT EXISTS idx_gift_cards_number ON gift_cards(card_number_hash);
CREATE INDEX IF NOT EXISTS idx_gift_cards_active ON gift_cards(org_id, is_active) WHERE is_active = true;

-- ============================================================
-- GIFT_CARD_TRANSACTIONS
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_gift_card_txns_card ON gift_card_transactions(gift_card_id);
CREATE INDEX IF NOT EXISTS idx_gift_card_txns_org ON gift_card_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_gift_card_txns_order ON gift_card_transactions(order_id) WHERE order_id IS NOT NULL;

-- ============================================================
-- AUDIT_LOG
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_audit_org_date ON audit_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_location ON audit_log(location_id, created_at DESC);

-- ============================================================
-- KDS_STATIONS (mod.kds)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_kds_stations_location ON kds_stations(location_id);
CREATE INDEX IF NOT EXISTS idx_kds_stations_org ON kds_stations(org_id);

-- ============================================================
-- KDS_TICKET_EVENTS (mod.kds)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_kds_events_station ON kds_ticket_events(station_id);
CREATE INDEX IF NOT EXISTS idx_kds_events_order ON kds_ticket_events(order_id);
CREATE INDEX IF NOT EXISTS idx_kds_events_org ON kds_ticket_events(org_id);

-- ============================================================
-- VENDORS (mod.inventory)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_vendors_org ON vendors(org_id);

-- ============================================================
-- INVENTORY_ITEMS (mod.inventory)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_inventory_items_org ON inventory_items(org_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_location ON inventory_items(location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_vendor ON inventory_items(vendor_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(org_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_items_low_stock ON inventory_items(location_id)
    WHERE current_quantity <= reorder_point AND is_active = true;

-- ============================================================
-- INVENTORY_TRANSACTIONS (mod.inventory)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_inv_txns_item ON inventory_transactions(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_txns_org ON inventory_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_inv_txns_type ON inventory_transactions(transaction_type);

-- ============================================================
-- RECIPES (mod.inventory)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_recipes_menu_item ON recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipes_inv_item ON recipes(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_recipes_org ON recipes(org_id);

-- ============================================================
-- PURCHASE_ORDERS (mod.inventory)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_po_org ON purchase_orders(org_id);
CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_location ON purchase_orders(location_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(org_id, status);

-- ============================================================
-- PURCHASE_ORDER_ITEMS (mod.inventory)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_inv_item ON purchase_order_items(inventory_item_id);

-- ============================================================
-- LOYALTY_PROGRAMS (mod.loyalty)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_loyalty_programs_org ON loyalty_programs(org_id);

-- ============================================================
-- LOYALTY_ACCOUNTS (mod.loyalty)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_org ON loyalty_accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_customer ON loyalty_accounts(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_program ON loyalty_accounts(program_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_accounts_unique ON loyalty_accounts(customer_id, program_id);

-- ============================================================
-- LOYALTY_TRANSACTIONS (mod.loyalty)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_loyalty_txns_account ON loyalty_transactions(loyalty_account_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_txns_org ON loyalty_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_txns_order ON loyalty_transactions(order_id) WHERE order_id IS NOT NULL;

-- ============================================================
-- ONLINE_MENUS (mod.online_ordering)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_online_menus_org ON online_menus(org_id);
CREATE INDEX IF NOT EXISTS idx_online_menus_location ON online_menus(location_id);
CREATE INDEX IF NOT EXISTS idx_online_menus_slug ON online_menus(org_id, slug);

-- ============================================================
-- ONLINE_MENU_ITEMS (mod.online_ordering)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_online_menu_items_menu ON online_menu_items(online_menu_id);
CREATE INDEX IF NOT EXISTS idx_online_menu_items_item ON online_menu_items(menu_item_id);

-- ============================================================
-- ONLINE_ORDER_QUEUE (mod.online_ordering)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_online_queue_org ON online_order_queue(org_id);
CREATE INDEX IF NOT EXISTS idx_online_queue_location ON online_order_queue(location_id);
CREATE INDEX IF NOT EXISTS idx_online_queue_status ON online_order_queue(location_id, status);
CREATE INDEX IF NOT EXISTS idx_online_queue_order ON online_order_queue(order_id);

-- ============================================================
-- RESERVATIONS (mod.reservations)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_reservations_org ON reservations(org_id);
CREATE INDEX IF NOT EXISTS idx_reservations_location_date ON reservations(location_id, reservation_date);
CREATE INDEX IF NOT EXISTS idx_reservations_customer ON reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(location_id, status, reservation_date);

-- ============================================================
-- WAITLIST_ENTRIES (mod.reservations)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_waitlist_org ON waitlist_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_location ON waitlist_entries(location_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_active ON waitlist_entries(location_id, status) WHERE status IN ('waiting', 'notified');

-- ============================================================
-- SCHEDULE_TEMPLATES (mod.scheduling)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_schedule_templates_org ON schedule_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_schedule_templates_location ON schedule_templates(location_id);

-- ============================================================
-- SCHEDULED_SHIFTS (mod.scheduling)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_org ON scheduled_shifts(org_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_user ON scheduled_shifts(user_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_location_date ON scheduled_shifts(location_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_published ON scheduled_shifts(location_id, shift_date)
    WHERE published_at IS NOT NULL;

-- ============================================================
-- SHIFT_SWAP_REQUESTS (mod.scheduling)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_shift_swaps_org ON shift_swap_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_shift ON shift_swap_requests(scheduled_shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_pending ON shift_swap_requests(org_id, status) WHERE status = 'pending';

-- ============================================================
-- AVAILABILITY (mod.scheduling)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_availability_org ON availability(org_id);
CREATE INDEX IF NOT EXISTS idx_availability_user ON availability(user_id);
CREATE INDEX IF NOT EXISTS idx_availability_user_day ON availability(user_id, day_of_week);

-- ============================================================
-- CAMPAIGNS (mod.marketing)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_campaigns_org ON campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(org_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(scheduled_for) WHERE status = 'scheduled';

-- ============================================================
-- CAMPAIGN_RECIPIENTS (mod.marketing)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_customer ON campaign_recipients(customer_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(campaign_id, status);

-- ============================================================
-- DELIVERY_ZONES (mod.delivery)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_delivery_zones_org ON delivery_zones(org_id);
CREATE INDEX IF NOT EXISTS idx_delivery_zones_location ON delivery_zones(location_id);

-- ============================================================
-- DELIVERIES (mod.delivery)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_deliveries_org ON deliveries(org_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(org_id, status);

-- ============================================================
-- DAILY_METRICS (mod.analytics)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_daily_metrics_location_date ON daily_metrics(location_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_org ON daily_metrics(org_id);

-- ============================================================
-- DAILY_ITEM_METRICS (mod.analytics)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_daily_item_metrics_location ON daily_item_metrics(location_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_item_metrics_item ON daily_item_metrics(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_daily_item_metrics_org ON daily_item_metrics(org_id);

-- ============================================================
-- updated_at trigger function (shared by all tables)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables with updated_at columns
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_locations_updated_at BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_terminals_updated_at BEFORE UPDATE ON terminals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_org_modules_updated_at BEFORE UPDATE ON org_modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_tax_rates_updated_at BEFORE UPDATE ON tax_rates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_menu_categories_updated_at BEFORE UPDATE ON menu_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_menu_items_updated_at BEFORE UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_modifier_groups_updated_at BEFORE UPDATE ON modifier_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_modifiers_updated_at BEFORE UPDATE ON modifiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_order_items_updated_at BEFORE UPDATE ON order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_payment_transactions_updated_at BEFORE UPDATE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_restaurant_processors_updated_at BEFORE UPDATE ON restaurant_processors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_payment_devices_updated_at BEFORE UPDATE ON payment_devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_settlement_batches_updated_at BEFORE UPDATE ON settlement_batches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_chargebacks_updated_at BEFORE UPDATE ON chargebacks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_surcharge_config_updated_at BEFORE UPDATE ON surcharge_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_tip_config_updated_at BEFORE UPDATE ON tip_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_daily_reconciliations_updated_at BEFORE UPDATE ON daily_reconciliations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_discounts_updated_at BEFORE UPDATE ON discounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_floor_plans_updated_at BEFORE UPDATE ON floor_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_tables_updated_at BEFORE UPDATE ON tables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_shifts_updated_at BEFORE UPDATE ON shifts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_time_entries_updated_at BEFORE UPDATE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_cash_drawers_updated_at BEFORE UPDATE ON cash_drawers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_gift_cards_updated_at BEFORE UPDATE ON gift_cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_kds_stations_updated_at BEFORE UPDATE ON kds_stations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_inventory_items_updated_at BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_vendors_updated_at BEFORE UPDATE ON vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_loyalty_programs_updated_at BEFORE UPDATE ON loyalty_programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_loyalty_accounts_updated_at BEFORE UPDATE ON loyalty_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_online_menus_updated_at BEFORE UPDATE ON online_menus
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_reservations_updated_at BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_waitlist_entries_updated_at BEFORE UPDATE ON waitlist_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_schedule_templates_updated_at BEFORE UPDATE ON schedule_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_scheduled_shifts_updated_at BEFORE UPDATE ON scheduled_shifts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_delivery_zones_updated_at BEFORE UPDATE ON delivery_zones
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_deliveries_updated_at BEFORE UPDATE ON deliveries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_daily_metrics_updated_at BEFORE UPDATE ON daily_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_daily_item_metrics_updated_at BEFORE UPDATE ON daily_item_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Missing updated_at triggers for tables with updated_at columns
CREATE TRIGGER trg_customer_addresses_updated_at BEFORE UPDATE ON customer_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_customer_payment_methods_updated_at BEFORE UPDATE ON customer_payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_break_entries_updated_at BEFORE UPDATE ON break_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_purchase_order_items_updated_at BEFORE UPDATE ON purchase_order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_online_menu_items_updated_at BEFORE UPDATE ON online_menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_online_order_queue_updated_at BEFORE UPDATE ON online_order_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_shift_swap_requests_updated_at BEFORE UPDATE ON shift_swap_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_campaign_recipients_updated_at BEFORE UPDATE ON campaign_recipients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
