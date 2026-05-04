// lib/chassis/pedimento/registry.ts — VUCEM / pedimento statutory parameters
import { PedimentoRegistry } from './types';

const REGISTRY: PedimentoRegistry = {
  version: '2026-05-04',
  dta_rate: 0.008,                       // 0.8% Derecho de Trámite Aduanero (definitivo)
  prv_fixed_mxn: 290,                    // Prevalidación 2026 (~290 MXN, varies)
  iva_standard_rate: 0.16,
  iva_frontera_rate: 0.08,
  estatutos: {
    LIGIE: 'Ley de los Impuestos Generales de Importación y de Exportación (DOF 1-jul-2020 + actualizaciones)',
    LFCE: 'Ley Federal de Competencia Económica',
    RGCE: 'Reglas Generales de Comercio Exterior 2026',
    Anexo22: 'Anexo 22 RGCE — Apéndice 2 (claves de pedimento)',
  },
};

// Northern border zone where IVA is reduced to 8% (Decreto Estímulos Frontera Norte)
const FRONTERA_NORTE_ESTADOS = new Set([
  'NLE', 'TAM', 'BCN', 'COA', 'CHH', 'SON', 'NUEVO LEON', 'TAMAULIPAS', 'BAJA CALIFORNIA',
  'COAHUILA', 'CHIHUAHUA', 'SONORA',
]);

export function getPedimentoRegistry(): PedimentoRegistry {
  return REGISTRY;
}

export function isFronteraNorte(estado: string): boolean {
  return FRONTERA_NORTE_ESTADOS.has(estado.toUpperCase());
}
