// scripts/verify-uflpa-evaluator.mjs — UFLPA chassis fixtures
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { evaluateUflpa } = await import('../lib/chassis/uflpa/risk-flagger.ts');

const fx = JSON.parse(readFileSync(resolve(__dirname, '../data/uflpa/test-fixtures/evaluator-known-answers.json'), 'utf-8'));
const today = new Date(fx.today_iso);

let pass = 0, fail = 0;
const fails = [];
for (const c of fx.cases) {
  const r = evaluateUflpa(c.input, today);
  const e = c.expect;
  const fatalCount = r.findings.filter((f) => f.severity === 'fatal').length;
  const hasFindingId = e.has_finding_rule_id
    ? r.findings.some((f) => f.rule_id === e.has_finding_rule_id)
    : true;
  const sectorMatch = e.high_risk_sectors_includes === undefined ||
    r.high_risk_sectors_detected.includes(e.high_risk_sectors_includes);
  const ok =
    (e.risk_level === undefined || r.risk_level === e.risk_level) &&
    (e.rebuttable_presumption_triggered === undefined || r.rebuttable_presumption_triggered === e.rebuttable_presumption_triggered) &&
    (e.xinjiang_tier === undefined || r.xinjiang_tier === e.xinjiang_tier) &&
    (e.fatal_count === undefined || fatalCount === e.fatal_count) &&
    (e.fatal_count_at_least === undefined || fatalCount >= e.fatal_count_at_least) &&
    hasFindingId && sectorMatch;
  if (ok) pass++;
  else {
    fail++;
    fails.push({ name: c.name, got: { risk: r.risk_level, presumption: r.rebuttable_presumption_triggered, xinjiang_tier: r.xinjiang_tier, sectors: r.high_risk_sectors_detected, fatal: fatalCount, finding_ids: r.findings.map((f) => f.rule_id) }, want: e });
  }
}
console.log(`UFLPA evaluator: ${pass}/${fx.cases.length} pass`);
if (fail > 0) { console.error(JSON.stringify(fails, null, 2)); process.exit(1); }
console.log('PASS');
