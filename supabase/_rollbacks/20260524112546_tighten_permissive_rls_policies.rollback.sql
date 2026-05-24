-- 20260524112546_tighten_permissive_rls_policies.rollback.sql
-- Rollback for TRUST-2 permissive RLS tightening. Restores the baseline
-- always-true policies that existed before the forward migration.

BEGIN;

DROP POLICY IF EXISTS "tenant_insert" ON public.ai_usage;
CREATE POLICY "ai_usage_insert" ON public.ai_usage
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_select" ON public.break_entries;
DROP POLICY IF EXISTS "tenant_insert" ON public.break_entries;
CREATE POLICY "allow_select" ON public.break_entries
  FOR SELECT USING (true);
CREATE POLICY "allow_insert" ON public.break_entries
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_select" ON public.cash_drawer_events;
DROP POLICY IF EXISTS "tenant_insert" ON public.cash_drawer_events;
CREATE POLICY "allow_select" ON public.cash_drawer_events
  FOR SELECT USING (true);
CREATE POLICY "allow_insert" ON public.cash_drawer_events
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_select" ON public.customer_addresses;
DROP POLICY IF EXISTS "tenant_insert" ON public.customer_addresses;
DROP POLICY IF EXISTS "tenant_delete" ON public.customer_addresses;
CREATE POLICY "allow_select" ON public.customer_addresses
  FOR SELECT USING (true);
CREATE POLICY "allow_insert" ON public.customer_addresses
  FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_delete" ON public.customer_addresses
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "tenant_select" ON public.gift_card_transactions;
DROP POLICY IF EXISTS "tenant_insert" ON public.gift_card_transactions;
CREATE POLICY "allow_select" ON public.gift_card_transactions
  FOR SELECT USING (true);
CREATE POLICY "allow_insert" ON public.gift_card_transactions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_select" ON public.menu_item_modifier_groups;
DROP POLICY IF EXISTS "tenant_insert" ON public.menu_item_modifier_groups;
DROP POLICY IF EXISTS "tenant_delete" ON public.menu_item_modifier_groups;
CREATE POLICY "allow_select" ON public.menu_item_modifier_groups
  FOR SELECT USING (true);
CREATE POLICY "allow_insert" ON public.menu_item_modifier_groups
  FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_delete" ON public.menu_item_modifier_groups
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "tenant_select" ON public.online_menu_items;
DROP POLICY IF EXISTS "tenant_insert" ON public.online_menu_items;
DROP POLICY IF EXISTS "tenant_update" ON public.online_menu_items;
DROP POLICY IF EXISTS "tenant_delete" ON public.online_menu_items;
CREATE POLICY "allow_select" ON public.online_menu_items
  FOR SELECT USING (true);
CREATE POLICY "allow_insert" ON public.online_menu_items
  FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_update" ON public.online_menu_items
  FOR UPDATE USING (true);
CREATE POLICY "allow_delete" ON public.online_menu_items
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "tenant_select" ON public.order_discounts;
DROP POLICY IF EXISTS "tenant_insert" ON public.order_discounts;
DROP POLICY IF EXISTS "tenant_delete" ON public.order_discounts;
CREATE POLICY "allow_select" ON public.order_discounts
  FOR SELECT USING (true);
CREATE POLICY "allow_insert" ON public.order_discounts
  FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_delete" ON public.order_discounts
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "tenant_select" ON public.order_item_modifiers;
DROP POLICY IF EXISTS "tenant_insert" ON public.order_item_modifiers;
DROP POLICY IF EXISTS "tenant_update" ON public.order_item_modifiers;
DROP POLICY IF EXISTS "tenant_delete" ON public.order_item_modifiers;
CREATE POLICY "allow_select" ON public.order_item_modifiers
  FOR SELECT USING (true);
CREATE POLICY "allow_insert" ON public.order_item_modifiers
  FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_update" ON public.order_item_modifiers
  FOR UPDATE USING (true);
CREATE POLICY "allow_delete" ON public.order_item_modifiers
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "tenant_select" ON public.purchase_order_items;
DROP POLICY IF EXISTS "tenant_insert" ON public.purchase_order_items;
DROP POLICY IF EXISTS "tenant_update" ON public.purchase_order_items;
CREATE POLICY "allow_select" ON public.purchase_order_items
  FOR SELECT USING (true);
CREATE POLICY "allow_insert" ON public.purchase_order_items
  FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_update" ON public.purchase_order_items
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "tenant_select" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "tenant_insert" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "tenant_update" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "tenant_delete" ON public.user_permission_overrides;
CREATE POLICY "allow_select" ON public.user_permission_overrides
  FOR SELECT USING (true);
CREATE POLICY "allow_insert" ON public.user_permission_overrides
  FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_update" ON public.user_permission_overrides
  FOR UPDATE USING (true);
CREATE POLICY "allow_delete" ON public.user_permission_overrides
  FOR DELETE USING (true);

COMMIT;
