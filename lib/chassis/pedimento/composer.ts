// lib/chassis/pedimento/composer.ts
// Module 11 orchestrator. Given an OperacionInput, classifies the clave,
// validates RFC/patente/fracción, computes duties, and returns a composition.
import {
  OperacionInput,
  PedimentoComposition,
  ValidationFinding,
} from './types';
import { classifyPedimento } from './classifier';
import { validateRfc, validatePatente, validateFraccion, validateNico } from './validators';
import { calculateImpuestos } from './duty-calculator';
import { getPedimentoRegistry } from './registry';

export function composePedimento(
  input: OperacionInput,
  today: Date = new Date(),
): PedimentoComposition {
  const reg = getPedimentoRegistry();
  const findings: ValidationFinding[] = [];

  const cls = classifyPedimento(input);

  const rfcValidation = validateRfc(input.importador_exportador.rfc);
  if (rfcValidation === 'formato_invalido') {
    findings.push({
      rule_id: 'PED-F-001',
      severity: 'fatal',
      field: 'importador_exportador.rfc',
      message_es: 'RFC con formato inválido — debe ser 12 (moral) o 13 (física) caracteres',
      message_en: 'RFC has invalid format — must be 12 (legal entity) or 13 (individual) chars',
    });
  }

  const patenteValidation = validatePatente(input.agente.patente);
  if (patenteValidation === 'formato_invalido') {
    findings.push({
      rule_id: 'PED-F-002',
      severity: 'fatal',
      field: 'agente.patente',
      message_es: 'Patente aduanal debe ser 4 dígitos exactos',
      message_en: 'Customs broker patente must be exactly 4 digits',
    });
  }

  for (let i = 0; i < input.mercancias.length; i++) {
    const m = input.mercancias[i];
    if (validateFraccion(m.fraccion_arancelaria) === 'formato_invalido') {
      findings.push({
        rule_id: 'PED-F-003',
        severity: 'fatal',
        field: `mercancias[${i}].fraccion_arancelaria`,
        message_es: `Fracción arancelaria #${i + 1} debe ser 8 dígitos LIGIE`,
        message_en: `Tariff fraction #${i + 1} must be 8 digits LIGIE`,
      });
    }
    if (validateNico(m.nico) === 'formato_invalido') {
      findings.push({
        rule_id: 'PED-F-004',
        severity: 'fatal',
        field: `mercancias[${i}].nico`,
        message_es: `NICO #${i + 1} debe ser 2 dígitos`,
        message_en: `NICO suffix #${i + 1} must be 2 digits`,
      });
    }
    if (m.valor_dolares <= 0) {
      findings.push({
        rule_id: 'PED-W-001',
        severity: 'warning',
        field: `mercancias[${i}].valor_dolares`,
        message_es: `Mercancía #${i + 1} tiene valor en dólares <= 0`,
        message_en: `Item #${i + 1} has zero or negative USD value`,
      });
    }
  }

  // Padrón check — only relevant for definitive imports (A1 / I1).
  const requierePadron = cls.clave_recomendada === 'A1' || cls.clave_recomendada === 'I1';
  let padronStatus: 'activo' | 'inactivo' | 'no_aplica' = 'no_aplica';
  if (requierePadron) {
    padronStatus = input.importador_exportador.padron_importadores_activo ? 'activo' : 'inactivo';
    if (padronStatus === 'inactivo') {
      findings.push({
        rule_id: 'PED-F-005',
        severity: 'fatal',
        field: 'importador_exportador.padron_importadores_activo',
        message_es: 'Padrón de Importadores debe estar activo para esta clave (A1 / I1)',
        message_en: 'Importer Registry must be active for this clave (A1 / I1)',
      });
    }
  }

  const impuestos = calculateImpuestos(input);

  let totalValor = 0;
  for (const m of input.mercancias) totalValor += m.valor_factura_usd;

  return {
    clave: cls.clave_recomendada,
    regimen: cls.regimen_inferido,
    agente_patente: input.agente.patente,
    importador_rfc: input.importador_exportador.rfc,
    rfc_validacion: rfcValidation,
    patente_validacion: patenteValidation,
    padron_status: padronStatus,
    total_mercancias: input.mercancias.length,
    total_valor_factura_usd: round2(totalValor),
    impuestos,
    findings,
    composed_at: today.toISOString(),
    registry_version: reg.version,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
