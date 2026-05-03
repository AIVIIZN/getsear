-- Printers, routing rules, and receipt configuration for the Sear POS printing system.
-- Part of V4 Phase 5 — Hardware Integration.

-- ============================================================
-- 1. printers table
-- ============================================================

CREATE TABLE IF NOT EXISTS printers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id   uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name          text NOT NULL,
  model         text NOT NULL CHECK (model IN (
    'star_tsp143iv', 'star_tsp143iii', 'star_mc_print3', 'star_mpop', 'star_sm_l200',
    'epson_tm_t88vii', 'epson_tm_82ii'
  )),
  connection_type text NOT NULL CHECK (connection_type IN ('network', 'cloudprnt', 'bluetooth', 'usb')),
  ip_address    text,
  port          integer DEFAULT 9100,
  role          text NOT NULL CHECK (role IN ('receipt', 'kitchen', 'bar', 'label', 'expo')),
  station_name  text,
  cash_drawer_enabled boolean NOT NULL DEFAULT false,
  cash_drawer_pin     integer NOT NULL DEFAULT 2 CHECK (cash_drawer_pin IN (2, 5)),
  pulse_duration      integer NOT NULL DEFAULT 100 CHECK (pulse_duration BETWEEN 100 AND 800),
  is_active     boolean NOT NULL DEFAULT true,
  status        text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error')),
  last_print_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_printers_org_id ON printers(org_id);
CREATE INDEX IF NOT EXISTS idx_printers_location_id ON printers(location_id);
CREATE INDEX IF NOT EXISTS idx_printers_role ON printers(role);

-- RLS
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "printers_select_own_org" ON printers
  FOR SELECT USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "printers_insert_own_org" ON printers
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "printers_update_own_org" ON printers
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "printers_delete_own_org" ON printers
  FOR DELETE USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_printers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_printers_updated_at
  BEFORE UPDATE ON printers
  FOR EACH ROW
  EXECUTE FUNCTION update_printers_updated_at();


-- ============================================================
-- 2. printer_routing_rules table
-- ============================================================

CREATE TABLE IF NOT EXISTS printer_routing_rules (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id          uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  station_name         text NOT NULL,
  primary_printer_id   uuid NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
  fallback_printer_id  uuid REFERENCES printers(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, station_name)
);

CREATE INDEX IF NOT EXISTS idx_printer_routing_rules_location_id ON printer_routing_rules(location_id);

ALTER TABLE printer_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "routing_select_own_org" ON printer_routing_rules
  FOR SELECT USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "routing_insert_own_org" ON printer_routing_rules
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "routing_update_own_org" ON printer_routing_rules
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "routing_delete_own_org" ON printer_routing_rules
  FOR DELETE USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE TRIGGER trg_printer_routing_rules_updated_at
  BEFORE UPDATE ON printer_routing_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_printers_updated_at();


-- ============================================================
-- 3. receipt_config table
-- ============================================================

CREATE TABLE IF NOT EXISTS receipt_config (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id        uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  header_text        text NOT NULL DEFAULT '',
  footer_text        text NOT NULL DEFAULT 'Thank you for dining with us!',
  logo_path          text,
  show_dual_pricing  boolean NOT NULL DEFAULT true,
  show_qr_code       boolean NOT NULL DEFAULT false,
  qr_code_url        text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id)
);

ALTER TABLE receipt_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipt_config_select_own_org" ON receipt_config
  FOR SELECT USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "receipt_config_insert_own_org" ON receipt_config
  FOR INSERT WITH CHECK (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "receipt_config_update_own_org" ON receipt_config
  FOR UPDATE USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "receipt_config_delete_own_org" ON receipt_config
  FOR DELETE USING (
    org_id = (SELECT org_id FROM users WHERE id = auth.uid())
  );

CREATE TRIGGER trg_receipt_config_updated_at
  BEFORE UPDATE ON receipt_config
  FOR EACH ROW
  EXECUTE FUNCTION update_printers_updated_at();
