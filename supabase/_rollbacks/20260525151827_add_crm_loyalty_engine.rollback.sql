-- Rollback CRM-V4.1 loyalty engine.

BEGIN;

DROP TRIGGER IF EXISTS prevent_crm_points_ledger_delete ON public.crm_points_ledger;
DROP TRIGGER IF EXISTS prevent_crm_points_ledger_update ON public.crm_points_ledger;
DROP FUNCTION IF EXISTS public.prevent_crm_points_ledger_mutation();

DROP TABLE IF EXISTS public.crm_points_ledger;
DROP TABLE IF EXISTS public.crm_reward_redemptions;
DROP TABLE IF EXISTS public.crm_tier_benefits;
DROP TABLE IF EXISTS public.crm_rewards;
DROP TABLE IF EXISTS public.crm_loyalty_accounts;
DROP TABLE IF EXISTS public.crm_loyalty_tiers;
DROP TABLE IF EXISTS public.crm_loyalty_rules;
DROP TABLE IF EXISTS public.crm_loyalty_programs;

COMMIT;
