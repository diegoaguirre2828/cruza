// scripts/verify-orchestrator.mjs — cross-module orchestrator fixtures
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { orchestrate } = await import('../lib/chassis/orchestrator.ts');

const fx = JSON.parse(readFileSync(resolve(__dirname, '../data/orchestrator/test-fixtures/multi-module-known-answers.json'), 'utf-8'));
const today = new Date(fx.today_iso);

let pass = 0, fail = 0;
const fails = [];

for (const c of fx.cases) {
  const r = await orchestrate(c.bundle, { skipScreening: true }, today);
  const e = c.expect;

  let ok = true;
  const reasons = [];

  if (e.modules_fired_includes) {
    for (const m of e.modules_fired_includes) {
      if (!r.modules_fired.includes(m)) { ok = false; reasons.push(`expected modules_fired to include ${m}`); }
    }
  }
  if (e.modules_skipped_includes) {
    for (const m of e.modules_skipped_includes) {
      if (!r.modules_skipped.some((s) => s.module === m)) { ok = false; reasons.push(`expected modules_skipped to include ${m}`); }
    }
  }
  if (e.modules_fired_count !== undefined && r.modules_fired.length !== e.modules_fired_count) {
    ok = false; reasons.push(`expected fired_count=${e.modules_fired_count}, got ${r.modules_fired.length}`);
  }
  if (e.modules_skipped_count_at_least !== undefined && r.modules_skipped.length < e.modules_skipped_count_at_least) {
    ok = false; reasons.push(`expected skipped>=${e.modules_skipped_count_at_least}, got ${r.modules_skipped.length}`);
  }
  for (const key of Object.keys(e)) {
    const m = key.match(/^cross_ref_for_entry_(\d+)_fires$/);
    if (m) {
      const entry = m[1];
      const ref = r.cross_references.find((x) => x.entry_number === entry);
      if (!ref) { ok = false; reasons.push(`no cross_ref for entry ${entry}`); continue; }
      for (const mod of e[key]) {
        if (!ref.fired_in_modules.includes(mod)) { ok = false; reasons.push(`entry ${entry} did not fire ${mod}`); }
      }
    }
    const m2 = key.match(/^cross_ref_for_entry_(\d+)_at_risk_(\w+)$/);
    if (m2) {
      const entry = m2[1];
      const flag = m2[2];
      const ref = r.cross_references.find((x) => x.entry_number === entry);
      if (!ref) { ok = false; reasons.push(`no cross_ref for entry ${entry}`); continue; }
      const flagKey = flag === 'cbam' ? 'cbam_in_scope' : flag === 'uflpa' ? 'uflpa_high' : flag;
      if (!ref.at_risk[flagKey]) { ok = false; reasons.push(`entry ${entry} not flagged at_risk.${flagKey}`); }
    }
  }
  if (e.totals_recoverable_above !== undefined && r.totals.recoverable_usd <= e.totals_recoverable_above) {
    ok = false; reasons.push(`expected recoverable>${e.totals_recoverable_above}, got ${r.totals.recoverable_usd}`);
  }
  if (e.totals_recoverable !== undefined && r.totals.recoverable_usd !== e.totals_recoverable) {
    ok = false; reasons.push(`expected recoverable=${e.totals_recoverable}, got ${r.totals.recoverable_usd}`);
  }
  if (e.cbam_cost_above !== undefined && r.totals.cbam_cost_eur <= e.cbam_cost_above) {
    ok = false; reasons.push(`expected cbam_cost>${e.cbam_cost_above}, got ${r.totals.cbam_cost_eur}`);
  }
  if (e.uflpa_high_risk_count_at_least !== undefined && r.totals.uflpa_high_risk_count < e.uflpa_high_risk_count_at_least) {
    ok = false; reasons.push(`expected uflpa_high>=${e.uflpa_high_risk_count_at_least}, got ${r.totals.uflpa_high_risk_count}`);
  }
  if (e.blocking_actions_required_at_least !== undefined && r.totals.blocking_actions_required < e.blocking_actions_required_at_least) {
    ok = false; reasons.push(`expected blocking>=${e.blocking_actions_required_at_least}, got ${r.totals.blocking_actions_required}`);
  }

  if (ok) pass++;
  else { fail++; fails.push({ name: c.name, reasons, got: { fired: r.modules_fired, skipped: r.modules_skipped.map((s) => s.module), totals: r.totals, cross_refs: r.cross_references } }); }
}

console.log(`Orchestrator: ${pass}/${fx.cases.length} pass`);
if (fail > 0) { console.error(JSON.stringify(fails, null, 2)); process.exit(1); }
console.log('PASS');
