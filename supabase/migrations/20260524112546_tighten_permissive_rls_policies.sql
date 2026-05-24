-- 20260524112546_tighten_permissive_rls_policies.sql
-- Task: TRUST-2 — tighten remaining permissive baseline RLS policies
-- One-way migration; rollback in
--   supabase/_rollbacks/20260524112546_tighten_permissive_rls_policies.rollback.sql
--
-- WHY:
--   The baseline still has authenticated-role policies with USING (true) /
--   WITH CHECK (true) on tenant data tables. These policies bypass the RLS
--   safety net whenever a caller can reach PostgREST with another tenant's
--   row IDs. `demo_requests` is intentionally public lead capture and is not
--   changed here.
--
-- SAFETY:
--   This migration only drops permissive policies and recreates equivalent
--   operation policies scoped to the caller's org, either from the row's own
--   org_id or through the tenant-scoped parent row. Existing service_role
--   bypass policies remain unchanged for backend workers and API routes.

BEGIN;

-- Direct org_id table: ai_usage -------------------------------------------------

DROP POLICY IF EXISTS "ai_usage_insert" ON public.ai_usage;

CREATE POLICY "tenant_insert" ON public.ai_usage
  FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

-- Parent-scoped table: break_entries -> time_entries --------------------------

DROP POLICY IF EXISTS "allow_select" ON public.break_entries;
DROP POLICY IF EXISTS "allow_insert" ON public.break_entries;

CREATE POLICY "tenant_select" ON public.break_entries
  FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.time_entries te
    WHERE te.id = public.break_entries.time_entry_id
      AND te.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

CREATE POLICY "tenant_insert" ON public.break_entries
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.time_entries te
    WHERE te.id = public.break_entries.time_entry_id
      AND te.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

-- Parent-scoped table: cash_drawer_events -> cash_drawers ---------------------

DROP POLICY IF EXISTS "allow_select" ON public.cash_drawer_events;
DROP POLICY IF EXISTS "allow_insert" ON public.cash_drawer_events;

CREATE POLICY "tenant_select" ON public.cash_drawer_events
  FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.cash_drawers cd
    WHERE cd.id = public.cash_drawer_events.cash_drawer_id
      AND cd.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

CREATE POLICY "tenant_insert" ON public.cash_drawer_events
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.cash_drawers cd
    WHERE cd.id = public.cash_drawer_events.cash_drawer_id
      AND cd.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

-- Parent-scoped table: customer_addresses -> customers ------------------------

DROP POLICY IF EXISTS "allow_select" ON public.customer_addresses;
DROP POLICY IF EXISTS "allow_insert" ON public.customer_addresses;
DROP POLICY IF EXISTS "allow_delete" ON public.customer_addresses;

CREATE POLICY "tenant_select" ON public.customer_addresses
  FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = public.customer_addresses.customer_id
      AND c.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

CREATE POLICY "tenant_insert" ON public.customer_addresses
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = public.customer_addresses.customer_id
      AND c.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

CREATE POLICY "tenant_delete" ON public.customer_addresses
  FOR DELETE
  USING (EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = public.customer_addresses.customer_id
      AND c.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

-- Parent-scoped table: gift_card_transactions -> gift_cards -------------------

DROP POLICY IF EXISTS "allow_select" ON public.gift_card_transactions;
DROP POLICY IF EXISTS "allow_insert" ON public.gift_card_transactions;

CREATE POLICY "tenant_select" ON public.gift_card_transactions
  FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.gift_cards gc
    WHERE gc.id = public.gift_card_transactions.gift_card_id
      AND gc.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

CREATE POLICY "tenant_insert" ON public.gift_card_transactions
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.gift_cards gc
    WHERE gc.id = public.gift_card_transactions.gift_card_id
      AND gc.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

-- Join table: menu_item_modifier_groups -> menu_items + modifier_groups -------

DROP POLICY IF EXISTS "allow_select" ON public.menu_item_modifier_groups;
DROP POLICY IF EXISTS "allow_insert" ON public.menu_item_modifier_groups;
DROP POLICY IF EXISTS "allow_delete" ON public.menu_item_modifier_groups;

CREATE POLICY "tenant_select" ON public.menu_item_modifier_groups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.menu_items mi
      WHERE mi.id = public.menu_item_modifier_groups.menu_item_id
        AND mi.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.modifier_groups mg
      WHERE mg.id = public.menu_item_modifier_groups.modifier_group_id
        AND mg.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "tenant_insert" ON public.menu_item_modifier_groups
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.menu_items mi
      WHERE mi.id = public.menu_item_modifier_groups.menu_item_id
        AND mi.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.modifier_groups mg
      WHERE mg.id = public.menu_item_modifier_groups.modifier_group_id
        AND mg.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "tenant_delete" ON public.menu_item_modifier_groups
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.menu_items mi
      WHERE mi.id = public.menu_item_modifier_groups.menu_item_id
        AND mi.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.modifier_groups mg
      WHERE mg.id = public.menu_item_modifier_groups.modifier_group_id
        AND mg.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
  );

-- Join table: online_menu_items -> online_menus + menu_items ------------------

DROP POLICY IF EXISTS "allow_select" ON public.online_menu_items;
DROP POLICY IF EXISTS "allow_insert" ON public.online_menu_items;
DROP POLICY IF EXISTS "allow_update" ON public.online_menu_items;
DROP POLICY IF EXISTS "allow_delete" ON public.online_menu_items;

CREATE POLICY "tenant_select" ON public.online_menu_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.online_menus om
      WHERE om.id = public.online_menu_items.online_menu_id
        AND om.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.menu_items mi
      WHERE mi.id = public.online_menu_items.menu_item_id
        AND mi.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "tenant_insert" ON public.online_menu_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.online_menus om
      WHERE om.id = public.online_menu_items.online_menu_id
        AND om.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.menu_items mi
      WHERE mi.id = public.online_menu_items.menu_item_id
        AND mi.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "tenant_update" ON public.online_menu_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.online_menus om
      WHERE om.id = public.online_menu_items.online_menu_id
        AND om.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.menu_items mi
      WHERE mi.id = public.online_menu_items.menu_item_id
        AND mi.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.online_menus om
      WHERE om.id = public.online_menu_items.online_menu_id
        AND om.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.menu_items mi
      WHERE mi.id = public.online_menu_items.menu_item_id
        AND mi.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "tenant_delete" ON public.online_menu_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.online_menus om
      WHERE om.id = public.online_menu_items.online_menu_id
        AND om.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.menu_items mi
      WHERE mi.id = public.online_menu_items.menu_item_id
        AND mi.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
  );

-- Parent-scoped table: order_discounts -> orders plus optional child checks ----

DROP POLICY IF EXISTS "allow_select" ON public.order_discounts;
DROP POLICY IF EXISTS "allow_insert" ON public.order_discounts;
DROP POLICY IF EXISTS "allow_delete" ON public.order_discounts;

CREATE POLICY "tenant_select" ON public.order_discounts
  FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = public.order_discounts.order_id
      AND o.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

CREATE POLICY "tenant_insert" ON public.order_discounts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = public.order_discounts.order_id
        AND o.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
    AND (
      public.order_discounts.order_item_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.order_items oi
        WHERE oi.id = public.order_discounts.order_item_id
          AND oi.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
      )
    )
    AND (
      public.order_discounts.discount_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.discounts d
        WHERE d.id = public.order_discounts.discount_id
          AND d.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "tenant_delete" ON public.order_discounts
  FOR DELETE
  USING (EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = public.order_discounts.order_id
      AND o.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

-- Parent-scoped table: order_item_modifiers -> order_items --------------------

DROP POLICY IF EXISTS "allow_select" ON public.order_item_modifiers;
DROP POLICY IF EXISTS "allow_insert" ON public.order_item_modifiers;
DROP POLICY IF EXISTS "allow_update" ON public.order_item_modifiers;
DROP POLICY IF EXISTS "allow_delete" ON public.order_item_modifiers;

CREATE POLICY "tenant_select" ON public.order_item_modifiers
  FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.id = public.order_item_modifiers.order_item_id
      AND oi.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

CREATE POLICY "tenant_insert" ON public.order_item_modifiers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.order_items oi
      WHERE oi.id = public.order_item_modifiers.order_item_id
        AND oi.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
    AND (
      public.order_item_modifiers.modifier_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.modifiers m
        WHERE m.id = public.order_item_modifiers.modifier_id
          AND m.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
      )
    )
    AND (
      public.order_item_modifiers.modifier_group_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.modifier_groups mg
        WHERE mg.id = public.order_item_modifiers.modifier_group_id
          AND mg.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "tenant_update" ON public.order_item_modifiers
  FOR UPDATE
  USING (EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.id = public.order_item_modifiers.order_item_id
      AND oi.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ))
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.order_items oi
      WHERE oi.id = public.order_item_modifiers.order_item_id
        AND oi.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
    AND (
      public.order_item_modifiers.modifier_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.modifiers m
        WHERE m.id = public.order_item_modifiers.modifier_id
          AND m.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
      )
    )
    AND (
      public.order_item_modifiers.modifier_group_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.modifier_groups mg
        WHERE mg.id = public.order_item_modifiers.modifier_group_id
          AND mg.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "tenant_delete" ON public.order_item_modifiers
  FOR DELETE
  USING (EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.id = public.order_item_modifiers.order_item_id
      AND oi.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

-- Parent-scoped table: purchase_order_items -> purchase_orders ----------------

DROP POLICY IF EXISTS "allow_select" ON public.purchase_order_items;
DROP POLICY IF EXISTS "allow_insert" ON public.purchase_order_items;
DROP POLICY IF EXISTS "allow_update" ON public.purchase_order_items;

CREATE POLICY "tenant_select" ON public.purchase_order_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.purchase_orders po
    WHERE po.id = public.purchase_order_items.purchase_order_id
      AND po.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

CREATE POLICY "tenant_insert" ON public.purchase_order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.purchase_orders po
      WHERE po.id = public.purchase_order_items.purchase_order_id
        AND po.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.inventory_items ii
      WHERE ii.id = public.purchase_order_items.inventory_item_id
        AND ii.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
  );

CREATE POLICY "tenant_update" ON public.purchase_order_items
  FOR UPDATE
  USING (EXISTS (
    SELECT 1
    FROM public.purchase_orders po
    WHERE po.id = public.purchase_order_items.purchase_order_id
      AND po.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ))
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.purchase_orders po
      WHERE po.id = public.purchase_order_items.purchase_order_id
        AND po.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.inventory_items ii
      WHERE ii.id = public.purchase_order_items.inventory_item_id
        AND ii.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    )
  );

-- Parent-scoped table: user_permission_overrides -> users ---------------------

DROP POLICY IF EXISTS "allow_select" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "allow_insert" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "allow_update" ON public.user_permission_overrides;
DROP POLICY IF EXISTS "allow_delete" ON public.user_permission_overrides;

CREATE POLICY "tenant_select" ON public.user_permission_overrides
  FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.user_permission_overrides.user_id
      AND u.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

CREATE POLICY "tenant_insert" ON public.user_permission_overrides
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.user_permission_overrides.user_id
      AND u.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

CREATE POLICY "tenant_update" ON public.user_permission_overrides
  FOR UPDATE
  USING (EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.user_permission_overrides.user_id
      AND u.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.user_permission_overrides.user_id
      AND u.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

CREATE POLICY "tenant_delete" ON public.user_permission_overrides
  FOR DELETE
  USING (EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.user_permission_overrides.user_id
      AND u.org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
  ));

COMMIT;
