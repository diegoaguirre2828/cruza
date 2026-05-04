// lib/chassis/pedimento/types.ts — Module 11 VUCEM / Mexican Pedimento chassis schemas
// Reference: Reglas Generales de Comercio Exterior (RGCE) 2026 + Anexo 22 (Apéndice 2 — claves de pedimento)

export type PedimentoClave =
  | 'A1'  // importación definitiva
  | 'A3'  // exportación definitiva
  | 'C1'  // retorno de mercancías importadas
  | 'C3'  // retorno de mercancías exportadas
  | 'F4'  // conversión a exportación virtual (A1 → F4 IMMEX)
  | 'I1'  // importación a depósito fiscal
  | 'K1'  // extracción de depósito fiscal
  | 'M3'  // tránsito internacional
  | 'T1'  // tránsito interno
  | 'V1'  // importación temporal definitiva
  | 'V5'  // importación temporal IMMEX
  | 'V6'  // retorno de importación temporal IMMEX
  | 'unknown';

export type OperacionAduanal = 'importacion' | 'exportacion' | 'transito' | 'retorno';

export type RegimenAduanero =
  | 'definitivo'
  | 'temporal'
  | 'deposito_fiscal'
  | 'transito'
  | 'recinto_fiscalizado_estrategico';

export type RegistroValidacion =
  | 'valido'
  | 'formato_invalido'
  | 'no_encontrado'
  | 'inactivo'
  | 'pendiente_verificacion';

export interface AgenteAduanal {
  patente: string;                 // 4-digit SAT-issued license
  nombre_o_razon_social: string;
  rfc: string;                     // 12 (legal entity) or 13 (persona física)
}

export interface ImportadorExportadorMx {
  rfc: string;
  razon_social: string;
  domicilio_fiscal_estado: string; // ISO ESP code (NLE, TAM, BCN…) or full state
  padron_importadores_activo: boolean;
  padron_sectorial?: string[];     // ['textil', 'siderurgia', 'cosmeticos', ...]
  programa_immex?: string;         // IMMEX registration number, if applicable
}

export interface MercanciaPedimento {
  fraccion_arancelaria: string;    // 8 digits LIGIE
  nico: string;                    // 2 digits (NICO suffix → 10-digit MX-tariff)
  descripcion: string;
  pais_origen: string;             // ISO alpha-2
  pais_vendedor: string;           // ISO alpha-2
  cantidad: number;
  unidad_medida_comercial: string; // KG, PZA, LTS, etc.
  valor_factura_usd: number;
  valor_dolares: number;
  ad_valorem_pct: number | null;   // arancel ad-valorem applicable
  iva_pct: number;                 // 16% standard, 8% border
  ieps_aplicable: boolean;
}

export interface OperacionInput {
  agente: AgenteAduanal;
  importador_exportador: ImportadorExportadorMx;
  operacion: OperacionAduanal;
  regimen: RegimenAduanero;
  aduana_codigo: string;           // 3-digit aduana entry (e.g., '470' Nuevo Laredo)
  fecha_operacion: string;         // ISO 8601
  mercancias: MercanciaPedimento[];
  forma_pago: 'efectivo' | 'cheque_certificado' | 'transferencia' | 'fianza';
  programa_certificacion?: 'OEA' | 'NEEC' | null;
}

export interface PedimentoClassification {
  clave_recomendada: PedimentoClave;
  regimen_inferido: RegimenAduanero;
  reason_es: string;
  reason_en: string;
}

export interface ValidationFinding {
  rule_id: string;                 // 'PED-F-001', 'PED-W-014', etc.
  severity: 'fatal' | 'warning' | 'info';
  field?: string;
  message_es: string;
  message_en: string;
}

export interface ImpuestosCalculados {
  base_gravable_usd: number;
  ad_valorem_usd: number;          // arancel ad valorem
  dta_usd: number;                 // Derecho de Trámite Aduanero (~0.8% on most operations)
  prv_usd: number;                 // Prevalidación
  iva_usd: number;                 // IVA on (base + ad_valorem + DTA + IEPS)
  ieps_usd: number;                // IEPS on applicable goods (alcohol, tobacco, etc.)
  total_contribuciones_usd: number;
}

export interface PedimentoComposition {
  clave: PedimentoClave;
  regimen: RegimenAduanero;
  agente_patente: string;
  importador_rfc: string;
  rfc_validacion: RegistroValidacion;
  patente_validacion: RegistroValidacion;
  padron_status: 'activo' | 'inactivo' | 'no_aplica';
  total_mercancias: number;
  total_valor_factura_usd: number;
  impuestos: ImpuestosCalculados;
  findings: ValidationFinding[];
  composed_at: string;
  registry_version: string;
}

export interface PedimentoRegistry {
  version: string;
  dta_rate: number;                // ~0.008 (definitivo) — varies by clave
  prv_fixed_mxn: number;           // prevalidación fee, fixed amount
  iva_standard_rate: number;       // 0.16
  iva_frontera_rate: number;       // 0.08 (region fronteriza norte)
  estatutos: {
    LIGIE: string;
    LFCE: string;
    RGCE: string;
    Anexo22: string;
  };
}
