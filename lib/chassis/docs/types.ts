// lib/chassis/docs/types.ts
// Module 4 — paperwork scanner schemas.
// Vision-provider-agnostic. Tesseract is default; Claude Vision + Nemotron adapters opt-in.

export type DocType =
  | 'commercial_invoice'
  | 'packing_list'
  | 'bill_of_lading'
  | 'certificate_of_origin'
  | 'mx_health_certificate'
  | 'pedimento'
  | 'fda_prior_notice'
  | 'usda_aphis'
  | 'other'
  | 'unknown';

export type VisionProvider = 'tesseract' | 'claude' | 'nemotron';

export interface VisionInput {
  bytes: Uint8Array;            // image bytes (PNG/JPEG) — multi-page PDFs are pre-split
  mime_type: string;
  language_hint?: 'en' | 'es' | 'auto';
}

export interface VisionResult {
  text: string;                 // raw extracted text
  word_confidences: number[];   // per-word OCR confidence 0-1 (Tesseract emits this; Claude/Nemotron may emit single doc-level confidence)
  doc_level_confidence: number; // 0-1 — average or model-emitted
  provider: VisionProvider;
  duration_ms: number;
}

export interface DocClassificationResult {
  doc_type: DocType;
  confidence: number;
  reason: string;               // human-readable why (keyword match / structural cue)
  alternative_types: Array<{ doc_type: DocType; confidence: number }>;
}

export interface CommercialInvoiceFields {
  seller?: { name: string; address?: string };
  buyer?: { name: string; address?: string };
  invoice_number?: string;
  invoice_date?: string;
  currency?: string;
  total_value?: number;
  incoterms?: string;
  country_of_origin?: string;
  line_items: Array<{ description: string; quantity?: number; unit_price?: number; line_total?: number; hts_code?: string }>;
}

export interface PackingListFields {
  shipper?: { name: string; address?: string };
  consignee?: { name: string; address?: string };
  package_count?: number;
  total_weight_kg?: number;
  marks_and_numbers?: string;
  packages: Array<{ description: string; quantity?: number; weight_kg?: number; dimensions?: string }>;
}

export interface BolFields {
  bol_number?: string;
  shipper?: { name: string; address?: string };
  consignee?: { name: string; address?: string };
  carrier?: string;
  vessel_or_truck?: string;
  port_of_loading?: string;
  port_of_discharge?: string;
  description_of_goods?: string;
  number_of_packages?: number;
  total_weight_kg?: number;
}

export interface CertificateOfOriginFields {
  exporter?: { name: string; address?: string };
  producer?: { name: string; address?: string };
  importer?: { name: string; address?: string };
  hs_classification?: string;
  origin_criterion?: 'A' | 'B' | 'C' | 'D';
  blanket_period?: { start: string; end: string };
  authorized_signature_present: boolean;
}

export interface MxHealthCertificateFlags {
  single_sided: boolean;
  handwriting_detected: boolean;
  fields_legible: boolean;
  scan_quality_score: number;   // 0-1
}

export interface MxHealthCertificateFields {
  certificate_number?: string;
  product?: string;
  origin_country?: string;
  destination_country?: string;
  issuing_authority?: string;
  issue_date?: string;
  flags: MxHealthCertificateFlags;
}

export interface FieldExtractionResult<T = unknown> {
  doc_type: DocType;
  fields: T;
  per_field_confidences: Record<string, number>;  // dotted-path keys → confidence 0-1
  flags: Record<string, boolean>;                  // e.g. { handwriting_detected: false }
  doc_level_confidence: number;
  provider_used: VisionProvider;
}

export interface MultiPageInput {
  pages: VisionInput[];
}

export interface MultiPageResult {
  page_count: number;
  per_page: Array<{ page_index: number; classification: DocClassificationResult; extraction: FieldExtractionResult }>;
}

export interface PaperworkComposition {
  documents_extracted: Array<{
    doc_type: DocType;
    fields_summary: string;     // human-readable one-line summary
    confidence: number;
    flags: Record<string, boolean>;
  }>;
  blocking_issues: string[];     // e.g. "MX health certificate is double-sided"
  doc_count: number;
  earliest_warning: string | null;
  composed_at_iso: string;
}
