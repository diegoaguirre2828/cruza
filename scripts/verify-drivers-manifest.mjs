import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { buildDriverComplianceManifest } = await import('../lib/chassis/drivers/composer.ts');

const set = JSON.parse(readFileSync(resolve(__dirname, '../data/drivers/test-cases.json'), 'utf-8'));

let passed = 0;
const failures = [];
for (const c of set.cases) {
  const got = buildDriverComplianceManifest(c.input);
  const e = c.expected;
  let ok = true;
  if (e.overall_status !== undefined && got.overall_status !== e.overall_status) ok = false;
  if (e.hos_compliant !== undefined && got.hos?.compliant !== e.hos_compliant) ok = false;
  if (e.imss_compliant !== undefined && got.imss?.compliant !== e.imss_compliant) ok = false;
  if (e.drug_testing_compliant !== undefined && got.drug_testing?.compliant !== e.drug_testing_compliant) ok = false;
  if (e.drayage_compliant !== undefined && got.drayage_classification?.compliant !== e.drayage_compliant) ok = false;
  if (e.usmca_compliant !== undefined && got.usmca_annex_31a?.compliant !== e.usmca_compliant) ok = false;
  if (e.drayage_recommendation !== undefined && got.drayage_classification?.classification_recommendation !== e.drayage_recommendation) ok = false;
  if (e.hos_divergence_flag !== undefined && got.hos?.divergence_flag !== e.hos_divergence_flag) ok = false;
  if (e.hos_break_required !== undefined && got.hos?.us_dot.rest_break_required !== e.hos_break_required) ok = false;
  if (ok) passed++;
  else failures.push({ id: c.id, label: c.label, got: { overall: got.overall_status, hos: got.hos?.compliant, imss: got.imss?.compliant, drug: got.drug_testing?.compliant, drayage: got.drayage_classification?.compliant, usmca: got.usmca_annex_31a?.compliant, drayage_rec: got.drayage_classification?.classification_recommendation, divergence: got.hos?.divergence_flag, break: got.hos?.us_dot.rest_break_required }, expected: e });
}
const pct = (passed / set.cases.length) * 100;
console.log(`Drivers manifest: ${passed}/${set.cases.length} = ${pct.toFixed(1)}%`);
if (failures.length > 0) for (const f of failures) console.log(`  x ${f.id} ${f.label}\n    got: ${JSON.stringify(f.got)}\n    expected: ${JSON.stringify(f.expected)}`);
if (pct < 98) { console.error(`FAIL: < 98%`); process.exit(1); }
console.log(`PASS: >= 98%`);
