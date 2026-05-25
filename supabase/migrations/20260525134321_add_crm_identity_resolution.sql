-- 20260525134321_add_crm_identity_resolution.sql
-- Task: CRM-V2.2 - Identity resolution engine
-- One-way migration; rollback in supabase/_rollbacks/20260525134321_add_crm_identity_resolution.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.guest_merge_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  primary_guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  candidate_guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  confidence integer NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  confidence_level text NOT NULL CHECK (confidence_level IN ('100', '90', '75', '50', 'below_50')),
  signals text[] NOT NULL DEFAULT ARRAY[]::text[],
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'merged', 'dismissed', 'kept_separate', 'household')),
  reviewed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (primary_guest_id <> candidate_guest_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS guest_merge_candidates_pair_idx
  ON public.guest_merge_candidates(org_id, LEAST(primary_guest_id, candidate_guest_id), GREATEST(primary_guest_id, candidate_guest_id))
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS guest_merge_candidates_org_status_idx ON public.guest_merge_candidates(org_id, status, confidence DESC);
CREATE INDEX IF NOT EXISTS guest_merge_candidates_primary_idx ON public.guest_merge_candidates(org_id, primary_guest_id, status);
CREATE INDEX IF NOT EXISTS guest_merge_candidates_candidate_idx ON public.guest_merge_candidates(org_id, candidate_guest_id, status);

CREATE TABLE IF NOT EXISTS public.guest_households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  name text NOT NULL,
  primary_guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS guest_households_org_id_idx ON public.guest_households(org_id);
CREATE INDEX IF NOT EXISTS guest_households_primary_guest_idx ON public.guest_households(org_id, primary_guest_id);

CREATE TABLE IF NOT EXISTS public.guest_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  household_id uuid REFERENCES public.guest_households(id) ON DELETE CASCADE,
  source_guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  related_guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'household' CHECK (relationship_type IN ('household', 'spouse', 'partner', 'parent', 'child', 'sibling', 'caregiver', 'friend', 'other')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (source_guest_id <> related_guest_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS guest_relationships_pair_idx
  ON public.guest_relationships(org_id, LEAST(source_guest_id, related_guest_id), GREATEST(source_guest_id, related_guest_id), relationship_type)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS guest_relationships_org_id_idx ON public.guest_relationships(org_id);
CREATE INDEX IF NOT EXISTS guest_relationships_household_idx ON public.guest_relationships(org_id, household_id);
CREATE INDEX IF NOT EXISTS guest_relationships_source_idx ON public.guest_relationships(org_id, source_guest_id);
CREATE INDEX IF NOT EXISTS guest_relationships_related_idx ON public.guest_relationships(org_id, related_guest_id);

CREATE TABLE IF NOT EXISTS public.guest_merge_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  candidate_id uuid REFERENCES public.guest_merge_candidates(id) ON DELETE SET NULL,
  decision_type text NOT NULL CHECK (decision_type IN ('merge', 'dismiss', 'keep_separate', 'mark_household')),
  primary_guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  secondary_guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  household_id uuid REFERENCES public.guest_households(id) ON DELETE SET NULL,
  confidence integer NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  decided_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (primary_guest_id <> secondary_guest_id)
);

CREATE INDEX IF NOT EXISTS guest_merge_decisions_org_type_idx ON public.guest_merge_decisions(org_id, decision_type, decided_at DESC);
CREATE INDEX IF NOT EXISTS guest_merge_decisions_candidate_idx ON public.guest_merge_decisions(org_id, candidate_id);
CREATE INDEX IF NOT EXISTS guest_merge_decisions_primary_idx ON public.guest_merge_decisions(org_id, primary_guest_id);
CREATE INDEX IF NOT EXISTS guest_merge_decisions_secondary_idx ON public.guest_merge_decisions(org_id, secondary_guest_id);

ALTER TABLE public.guest_merge_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_merge_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.guest_merge_candidates
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.guest_merge_candidates
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.guest_merge_candidates
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.guest_merge_candidates
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.guest_merge_decisions
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.guest_merge_decisions
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.guest_merge_decisions
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.guest_merge_decisions
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.guest_households
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.guest_households
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.guest_households
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.guest_households
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.guest_relationships
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.guest_relationships
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.guest_relationships
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.guest_relationships
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

COMMIT;
