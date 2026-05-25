-- 20260525113405_add_crm_guest_core_schema.sql
-- Task: CRM-V1.1 - Guest core schema
-- One-way migration; rollback in supabase/_rollbacks/20260525113405_add_crm_guest_core_schema.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  legacy_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  first_name text,
  last_name text,
  preferred_name text,
  birthday date,
  anniversary date,
  lifecycle_stage text NOT NULL DEFAULT 'unknown' CHECK (
    lifecycle_stage IN (
      'unknown',
      'prospect',
      'first_time',
      'second_time',
      'emerging_regular',
      'regular',
      'vip',
      'lapsed',
      'at_risk',
      'recovered',
      'dormant',
      'do_not_contact'
    )
  ),
  profile_status text NOT NULL DEFAULT 'active' CHECK (profile_status IN ('active', 'archived', 'merged')),
  is_vip boolean NOT NULL DEFAULT false,
  total_visits integer NOT NULL DEFAULT 0 CHECK (total_visits >= 0),
  total_spend numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_spend >= 0),
  average_check numeric(10,2) NOT NULL DEFAULT 0 CHECK (average_check >= 0),
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  last_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  last_reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  merged_into_guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  search_document tsvector GENERATED ALWAYS AS (
    to_tsvector(
      'simple',
      coalesce(display_name, '') || ' ' ||
      coalesce(first_name, '') || ' ' ||
      coalesce(last_name, '') || ' ' ||
      coalesce(preferred_name, '')
    )
  ) STORED,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS guests_org_id_idx ON public.guests(org_id);
CREATE INDEX IF NOT EXISTS guests_location_id_idx ON public.guests(location_id);
CREATE INDEX IF NOT EXISTS guests_lifecycle_stage_idx ON public.guests(org_id, lifecycle_stage);
CREATE INDEX IF NOT EXISTS guests_last_visit_at_idx ON public.guests(org_id, last_visit_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS guests_search_document_idx ON public.guests USING gin(search_document);
CREATE UNIQUE INDEX IF NOT EXISTS guests_legacy_customer_id_key
  ON public.guests(org_id, legacy_customer_id)
  WHERE legacy_customer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.guest_contact_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  contact_type text NOT NULL CHECK (
    contact_type IN ('email', 'phone', 'address', 'social', 'reservation', 'delivery', 'other')
  ),
  label text,
  value text NOT NULL,
  normalized_value text,
  value_hash text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  verification_source text,
  verified_at timestamptz,
  source text NOT NULL DEFAULT 'manual',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS guest_contact_points_org_id_idx ON public.guest_contact_points(org_id);
CREATE INDEX IF NOT EXISTS guest_contact_points_guest_id_idx ON public.guest_contact_points(guest_id);
CREATE INDEX IF NOT EXISTS guest_contact_points_location_id_idx ON public.guest_contact_points(location_id);
CREATE INDEX IF NOT EXISTS guest_contact_points_primary_email_hash_idx
  ON public.guest_contact_points(org_id, value_hash)
  WHERE contact_type = 'email' AND is_primary = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS guest_contact_points_primary_phone_hash_idx
  ON public.guest_contact_points(org_id, value_hash)
  WHERE contact_type = 'phone' AND is_primary = true AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS guest_contact_points_unique_hash_idx
  ON public.guest_contact_points(org_id, contact_type, value_hash)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS guest_contact_points_one_primary_per_type_idx
  ON public.guest_contact_points(org_id, guest_id, contact_type)
  WHERE is_primary = true AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.guest_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  identifier_type text NOT NULL CHECK (
    identifier_type IN (
      'loyalty_id',
      'external_system_id',
      'payment_token_reference',
      'online_ordering_account_id',
      'gift_card_id',
      'reservation_system_id',
      'other'
    )
  ),
  provider text,
  display_value text,
  value_hash text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS guest_identifiers_org_id_idx ON public.guest_identifiers(org_id);
CREATE INDEX IF NOT EXISTS guest_identifiers_guest_id_idx ON public.guest_identifiers(guest_id);
CREATE INDEX IF NOT EXISTS guest_identifiers_location_id_idx ON public.guest_identifiers(location_id);
CREATE UNIQUE INDEX IF NOT EXISTS guest_identifiers_unique_hash_idx
  ON public.guest_identifiers(org_id, identifier_type, provider, value_hash)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.guest_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  note_category text NOT NULL DEFAULT 'general' CHECK (
    note_category IN (
      'general',
      'hospitality',
      'service_recovery',
      'preference',
      'allergy',
      'sensitive'
    )
  ),
  visibility text NOT NULL DEFAULT 'service' CHECK (visibility IN ('service', 'manager', 'owner')),
  body text NOT NULL CHECK (length(body) <= 5000),
  pinned boolean NOT NULL DEFAULT false,
  author_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS guest_notes_org_id_idx ON public.guest_notes(org_id);
CREATE INDEX IF NOT EXISTS guest_notes_guest_id_idx ON public.guest_notes(guest_id);
CREATE INDEX IF NOT EXISTS guest_notes_location_id_idx ON public.guest_notes(location_id);
CREATE INDEX IF NOT EXISTS guest_notes_category_idx ON public.guest_notes(org_id, note_category);
CREATE INDEX IF NOT EXISTS guest_notes_pinned_idx ON public.guest_notes(org_id, guest_id, pinned)
  WHERE pinned = true AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.guest_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  preference_category text NOT NULL CHECK (
    preference_category IN ('menu', 'seating', 'service', 'occasion', 'channel', 'accessibility', 'other')
  ),
  preference_key text NOT NULL,
  preference_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric(4,3) NOT NULL DEFAULT 1 CHECK (confidence >= 0 AND confidence <= 1),
  source text NOT NULL DEFAULT 'manual',
  last_observed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS guest_preferences_org_id_idx ON public.guest_preferences(org_id);
CREATE INDEX IF NOT EXISTS guest_preferences_guest_id_idx ON public.guest_preferences(guest_id);
CREATE INDEX IF NOT EXISTS guest_preferences_location_id_idx ON public.guest_preferences(location_id);
CREATE INDEX IF NOT EXISTS guest_preferences_category_idx ON public.guest_preferences(org_id, preference_category);
CREATE UNIQUE INDEX IF NOT EXISTS guest_preferences_unique_key_idx
  ON public.guest_preferences(org_id, guest_id, preference_category, preference_key)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.guest_allergies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  allergen text NOT NULL,
  severity text NOT NULL DEFAULT 'unknown' CHECK (severity IN ('unknown', 'mild', 'moderate', 'severe', 'life_threatening')),
  reaction_notes text,
  source text NOT NULL DEFAULT 'manual',
  verified_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS guest_allergies_org_id_idx ON public.guest_allergies(org_id);
CREATE INDEX IF NOT EXISTS guest_allergies_guest_id_idx ON public.guest_allergies(guest_id);
CREATE INDEX IF NOT EXISTS guest_allergies_location_id_idx ON public.guest_allergies(location_id);
CREATE INDEX IF NOT EXISTS guest_allergies_active_idx ON public.guest_allergies(org_id, guest_id, is_active)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS guest_allergies_unique_active_idx
  ON public.guest_allergies(org_id, guest_id, lower(allergen))
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.crm_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  tag_category text NOT NULL DEFAULT 'custom' CHECK (
    tag_category IN ('custom', 'lifecycle', 'preference', 'allergy', 'marketing', 'loyalty', 'risk', 'system')
  ),
  color_token text,
  is_system boolean NOT NULL DEFAULT false,
  is_sensitive boolean NOT NULL DEFAULT false,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS crm_tags_org_id_idx ON public.crm_tags(org_id);
CREATE INDEX IF NOT EXISTS crm_tags_location_id_idx ON public.crm_tags(location_id);
CREATE INDEX IF NOT EXISTS crm_tags_category_idx ON public.crm_tags(org_id, tag_category);
CREATE UNIQUE INDEX IF NOT EXISTS crm_tags_slug_key
  ON public.crm_tags(org_id, slug)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.guest_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.crm_tags(id) ON DELETE CASCADE,
  assigned_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  assignment_source text NOT NULL DEFAULT 'manual',
  assignment_reason text,
  confidence numeric(4,3) NOT NULL DEFAULT 1 CHECK (confidence >= 0 AND confidence <= 1),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS guest_tags_org_id_idx ON public.guest_tags(org_id);
CREATE INDEX IF NOT EXISTS guest_tags_location_id_idx ON public.guest_tags(location_id);
CREATE INDEX IF NOT EXISTS guest_tags_guest_id_idx ON public.guest_tags(guest_id);
CREATE INDEX IF NOT EXISTS guest_tags_tag_id_idx ON public.guest_tags(tag_id);
CREATE UNIQUE INDEX IF NOT EXISTS guest_tags_unique_active_idx
  ON public.guest_tags(org_id, guest_id, tag_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.guest_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_source text NOT NULL DEFAULT 'crm',
  event_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  visibility text NOT NULL DEFAULT 'service' CHECK (visibility IN ('service', 'manager', 'owner')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_timeline_events_org_id_idx ON public.guest_timeline_events(org_id);
CREATE INDEX IF NOT EXISTS guest_timeline_events_location_id_idx ON public.guest_timeline_events(location_id);
CREATE INDEX IF NOT EXISTS guest_timeline_events_guest_id_idx ON public.guest_timeline_events(guest_id);
CREATE INDEX IF NOT EXISTS guest_timeline_events_event_at_idx ON public.guest_timeline_events(org_id, guest_id, event_at DESC);
CREATE INDEX IF NOT EXISTS guest_timeline_events_type_idx ON public.guest_timeline_events(org_id, event_type);

ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_contact_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_timeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select" ON public.guests
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.guests
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.guests
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.guests
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.guest_contact_points
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.guest_contact_points
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.guest_contact_points
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.guest_contact_points
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.guest_identifiers
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.guest_identifiers
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.guest_identifiers
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.guest_identifiers
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select_service_notes" ON public.guest_notes
  FOR SELECT
  USING (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (
      (visibility = 'service' AND note_category <> 'sensitive')
      OR (visibility = 'manager' AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('platform_admin', 'owner', 'admin', 'manager'))
      OR (visibility = 'owner' AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('platform_admin', 'owner', 'admin'))
    )
  );
CREATE POLICY "tenant_insert_service_notes" ON public.guest_notes
  FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (note_category <> 'sensitive' OR visibility IN ('manager', 'owner'))
    AND (
      visibility = 'service'
      OR (visibility = 'manager' AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('platform_admin', 'owner', 'admin', 'manager'))
      OR (visibility = 'owner' AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('platform_admin', 'owner', 'admin'))
    )
  );
CREATE POLICY "tenant_update_service_notes" ON public.guest_notes
  FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (
      (visibility = 'service' AND note_category <> 'sensitive')
      OR (visibility = 'manager' AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('platform_admin', 'owner', 'admin', 'manager'))
      OR (visibility = 'owner' AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('platform_admin', 'owner', 'admin'))
    )
  )
  WITH CHECK (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (note_category <> 'sensitive' OR visibility IN ('manager', 'owner'))
    AND (
      visibility = 'service'
      OR (visibility = 'manager' AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('platform_admin', 'owner', 'admin', 'manager'))
      OR (visibility = 'owner' AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('platform_admin', 'owner', 'admin'))
    )
  );
CREATE POLICY "tenant_delete_service_notes" ON public.guest_notes
  FOR DELETE
  USING (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (
      (visibility = 'service' AND note_category <> 'sensitive')
      OR (visibility = 'manager' AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('platform_admin', 'owner', 'admin', 'manager'))
      OR (visibility = 'owner' AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('platform_admin', 'owner', 'admin'))
    )
  );

CREATE POLICY "tenant_select" ON public.guest_preferences
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.guest_preferences
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.guest_preferences
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.guest_preferences
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.guest_allergies
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.guest_allergies
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.guest_allergies
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.guest_allergies
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.crm_tags
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.crm_tags
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.crm_tags
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.crm_tags
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.guest_tags
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.guest_tags
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.guest_tags
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.guest_tags
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "tenant_select" ON public.guest_timeline_events
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert" ON public.guest_timeline_events
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update" ON public.guest_timeline_events
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete" ON public.guest_timeline_events
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

COMMIT;
