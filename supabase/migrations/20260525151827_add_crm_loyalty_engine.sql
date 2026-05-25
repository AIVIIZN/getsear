-- CRM-V4.1: Loyalty programs, rewards, accounts, and immutable points ledger.
-- Rollback: supabase/_rollbacks/20260525151827_add_crm_loyalty_engine.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_loyalty_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  name text NOT NULL,
  program_type text NOT NULL DEFAULT 'points',
  status text NOT NULL DEFAULT 'active',
  points_per_dollar numeric(10, 4) NOT NULL DEFAULT 1,
  points_per_visit integer NOT NULL DEFAULT 0,
  membership_fee_cents integer NOT NULL DEFAULT 0,
  birthday_points integer NOT NULL DEFAULT 0,
  anniversary_points integer NOT NULL DEFAULT 0,
  referral_points integer NOT NULL DEFAULT 0,
  surprise_enabled boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_loyalty_programs_program_type_check CHECK (program_type IN ('points', 'visits', 'item_category', 'tiered', 'vip_club', 'paid_membership', 'birthday_anniversary', 'surprise_delight', 'punch_card', 'referral')),
  CONSTRAINT crm_loyalty_programs_status_check CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  CONSTRAINT crm_loyalty_programs_nonnegative_values_check CHECK (
    points_per_dollar >= 0
    AND points_per_visit >= 0
    AND membership_fee_cents >= 0
    AND birthday_points >= 0
    AND anniversary_points >= 0
    AND referral_points >= 0
  )
);

CREATE TABLE IF NOT EXISTS public.crm_loyalty_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  program_id uuid NOT NULL REFERENCES public.crm_loyalty_programs(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  name text NOT NULL,
  description text,
  points integer NOT NULL DEFAULT 0,
  multiplier numeric(10, 4) NOT NULL DEFAULT 1,
  minimum_spend_cents integer NOT NULL DEFAULT 0,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  menu_category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_loyalty_rules_rule_type_check CHECK (rule_type IN ('points_per_dollar', 'points_per_visit', 'item_reward', 'category_reward', 'tier_multiplier', 'vip_club', 'paid_membership', 'birthday', 'anniversary', 'surprise_delight', 'punch_card', 'referral')),
  CONSTRAINT crm_loyalty_rules_nonnegative_values_check CHECK (points >= 0 AND multiplier >= 0 AND minimum_spend_cents >= 0)
);

CREATE TABLE IF NOT EXISTS public.crm_loyalty_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.crm_loyalty_programs(id) ON DELETE CASCADE,
  name text NOT NULL,
  rank integer NOT NULL DEFAULT 0,
  threshold_points integer NOT NULL DEFAULT 0,
  threshold_spend_cents integer NOT NULL DEFAULT 0,
  points_multiplier numeric(10, 4) NOT NULL DEFAULT 1,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_loyalty_tiers_thresholds_check CHECK (threshold_points >= 0 AND threshold_spend_cents >= 0 AND points_multiplier >= 0),
  CONSTRAINT crm_loyalty_tiers_program_rank_unique UNIQUE (program_id, rank),
  CONSTRAINT crm_loyalty_tiers_program_name_unique UNIQUE (program_id, name)
);

CREATE TABLE IF NOT EXISTS public.crm_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  program_id uuid NOT NULL REFERENCES public.crm_loyalty_programs(id) ON DELETE CASCADE,
  tier_id uuid REFERENCES public.crm_loyalty_tiers(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  reward_type text NOT NULL DEFAULT 'discount_amount',
  points_cost integer NOT NULL DEFAULT 0,
  value_cents integer NOT NULL DEFAULT 0,
  percent_off numeric(5, 2),
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  menu_category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz,
  ends_at timestamptz,
  per_guest_limit integer,
  requires_manager_override boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_rewards_reward_type_check CHECK (reward_type IN ('discount_amount', 'discount_percent', 'free_item', 'free_category_item', 'experience', 'surprise_delight')),
  CONSTRAINT crm_rewards_status_check CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  CONSTRAINT crm_rewards_values_check CHECK (
    points_cost >= 0
    AND value_cents >= 0
    AND (percent_off IS NULL OR (percent_off > 0 AND percent_off <= 100))
    AND (per_guest_limit IS NULL OR per_guest_limit > 0)
  )
);

CREATE TABLE IF NOT EXISTS public.crm_tier_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.crm_loyalty_tiers(id) ON DELETE CASCADE,
  reward_id uuid REFERENCES public.crm_rewards(id) ON DELETE SET NULL,
  benefit_type text NOT NULL,
  name text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_tier_benefits_type_check CHECK (benefit_type IN ('points_multiplier', 'exclusive_reward', 'vip_service', 'paid_membership', 'birthday', 'anniversary', 'surprise_delight'))
);

CREATE TABLE IF NOT EXISTS public.crm_loyalty_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  program_id uuid NOT NULL REFERENCES public.crm_loyalty_programs(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  legacy_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  tier_id uuid REFERENCES public.crm_loyalty_tiers(id) ON DELETE SET NULL,
  account_number text NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  status text NOT NULL DEFAULT 'active',
  points_balance integer NOT NULL DEFAULT 0,
  lifetime_points_earned integer NOT NULL DEFAULT 0,
  lifetime_points_redeemed integer NOT NULL DEFAULT 0,
  visits_count integer NOT NULL DEFAULT 0,
  current_punches integer NOT NULL DEFAULT 0,
  paid_membership_renews_at timestamptz,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_loyalty_accounts_status_check CHECK (status IN ('active', 'paused', 'closed')),
  CONSTRAINT crm_loyalty_accounts_balances_check CHECK (
    points_balance >= 0
    AND lifetime_points_earned >= 0
    AND lifetime_points_redeemed >= 0
    AND visits_count >= 0
    AND current_punches >= 0
  )
);

CREATE TABLE IF NOT EXISTS public.crm_reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  account_id uuid NOT NULL REFERENCES public.crm_loyalty_accounts(id) ON DELETE RESTRICT,
  reward_id uuid NOT NULL REFERENCES public.crm_rewards(id) ON DELETE RESTRICT,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'reserved',
  points_spent integer NOT NULL DEFAULT 0,
  discount_cents integer NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,
  voided_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_reward_redemptions_status_check CHECK (status IN ('reserved', 'applied', 'voided', 'expired')),
  CONSTRAINT crm_reward_redemptions_values_check CHECK (points_spent >= 0 AND discount_cents >= 0)
);

CREATE TABLE IF NOT EXISTS public.crm_points_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  account_id uuid NOT NULL REFERENCES public.crm_loyalty_accounts(id) ON DELETE RESTRICT,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE RESTRICT,
  program_id uuid NOT NULL REFERENCES public.crm_loyalty_programs(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  redemption_id uuid REFERENCES public.crm_reward_redemptions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  points_delta integer NOT NULL,
  balance_after integer NOT NULL,
  source text NOT NULL DEFAULT 'crm',
  explanation text NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_points_ledger_event_type_check CHECK (event_type IN ('earn', 'redeem', 'adjust', 'expire', 'refund', 'void', 'surprise_delight', 'referral', 'punch')),
  CONSTRAINT crm_points_ledger_points_delta_check CHECK (points_delta <> 0),
  CONSTRAINT crm_points_ledger_balance_after_check CHECK (balance_after >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_loyalty_programs_org_name_idx ON public.crm_loyalty_programs(org_id, lower(name));
CREATE INDEX IF NOT EXISTS crm_loyalty_programs_org_status_idx ON public.crm_loyalty_programs(org_id, status);
CREATE INDEX IF NOT EXISTS crm_loyalty_rules_program_idx ON public.crm_loyalty_rules(program_id, is_active);
CREATE INDEX IF NOT EXISTS crm_loyalty_tiers_program_threshold_idx ON public.crm_loyalty_tiers(program_id, threshold_points, threshold_spend_cents);
CREATE INDEX IF NOT EXISTS crm_rewards_program_status_idx ON public.crm_rewards(program_id, status);
CREATE INDEX IF NOT EXISTS crm_tier_benefits_tier_idx ON public.crm_tier_benefits(tier_id);
CREATE UNIQUE INDEX IF NOT EXISTS crm_loyalty_accounts_program_guest_active_idx ON public.crm_loyalty_accounts(program_id, guest_id) WHERE status <> 'closed';
CREATE UNIQUE INDEX IF NOT EXISTS crm_loyalty_accounts_org_account_number_idx ON public.crm_loyalty_accounts(org_id, account_number);
CREATE INDEX IF NOT EXISTS crm_loyalty_accounts_org_guest_idx ON public.crm_loyalty_accounts(org_id, guest_id);
CREATE INDEX IF NOT EXISTS crm_reward_redemptions_account_idx ON public.crm_reward_redemptions(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_reward_redemptions_order_idx ON public.crm_reward_redemptions(org_id, order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_points_ledger_account_created_idx ON public.crm_points_ledger(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_points_ledger_order_idx ON public.crm_points_ledger(org_id, order_id) WHERE order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prevent_crm_points_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'crm_points_ledger is immutable';
END;
$$;

DROP TRIGGER IF EXISTS prevent_crm_points_ledger_update ON public.crm_points_ledger;
CREATE TRIGGER prevent_crm_points_ledger_update
  BEFORE UPDATE ON public.crm_points_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_crm_points_ledger_mutation();

DROP TRIGGER IF EXISTS prevent_crm_points_ledger_delete ON public.crm_points_ledger;
CREATE TRIGGER prevent_crm_points_ledger_delete
  BEFORE DELETE ON public.crm_points_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_crm_points_ledger_mutation();

ALTER TABLE public.crm_loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_loyalty_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_points_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_loyalty_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tier_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.crm_loyalty_programs FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_loyalty_programs FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_loyalty_programs FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_loyalty_programs FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_loyalty_rules FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_loyalty_rules FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_loyalty_rules FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_loyalty_rules FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_loyalty_accounts FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_loyalty_accounts FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_loyalty_accounts FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_loyalty_accounts FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_points_ledger FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_points_ledger FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_rewards FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_rewards FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_rewards FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_rewards FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_reward_redemptions FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_reward_redemptions FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_reward_redemptions FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_reward_redemptions FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_loyalty_tiers FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_loyalty_tiers FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_loyalty_tiers FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_loyalty_tiers FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_tier_benefits FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_tier_benefits FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_tier_benefits FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())) WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_tier_benefits FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

COMMIT;
