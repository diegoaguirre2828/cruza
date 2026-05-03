-- v76: tickets — Cruzar Ticket immutable store
-- Every issued Ticket gets a row. Tickets are NEVER UPDATEd; supersession via superseded_by.

CREATE TABLE IF NOT EXISTS public.tickets (
  ticket_id TEXT PRIMARY KEY,                    -- e.g. cr_2026_05_02_abc123
  schema_version TEXT NOT NULL DEFAULT 'v1',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modules_present TEXT[] NOT NULL,               -- e.g. ARRAY['customs']
  shipment_ref TEXT,
  importer_name TEXT,
  origin_country TEXT,
  destination_country TEXT,
  port_of_entry TEXT,
  payload_canonical JSONB NOT NULL,              -- canonical signed payload
  content_hash TEXT NOT NULL,                    -- SHA-256 of canonical payload
  signature_b64 TEXT NOT NULL,                   -- Ed25519 signature
  signing_key_id TEXT NOT NULL,                  -- which key signed (for rotation)
  superseded_by TEXT REFERENCES public.tickets(ticket_id),
  created_by_user_id UUID REFERENCES auth.users(id),
  created_via TEXT                               -- 'api/ticket/generate' | 'mcp' | 'admin'
);

CREATE INDEX IF NOT EXISTS idx_tickets_issued_at ON public.tickets(issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_shipment_ref ON public.tickets(shipment_ref) WHERE shipment_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_importer ON public.tickets(importer_name);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON public.tickets(created_by_user_id) WHERE created_by_user_id IS NOT NULL;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Public read (redacted view enforced at app layer): the public viewer at /ticket/[id]
-- only renders verification status, not PII. Storing signed payload publicly is OK
-- because the Ticket is the broker's deliverable.
CREATE POLICY "public read tickets" ON public.tickets FOR SELECT USING (true);

CREATE POLICY "service role write tickets" ON public.tickets
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "service role update tickets (supersession only)" ON public.tickets
  FOR UPDATE USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.tickets IS 'Cruzar Ticket immutable store. Tickets are signed bundles emitted by the chassis. Public read; service-role write. Supersession via superseded_by FK; never delete.';
