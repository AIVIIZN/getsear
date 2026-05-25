-- 20260525140821_add_crm_consent_center.sql
-- Task: CRM-V3.1 - Consent center
-- One-way migration; rollback in supabase/_rollbacks/20260525140821_add_crm_consent_center.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.consent_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  policy_key text NOT NULL CHECK (policy_key IN ('email_marketing', 'sms_marketing', 'transactional', 'loyalty', 'reservation', 'feedback', 'push', 'personalization')),
  version_label text NOT NULL,
  language text NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS consent_policy_versions_key_label_idx
  ON public.consent_policy_versions(org_id, policy_key, version_label);
CREATE INDEX IF NOT EXISTS consent_policy_versions_active_idx
  ON public.consent_policy_versions(org_id, policy_key, effective_at DESC)
  WHERE retired_at IS NULL;

CREATE TABLE IF NOT EXISTS public.guest_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  contact_point_id uuid REFERENCES public.guest_contact_points(id) ON DELETE SET NULL,
  policy_version_id uuid REFERENCES public.consent_policy_versions(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app', 'phone', 'mail')),
  purpose text NOT NULL CHECK (purpose IN ('marketing', 'transactional', 'loyalty', 'reservation', 'feedback', 'personalization')),
  status text NOT NULL CHECK (status IN ('granted', 'revoked', 'unknown')),
  source text NOT NULL DEFAULT 'manual',
  proof jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'revoked' AND revoked_at IS NOT NULL) OR (status <> 'revoked' AND revoked_at IS NULL))
);

CREATE INDEX IF NOT EXISTS guest_consents_org_guest_idx ON public.guest_consents(org_id, guest_id);
CREATE INDEX IF NOT EXISTS guest_consents_channel_purpose_idx ON public.guest_consents(org_id, channel, purpose, status);
CREATE INDEX IF NOT EXISTS guest_consents_contact_point_idx ON public.guest_consents(org_id, contact_point_id);
CREATE UNIQUE INDEX IF NOT EXISTS guest_consents_guest_channel_purpose_idx
  ON public.guest_consents(org_id, guest_id, channel, purpose);

CREATE TABLE IF NOT EXISTS public.suppression_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES public.guests(id) ON DELETE CASCADE,
  contact_point_id uuid REFERENCES public.guest_contact_points(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app', 'phone', 'mail')),
  purpose text NOT NULL DEFAULT 'marketing' CHECK (purpose IN ('marketing', 'transactional', 'loyalty', 'reservation', 'feedback', 'personalization', 'all')),
  suppressed_value_hash text,
  reason text NOT NULL CHECK (reason IN ('revoked_consent', 'unsubscribe', 'bounce', 'complaint', 'privacy_request', 'manual', 'legal_hold')),
  source text NOT NULL DEFAULT 'crm',
  proof jsonb NOT NULL DEFAULT '{}'::jsonb,
  suppressed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  suppressed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS suppression_entries_org_guest_idx ON public.suppression_entries(org_id, guest_id);
CREATE INDEX IF NOT EXISTS suppression_entries_channel_idx ON public.suppression_entries(org_id, channel, purpose, suppressed_at DESC);
CREATE INDEX IF NOT EXISTS suppression_entries_value_hash_idx ON public.suppression_entries(org_id, channel, suppressed_value_hash)
  WHERE suppressed_value_hash IS NOT NULL;

ALTER TABLE public.consent_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppression_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.consent_policy_versions
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.consent_policy_versions
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.consent_policy_versions
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.consent_policy_versions
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.guest_consents
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.guest_consents
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.guest_consents
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.guest_consents
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.suppression_entries
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.suppression_entries
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.suppression_entries
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.suppression_entries
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

COMMIT;
