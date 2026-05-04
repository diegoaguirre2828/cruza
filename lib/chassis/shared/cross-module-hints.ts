// lib/chassis/shared/cross-module-hints.ts
// When a broker enters through a per-module scan (refunds, drawback, uflpa, etc.)
// instead of the universal /scan, surface hints about what OTHER modules could
// also fire on the same entries — and what additional data they'd need to fire.
//
// Same talking-to-each-other intent as the orchestrator, but at the per-module
// scan response level: a refunds-scan returns refunds output + hints like
// "drawback would also fire on these entries if you provide an export record."

export interface CrossModuleHint {
  module: 'refunds' | 'drawback' | 'pedimento' | 'cbam' | 'uflpa' | 'driver_pass';
  reason_en: string;
  reason_es: string;
  what_to_provide_en: string;
  what_to_provide_es: string;
  // Run-link hint: if the broker clicks "run universal scan against these entries,"
  // this is the input augmentation that would let the named module fire.
  augmentation_hint: 'add_exports' | 'add_supply_chain' | 'add_cbam_goods' | 'add_eori' | 'add_mexican_broker' | 'add_driver_trip';
}

interface HintInput {
  has_entries: boolean;
  entry_count: number;
  has_exports: boolean;
  has_supply_chain: boolean;
  has_cbam_goods: boolean;
  has_eori: boolean;
  has_mexican_broker: boolean;
  has_driver: boolean;
  htsus_codes: string[];
  countries_of_origin: string[];
  has_chinese_supply: boolean;
  any_duty_paid: boolean;
}

const UFLPA_PRIORITY_PREFIXES = [
  '52', '5208', '61', '62',                 // cotton + apparel
  '2804', '8541',                            // polysilicon + solar
  '0702', '2002',                            // tomatoes
  '8471', '8517', '8542',                    // electronics
  '8708',                                    // automotive
  '8507',                                    // batteries
  '76',                                      // aluminum
  '3904', '4002',                            // PVC + rubber
];

const CBAM_PREFIXES = [
  '2523', '72', '73', '76', '2808', '2814', '2834', '3102', '3105', '2716', '2804',
];

export function surfaceCrossModuleHints(
  context: 'from_refunds' | 'from_drawback' | 'from_uflpa' | 'from_cbam' | 'from_pedimento' | 'from_driver_pass',
  input: HintInput,
): CrossModuleHint[] {
  const hints: CrossModuleHint[] = [];

  const htsClean = input.htsus_codes.map((c) => c.replace(/\D/g, ''));
  const matchesUflpaSector = htsClean.some((h) =>
    UFLPA_PRIORITY_PREFIXES.some((p) => h.startsWith(p)),
  );
  const matchesCbamSector = htsClean.some((h) =>
    CBAM_PREFIXES.some((p) => h.startsWith(p)),
  );

  // ── Refunds context: what else fires on these import entries ────────────
  if (context === 'from_refunds' && input.has_entries) {
    if (!input.has_exports && input.any_duty_paid) {
      hints.push({
        module: 'drawback',
        reason_en: `These ${input.entry_count} import entr${input.entry_count === 1 ? 'y' : 'ies'} paid duty. If any were exported, used in manufacturing exports, or rejected/returned, §1313 drawback recovers 99% of those duties (5-yr window).`,
        reason_es: `Estas ${input.entry_count} entrada${input.entry_count === 1 ? '' : 's'} de importación pagaron arancel. Si alguna se exportó, usó en manufactura para exportación, o se rechazó/devolvió, drawback §1313 recupera 99% (ventana 5 años).`,
        what_to_provide_en: 'Export records (BOL or AES filing reference + export date + destination country) for any entries that left the US after import.',
        what_to_provide_es: 'Registros de exportación (BOL o referencia AES + fecha + país destino) para cualquier entrada que salió del US después del import.',
        augmentation_hint: 'add_exports',
      });
    }
    if (matchesUflpaSector && !input.has_supply_chain) {
      hints.push({
        module: 'uflpa',
        reason_en: `Your HTSUS codes match a CBP UFLPA priority sector. Even unliquidated entries can be detained at port of entry under the rebuttable-presumption rule.`,
        reason_es: `Tus códigos HTSUS coinciden con un sector prioritario UFLPA de CBP. Incluso entradas no liquidadas pueden detenerse en puerto bajo la presunción refutable.`,
        what_to_provide_en: 'Supply-chain map (tier 0 supplier name + country, plus upstream tiers if known). UFLPA detention happens BEFORE liquidation — trace upstream now.',
        what_to_provide_es: 'Mapa de cadena de suministro (proveedor tier 0 + país, y tiers upstream si conocidos). La detención UFLPA ocurre ANTES de liquidación — rastrea upstream ahora.',
        augmentation_hint: 'add_supply_chain',
      });
    }
    if (matchesCbamSector && !input.has_cbam_goods) {
      hints.push({
        module: 'cbam',
        reason_en: `Your HTSUS codes are in the CBAM in-scope list (steel / aluminum / cement / fertilizers / electricity / hydrogen). If you re-export these to the EU, CBAM certificates are required from Jan 1, 2026.`,
        reason_es: `Tus códigos HTSUS están en la lista CBAM en alcance (acero / aluminio / cemento / fertilizantes / electricidad / hidrógeno). Si re-exportas a la UE, los certificados CBAM son requeridos desde 1 ene 2026.`,
        what_to_provide_en: 'EU EORI number + producing installation details + embedded emissions data (verified or default values).',
        what_to_provide_es: 'Número EORI UE + detalles de instalación productora + datos de emisiones (verificados o valores default).',
        augmentation_hint: 'add_cbam_goods',
      });
    }
  }

  // ── Drawback context: what else fires ───────────────────────────────────
  if (context === 'from_drawback' && input.has_entries) {
    hints.push({
      module: 'refunds',
      reason_en: `Drawback recovers 99% of duties on exports. If any of those entries paid IEEPA tariffs (Chapter 99), the IEEPA refund track may also apply for the entries that DIDN'T get exported.`,
      reason_es: `Drawback recupera 99% sobre exportaciones. Si alguna de esas entradas pagó aranceles IEEPA (Cap 99), el track de reembolso IEEPA también aplica para las entradas que NO se exportaron.`,
      what_to_provide_en: 'ACE Entry Summary CSV — same entries you used for drawback, plus any unexported entries from the same period.',
      what_to_provide_es: 'CSV ACE Entry Summary — mismas entradas, más cualquier entrada no exportada del mismo periodo.',
      augmentation_hint: 'add_exports', // already have, but signals refund flows in same orchestrator pass
    });
    if (matchesUflpaSector && !input.has_supply_chain) {
      hints.push({
        module: 'uflpa',
        reason_en: `HTSUS in UFLPA priority sector. Drawback only recovers on imports that cleared CBP — UFLPA detention prevents the import from clearing in the first place.`,
        reason_es: `HTSUS en sector prioritario UFLPA. Drawback solo recupera sobre imports que limpiaron CBP — la detención UFLPA previene que el import limpie.`,
        what_to_provide_en: 'Supply-chain map for the imports.',
        what_to_provide_es: 'Mapa de cadena de suministro para los imports.',
        augmentation_hint: 'add_supply_chain',
      });
    }
  }

  // ── UFLPA context: what else fires ──────────────────────────────────────
  if (context === 'from_uflpa') {
    if (!input.has_entries) {
      hints.push({
        module: 'refunds',
        reason_en: `If those imports paid IEEPA tariffs and the supply-chain rebuttal cleared CBP, run the IEEPA refund track on the entries.`,
        reason_es: `Si esos imports pagaron aranceles IEEPA y la refutación de cadena limpió CBP, corre el track de reembolso IEEPA en las entradas.`,
        what_to_provide_en: 'ACE Entry Summary CSV.',
        what_to_provide_es: 'CSV ACE Entry Summary.',
        augmentation_hint: 'add_exports',
      });
    }
  }

  // ── CBAM context: what else fires ───────────────────────────────────────
  if (context === 'from_cbam' && !input.has_entries) {
    hints.push({
      module: 'refunds',
      reason_en: `If you imported those CBAM-scope goods to the US first (with IEEPA tariffs paid) before re-exporting to the EU, the IEEPA refund + drawback tracks both apply on the import side.`,
      reason_es: `Si importaste esos bienes CBAM al US primero (con aranceles IEEPA pagados) antes de re-exportar a la UE, los tracks IEEPA + drawback aplican del lado import.`,
      what_to_provide_en: 'ACE Entry Summary CSV for the original US imports + the EU export records.',
      what_to_provide_es: 'CSV ACE Entry Summary del import US original + registros de exportación UE.',
      augmentation_hint: 'add_exports',
    });
  }

  // ── Pedimento context: what else fires ──────────────────────────────────
  if (context === 'from_pedimento' && !input.has_entries) {
    hints.push({
      module: 'refunds',
      reason_en: `Cross-corridor flow: the same shipment that has a pedimento on the MX side may have an ACE Entry on the US side eligible for IEEPA refund / §1313 drawback.`,
      reason_es: `Flujo trans-corredor: el mismo envío con pedimento del lado MX puede tener un ACE Entry del lado US elegible para reembolso IEEPA / drawback §1313.`,
      what_to_provide_en: 'US ACE Entry Summary CSV for the shipment.',
      what_to_provide_es: 'CSV ACE Entry Summary US del envío.',
      augmentation_hint: 'add_exports',
    });
  }

  // ── Driver pass context: what else fires ────────────────────────────────
  if (context === 'from_driver_pass') {
    // Driver pass is per-trip; cross-references mostly tie to the operational shipment.
    // Surface a hint that connecting driver-pass to a Cruzar Ticket gives one signed
    // record across driver + customs + paperwork.
    hints.push({
      module: 'pedimento',
      reason_en: `If the driver is crossing south-bound with a commercial load, the same trip needs a pedimento composition on the MX side. Bundle them to compose one signed Ticket.`,
      reason_es: `Si el operador cruza hacia el sur con carga comercial, el mismo viaje necesita composición de pedimento del lado MX. Agruparlos compone un solo Ticket firmado.`,
      what_to_provide_en: 'Mexican broker patente + RFC + merchandise lines.',
      what_to_provide_es: 'Patente del agente aduanal + RFC + mercancías.',
      augmentation_hint: 'add_mexican_broker',
    });
  }

  return hints;
}
