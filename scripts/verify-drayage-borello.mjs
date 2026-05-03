import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { checkDrayageClassification } = await import('../lib/chassis/drivers/drayage-1099.ts');

const set = JSON.parse(readFileSync(resolve(__dirname, '../data/drivers/test-cases.json'), 'utf-8'));
const filtered = set.cases.filter(c => c.expected.drayage_compliant !== undefined || c.expected.drayage_recommendation !== undefined);

let passed = 0;
const failures = [];
for (const c of filtered) {
  const got = checkDrayageClassification(c.input);
  const e = c.expected;
  let ok = true;
  if (e.drayage_compliant !== undefined && got.compliant !== e.drayage_compliant) ok = false;
  if (e.drayage_recommendation !== undefined && got.classification_recommendation !== e.drayage_recommendation) ok = false;
  if (ok) passed++; else failures.push({ id: c.id, label: c.label, got: { compliant: got.compliant, rec: got.classification_recommendation, score: got.borello_score }, expected: e });
}
const pct = filtered.length > 0 ? (passed / filtered.length) * 100 : 100;
console.log(`Drayage Borello: ${passed}/${filtered.length} = ${pct.toFixed(1)}%`);
if (failures.length > 0) for (const f of failures) console.log(`  x ${f.id} ${f.label}: got ${JSON.stringify(f.got)}; expected ${JSON.stringify(f.expected)}`);
if (pct < 100) { console.error(`FAIL: < 100%`); process.exit(1); }
console.log(`PASS: 100%`);
