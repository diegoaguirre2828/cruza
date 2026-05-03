-- v78: doc_extractions — Module 4 paperwork-scanner log
-- One row per document the chassis processes (single-page or per-page of multi-page).

CREATE TABLE IF NOT EXISTS public.doc_extractions (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT,                                -- nullable: extraction may run before Ticket signs
  shipment_ref TEXT,
  source_blob_url TEXT,                          -- Vercel Blob URL of original upload
  source_filename TEXT,
  source_mime_type TEXT,
  page_index INTEGER NOT NULL DEFAULT 0,         -- 0 for single-page; 0..n for multi-page
  page_count INTEGER NOT NULL DEFAULT 1,
  doc_type TEXT NOT NULL CHECK (doc_type IN (
    'commercial_invoice','packing_list','bill_of_lading','certificate_of_origin',
    'mx_health_certificate','pedimento','fda_prior_notice','usda_aphis','other','unknown'
  )),
  classifier_confidence NUMERIC(5,4),
  fields_extracted JSONB NOT NULL,               -- structured field map per doc-type schema
  extraction_confidence NUMERIC(5,4),
  vision_provider TEXT NOT NULL CHECK (vision_provider IN ('tesseract','claude','nemotron')),
  flags JSONB,                                   -- e.g. { "mx_health_cert_double_sided": true, "handwriting_detected": false }
  duration_ms INTEGER,
  caller TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_ext_doc_type ON public.doc_extractions(doc_type);
CREATE INDEX IF NOT EXISTS idx_doc_ext_created_at ON public.doc_extractions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_ext_ticket ON public.doc_extractions(ticket_id) WHERE ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_doc_ext_provider ON public.doc_extractions(vision_provider);

ALTER TABLE public.doc_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access on doc_extractions"
  ON public.doc_extractions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.doc_extractions IS 'Module 4 paperwork-scanner extraction log. One row per processed document/page. Mexican health-certificate flags + handwriting-detected flag captured in flags JSONB.';
