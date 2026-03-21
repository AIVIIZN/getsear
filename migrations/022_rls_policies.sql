-- ============================================================
-- 022_rls_policies.sql
-- Row-Level Security policies for ALL tables
-- Isolation: org_id based. Platform admin bypasses RLS.
-- ============================================================

-- Helper function to extract org_id from the JWT
CREATE OR REPLACE FUNCTION auth.org_id()
RETURNS uuid AS $$
    SELECT COALESCE(
        (current_setting('request.jwt.claims', true)::jsonb ->> 'org_id')::uuid,
        '00000000-0000-0000-0000-000000000000'::uuid
    );
$$ LANGUAGE sql STABLE;

-- Helper function to check if current user is platform_admin
CREATE OR REPLACE FUNCTION auth.is_platform_admin()
RETURNS boolean AS $$
    SELECT COALESCE(
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'platform_admin',
        false
    );
$$ LANGUAGE sql STABLE;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select" ON organizations FOR SELECT
    USING (auth.is_platform_admin() OR id = auth.org_id());

CREATE POLICY "org_insert" ON organizations FOR INSERT
    WITH CHECK (auth.is_platform_admin());

CREATE POLICY "org_update" ON organizations FOR UPDATE
    USING (auth.is_platform_admin() OR id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR id = auth.org_id());

CREATE POLICY "org_delete" ON organizations FOR DELETE
    USING (auth.is_platform_admin());

-- ============================================================
-- LOCATIONS
-- ============================================================
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locations_select" ON locations FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "locations_insert" ON locations FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "locations_update" ON locations FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "locations_delete" ON locations FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- TERMINALS
-- ============================================================
ALTER TABLE terminals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terminals_select" ON terminals FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "terminals_insert" ON terminals FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "terminals_update" ON terminals FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "terminals_delete" ON terminals FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- ORG_MODULES
-- ============================================================
ALTER TABLE org_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_modules_select" ON org_modules FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "org_modules_insert" ON org_modules FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "org_modules_update" ON org_modules FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "org_modules_delete" ON org_modules FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- MODULE_MIGRATIONS
-- ============================================================
ALTER TABLE module_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "module_migrations_select" ON module_migrations FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "module_migrations_insert" ON module_migrations FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "module_migrations_update" ON module_migrations FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "module_migrations_delete" ON module_migrations FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- USERS
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select" ON users FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "users_insert" ON users FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "users_update" ON users FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "users_delete" ON users FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- PERMISSIONS (global reference data, no org_id -- readable by all)
-- ============================================================
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissions_select" ON permissions FOR SELECT
    USING (true);

CREATE POLICY "permissions_insert" ON permissions FOR INSERT
    WITH CHECK (auth.is_platform_admin());

CREATE POLICY "permissions_update" ON permissions FOR UPDATE
    USING (auth.is_platform_admin())
    WITH CHECK (auth.is_platform_admin());

CREATE POLICY "permissions_delete" ON permissions FOR DELETE
    USING (auth.is_platform_admin());

-- ============================================================
-- ROLE_PERMISSIONS (global reference data -- readable by all)
-- ============================================================
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions_select" ON role_permissions FOR SELECT
    USING (true);

CREATE POLICY "role_permissions_insert" ON role_permissions FOR INSERT
    WITH CHECK (auth.is_platform_admin());

CREATE POLICY "role_permissions_update" ON role_permissions FOR UPDATE
    USING (auth.is_platform_admin())
    WITH CHECK (auth.is_platform_admin());

CREATE POLICY "role_permissions_delete" ON role_permissions FOR DELETE
    USING (auth.is_platform_admin());

-- ============================================================
-- USER_PERMISSION_OVERRIDES
-- ============================================================
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_perm_overrides_select" ON user_permission_overrides FOR SELECT
    USING (auth.is_platform_admin() OR user_id IN (SELECT id FROM users WHERE org_id = auth.org_id()));

CREATE POLICY "user_perm_overrides_insert" ON user_permission_overrides FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR user_id IN (SELECT id FROM users WHERE org_id = auth.org_id()));

CREATE POLICY "user_perm_overrides_update" ON user_permission_overrides FOR UPDATE
    USING (auth.is_platform_admin() OR user_id IN (SELECT id FROM users WHERE org_id = auth.org_id()))
    WITH CHECK (auth.is_platform_admin() OR user_id IN (SELECT id FROM users WHERE org_id = auth.org_id()));

CREATE POLICY "user_perm_overrides_delete" ON user_permission_overrides FOR DELETE
    USING (auth.is_platform_admin() OR user_id IN (SELECT id FROM users WHERE org_id = auth.org_id()));

-- ============================================================
-- TAX_RATES
-- ============================================================
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_rates_select" ON tax_rates FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "tax_rates_insert" ON tax_rates FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "tax_rates_update" ON tax_rates FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "tax_rates_delete" ON tax_rates FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- MENU_CATEGORIES
-- ============================================================
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_categories_select" ON menu_categories FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "menu_categories_insert" ON menu_categories FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "menu_categories_update" ON menu_categories FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "menu_categories_delete" ON menu_categories FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- MENU_ITEMS
-- ============================================================
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "menu_items_select" ON menu_items FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "menu_items_insert" ON menu_items FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "menu_items_update" ON menu_items FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "menu_items_delete" ON menu_items FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- MODIFIER_GROUPS
-- ============================================================
ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modifier_groups_select" ON modifier_groups FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "modifier_groups_insert" ON modifier_groups FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "modifier_groups_update" ON modifier_groups FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "modifier_groups_delete" ON modifier_groups FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- MODIFIERS
-- ============================================================
ALTER TABLE modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modifiers_select" ON modifiers FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "modifiers_insert" ON modifiers FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "modifiers_update" ON modifiers FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "modifiers_delete" ON modifiers FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- MENU_ITEM_MODIFIER_GROUPS (no org_id -- secured via menu_items FK)
-- ============================================================
ALTER TABLE menu_item_modifier_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mimg_select" ON menu_item_modifier_groups FOR SELECT
    USING (auth.is_platform_admin() OR menu_item_id IN (SELECT id FROM menu_items WHERE org_id = auth.org_id()));

CREATE POLICY "mimg_insert" ON menu_item_modifier_groups FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR menu_item_id IN (SELECT id FROM menu_items WHERE org_id = auth.org_id()));

CREATE POLICY "mimg_update" ON menu_item_modifier_groups FOR UPDATE
    USING (auth.is_platform_admin() OR menu_item_id IN (SELECT id FROM menu_items WHERE org_id = auth.org_id()))
    WITH CHECK (auth.is_platform_admin() OR menu_item_id IN (SELECT id FROM menu_items WHERE org_id = auth.org_id()));

CREATE POLICY "mimg_delete" ON menu_item_modifier_groups FOR DELETE
    USING (auth.is_platform_admin() OR menu_item_id IN (SELECT id FROM menu_items WHERE org_id = auth.org_id()));

-- ============================================================
-- ORDERS
-- ============================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select" ON orders FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "orders_insert" ON orders FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "orders_update" ON orders FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "orders_delete" ON orders FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- ORDER_ITEMS
-- ============================================================
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items_select" ON order_items FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "order_items_insert" ON order_items FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "order_items_update" ON order_items FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "order_items_delete" ON order_items FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- ORDER_ITEM_MODIFIERS (no org_id -- secured via order_items FK)
-- ============================================================
ALTER TABLE order_item_modifiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oim_select" ON order_item_modifiers FOR SELECT
    USING (auth.is_platform_admin() OR order_item_id IN (SELECT id FROM order_items WHERE org_id = auth.org_id()));

CREATE POLICY "oim_insert" ON order_item_modifiers FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR order_item_id IN (SELECT id FROM order_items WHERE org_id = auth.org_id()));

CREATE POLICY "oim_update" ON order_item_modifiers FOR UPDATE
    USING (auth.is_platform_admin() OR order_item_id IN (SELECT id FROM order_items WHERE org_id = auth.org_id()))
    WITH CHECK (auth.is_platform_admin() OR order_item_id IN (SELECT id FROM order_items WHERE org_id = auth.org_id()));

CREATE POLICY "oim_delete" ON order_item_modifiers FOR DELETE
    USING (auth.is_platform_admin() OR order_item_id IN (SELECT id FROM order_items WHERE org_id = auth.org_id()));

-- ============================================================
-- ORDER_MODIFICATIONS
-- ============================================================
ALTER TABLE order_modifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_modifications_select" ON order_modifications FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "order_modifications_insert" ON order_modifications FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "order_modifications_update" ON order_modifications FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "order_modifications_delete" ON order_modifications FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- PAYMENTS
-- ============================================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select" ON payments FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "payments_insert" ON payments FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "payments_update" ON payments FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "payments_delete" ON payments FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- TIP_ADJUSTMENTS
-- ============================================================
ALTER TABLE tip_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tip_adjustments_select" ON tip_adjustments FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "tip_adjustments_insert" ON tip_adjustments FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "tip_adjustments_update" ON tip_adjustments FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "tip_adjustments_delete" ON tip_adjustments FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- PAYMENT_TRANSACTIONS
-- ============================================================
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_txns_select" ON payment_transactions FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "payment_txns_insert" ON payment_transactions FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "payment_txns_update" ON payment_transactions FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "payment_txns_delete" ON payment_transactions FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- RESTAURANT_PROCESSORS
-- ============================================================
ALTER TABLE restaurant_processors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restaurant_processors_select" ON restaurant_processors FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "restaurant_processors_insert" ON restaurant_processors FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "restaurant_processors_update" ON restaurant_processors FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "restaurant_processors_delete" ON restaurant_processors FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- PAYMENT_DEVICES
-- ============================================================
ALTER TABLE payment_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_devices_select" ON payment_devices FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "payment_devices_insert" ON payment_devices FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "payment_devices_update" ON payment_devices FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "payment_devices_delete" ON payment_devices FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- SETTLEMENT_BATCHES
-- ============================================================
ALTER TABLE settlement_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settlement_batches_select" ON settlement_batches FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "settlement_batches_insert" ON settlement_batches FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "settlement_batches_update" ON settlement_batches FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "settlement_batches_delete" ON settlement_batches FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- CHARGEBACKS
-- ============================================================
ALTER TABLE chargebacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chargebacks_select" ON chargebacks FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "chargebacks_insert" ON chargebacks FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "chargebacks_update" ON chargebacks FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "chargebacks_delete" ON chargebacks FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- SURCHARGE_CONFIG
-- ============================================================
ALTER TABLE surcharge_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "surcharge_config_select" ON surcharge_config FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "surcharge_config_insert" ON surcharge_config FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "surcharge_config_update" ON surcharge_config FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "surcharge_config_delete" ON surcharge_config FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- TIP_CONFIG
-- ============================================================
ALTER TABLE tip_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tip_config_select" ON tip_config FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "tip_config_insert" ON tip_config FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "tip_config_update" ON tip_config FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "tip_config_delete" ON tip_config FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- DAILY_RECONCILIATIONS
-- ============================================================
ALTER TABLE daily_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_reconciliations_select" ON daily_reconciliations FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "daily_reconciliations_insert" ON daily_reconciliations FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "daily_reconciliations_update" ON daily_reconciliations FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "daily_reconciliations_delete" ON daily_reconciliations FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- DISCOUNTS
-- ============================================================
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discounts_select" ON discounts FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "discounts_insert" ON discounts FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "discounts_update" ON discounts FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "discounts_delete" ON discounts FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- ORDER_DISCOUNTS
-- ============================================================
ALTER TABLE order_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_discounts_select" ON order_discounts FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "order_discounts_insert" ON order_discounts FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "order_discounts_update" ON order_discounts FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "order_discounts_delete" ON order_discounts FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- FLOOR_PLANS
-- ============================================================
ALTER TABLE floor_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "floor_plans_select" ON floor_plans FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "floor_plans_insert" ON floor_plans FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "floor_plans_update" ON floor_plans FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "floor_plans_delete" ON floor_plans FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- TABLES
-- ============================================================
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tables_select" ON tables FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "tables_insert" ON tables FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "tables_update" ON tables FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "tables_delete" ON tables FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- CUSTOMERS
-- ============================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select" ON customers FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "customers_insert" ON customers FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "customers_update" ON customers FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "customers_delete" ON customers FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- CUSTOMER_ADDRESSES
-- ============================================================
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_addresses_select" ON customer_addresses FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "customer_addresses_insert" ON customer_addresses FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "customer_addresses_update" ON customer_addresses FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "customer_addresses_delete" ON customer_addresses FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- CUSTOMER_PAYMENT_METHODS
-- ============================================================
ALTER TABLE customer_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpm_select" ON customer_payment_methods FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "cpm_insert" ON customer_payment_methods FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "cpm_update" ON customer_payment_methods FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "cpm_delete" ON customer_payment_methods FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- SHIFTS
-- ============================================================
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shifts_select" ON shifts FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "shifts_insert" ON shifts FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "shifts_update" ON shifts FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "shifts_delete" ON shifts FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- TIME_ENTRIES
-- ============================================================
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_select" ON time_entries FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "time_entries_insert" ON time_entries FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "time_entries_update" ON time_entries FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "time_entries_delete" ON time_entries FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- BREAK_ENTRIES (no org_id -- secured via time_entries FK)
-- ============================================================
ALTER TABLE break_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "break_entries_select" ON break_entries FOR SELECT
    USING (auth.is_platform_admin() OR time_entry_id IN (SELECT id FROM time_entries WHERE org_id = auth.org_id()));

CREATE POLICY "break_entries_insert" ON break_entries FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR time_entry_id IN (SELECT id FROM time_entries WHERE org_id = auth.org_id()));

CREATE POLICY "break_entries_update" ON break_entries FOR UPDATE
    USING (auth.is_platform_admin() OR time_entry_id IN (SELECT id FROM time_entries WHERE org_id = auth.org_id()))
    WITH CHECK (auth.is_platform_admin() OR time_entry_id IN (SELECT id FROM time_entries WHERE org_id = auth.org_id()));

CREATE POLICY "break_entries_delete" ON break_entries FOR DELETE
    USING (auth.is_platform_admin() OR time_entry_id IN (SELECT id FROM time_entries WHERE org_id = auth.org_id()));

-- ============================================================
-- CASH_DRAWERS
-- ============================================================
ALTER TABLE cash_drawers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_drawers_select" ON cash_drawers FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "cash_drawers_insert" ON cash_drawers FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "cash_drawers_update" ON cash_drawers FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "cash_drawers_delete" ON cash_drawers FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- CASH_DRAWER_EVENTS
-- ============================================================
ALTER TABLE cash_drawer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_drawer_events_select" ON cash_drawer_events FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "cash_drawer_events_insert" ON cash_drawer_events FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "cash_drawer_events_update" ON cash_drawer_events FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "cash_drawer_events_delete" ON cash_drawer_events FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- TIP_DISTRIBUTIONS
-- ============================================================
ALTER TABLE tip_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tip_distributions_select" ON tip_distributions FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "tip_distributions_insert" ON tip_distributions FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "tip_distributions_update" ON tip_distributions FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "tip_distributions_delete" ON tip_distributions FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- CASH_TIP_REPORTS
-- ============================================================
ALTER TABLE cash_tip_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_tip_reports_select" ON cash_tip_reports FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "cash_tip_reports_insert" ON cash_tip_reports FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "cash_tip_reports_update" ON cash_tip_reports FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "cash_tip_reports_delete" ON cash_tip_reports FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- GIFT_CARDS
-- ============================================================
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gift_cards_select" ON gift_cards FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "gift_cards_insert" ON gift_cards FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "gift_cards_update" ON gift_cards FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "gift_cards_delete" ON gift_cards FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- GIFT_CARD_TRANSACTIONS
-- ============================================================
ALTER TABLE gift_card_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gift_card_txns_select" ON gift_card_transactions FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "gift_card_txns_insert" ON gift_card_transactions FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "gift_card_txns_update" ON gift_card_transactions FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "gift_card_txns_delete" ON gift_card_transactions FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- AUDIT_LOG
-- ============================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select" ON audit_log FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

-- Audit log should not be updatable or deletable by tenants
CREATE POLICY "audit_log_update" ON audit_log FOR UPDATE
    USING (auth.is_platform_admin());

CREATE POLICY "audit_log_delete" ON audit_log FOR DELETE
    USING (auth.is_platform_admin());

-- ============================================================
-- KDS_STATIONS (mod.kds)
-- ============================================================
ALTER TABLE kds_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kds_stations_select" ON kds_stations FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "kds_stations_insert" ON kds_stations FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "kds_stations_update" ON kds_stations FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "kds_stations_delete" ON kds_stations FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- KDS_TICKET_EVENTS (mod.kds)
-- ============================================================
ALTER TABLE kds_ticket_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kds_ticket_events_select" ON kds_ticket_events FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "kds_ticket_events_insert" ON kds_ticket_events FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "kds_ticket_events_update" ON kds_ticket_events FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "kds_ticket_events_delete" ON kds_ticket_events FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- VENDORS (mod.inventory)
-- ============================================================
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors_select" ON vendors FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "vendors_insert" ON vendors FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "vendors_update" ON vendors FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "vendors_delete" ON vendors FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- INVENTORY_ITEMS (mod.inventory)
-- ============================================================
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_items_select" ON inventory_items FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "inventory_items_insert" ON inventory_items FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "inventory_items_update" ON inventory_items FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "inventory_items_delete" ON inventory_items FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- INVENTORY_TRANSACTIONS (mod.inventory)
-- ============================================================
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_txns_select" ON inventory_transactions FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "inventory_txns_insert" ON inventory_transactions FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "inventory_txns_update" ON inventory_transactions FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "inventory_txns_delete" ON inventory_transactions FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- RECIPES (mod.inventory)
-- ============================================================
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipes_select" ON recipes FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "recipes_insert" ON recipes FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "recipes_update" ON recipes FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "recipes_delete" ON recipes FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- PURCHASE_ORDERS (mod.inventory)
-- ============================================================
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_orders_select" ON purchase_orders FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "purchase_orders_insert" ON purchase_orders FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "purchase_orders_update" ON purchase_orders FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "purchase_orders_delete" ON purchase_orders FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- PURCHASE_ORDER_ITEMS (mod.inventory -- no org_id, secured via PO FK)
-- ============================================================
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_items_select" ON purchase_order_items FOR SELECT
    USING (auth.is_platform_admin() OR purchase_order_id IN (SELECT id FROM purchase_orders WHERE org_id = auth.org_id()));

CREATE POLICY "po_items_insert" ON purchase_order_items FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR purchase_order_id IN (SELECT id FROM purchase_orders WHERE org_id = auth.org_id()));

CREATE POLICY "po_items_update" ON purchase_order_items FOR UPDATE
    USING (auth.is_platform_admin() OR purchase_order_id IN (SELECT id FROM purchase_orders WHERE org_id = auth.org_id()))
    WITH CHECK (auth.is_platform_admin() OR purchase_order_id IN (SELECT id FROM purchase_orders WHERE org_id = auth.org_id()));

CREATE POLICY "po_items_delete" ON purchase_order_items FOR DELETE
    USING (auth.is_platform_admin() OR purchase_order_id IN (SELECT id FROM purchase_orders WHERE org_id = auth.org_id()));

-- ============================================================
-- LOYALTY_PROGRAMS (mod.loyalty)
-- ============================================================
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_programs_select" ON loyalty_programs FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "loyalty_programs_insert" ON loyalty_programs FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "loyalty_programs_update" ON loyalty_programs FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "loyalty_programs_delete" ON loyalty_programs FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- LOYALTY_ACCOUNTS (mod.loyalty)
-- ============================================================
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_accounts_select" ON loyalty_accounts FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "loyalty_accounts_insert" ON loyalty_accounts FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "loyalty_accounts_update" ON loyalty_accounts FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "loyalty_accounts_delete" ON loyalty_accounts FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- LOYALTY_TRANSACTIONS (mod.loyalty)
-- ============================================================
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_txns_select" ON loyalty_transactions FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "loyalty_txns_insert" ON loyalty_transactions FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "loyalty_txns_update" ON loyalty_transactions FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "loyalty_txns_delete" ON loyalty_transactions FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- ONLINE_MENUS (mod.online_ordering)
-- ============================================================
ALTER TABLE online_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "online_menus_select" ON online_menus FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "online_menus_insert" ON online_menus FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "online_menus_update" ON online_menus FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "online_menus_delete" ON online_menus FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- ONLINE_MENU_ITEMS (mod.online_ordering)
-- ============================================================
ALTER TABLE online_menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "online_menu_items_select" ON online_menu_items FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "online_menu_items_insert" ON online_menu_items FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "online_menu_items_update" ON online_menu_items FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "online_menu_items_delete" ON online_menu_items FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- ONLINE_ORDER_QUEUE (mod.online_ordering)
-- ============================================================
ALTER TABLE online_order_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "online_order_queue_select" ON online_order_queue FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "online_order_queue_insert" ON online_order_queue FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "online_order_queue_update" ON online_order_queue FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "online_order_queue_delete" ON online_order_queue FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- RESERVATIONS (mod.reservations)
-- ============================================================
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reservations_select" ON reservations FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "reservations_insert" ON reservations FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "reservations_update" ON reservations FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "reservations_delete" ON reservations FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- WAITLIST_ENTRIES (mod.reservations)
-- ============================================================
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlist_entries_select" ON waitlist_entries FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "waitlist_entries_insert" ON waitlist_entries FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "waitlist_entries_update" ON waitlist_entries FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "waitlist_entries_delete" ON waitlist_entries FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- SCHEDULE_TEMPLATES (mod.scheduling)
-- ============================================================
ALTER TABLE schedule_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_templates_select" ON schedule_templates FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "schedule_templates_insert" ON schedule_templates FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "schedule_templates_update" ON schedule_templates FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "schedule_templates_delete" ON schedule_templates FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- SCHEDULED_SHIFTS (mod.scheduling)
-- ============================================================
ALTER TABLE scheduled_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scheduled_shifts_select" ON scheduled_shifts FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "scheduled_shifts_insert" ON scheduled_shifts FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "scheduled_shifts_update" ON scheduled_shifts FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "scheduled_shifts_delete" ON scheduled_shifts FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- SHIFT_SWAP_REQUESTS (mod.scheduling)
-- ============================================================
ALTER TABLE shift_swap_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_swap_requests_select" ON shift_swap_requests FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "shift_swap_requests_insert" ON shift_swap_requests FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "shift_swap_requests_update" ON shift_swap_requests FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "shift_swap_requests_delete" ON shift_swap_requests FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- AVAILABILITY (mod.scheduling)
-- ============================================================
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availability_select" ON availability FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "availability_insert" ON availability FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "availability_update" ON availability FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "availability_delete" ON availability FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- CAMPAIGNS (mod.marketing)
-- ============================================================
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_select" ON campaigns FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "campaigns_insert" ON campaigns FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "campaigns_update" ON campaigns FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "campaigns_delete" ON campaigns FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- CAMPAIGN_RECIPIENTS (mod.marketing)
-- ============================================================
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_recipients_select" ON campaign_recipients FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "campaign_recipients_insert" ON campaign_recipients FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "campaign_recipients_update" ON campaign_recipients FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "campaign_recipients_delete" ON campaign_recipients FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- DELIVERY_ZONES (mod.delivery)
-- ============================================================
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delivery_zones_select" ON delivery_zones FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "delivery_zones_insert" ON delivery_zones FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "delivery_zones_update" ON delivery_zones FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "delivery_zones_delete" ON delivery_zones FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- DELIVERIES (mod.delivery)
-- ============================================================
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deliveries_select" ON deliveries FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "deliveries_insert" ON deliveries FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "deliveries_update" ON deliveries FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "deliveries_delete" ON deliveries FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- DAILY_METRICS (mod.analytics)
-- ============================================================
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_metrics_select" ON daily_metrics FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "daily_metrics_insert" ON daily_metrics FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "daily_metrics_update" ON daily_metrics FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "daily_metrics_delete" ON daily_metrics FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

-- ============================================================
-- DAILY_ITEM_METRICS (mod.analytics)
-- ============================================================
ALTER TABLE daily_item_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_item_metrics_select" ON daily_item_metrics FOR SELECT
    USING (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "daily_item_metrics_insert" ON daily_item_metrics FOR INSERT
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "daily_item_metrics_update" ON daily_item_metrics FOR UPDATE
    USING (auth.is_platform_admin() OR org_id = auth.org_id())
    WITH CHECK (auth.is_platform_admin() OR org_id = auth.org_id());

CREATE POLICY "daily_item_metrics_delete" ON daily_item_metrics FOR DELETE
    USING (auth.is_platform_admin() OR org_id = auth.org_id());
