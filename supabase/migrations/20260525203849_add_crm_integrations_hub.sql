-- 20260525203849_add_crm_integrations_hub.sql
-- Task: CRM-V12.2 - Integrations Hub
-- One-way migration; rollback in supabase/_rollbacks/20260525203849_add_crm_integrations_hub.rollback.sql

BEGIN;

CREATE TABLE IF NOT EXISTS public.crm_integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  category text NOT NULL CHECK (category IN ('email', 'sms', 'reservations', 'online_ordering', 'delivery', 'accounting', 'gift_cards', 'reviews', 'data_warehouse', 'webhooks', 'automation')),
  provider text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error', 'expired', 'pending')),
  sync_status text NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'succeeded', 'failed')),
  webhook_status text NOT NULL DEFAULT 'not_configured' CHECK (webhook_status IN ('active', 'disabled', 'failing', 'not_configured')),
  credential_ref text,
  credential_expires_at timestamptz,
  last_sync_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  records_imported_count integer NOT NULL DEFAULT 0 CHECK (records_imported_count >= 0),
  records_failed_count integer NOT NULL DEFAULT 0 CHECK (records_failed_count >= 0),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  health jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.crm_integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  connection_id uuid REFERENCES public.crm_integration_connections(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound', 'sync')),
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'skipped')),
  records_imported integer NOT NULL DEFAULT 0 CHECK (records_imported >= 0),
  records_failed integer NOT NULL DEFAULT 0 CHECK (records_failed >= 0),
  error_message text,
  payload_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE SET NULL,
  connection_id uuid REFERENCES public.crm_integration_connections(id) ON DELETE SET NULL,
  provider text NOT NULL,
  event_name text NOT NULL,
  delivery_id text,
  signature_status text NOT NULL CHECK (signature_status IN ('verified', 'failed', 'missing', 'skipped')),
  processing_status text NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received', 'processed', 'failed', 'ignored')),
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_integration_connections_org_provider_idx
  ON public.crm_integration_connections(org_id, provider, category)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_integration_connections_org_health_idx
  ON public.crm_integration_connections(org_id, status, sync_status, webhook_status);
CREATE INDEX IF NOT EXISTS crm_integration_connections_expiry_idx
  ON public.crm_integration_connections(org_id, credential_expires_at)
  WHERE credential_expires_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_integration_events_connection_idx
  ON public.crm_integration_events(org_id, connection_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS crm_integration_events_status_idx
  ON public.crm_integration_events(org_id, status, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS crm_webhook_events_delivery_idx
  ON public.crm_webhook_events(org_id, connection_id, delivery_id)
  WHERE delivery_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_webhook_events_connection_idx
  ON public.crm_webhook_events(org_id, connection_id, received_at DESC);
CREATE INDEX IF NOT EXISTS crm_webhook_events_status_idx
  ON public.crm_webhook_events(org_id, signature_status, processing_status, received_at DESC);

ALTER TABLE public.crm_integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_crm_integration_connections" ON public.crm_integration_connections
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_integration_connections" ON public.crm_integration_connections
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_integration_connections" ON public.crm_integration_connections
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_integration_connections" ON public.crm_integration_connections
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_integration_connections" ON public.crm_integration_connections
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_integration_events" ON public.crm_integration_events
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_integration_events" ON public.crm_integration_events
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_integration_events" ON public.crm_integration_events
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_integration_events" ON public.crm_integration_events
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_integration_events" ON public.crm_integration_events
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "tenant_select_crm_webhook_events" ON public.crm_webhook_events
  FOR SELECT USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_crm_webhook_events" ON public.crm_webhook_events
  FOR INSERT WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_crm_webhook_events" ON public.crm_webhook_events
  FOR UPDATE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_crm_webhook_events" ON public.crm_webhook_events
  FOR DELETE USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "service_role_bypass_crm_webhook_events" ON public.crm_webhook_events
  TO service_role USING (true) WITH CHECK (true);

COMMIT;
