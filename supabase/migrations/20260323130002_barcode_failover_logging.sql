-- ============================================================================
-- Session 5.3: Barcode Scanner, Printer Failover & Print Job Logging
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Ensure barcode column exists on menu_items (may already exist)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'menu_items' AND column_name = 'barcode'
  ) THEN
    ALTER TABLE menu_items ADD COLUMN barcode text;
  END IF;
END $$;

-- Index for barcode lookups (partial index — only rows with a barcode)
CREATE INDEX IF NOT EXISTS idx_menu_items_barcode
  ON menu_items (org_id, barcode)
  WHERE barcode IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. print_jobs table — stores every print job for history & reprints
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS print_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  location_id     uuid NOT NULL REFERENCES locations(id),
  printer_id      uuid NOT NULL,
  printer_name    text,
  job_type        text NOT NULL CHECK (job_type IN (
    'receipt', 'kitchen', 'void', 'kds_failover', 'bar', 'label', 'report'
  )),
  order_id        uuid REFERENCES orders(id),
  order_number    text,
  document_data   text NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'sending', 'completed', 'failed', 'cancelled'
  )),
  attempts        int NOT NULL DEFAULT 0,
  error_message   text,
  metadata        jsonb,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_print_jobs_org
  ON print_jobs (org_id);

CREATE INDEX IF NOT EXISTS idx_print_jobs_location
  ON print_jobs (location_id);

CREATE INDEX IF NOT EXISTS idx_print_jobs_status
  ON print_jobs (status)
  WHERE status IN ('pending', 'sending');

CREATE INDEX IF NOT EXISTS idx_print_jobs_created
  ON print_jobs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_print_jobs_order
  ON print_jobs (order_id)
  WHERE order_id IS NOT NULL;

-- RLS
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_jobs_tenant_select" ON print_jobs
  FOR SELECT USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );

CREATE POLICY "print_jobs_tenant_insert" ON print_jobs
  FOR INSERT WITH CHECK (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );

CREATE POLICY "print_jobs_tenant_update" ON print_jobs
  FOR UPDATE USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );

CREATE POLICY "print_jobs_tenant_delete" ON print_jobs
  FOR DELETE USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );

-- ---------------------------------------------------------------------------
-- 3. print_failover_log table — tracks printer failover events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS print_failover_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organizations(id),
  location_id         uuid NOT NULL REFERENCES locations(id),
  station_id          uuid,
  station_name        text NOT NULL,
  primary_printer_id  uuid NOT NULL,
  fallback_printer_id uuid NOT NULL,
  reason              text NOT NULL,
  started_at          timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_print_failover_log_org
  ON print_failover_log (org_id);

CREATE INDEX IF NOT EXISTS idx_print_failover_log_location
  ON print_failover_log (location_id);

CREATE INDEX IF NOT EXISTS idx_print_failover_log_active
  ON print_failover_log (station_id, location_id)
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_print_failover_log_created
  ON print_failover_log (created_at DESC);

-- RLS
ALTER TABLE print_failover_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "print_failover_log_tenant_select" ON print_failover_log
  FOR SELECT USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );

CREATE POLICY "print_failover_log_tenant_insert" ON print_failover_log
  FOR INSERT WITH CHECK (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );

CREATE POLICY "print_failover_log_tenant_update" ON print_failover_log
  FOR UPDATE USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );

CREATE POLICY "print_failover_log_tenant_delete" ON print_failover_log
  FOR DELETE USING (
    org_id = (current_setting('request.jwt.claims', true)::json->>'org_id')::uuid
  );

-- ---------------------------------------------------------------------------
-- 4. Updated_at trigger for print_jobs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_print_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_print_jobs_updated_at ON print_jobs;
CREATE TRIGGER trg_print_jobs_updated_at
  BEFORE UPDATE ON print_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_print_jobs_updated_at();
