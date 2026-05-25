-- CRM-V4.3: Loyalty suspicious activity review queue.
-- Rollback: supabase/_rollbacks/20260525170500_add_crm_loyalty_review_items.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_loyalty_review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.crm_loyalty_accounts(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  reward_id uuid REFERENCES public.crm_rewards(id) ON DELETE SET NULL,
  redemption_id uuid REFERENCES public.crm_reward_redemptions(id) ON DELETE SET NULL,
  ledger_id uuid REFERENCES public.crm_points_ledger(id) ON DELETE SET NULL,
  signal_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  source_key text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_loyalty_review_items_signal_type_check CHECK (signal_type IN ('staff_redemption_velocity', 'manual_adjustment', 'shared_phone_cluster', 'refund_reward_loop', 'comp_reward_stacking')),
  CONSTRAINT crm_loyalty_review_items_severity_check CHECK (severity IN ('low', 'medium', 'high')),
  CONSTRAINT crm_loyalty_review_items_status_check CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
  CONSTRAINT crm_loyalty_review_items_source_unique UNIQUE (org_id, source_key)
);

CREATE INDEX IF NOT EXISTS crm_loyalty_review_items_org_status_idx
  ON public.crm_loyalty_review_items(org_id, status, detected_at DESC);
CREATE INDEX IF NOT EXISTS crm_loyalty_review_items_account_idx
  ON public.crm_loyalty_review_items(org_id, account_id, detected_at DESC)
  WHERE account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_loyalty_review_items_signal_idx
  ON public.crm_loyalty_review_items(org_id, signal_type, detected_at DESC);

ALTER TABLE public.crm_loyalty_review_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.crm_loyalty_review_items
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_loyalty_review_items
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_loyalty_review_items
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

COMMIT;
