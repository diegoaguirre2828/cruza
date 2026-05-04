// lib/chassis/cbam/composer.ts
// Module CBAM orchestrator. Given a declarant + a list of CBAM goods, classifies
// each by CN code, computes embedded emissions (actual or default), and produces
// a quarterly/annual CBAM composition with certificate cost estimate.
import {
  CbamGood,
  CbamComposition,
  CbamDeclarantProfile,
  CbamFinding,
} from './types';
import { getCbamRegistry, classifyCn } from './registry';

export interface ComposeCbamInput {
  declarant: CbamDeclarantProfile;
  goods: CbamGood[];
}

export function composeCbam(
  input: ComposeCbamInput,
  today: Date = new Date(),
): CbamComposition {
  const reg = getCbamRegistry();
  const findings: CbamFinding[] = [];

  // Declarant authorization check — required for definitive phase
  if (reg.phase === 'definitive' && !input.declarant.authorized_cbam_declarant) {
    findings.push({
      rule_id: 'CBAM-F-001',
      severity: 'fatal',
      field: 'declarant.authorized_cbam_declarant',
      message_en: 'In the definitive phase (from 2026-01-01) only Authorized CBAM Declarants may import in-scope goods. Apply via the EU CBAM Registry first.',
      message_es: 'En la fase definitiva (desde 2026-01-01) solo Declarantes CBAM Autorizados pueden importar mercancías en-alcance. Solicita primero en el Registro CBAM de la UE.',
    });
  }
  if (!input.declarant.declarant_eori || input.declarant.declarant_eori.length < 5) {
    findings.push({
      rule_id: 'CBAM-F-002',
      severity: 'fatal',
      field: 'declarant.declarant_eori',
      message_en: 'EORI number required (min 5 chars).',
      message_es: 'Número EORI requerido (mín 5 caracteres).',
    });
  }

  let totalMass = 0;
  let totalDirect = 0;
  let totalIndirect = 0;
  let inScopeCount = 0;
  let outOfScopeCount = 0;

  for (let i = 0; i < input.goods.length; i++) {
    const g = input.goods[i];
    const inferredCat = classifyCn(g.cn_code);

    if (inferredCat === 'out_of_scope') {
      outOfScopeCount++;
      continue;
    }

    inScopeCount++;
    totalMass += g.mass_tonnes;

    // Use actual verified data if present; otherwise fall back to default factors
    const directFactor = g.direct_emissions_t_co2_per_t ??
      reg.default_factors_t_co2_per_t[inferredCat].direct;
    const indirectFactor = g.indirect_emissions_t_co2_per_t ??
      reg.default_factors_t_co2_per_t[inferredCat].indirect;

    totalDirect += directFactor * g.mass_tonnes;
    totalIndirect += indirectFactor * g.mass_tonnes;

    if (g.emissions_basis === 'default_value' && reg.phase === 'definitive') {
      findings.push({
        rule_id: 'CBAM-W-001',
        severity: 'warning',
        field: `goods[${i}]`,
        message_en: `Default emission factors used for CN ${g.cn_code}. Verified actual data from the producing installation reduces CBAM cost. Engage an accredited CBAM verifier.`,
        message_es: `Factores de emisión por defecto usados para CN ${g.cn_code}. Datos verificados de la instalación productora reducen el costo CBAM. Contrata un verificador CBAM acreditado.`,
      });
    }

    if (!g.installation.has_emissions_monitoring_plan && reg.phase === 'definitive') {
      findings.push({
        rule_id: 'CBAM-W-002',
        severity: 'warning',
        field: `goods[${i}].installation.has_emissions_monitoring_plan`,
        message_en: `Installation "${g.installation.installation_name}" lacks an Emissions Monitoring Plan. Required for verified actual emissions reporting.`,
        message_es: `Instalación "${g.installation.installation_name}" no tiene Plan de Monitoreo de Emisiones. Requerido para reporte de emisiones reales verificadas.`,
      });
    }
  }

  const totalEmbedded = totalDirect + totalIndirect;
  // Definitive-phase certificates: 1 cert per t CO2e. Transitional phase = 0 cost (reporting only).
  const certificatesRequired = reg.phase === 'definitive' ? Math.ceil(totalEmbedded) : 0;
  const cbamCost = certificatesRequired * reg.ets_reference_price_eur_per_t;

  return {
    declarant_name: input.declarant.declarant_name,
    declarant_eori: input.declarant.declarant_eori,
    authorized: input.declarant.authorized_cbam_declarant,
    phase: reg.phase,
    reporting_period: input.declarant.reporting_period,
    total_goods: input.goods.length,
    in_scope_count: inScopeCount,
    out_of_scope_count: outOfScopeCount,
    total_mass_tonnes: round2(totalMass),
    total_embedded_emissions_t_co2: round2(totalEmbedded),
    total_direct_emissions_t_co2: round2(totalDirect),
    total_indirect_emissions_t_co2: round2(totalIndirect),
    certificates_required: certificatesRequired,
    estimated_cbam_cost_eur: round2(cbamCost),
    ets_avg_price_eur_per_t: reg.ets_reference_price_eur_per_t,
    findings,
    composed_at: today.toISOString(),
    registry_version: reg.version,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
