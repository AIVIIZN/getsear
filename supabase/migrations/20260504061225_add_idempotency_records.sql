-- 20260504061225_add_idempotency_records.sql
-- Task: 5.3.1 (fix cycle 2) — server-side idempotency support for the offline queue
-- One-way migration; rollback in supabase/_rollbacks/20260504061225_add_idempotency_records.rollback.sql
--
-- WHY: V5.3.1 buffers POS mutations in IndexedDB and replays them on reconnect.
-- Each replay carries an `Idempotency-Key` header (UUIDv4 minted client-side
-- in `src/lib/offline/sync-queue.ts`). The server middleware
-- `src/lib/api/idempotency.ts` consults this table on every wrapped POST/PATCH:
--   - first hit  → run the handler, capture (status, body), store the row
--   - replay     → return the stored response verbatim
-- This prevents the canonical "network blip → duplicate order / double charge"
-- bug. The dedup scope is `(key, route, org_id)` so the same key on different
-- routes or different tenants can never collide.
--
-- Persistence: 24-hour TTL (default expires_at). A future cron job prunes
-- expired rows; for now the table grows then is trimmed manually.

BEGIN;

CREATE TABLE IF NOT EXISTS public.idempotency_records (
  -- Composite identity: a single client-minted UUIDv4 may legitimately appear
  -- on different routes (different operations), so the unique key is the
  -- triple. Keeping `key` as plain uuid (not the PK) lets us index on it
  -- naturally for the hot lookup path.
  key uuid NOT NULL,
  route text NOT NULL,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- The full response we returned to the original caller. JSONB so the
  -- middleware can serialize/deserialize cleanly across handler shapes.
  response_body jsonb,
  -- HTTP status (e.g., 201 Created, 200 OK, 400 Bad Request). Replays return
  -- the same status — including 4xx, since the second caller deserves the
  -- same answer the first one got.
  response_status integer NOT NULL CHECK (response_status >= 100 AND response_status < 600),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),

  PRIMARY KEY (key, route, org_id)
);

COMMENT ON TABLE public.idempotency_records IS
  'Server-side dedup cache for the V5.3.1 offline mutation queue. Rows expire '
  'after 24 hours via expires_at — middleware filters them out of lookups, and '
  'a periodic cleanup will prune. Scope is (key, route, org_id) so a single '
  'UUIDv4 can be reused across routes/tenants without collision.';

COMMENT ON COLUMN public.idempotency_records.response_body IS
  'JSONB snapshot of the original handler''s response body. NULL for empty '
  '(204 No Content) responses. Stored verbatim so replays return byte-equal '
  'JSON to the original caller.';

COMMENT ON COLUMN public.idempotency_records.expires_at IS
  'TTL = created_at + 24h. Beyond this, the row is invisible to lookups and '
  'eligible for deletion. The middleware always filters on expires_at so we '
  'never serve a stale-by-policy row even if the cleanup job lags.';

-- Hot lookup path: middleware queries `(key, route, org_id) WHERE expires_at >= now()`.
-- The PK already covers the equality lookup. Add an index on expires_at for
-- the cleanup cron's `DELETE WHERE expires_at < now()` scan.
CREATE INDEX IF NOT EXISTS idempotency_records_expires_at_idx
  ON public.idempotency_records(expires_at);

-- Tenant index for ad-hoc forensics (rarely queried; cheap to maintain).
CREATE INDEX IF NOT EXISTS idempotency_records_org_id_idx
  ON public.idempotency_records(org_id);

-- RLS. The middleware uses the service-role admin client (bypasses RLS) so
-- these policies don't gate the hot path — they exist as defense-in-depth
-- against anyone hitting the table via PostgREST. Tenants may read their own
-- rows for debugging; nobody mutates via the API.
ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY idempotency_records_tenant_select
  ON public.idempotency_records
  FOR SELECT
  USING (org_id = (SELECT org_id FROM public.users WHERE id = auth.uid()));

-- No INSERT/UPDATE/DELETE policies = denied for non-service-role callers.
-- The service role bypasses RLS by design, so the middleware always works.

COMMIT;
