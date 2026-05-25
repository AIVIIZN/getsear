-- 20260525114831_tighten_crm_guest_note_visibility.rollback.sql
-- Rollback for CRM-V1.1 guest note visibility tightening.

BEGIN;

DROP POLICY IF EXISTS "tenant_select_service_notes" ON public.guest_notes;
DROP POLICY IF EXISTS "tenant_insert_service_notes" ON public.guest_notes;
DROP POLICY IF EXISTS "tenant_update_service_notes" ON public.guest_notes;
DROP POLICY IF EXISTS "tenant_delete_service_notes" ON public.guest_notes;

CREATE POLICY "tenant_select_service_notes" ON public.guest_notes
  FOR SELECT
  USING (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (
      note_category <> 'sensitive'
      OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('platform_admin', 'owner', 'admin', 'manager')
    )
  );

CREATE POLICY "tenant_insert_service_notes" ON public.guest_notes
  FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (
      note_category <> 'sensitive'
      OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('platform_admin', 'owner', 'admin', 'manager')
    )
  );

CREATE POLICY "tenant_update_service_notes" ON public.guest_notes
  FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (
      note_category <> 'sensitive'
      OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('platform_admin', 'owner', 'admin', 'manager')
    )
  )
  WITH CHECK (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (
      note_category <> 'sensitive'
      OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('platform_admin', 'owner', 'admin', 'manager')
    )
  );

CREATE POLICY "tenant_delete_service_notes" ON public.guest_notes
  FOR DELETE
  USING (
    org_id = (SELECT org_id FROM public.users WHERE id = auth.uid())
    AND (
      note_category <> 'sensitive'
      OR (SELECT role FROM public.users WHERE id = auth.uid()) IN ('platform_admin', 'owner', 'admin', 'manager')
    )
  );

COMMIT;
