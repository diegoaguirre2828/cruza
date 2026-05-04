// scripts/verify-cbam-composer.mjs — CBAM chassis fixtures
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { composeCbam } = await import('../lib/chassis/cbam/composer.ts');

const fx = JSON.parse(readFileSync(resolve(__dirname, '../data/cbam/test-fixtures/composer-known-answers.json'), 'utf-8'));
const today = new Date(fx.today_iso);

let pass = 0, fail = 0;
const fails = [];
for (const c of fx.cases) {
  const r = composeCbam(c.input, today);
  const e = c.expect;
  const fatalCount = r.findings.filter((f) => f.severity === 'fatal').length;
  const hasFindingId = e.has_finding_rule_id
    ? r.findings.some((f) => f.rule_id === e.has_finding_rule_id)
    : true;
  const ok =
    (e.in_scope_count === undefined || r.in_scope_count === e.in_scope_count) &&
    (e.out_of_scope_count === undefined || r.out_of_scope_count === e.out_of_scope_count) &&
    (e.total_mass_tonnes === undefined || Math.abs(r.total_mass_tonnes - e.total_mass_tonnes) < 0.01) &&
    (e.total_embedded_emissions_t_co2 === undefined || Math.abs(r.total_embedded_emissions_t_co2 - e.total_embedded_emissions_t_co2) < 0.5) &&
    (e.phase === undefined || r.phase === e.phase) &&
    (e.certificates_required === undefined || r.certificates_required === e.certificates_required) &&
    (e.fatal_count === undefined || fatalCount === e.fatal_count) &&
    (e.fatal_count_at_least === undefined || fatalCount >= e.fatal_count_at_least) &&
    hasFindingId;
  if (ok) pass++;
  else {
    fail++;
    fails.push({ name: c.name, got: { in_scope: r.in_scope_count, out_of_scope: r.out_of_scope_count, mass: r.total_mass_tonnes, emis: r.total_embedded_emissions_t_co2, phase: r.phase, certs: r.certificates_required, fatal: fatalCount, finding_ids: r.findings.map((f) => f.rule_id) }, want: e });
  }
}
console.log(`CBAM composer: ${pass}/${fx.cases.length} pass`);
if (fail > 0) { console.error(JSON.stringify(fails, null, 2)); process.exit(1); }
console.log('PASS');
