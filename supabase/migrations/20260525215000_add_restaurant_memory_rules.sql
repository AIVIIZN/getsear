-- 20260525215000_add_restaurant_memory_rules.sql
-- Task: CRM-V11.4 - Restaurant Memory
-- One-way migration; rollback in supabase/_rollbacks/20260525215000_add_restaurant_memory_rules.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.restaurant_memory_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  rule_key text NOT NULL,
  category text NOT NULL CHECK (category IN ('brand_voice', 'discount_policy', 'vip_hospitality', 'birthday', 'wine', 'recovery', 'campaign', 'next_best_action', 'other')),
  title text NOT NULL,
  rule_text text NOT NULL,
  applies_to text[] NOT NULL DEFAULT ARRAY['campaign', 'next_best_action']::text[],
  priority integer NOT NULL DEFAULT 100 CHECK (priority >= 0 AND priority <= 1000),
  active boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT restaurant_memory_rules_applies_to_allowed CHECK (
    applies_to <@ ARRAY['campaign', 'next_best_action', 'guest_summary', 'server_brief', 'recovery_message', 'segment_draft', 'report_builder', 'data_cleanup']::text[]
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_memory_rules_key_idx
  ON public.restaurant_memory_rules(org_id, rule_key);
CREATE INDEX IF NOT EXISTS restaurant_memory_rules_active_idx
  ON public.restaurant_memory_rules(org_id, active, priority, updated_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS restaurant_memory_rules_location_idx
  ON public.restaurant_memory_rules(org_id, location_id, active)
  WHERE deleted_at IS NULL AND location_id IS NOT NULL;

ALTER TABLE public.restaurant_memory_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_restaurant_memory_rules" ON public.restaurant_memory_rules
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_restaurant_memory_rules" ON public.restaurant_memory_rules
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_restaurant_memory_rules" ON public.restaurant_memory_rules
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_restaurant_memory_rules" ON public.restaurant_memory_rules
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_restaurant_memory_rules" ON public.restaurant_memory_rules
  TO service_role USING (true) WITH CHECK (true);

COMMIT;
