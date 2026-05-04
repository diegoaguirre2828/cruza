// lib/chassis/uflpa/risk-flagger.ts
// Flags UFLPA risk based on HTSUS sector + Xinjiang origin in supply chain + Entity List matches.
import {
  UflpaShipmentInput,
  UflpaComposition,
  UflpaRiskFinding,
  UflpaRiskLevel,
  HighRiskSector,
  RebuttableEvidenceQuality,
} from './types';
import { getUflpaRegistry } from './registry';

export function evaluateUflpa(
  input: UflpaShipmentInput,
  today: Date = new Date(),
): UflpaComposition {
  const reg = getUflpaRegistry();
  const findings: UflpaRiskFinding[] = [];

  // 1. HTSUS sector check
  const sectorsDetected = new Set<HighRiskSector>();
  const htsClean = input.htsus_code.replace(/\D/g, '');
  for (const entry of reg.htsus_high_risk_chapter_prefixes) {
    if (htsClean.startsWith(entry.prefix)) {
      sectorsDetected.add(entry.sector);
    }
  }

  // 2. Xinjiang detection — surface earliest tier where province = Xinjiang
  let xinjiangTier: number | null = null;
  for (const tier of input.supply_chain) {
    if (tier.produced_in_xinjiang ||
        tier.province_or_state?.toLowerCase().includes('xinjiang') ||
        tier.province_or_state?.toLowerCase().includes('uyghur')) {
      if (xinjiangTier === null || tier.tier < xinjiangTier) {
        xinjiangTier = tier.tier;
      }
    }
  }

  // 3. Entity List matches
  const entityListHits: Array<{ tier: number; supplier: string }> = [];
  for (const tier of input.supply_chain) {
    if (tier.is_on_uflpa_entity_list) {
      entityListHits.push({ tier: tier.tier, supplier: tier.supplier_name });
      continue;
    }
    const supplierLower = tier.supplier_name.toLowerCase();
    for (const ent of reg.sample_entity_list) {
      const names = [ent.name, ...ent.aliases].map((n) => n.toLowerCase());
      if (names.some((n) => supplierLower.includes(n) || n.includes(supplierLower))) {
        entityListHits.push({ tier: tier.tier, supplier: tier.supplier_name });
      }
    }
  }

  // 4. Rebuttable presumption logic
  const rebuttablePresumptionTriggered = xinjiangTier !== null || entityListHits.length > 0;
  if (xinjiangTier !== null) {
    findings.push({
      rule_id: 'UFLPA-F-001',
      severity: 'fatal',
      field: `supply_chain[tier=${xinjiangTier}]`,
      message_en: `Tier ${xinjiangTier} supplier produces in Xinjiang. UFLPA rebuttable presumption triggered. Goods will be detained at port of entry unless rebutted by clear and convincing evidence.`,
      message_es: `Proveedor de tier ${xinjiangTier} produce en Xinjiang. Presunción refutable UFLPA activada. La mercancía será detenida en aduana a menos que se refute con evidencia clara y convincente.`,
    });
  }
  for (const hit of entityListHits) {
    findings.push({
      rule_id: 'UFLPA-F-002',
      severity: 'fatal',
      field: `supply_chain[tier=${hit.tier}]`,
      message_en: `Supplier "${hit.supplier}" appears on the UFLPA Entity List (or matches an alias). Goods will be detained.`,
      message_es: `Proveedor "${hit.supplier}" aparece en la Lista de Entidades UFLPA (o coincide con un alias). La mercancía será detenida.`,
    });
  }

  // 5. Sector flag without Xinjiang/entity hit — high-risk-but-rebuttable warning
  if (!rebuttablePresumptionTriggered && sectorsDetected.size > 0) {
    findings.push({
      rule_id: 'UFLPA-W-001',
      severity: 'warning',
      message_en: `HTSUS ${input.htsus_code} sits in CBP UFLPA priority sector(s): ${[...sectorsDetected].join(', ')}. CBP detention is not automatic but enforcement is heightened — full supply-chain traceability + supplier affidavits + audit records recommended before shipment arrival.`,
      message_es: `HTSUS ${input.htsus_code} está en sector(es) prioritarios UFLPA: ${[...sectorsDetected].join(', ')}. La detención CBP no es automática pero la fiscalización es elevada — trazabilidad completa de cadena + declaraciones de proveedor + registros de auditoría recomendados antes del arribo.`,
    });
  }

  // 6. Traceability completeness
  if (input.total_supplier_traceability_tiers < 2) {
    findings.push({
      rule_id: 'UFLPA-W-002',
      severity: 'warning',
      message_en: 'Supply-chain traced fewer than 2 tiers deep. UFLPA enforcement requires tracing to raw input level (typically tier 3-4 for textiles/electronics).',
      message_es: 'Cadena de suministro rastreada menos de 2 niveles. La fiscalización UFLPA requiere rastrear hasta el insumo crudo (típicamente tier 3-4 en textiles/electrónica).',
    });
  }

  // 7. Evidence quality
  const allTiersHaveEvidence = input.supply_chain.every(
    (t) => t.audit_evidence_present && t.affidavit_present,
  );
  const someTiersHaveEvidence = input.supply_chain.some(
    (t) => t.audit_evidence_present || t.affidavit_present,
  );
  const evidenceQuality: RebuttableEvidenceQuality = rebuttablePresumptionTriggered
    ? (allTiersHaveEvidence ? 'clear_and_convincing'
        : someTiersHaveEvidence ? 'preponderant'
        : 'absent')
    : (someTiersHaveEvidence ? 'circumstantial' : 'absent');

  // 8. Compute overall risk
  let riskLevel: UflpaRiskLevel = 'low';
  if (rebuttablePresumptionTriggered) {
    riskLevel = evidenceQuality === 'clear_and_convincing' ? 'medium' : 'high';
  } else if (sectorsDetected.size >= 2) {
    riskLevel = 'medium';
  } else if (sectorsDetected.size === 1) {
    riskLevel = 'medium';
  }
  if (input.supply_chain.length === 0) riskLevel = 'unknown';

  // 9. Required actions (bilingual)
  const requiredActions: string[] = [];
  if (rebuttablePresumptionTriggered) {
    requiredActions.push(
      'Compile UFLPA rebuttal package: full supply-chain map + supplier affidavits + audit reports + production records + transactional flow proof. CBP threshold = clear and convincing evidence.',
    );
  }
  if (sectorsDetected.size > 0) {
    requiredActions.push(
      `Document sector-specific traceability: ${[...sectorsDetected].join(', ')}. CBP examines these sectors with elevated scrutiny.`,
    );
  }
  if (!allTiersHaveEvidence && input.supply_chain.length > 0) {
    requiredActions.push(
      'Collect supplier affidavits and third-party audit reports for every tier — current dataset has gaps.',
    );
  }
  if (input.total_supplier_traceability_tiers < 2) {
    requiredActions.push(
      'Trace supply chain at least 2 tiers upstream — preferably to raw-input origin.',
    );
  }

  return {
    importer_name: input.importer_name,
    importer_ein: input.importer_ein,
    risk_level: riskLevel,
    rebuttable_presumption_triggered: rebuttablePresumptionTriggered,
    high_risk_sectors_detected: [...sectorsDetected],
    xinjiang_tier: xinjiangTier,
    entity_list_hits: entityListHits,
    evidence_quality: evidenceQuality,
    required_actions: requiredActions,
    findings,
    composed_at: today.toISOString(),
    registry_version: reg.version,
  };
}
