// lib/chassis/docs/classifier.ts
// Keyword-based document-type classifier on top of OCR'd text.
// Bilingual EN + ES keyword sets per doc type.

import type { DocClassificationResult, DocType, VisionResult } from './types';

interface DocRule {
  doc_type: DocType;
  keywords: string[];      // case-insensitive substring matches; bilingual
}

const RULES: DocRule[] = [
  { doc_type: 'commercial_invoice', keywords: ['commercial invoice','factura comercial','invoice no','factura no','seller','vendedor','buyer','comprador','incoterms'] },
  { doc_type: 'packing_list', keywords: ['packing list','lista de empaque','marks and numbers','marcas y numeros','gross weight','peso bruto','net weight','peso neto'] },
  { doc_type: 'bill_of_lading', keywords: ['bill of lading','conocimiento de embarque','b/l no','bol number','vessel','navio','port of loading','puerto de carga','port of discharge','puerto de descarga','shipper','embarcador'] },
  { doc_type: 'certificate_of_origin', keywords: ['certificate of origin','certificado de origen','usmca','t-mec','tmec','origin criterion','criterio de origen','exporter','exportador','producer','productor'] },
  { doc_type: 'mx_health_certificate', keywords: ['certificado de salud','certificado fitosanitario','certificado zoosanitario','senasica','cofepris','health certificate'] },
  { doc_type: 'pedimento', keywords: ['pedimento','clave del pedimento','aduana','agente aduanal','referencia','factura','tipo de cambio'] },
  { doc_type: 'fda_prior_notice', keywords: ['fda prior notice','prior notice confirmation','21 cfr','pnsi','industry code'] },
  { doc_type: 'usda_aphis', keywords: ['usda aphis','ppq form','plant protection','quarantine','phytosanitary'] },
];

export function classifyDocument(vision: VisionResult): DocClassificationResult {
  const text = vision.text.toLowerCase();
  const scored = RULES.map(r => ({
    doc_type: r.doc_type,
    score: r.keywords.reduce((s, kw) => s + (text.includes(kw.toLowerCase()) ? 1 : 0), 0),
    matchedKeywords: r.keywords.filter(kw => text.includes(kw.toLowerCase())),
  })).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      doc_type: 'unknown',
      confidence: 0.10,
      reason: 'no document-type keywords matched in OCR text',
      alternative_types: [],
    };
  }

  const winner = scored[0];
  // Confidence formula: keyword score relative to keyword set size, scaled by OCR confidence
  const ruleSet = RULES.find(r => r.doc_type === winner.doc_type)!;
  const keywordRatio = Math.min(1, winner.score / Math.max(1, ruleSet.keywords.length / 3));
  const confidence = +(keywordRatio * vision.doc_level_confidence).toFixed(4);

  return {
    doc_type: winner.doc_type,
    confidence,
    reason: `matched ${winner.score} keyword(s): ${winner.matchedKeywords.slice(0, 3).join(', ')}`,
    alternative_types: scored.slice(1, 3).map(s => {
      const altRule = RULES.find(r => r.doc_type === s.doc_type)!;
      return {
        doc_type: s.doc_type,
        confidence: +(Math.min(1, s.score / Math.max(1, altRule.keywords.length / 3)) * vision.doc_level_confidence).toFixed(4),
      };
    }),
  };
}
