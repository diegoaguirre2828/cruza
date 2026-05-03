// lib/chassis/customs/origin-validator.ts
// USMCA origin validation (Annex 4-B product-specific rules + LIGIE flag check).

import type { OriginValidationResult, ShipmentInput } from './types';
import { checkLigieForShipment } from './ligie-flag';
import { calculateRvc } from './rvc-calculator';
import { buildUsmcaCertification } from './usmca-preference';

const USMCA_ORIGINS = new Set(['US', 'MX', 'CA']);

interface AnnexRule {
  hs_chapter: string;
  rule: 'tariff_shift' | 'rvc' | 'wholly_obtained' | 'mixed';
  rvc_threshold?: number;
  tariff_shift_from_chapters?: string[];
}

// Subset of USMCA Annex 4-B product-specific rules. Expand as needed.
const ANNEX_4B: AnnexRule[] = [
  { hs_chapter: '07', rule: 'wholly_obtained' }, // veggies
  { hs_chapter: '08', rule: 'wholly_obtained' }, // fruit
  { hs_chapter: '87', rule: 'mixed', rvc_threshold: 75 }, // autos — 75% RVC
  { hs_chapter: '90', rule: 'rvc', rvc_threshold: 60 }, // medical
  { hs_chapter: '61', rule: 'tariff_shift', tariff_shift_from_chapters: ['52','53','54','55','56'] }, // knit apparel
  { hs_chapter: '62', rule: 'tariff_shift', tariff_shift_from_chapters: ['52','53','54','55','56'] },
  { hs_chapter: '85', rule: 'rvc', rvc_threshold: 60 },
  { hs_chapter: '39', rule: 'rvc', rvc_threshold: 60 },
];

export function validateOrigin(
  shipment: ShipmentInput,
  productHsChapter: string,
): OriginValidationResult {
  const ligie = checkLigieForShipment(shipment.bom);
  const allUsmca = shipment.bom.length === 0 || shipment.bom.every(b => USMCA_ORIGINS.has(b.origin_country));
  const productOriginUsmca = USMCA_ORIGINS.has(shipment.origin_country);

  const annexRule = ANNEX_4B.find(r => r.hs_chapter === productHsChapter);

  let usmcaOriginating = false;
  let ruleApplied: OriginValidationResult['rule_applied'] = 'tariff_shift';
  let confidence = 0.7;

  if (annexRule?.rule === 'wholly_obtained') {
    usmcaOriginating = allUsmca && productOriginUsmca;
    ruleApplied = 'wholly_obtained';
    confidence = 0.95;
  } else if (annexRule?.rule === 'tariff_shift' && annexRule.tariff_shift_from_chapters) {
    const allShifted = shipment.bom.every(b => {
      const inputChapter = b.hs6.slice(0, 2);
      return USMCA_ORIGINS.has(b.origin_country) ||
        annexRule.tariff_shift_from_chapters!.includes(inputChapter);
    });
    usmcaOriginating = productOriginUsmca && allShifted;
    ruleApplied = 'tariff_shift';
    confidence = 0.80;
  } else if (annexRule?.rule === 'rvc' || annexRule?.rule === 'mixed') {
    const vnm = shipment.bom
      .filter(b => !USMCA_ORIGINS.has(b.origin_country))
      .reduce((s, b) => s + b.value_usd, 0);
    const rvc = calculateRvc({
      transaction_value_usd: shipment.transaction_value_usd,
      vnm_total_usd: vnm,
      net_cost_usd: shipment.net_cost_usd,
      threshold_required: annexRule.rvc_threshold ?? 60,
    });
    usmcaOriginating = productOriginUsmca && rvc.threshold_met;
    ruleApplied = 'rvc';
    confidence = 0.75;
  } else {
    // No specific rule found — fall back to wholly-obtained
    usmcaOriginating = allUsmca && productOriginUsmca;
    confidence = 0.50;
  }

  const mfn = 4.0;
  const preferential = usmcaOriginating ? 0 : mfn;
  const effective = ligie.affected
    ? Math.max(preferential, ligie.rate_pct ?? 0)
    : preferential;

  const cert = usmcaOriginating
    ? buildUsmcaCertification({
        certifier_role: 'EXPORTER',
        certifier_name: 'TBD',
        certifier_address: 'TBD',
        exporter_name: 'TBD',
        producer_name: 'TBD',
        importer_name: shipment.importer_name ?? 'TBD',
        hs_classification: shipment.declared_hs10 ?? `${productHsChapter}.??.??`,
        origin_criterion: ruleApplied === 'wholly_obtained' ? 'A' : ruleApplied === 'tariff_shift' ? 'B' : 'B',
      })
    : null;

  return {
    usmca_originating: usmcaOriginating,
    rule_applied: ruleApplied,
    ligie,
    preferential_rate_pct: preferential,
    mfn_rate_pct: mfn,
    effective_rate_pct: effective,
    certificate_origin_draft: cert,
    confidence,
  };
}
