// lib/chassis/docs/composer.ts
import type { PaperworkComposition, FieldExtractionResult, VisionInput, MxHealthCertificateFlags } from './types';
import { extractText } from './vision-provider';
import { classifyDocument } from './classifier';
import { extractFields } from './extractor';
import { validateMxHealthCertificate } from './mx-health-cert';

export interface ComposerInput {
  pages: VisionInput[];
}

function summarizeFields(doc_type: string, fields: unknown): string {
  if (typeof fields !== 'object' || fields === null) return '';
  const f = fields as Record<string, unknown>;
  switch (doc_type) {
    case 'commercial_invoice': return `Invoice ${f.invoice_number ?? '?'} ${f.currency ?? ''}${f.total_value ?? '?'}`;
    case 'packing_list': return `Packing list ${f.package_count ?? '?'} pkgs ${f.total_weight_kg ?? '?'}kg`;
    case 'bill_of_lading': return `BOL ${f.bol_number ?? '?'} ${f.carrier ?? ''} ${f.port_of_loading ?? ''}->${f.port_of_discharge ?? ''}`;
    case 'certificate_of_origin': return `USMCA cert HS ${f.hs_classification ?? '?'} criterion ${f.origin_criterion ?? '?'}`;
    case 'mx_health_certificate': return `MX health cert ${f.certificate_number ?? '?'} ${f.product ?? ''}`;
    case 'pedimento': return `Pedimento ${f.certificate_number ?? ''} ${f.aduana ?? ''}`;
    default: return doc_type;
  }
}

export async function composePaperwork(input: ComposerInput): Promise<{ composition: PaperworkComposition; per_page: FieldExtractionResult[] }> {
  const perPage: FieldExtractionResult[] = [];
  const docs: PaperworkComposition['documents_extracted'] = [];
  const blocking: string[] = [];

  for (let i = 0; i < input.pages.length; i++) {
    const vision = await extractText(input.pages[i]);
    const cls = classifyDocument(vision);
    let mxFlags: MxHealthCertificateFlags | undefined;
    if (cls.doc_type === 'mx_health_certificate') {
      mxFlags = await validateMxHealthCertificate({
        page_count: input.pages.length,
        primary_vision: vision,
        secondary_vision: input.pages.length > 1 && i === 0 ? await extractText(input.pages[1]) : undefined,
      });
      if (!mxFlags.single_sided) blocking.push(`MX health certificate is double-sided (per SENASICA rule, must be single-sided + no handwritten corrections)`);
      if (mxFlags.handwriting_detected) blocking.push(`MX health certificate has handwritten corrections (per SENASICA rule, must be entirely printed)`);
    }
    const extraction = extractFields(cls.doc_type, vision, mxFlags);
    perPage.push(extraction);
    docs.push({
      doc_type: cls.doc_type,
      fields_summary: summarizeFields(cls.doc_type, extraction.fields),
      confidence: cls.confidence,
      flags: extraction.flags,
    });
  }

  return {
    composition: {
      documents_extracted: docs,
      blocking_issues: blocking,
      doc_count: docs.length,
      earliest_warning: blocking[0] ?? null,
      composed_at_iso: new Date().toISOString(),
    },
    per_page: perPage,
  };
}
