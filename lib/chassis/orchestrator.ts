// lib/chassis/orchestrator.ts
// Cross-module composition. Takes ONE ShipmentBundle, runs every chassis composer
// the bundle has enough data for, returns a unified MultiModuleComposition with:
//   - per-module composition results (refunds, drawback, pedimento, cbam, uflpa, driver_pass)
//   - cross-references: which entries fired in which modules (the "talking" surface)
//   - aggregate totals: total_recoverable_usd / total_at_risk_usd / total_findings
//
// This is the structural fix for the silos-in-one-place critique. A single intake
// fans out across the surround. The result composes ONE Cruzar Ticket with
// every applicable module's block.

import {
  ShipmentBundle,
  bundleToRefundsInput,
  bundleToDrawbackInput,
  bundleToPedimentoInput,
  bundleToCbamInput,
  bundleToUflpaInput,
  bundleToDriverPassInput,
} from './shared/shipment-bundle';
import { composeRefund } from './refunds/composer';
import { composeDrawback } from './drawback/composer';
import { composePedimento } from './pedimento/composer';
import { composeCbam } from './cbam/composer';
import { evaluateUflpa } from './uflpa/risk-flagger';
import { composeDriverPass } from './driver-pass/composer';
import type { RefundComposition } from './refunds/types';
import type { DrawbackComposition } from './drawback/types';
import type { PedimentoComposition } from './pedimento/types';
import type { CbamComposition } from './cbam/types';
import type { UflpaComposition } from './uflpa/types';
import type { DriverPassComposition } from './driver-pass/types';

export type ModuleKey =
  | 'refunds' | 'drawback' | 'pedimento' | 'cbam' | 'uflpa' | 'driver_pass';

export interface PerEntryCrossRef {
  entry_number: string;
  fired_in_modules: ModuleKey[];          // every module that processed this entry
  recoverable_usd: number;                // sum across refunds + drawback designations on this entry
  at_risk: { uflpa_high: boolean; cbam_in_scope: boolean };
}

export interface MultiModuleComposition {
  bundle_id: string;
  composed_at: string;
  modules_fired: ModuleKey[];             // in order of severity (revenue first, risk second)
  modules_skipped: Array<{ module: ModuleKey; reason: string }>;
  // Per-module compositions — only present when the module fired
  refunds?: RefundComposition;
  drawback?: DrawbackComposition;
  pedimento?: PedimentoComposition;
  cbam?: CbamComposition;
  uflpa?: UflpaComposition;
  driver_pass?: DriverPassComposition;
  // Cross-module aggregates
  cross_references: PerEntryCrossRef[];
  totals: {
    recoverable_usd: number;              // refunds.total_recoverable + drawback.total_drawback_recoverable
    estimated_fee_usd: number;             // refunds.estimated_fee + drawback.estimated_fee
    estimated_net_to_you_usd: number;
    cbam_cost_eur: number;
    uflpa_high_risk_count: number;
    fatal_findings: number;
    blocking_actions_required: number;
  };
}

export interface OrchestrateOptions {
  /** Skip OFAC SDN screening on refunds (used by public scanner with synthetic profile). */
  skipScreening?: boolean;
}

export async function orchestrate(
  bundle: ShipmentBundle,
  options: OrchestrateOptions = {},
  today: Date = new Date(),
): Promise<MultiModuleComposition> {
  const composedAt = today.toISOString();
  const modulesFired: ModuleKey[] = [];
  const modulesSkipped: MultiModuleComposition['modules_skipped'] = [];

  let refunds: RefundComposition | undefined;
  let drawback: DrawbackComposition | undefined;
  let pedimento: PedimentoComposition | undefined;
  let cbam: CbamComposition | undefined;
  let uflpa: UflpaComposition | undefined;
  let driver_pass: DriverPassComposition | undefined;

  // ── Refunds (US IEEPA refund recovery) ─────────────────────────────────
  const refundsIn = bundleToRefundsInput(bundle);
  if (refundsIn) {
    refunds = await composeRefund(refundsIn.entries, refundsIn.ior, today, {
      skipScreening: options.skipScreening,
    });
    modulesFired.push('refunds');
  } else {
    modulesSkipped.push({ module: 'refunds', reason: 'no entries with entry_number + liquidation_status' });
  }

  // ── Drawback (US §1313) ────────────────────────────────────────────────
  const drawbackIn = bundleToDrawbackInput(bundle);
  if (drawbackIn) {
    drawback = composeDrawback(drawbackIn, today);
    modulesFired.push('drawback');
  } else {
    modulesSkipped.push({ module: 'drawback', reason: 'need at least one entry + one export' });
  }

  // ── Pedimento (MX VUCEM) ───────────────────────────────────────────────
  const pedimentoIn = bundleToPedimentoInput(bundle);
  if (pedimentoIn) {
    pedimento = composePedimento(pedimentoIn, today);
    modulesFired.push('pedimento');
  } else {
    modulesSkipped.push({ module: 'pedimento', reason: 'need mexican_broker + importer.rfc + pedimento_mercancias' });
  }

  // ── CBAM (EU carbon) ───────────────────────────────────────────────────
  const cbamIn = bundleToCbamInput(bundle);
  if (cbamIn) {
    cbam = composeCbam(cbamIn, today);
    modulesFired.push('cbam');
  } else {
    modulesSkipped.push({ module: 'cbam', reason: 'need cbam_goods + importer.eori' });
  }

  // ── UFLPA (US forced-labor risk) ───────────────────────────────────────
  const uflpaIn = bundleToUflpaInput(bundle);
  if (uflpaIn) {
    uflpa = evaluateUflpa(uflpaIn, today);
    modulesFired.push('uflpa');
  } else {
    modulesSkipped.push({ module: 'uflpa', reason: 'need supply_chain map' });
  }

  // ── Driver Pass (per-trip readiness) ───────────────────────────────────
  const driverPassIn = bundleToDriverPassInput(bundle);
  if (driverPassIn) {
    driver_pass = composeDriverPass(driverPassIn, today);
    modulesFired.push('driver_pass');
  } else {
    modulesSkipped.push({ module: 'driver_pass', reason: 'need driver + trip + docs' });
  }

  // ── Cross-module references — per-entry rollup ─────────────────────────
  const crossRefMap = new Map<string, PerEntryCrossRef>();
  function ensureRef(entryNumber: string): PerEntryCrossRef {
    let r = crossRefMap.get(entryNumber);
    if (!r) {
      r = { entry_number: entryNumber, fired_in_modules: [], recoverable_usd: 0, at_risk: { uflpa_high: false, cbam_in_scope: false } };
      crossRefMap.set(entryNumber, r);
    }
    return r;
  }

  if (refunds) {
    // Every entry the broker brought to refunds appears here
    for (const e of refundsIn?.entries ?? []) {
      const ref = ensureRef(e.entry_number);
      if (!ref.fired_in_modules.includes('refunds')) ref.fired_in_modules.push('refunds');
    }
    // Recoverable: total / num_eligible amortized per CAPE-eligible entry
    const eligibleCount = refunds.cape_eligible_count + refunds.protest_required_count;
    const perEntry = eligibleCount > 0 ? refunds.total_recoverable_usd / eligibleCount : 0;
    for (const e of refundsIn?.entries ?? []) {
      const ref = ensureRef(e.entry_number);
      ref.recoverable_usd += perEntry;
    }
  }
  if (drawback) {
    for (const d of drawback.designations) {
      const ref = ensureRef(d.entry_number);
      if (!ref.fired_in_modules.includes('drawback')) ref.fired_in_modules.push('drawback');
      if (d.claim_type !== 'ineligible') {
        ref.recoverable_usd += d.refund_basis_usd * 0.99;
      }
    }
  }
  if (uflpa?.rebuttable_presumption_triggered) {
    // UFLPA risk applies at shipment level — flag every entry on the bundle
    for (const e of bundle.entries) {
      if (e.entry_number) {
        const ref = ensureRef(e.entry_number);
        if (!ref.fired_in_modules.includes('uflpa')) ref.fired_in_modules.push('uflpa');
        ref.at_risk.uflpa_high = true;
      }
    }
  }
  if (cbam && cbam.in_scope_count > 0) {
    for (const e of bundle.entries) {
      if (e.entry_number) {
        const ref = ensureRef(e.entry_number);
        if (!ref.fired_in_modules.includes('cbam')) ref.fired_in_modules.push('cbam');
        ref.at_risk.cbam_in_scope = true;
      }
    }
  }

  // Round per-entry recoverable
  const cross_references = [...crossRefMap.values()].map((r) => ({
    ...r,
    recoverable_usd: Math.round(r.recoverable_usd * 100) / 100,
  }));

  // ── Aggregate totals ───────────────────────────────────────────────────
  const recoverable =
    (refunds?.total_recoverable_usd ?? 0) +
    (drawback?.total_drawback_recoverable_usd ?? 0);
  const fee =
    (refunds?.estimated_cruzar_fee_usd ?? 0) +
    (drawback?.estimated_cruzar_fee_usd ?? 0);

  const fatalFindings =
    (pedimento?.findings.filter((f) => f.severity === 'fatal').length ?? 0) +
    (cbam?.findings.filter((f) => f.severity === 'fatal').length ?? 0) +
    (uflpa?.findings.filter((f) => f.severity === 'fatal').length ?? 0);

  const blockingActions =
    (driver_pass?.blocking_doc_count ?? 0) +
    (uflpa?.rebuttable_presumption_triggered ? 1 : 0) +
    (pedimento?.padron_status === 'inactivo' ? 1 : 0);

  return {
    bundle_id: bundle.bundle_id,
    composed_at: composedAt,
    modules_fired: modulesFired,
    modules_skipped: modulesSkipped,
    refunds,
    drawback,
    pedimento,
    cbam,
    uflpa,
    driver_pass,
    cross_references,
    totals: {
      recoverable_usd: Math.round(recoverable * 100) / 100,
      estimated_fee_usd: Math.round(fee * 100) / 100,
      estimated_net_to_you_usd: Math.round((recoverable - fee) * 100) / 100,
      cbam_cost_eur: cbam?.estimated_cbam_cost_eur ?? 0,
      uflpa_high_risk_count: uflpa?.risk_level === 'high' ? 1 : 0,
      fatal_findings: fatalFindings,
      blocking_actions_required: blockingActions,
    },
  };
}
