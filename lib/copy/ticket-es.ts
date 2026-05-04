// lib/copy/ticket-es.ts
export const TICKET_ES = {
  // Chrome
  title: 'Cruzar Ticket',
  subtitle: 'Un registro firmado. Cada módulo transfronterizo. Verificable.',
  issued_at: 'Emitido',
  ticket_id: 'ID del Ticket',
  signature_valid: 'Firma válida',
  signature_invalid: 'Verificación falló',
  superseded_by: 'Reemplazado por',
  modules_present: 'Módulos compuestos',
  spec_link: 'Spec Cruzar Ticket v1',

  // Cross-references
  cross_refs_section: 'Referencias cruzadas — entries × módulos',
  cross_refs_intro: 'Cada entry muestra cada módulo que se disparó sobre él. Los entries multi-módulo son el substrato componiendo.',
  cross_ref_entry: 'Entry',
  cross_ref_fired_in: 'Disparó en',
  cross_ref_at_risk: 'En riesgo',

  // Shipment
  shipment_section: 'Envío',
  origin: 'Origen',
  destination: 'Destino',
  importer: 'Importador',
  bol_ref: 'Referencia BOL',
  carrier: 'Transportista',

  // Customs
  customs_section: 'Validación aduanal (lado US)',
  hs_classification: 'Clasificación HS',
  origin_status: 'Estado de origen',
  ligie_status: 'Estado LIGIE 2026',
  rvc_status: 'VCR',
  usmca_originating: 'USMCA originario',
  not_originating: 'No originario USMCA',
  ligie_affected: 'Afectado LIGIE',
  ligie_clear: 'LIGIE limpio',

  // Pedimento
  pedimento_section: 'Pedimento (lado MX)',
  pedimento_clave: 'Clave (Anexo 22)',
  pedimento_regimen: 'Régimen',
  pedimento_total_contribuciones: 'Total contribuciones',
  pedimento_fatal_findings: 'Hallazgos fatales',

  // Regulatory
  regulatory_section: 'Notificación pre-arribo',
  agencies_required: 'Agencias',
  earliest_deadline: 'Fecha límite más cercana',

  // Paperwork
  paperwork_section: 'Papelería extraída',
  documents: 'Documentos',
  blocking: 'Problemas bloqueantes',

  // Drivers operator
  drivers_section: 'Cumplimiento de operadores',
  overall_status: 'Estado general',
  checks_run: 'Validaciones',

  // Driver pass
  driver_pass_section: 'Pase del operador',
  driver_pass_readiness: 'Preparación',
  driver_pass_blocking: 'Documentos bloqueantes',
  driver_pass_expiring: 'Vencen en 30 días',

  // Refunds
  refunds_section: 'Composición reembolsos IEEPA',
  refunds_total_recoverable: 'Total recuperable',
  refunds_cape_eligible: 'Entries elegibles CAPE',
  refunds_protest_required: 'Protesta Form 19 requerida',
  refunds_registry_version: 'Versión del registro',

  // Drawback
  drawback_section: 'Composición drawback §1313',
  drawback_total_recoverable: 'Total drawback recuperable',
  drawback_manufacturing: 'Reclamos manufactura',
  drawback_unused: 'Reclamos sin-uso',
  drawback_rejected: 'Reclamos rechazo',
  drawback_accelerated: 'Pago acelerado elegible',

  // CBAM
  cbam_section: 'Composición CBAM UE',
  cbam_phase: 'Fase',
  cbam_in_scope: 'Mercancías en alcance',
  cbam_emissions: 'Total emisiones incrustadas (t CO2e)',
  cbam_certificates: 'Certificados requeridos',
  cbam_cost: 'Costo CBAM estimado',

  // UFLPA
  uflpa_section: 'Evaluación de riesgo UFLPA',
  uflpa_risk_level: 'Nivel de riesgo',
  uflpa_presumption: 'Presunción refutable',
  uflpa_xinjiang_tier: 'Tier de exposición Xinjiang',
  uflpa_evidence: 'Calidad de evidencia',

  // Audit + footer
  audit_shield: 'Escudo de auditoría',
  prior_disclosure: 'Elegible para divulgación previa (19 CFR § 162.74)',
  signing_key_id: 'Llave de firma',
  schema_version: 'Versión del esquema',
  disclaimer: 'Este Ticket es documentación operativa preparada por software Cruzar. Cruzar no es un agente aduanal licenciado; las presentaciones deben ser revisadas y enviadas por el agente / declarante licenciado responsable. La firma Ed25519 es verificable contra nuestra llave pública en /.well-known/cruzar-ticket-key.json.',
};
