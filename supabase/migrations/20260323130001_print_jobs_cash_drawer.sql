-- ============================================================================
-- Print Jobs & Cash Drawer Events
-- Session 5.2: Kitchen Ticket Printing, Cash Drawer & Print Queue
-- ============================================================================

-- ---------------------------------------------------------------------------
-- print_jobs — Server-side record of all print jobs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS print_jobs (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        uuid        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  location_id   uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  printer_id    uuid        NOT NULL,
  job_type      text        NOT NULL CHECK (job_type IN ('receipt', 'kitchen_ticket', 'cash_drawer', 'test_page', 'label')),
  document_data text        NOT NULL DEFAULT '',
  status        text        NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'printing', 'printed', 'failed', 'cancelled')),
  attempts      int         NOT NULL DEFAULT 0,
  error_message text,
  priority      int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_print_jobs_org_status
  ON print_jobs(org_id, status);

CREATE INDEX IF NOT EXISTS idx_print_jobs_location_status
  ON print_jobs(location_id, status);

CREATE INDEX IF NOT EXISTS idx_print_jobs_printer_created
  ON print_jobs(printer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at
  ON print_jobs(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_print_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_print_jobs_updated_at
  BEFORE UPDATE ON print_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_print_jobs_updated_at();

-- RLS
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org print jobs"
  ON print_jobs FOR SELECT
  USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert print jobs for their org"
  ON print_jobs FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their org print jobs"
  ON print_jobs FOR UPDATE
  USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Managers can delete their org print jobs"
  ON print_jobs FOR DELETE
  USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('owner', 'admin', 'manager')
  );


-- ---------------------------------------------------------------------------
-- cash_drawer_events — Audit log for every cash drawer open
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cash_drawer_events (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        uuid        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  location_id   uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  printer_id    uuid        NOT NULL,
  staff_id      uuid        NOT NULL,
  terminal_id   uuid,
  event_type    text        NOT NULL CHECK (event_type IN ('no_sale', 'cash_payment', 'shift_count')),
  reason        text        NOT NULL DEFAULT '',
  amount        numeric(10,2),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for shift-based no-sale counting
CREATE INDEX IF NOT EXISTS idx_cash_drawer_events_staff_type
  ON cash_drawer_events(staff_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_events_org_location
  ON cash_drawer_events(org_id, location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_events_created_at
  ON cash_drawer_events(created_at DESC);

-- RLS
ALTER TABLE cash_drawer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org cash drawer events"
  ON cash_drawer_events FOR SELECT
  USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert cash drawer events for their org"
  ON cash_drawer_events FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));


-- ---------------------------------------------------------------------------
-- printer_routing_rules — Station-to-printer mapping
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS printer_routing_rules (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id                uuid        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  location_id           uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  station_name          text        NOT NULL,
  primary_printer_id    uuid        NOT NULL,
  fallback_printer_id   uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- One rule per station per location
  UNIQUE (location_id, station_name)
);

CREATE INDEX IF NOT EXISTS idx_printer_routing_rules_location
  ON printer_routing_rules(location_id);

-- Auto-update updated_at
CREATE TRIGGER trg_printer_routing_rules_updated_at
  BEFORE UPDATE ON printer_routing_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_print_jobs_updated_at();

-- RLS
ALTER TABLE printer_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org routing rules"
  ON printer_routing_rules FOR SELECT
  USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Managers can manage routing rules"
  ON printer_routing_rules FOR ALL
  USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('owner', 'admin', 'manager')
  );


-- ---------------------------------------------------------------------------
-- Ensure printers table has cash drawer columns
-- (printers table may be created by Worker 5.1; add columns if missing)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  -- Create printers table if it doesn't exist yet
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'printers') THEN
    CREATE TABLE printers (
      id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
      org_id                uuid        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      location_id           uuid        NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      name                  text        NOT NULL,
      model                 text        NOT NULL DEFAULT '',
      connection_type       text        NOT NULL DEFAULT 'network' CHECK (connection_type IN ('network', 'cloudprnt', 'bluetooth', 'usb')),
      ip_address            text,
      port                  int         DEFAULT 9100,
      role                  text        NOT NULL DEFAULT 'receipt' CHECK (role IN ('receipt', 'kitchen', 'bar', 'label')),
      station_name          text,
      cash_drawer_enabled   boolean     NOT NULL DEFAULT false,
      cash_drawer_pin       int         DEFAULT 2 CHECK (cash_drawer_pin IN (2, 5)),
      pulse_duration        int         DEFAULT 200 CHECK (pulse_duration BETWEEN 100 AND 800),
      is_active             boolean     NOT NULL DEFAULT true,
      status                text        NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error', 'paper_low')),
      last_print_at         timestamptz,
      created_at            timestamptz NOT NULL DEFAULT now(),
      updated_at            timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX idx_printers_org_location ON printers(org_id, location_id);
    CREATE INDEX idx_printers_location_role ON printers(location_id, role);

    ALTER TABLE printers ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view their org printers"
      ON printers FOR SELECT
      USING (org_id = (SELECT org_id FROM users WHERE id = auth.uid()));

    CREATE POLICY "Managers can manage printers"
      ON printers FOR ALL
      USING (
        org_id = (SELECT org_id FROM users WHERE id = auth.uid())
        AND (SELECT role FROM users WHERE id = auth.uid()) IN ('owner', 'admin', 'manager')
      );
  ELSE
    -- Add cash drawer columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printers' AND column_name = 'cash_drawer_enabled') THEN
      ALTER TABLE printers ADD COLUMN cash_drawer_enabled boolean NOT NULL DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printers' AND column_name = 'cash_drawer_pin') THEN
      ALTER TABLE printers ADD COLUMN cash_drawer_pin int DEFAULT 2 CHECK (cash_drawer_pin IN (2, 5));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'printers' AND column_name = 'pulse_duration') THEN
      ALTER TABLE printers ADD COLUMN pulse_duration int DEFAULT 200 CHECK (pulse_duration BETWEEN 100 AND 800);
    END IF;
  END IF;
END $$;
