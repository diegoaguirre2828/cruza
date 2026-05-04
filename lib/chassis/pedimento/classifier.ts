// lib/chassis/pedimento/classifier.ts
// Picks the correct pedimento clave per Anexo 22 RGCE based on operation + regimen + IMMEX flag.
import { OperacionInput, PedimentoClassification, PedimentoClave, RegimenAduanero } from './types';

export function classifyPedimento(input: OperacionInput): PedimentoClassification {
  const { operacion, regimen, importador_exportador } = input;
  const hasImmex = !!importador_exportador.programa_immex;

  // Tránsito (in-transit)
  if (operacion === 'transito') {
    return {
      clave_recomendada: regimen === 'transito' ? 'M3' : 'T1',
      regimen_inferido: 'transito',
      reason_es: 'Operación en tránsito — se asigna M3 (internacional) o T1 (interno) per Anexo 22',
      reason_en: 'In-transit operation — M3 (international) or T1 (internal) per Anexo 22',
    };
  }

  // Retorno
  if (operacion === 'retorno') {
    if (hasImmex) {
      return {
        clave_recomendada: 'V6',
        regimen_inferido: 'temporal',
        reason_es: 'Retorno de importación temporal IMMEX — clave V6',
        reason_en: 'Return of IMMEX temporary import — clave V6',
      };
    }
    return {
      clave_recomendada: 'C1',
      regimen_inferido: 'definitivo',
      reason_es: 'Retorno de mercancía importada — clave C1',
      reason_en: 'Return of previously imported merchandise — clave C1',
    };
  }

  // Exportación
  if (operacion === 'exportacion') {
    if (hasImmex && regimen === 'temporal') {
      return {
        clave_recomendada: 'F4',
        regimen_inferido: 'temporal',
        reason_es: 'Conversión IMMEX a exportación virtual — clave F4',
        reason_en: 'IMMEX virtual-export conversion — clave F4',
      };
    }
    return {
      clave_recomendada: 'A3',
      regimen_inferido: 'definitivo',
      reason_es: 'Exportación definitiva — clave A3',
      reason_en: 'Definitive export — clave A3',
    };
  }

  // Importación (default)
  let regimenInferido: RegimenAduanero = regimen;
  let clave: PedimentoClave;
  let reasonEs: string;
  let reasonEn: string;

  if (regimen === 'deposito_fiscal') {
    clave = 'I1';
    reasonEs = 'Importación a depósito fiscal — clave I1';
    reasonEn = 'Import into bonded warehouse — clave I1';
  } else if (regimen === 'temporal' && hasImmex) {
    clave = 'V5';
    reasonEs = 'Importación temporal bajo programa IMMEX — clave V5';
    reasonEn = 'Temporary import under IMMEX program — clave V5';
  } else if (regimen === 'temporal') {
    clave = 'V1';
    reasonEs = 'Importación temporal definitiva (no IMMEX) — clave V1';
    reasonEn = 'Definitive temporary import (non-IMMEX) — clave V1';
  } else {
    clave = 'A1';
    regimenInferido = 'definitivo';
    reasonEs = 'Importación definitiva — clave A1, la más común';
    reasonEn = 'Definitive import — clave A1, the most common';
  }

  return {
    clave_recomendada: clave,
    regimen_inferido: regimenInferido,
    reason_es: reasonEs,
    reason_en: reasonEn,
  };
}
