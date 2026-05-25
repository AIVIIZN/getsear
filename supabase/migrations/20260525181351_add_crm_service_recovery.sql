-- 20260525181351_add_crm_service_recovery.sql
-- Task: CRM-V9.2 - Service recovery center
-- One-way migration; rollback in supabase/_rollbacks/20260525181351_add_crm_service_recovery.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_recovery_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  staff_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  complaint_id uuid REFERENCES public.crm_complaints(id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (
    source_type IN ('low_score', 'bad_review', 'refund', 'comp', 'void', 'long_wait', 'manager_note', 'complaint_tag', 'churn_after_issue', 'manual')
  ),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'in_progress', 'waiting_for_guest', 'resolved', 'closed', 'escalated')),
  issue_summary text NOT NULL CHECK (length(trim(issue_summary)) > 0),
  issue_detail text,
  topics text[] NOT NULL DEFAULT '{}' CHECK (
    topics <@ ARRAY['food', 'service', 'speed', 'cleanliness', 'pricing', 'reservation', 'delivery', 'staff_compliment']::text[]
  ),
  assigned_manager_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  deadline_at timestamptz,
  ai_summary text,
  recommended_action text,
  resolution_summary text,
  resolved_at timestamptz,
  closed_at timestamptz,
  followup_due_at timestamptz,
  followup_completed_at timestamptz,
  recovered_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  recovered_at timestamptz,
  recovered_revenue numeric(10,2) NOT NULL DEFAULT 0,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_recovery_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recovery_case_id uuid NOT NULL REFERENCES public.crm_recovery_cases(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (
    action_type IN ('assign', 'status_change', 'manager_note', 'guest_message', 'refund', 'comp', 'void', 'coupon', 'call', 'email', 'sms', 'resolve', 'close', 'escalate')
  ),
  status_before text CHECK (status_before IN ('new', 'assigned', 'in_progress', 'waiting_for_guest', 'resolved', 'closed', 'escalated')),
  status_after text CHECK (status_after IN ('new', 'assigned', 'in_progress', 'waiting_for_guest', 'resolved', 'closed', 'escalated')),
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_manager_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  note text,
  value_cents integer NOT NULL DEFAULT 0 CHECK (value_cents >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_recovery_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recovery_case_id uuid NOT NULL REFERENCES public.crm_recovery_cases(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'manager_task' CHECK (channel IN ('manager_task', 'phone', 'email', 'sms', 'in_person')),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'missed', 'cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  outcome text CHECK (outcome IN ('guest_contacted', 'guest_returned', 'no_response', 'needs_escalation', 'resolved_without_contact')),
  note text,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  completed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_recovery_cases_complaint_unique_idx
  ON public.crm_recovery_cases(org_id, complaint_id)
  WHERE complaint_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_recovery_cases_org_status_idx ON public.crm_recovery_cases(org_id, status, deadline_at ASC NULLS LAST, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_recovery_cases_guest_idx ON public.crm_recovery_cases(org_id, guest_id, created_at DESC) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_recovery_cases_assignee_idx ON public.crm_recovery_cases(org_id, assigned_manager_user_id, status) WHERE assigned_manager_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_recovery_actions_case_idx ON public.crm_recovery_actions(org_id, recovery_case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_recovery_followups_case_idx ON public.crm_recovery_followups(org_id, recovery_case_id, due_at ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS crm_recovery_followups_status_idx ON public.crm_recovery_followups(org_id, status, due_at ASC NULLS LAST);

ALTER TABLE public.crm_recovery_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_recovery_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_recovery_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.crm_recovery_cases
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_recovery_cases
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_recovery_cases
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_recovery_cases
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_recovery_actions
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_recovery_actions
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_recovery_actions
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_recovery_actions
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_recovery_followups
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_recovery_followups
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_recovery_followups
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_recovery_followups
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

COMMIT;
