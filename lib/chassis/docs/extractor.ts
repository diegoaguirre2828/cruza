// lib/chassis/docs/extractor.ts
// Per-doc-type field extractor. Deterministic regex/keyword search on OCR text.
// LLM-assisted extraction (Claude / Nemotron) deferred to v2.

import type { DocType, FieldExtractionResult, VisionResult, CommercialInvoiceFields, PackingListFields, BolFields, CertificateOfOriginFields, MxHealthCertificateFields, MxHealthCertificateFlags } from './types';

// Helper: match regex against OCR text, return first capture group or undefined.
function match(text: string, re: RegExp): string | undefined {
  const m = text.match(re);
  return m?.[1]?.trim();
}

function parseNumber(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const cleaned = s.replace(/[^\d.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

// ── Commercial Invoice ────────────────────────────────────────────────────
function extractCommercialInvoice(text: string): CommercialInvoiceFields {
  return {
    invoice_number: match(text, /(?:invoice\s*(?:no|number|#)|factura\s*(?:no|num))[\s.:]*([\w-]+)/i),
    invoice_date: match(text, /(?:date|fecha)[\s.:]*([0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{1,4})/i),
    currency: match(text, /\b(USD|MXN|CAD|EUR)\b/),
    total_value: parseNumber(match(text, /(?:total|gran\s*total|amount\s*due)[\s.:$]*(?:USD|MXN|CAD|EUR)?\s*([\d,]+\.?\d*)/i)),
    incoterms: match(text, /\b(EXW|FCA|CPT|CIP|DAP|DDP|FOB|CFR|CIF)\b/),
    country_of_origin: match(text, /(?:country\s*of\s*origin|pais\s*de\s*origen)[\s.:]*([A-Za-z]{2,30})/i),
    line_items: [],
  };
}

// ── Packing List ──────────────────────────────────────────────────────────
function extractPackingList(text: string): PackingListFields {
  return {
    package_count: parseNumber(match(text, /(?:total\s*packages|paquetes\s*total|number\s*of\s*packages)[\s.:]*([\d,]+)/i)),
    total_weight_kg: parseNumber(match(text, /(?:gross\s*weight|peso\s*bruto)[\s.:]*([\d,]+\.?\d*)\s*kg/i)),
    marks_and_numbers: match(text, /(?:marks\s*and\s*numbers|marcas\s*y\s*numeros)[\s.:]*([^\n]{1,80})/i),
    packages: [],
  };
}

// ── BOL ───────────────────────────────────────────────────────────────────
function extractBol(text: string): BolFields {
  return {
    bol_number: match(text, /(?:b\/?l\s*(?:no|number)|bol\s*number|conocimiento\s*no)[\s.:]*([\w-]+)/i),
    carrier: match(text, /(?:carrier|transportista)[\s.:]*([^\n]{1,60})/i),
    vessel_or_truck: match(text, /(?:vessel|navio|truck|camion)[\s.:]*([^\n]{1,40})/i),
    port_of_loading: match(text, /(?:port\s*of\s*loading|puerto\s*de\s*carga)[\s.:]*([^\n]{1,60})/i),
    port_of_discharge: match(text, /(?:port\s*of\s*discharge|puerto\s*de\s*descarga)[\s.:]*([^\n]{1,60})/i),
    description_of_goods: match(text, /(?:description\s*of\s*goods|descripcion\s*de\s*mercancias)[\s.:]*([^\n]{1,200})/i),
    number_of_packages: parseNumber(match(text, /(?:number\s*of\s*packages|paquetes)[\s.:]*([\d,]+)/i)),
    total_weight_kg: parseNumber(match(text, /(?:gross\s*weight|peso\s*bruto)[\s.:]*([\d,]+\.?\d*)\s*kg/i)),
  };
}

// ── Certificate of Origin ─────────────────────────────────────────────────
function extractCertificateOfOrigin(text: string): CertificateOfOriginFields {
  return {
    hs_classification: match(text, /(?:hs\s*classification|clasificacion\s*hs|hts)[\s.:]*([\d.]+)/i),
    origin_criterion: (match(text, /(?:origin\s*criterion|criterio\s*de\s*origen)[\s.:]*([A-D])/i) as 'A' | 'B' | 'C' | 'D' | undefined),
    authorized_signature_present: /signature|firma autorizada|authorized\s*signature/i.test(text),
  };
}

// ── MX Health Certificate ─────────────────────────────────────────────────
function extractMxHealthCert(text: string, flags: MxHealthCertificateFlags): MxHealthCertificateFields {
  return {
    certificate_number: match(text, /(?:certificado\s*(?:no|num|#)|certificate\s*(?:no|number|#))[\s.:]*([\w-]+)/i),
    product: match(text, /(?:producto|product)[\s.:]*([^\n]{1,80})/i),
    origin_country: match(text, /(?:pais\s*de\s*origen|country\s*of\s*origin)[\s.:]*([A-Za-z]{2,30})/i),
    destination_country: match(text, /(?:pais\s*de\s*destino|country\s*of\s*destination)[\s.:]*([A-Za-z]{2,30})/i),
    issuing_authority: match(text, /\b(SENASICA|COFEPRIS|SAGARPA|FDA|USDA APHIS)\b/i),
    issue_date: match(text, /(?:fecha\s*de\s*expedicion|issue\s*date|date\s*of\s*issue)[\s.:]*([0-9]{1,4}[-/.][0-9]{1,2}[-/.][0-9]{1,4})/i),
    flags,
  };
}

// ── Per-field confidence (heuristic) ──────────────────────────────────────
function confidenceFor(field: unknown, vision: VisionResult): number {
  if (field == null || field === '') return 0;
  return Math.min(1, vision.doc_level_confidence + 0.05);
}

export function extractFields(
  doc_type: DocType,
  vision: VisionResult,
  mxHealthFlags?: MxHealthCertificateFlags,
): FieldExtractionResult {
  const text = vision.text;
  let fields: unknown;
  switch (doc_type) {
    case 'commercial_invoice':
      fields = extractCommercialInvoice(text);
      break;
    case 'packing_list':
      fields = extractPackingList(text);
      break;
    case 'bill_of_lading':
      fields = extractBol(text);
      break;
    case 'certificate_of_origin':
      fields = extractCertificateOfOrigin(text);
      break;
    case 'mx_health_certificate':
      fields = extractMxHealthCert(text, mxHealthFlags ?? { single_sided: true, handwriting_detected: false, fields_legible: vision.doc_level_confidence > 0.7, scan_quality_score: vision.doc_level_confidence });
      break;
    default:
      fields = {};
  }

  // Per-field confidence map
  const perField: Record<string, number> = {};
  for (const [k, v] of Object.entries(fields as Record<string, unknown>)) {
    if (k !== 'flags' && k !== 'line_items' && k !== 'packages') perField[k] = confidenceFor(v, vision);
  }

  return {
    doc_type,
    fields,
    per_field_confidences: perField,
    flags: doc_type === 'mx_health_certificate' && mxHealthFlags
      ? { single_sided: mxHealthFlags.single_sided, handwriting_detected: mxHealthFlags.handwriting_detected, fields_legible: mxHealthFlags.fields_legible }
      : {},
    doc_level_confidence: vision.doc_level_confidence,
    provider_used: vision.provider,
  };
}
