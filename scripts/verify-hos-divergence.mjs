import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { checkHos } = await import('../lib/chassis/drivers/hos-divergence.ts');

const set = JSON.parse(readFileSync(resolve(__dirname, '../data/drivers/test-cases.json'), 'utf-8'));
const filtered = set.cases.filter(c => c.expected.hos_compliant !== undefined || c.expected.hos_divergence_flag !== undefined || c.expected.hos_break_required !== undefined);

let passed = 0;
const failures = [];
for (const c of filtered) {
  const got = checkHos(c.input);
  const e = c.expected;
  let ok = true;
  if (e.hos_compliant !== undefined && got.compliant !== e.hos_compliant) ok = false;
  if (e.hos_divergence_flag !== undefined && got.divergence_flag !== e.hos_divergence_flag) ok = false;
  if (e.hos_break_required !== undefined && got.us_dot.rest_break_required !== e.hos_break_required) ok = false;
  if (ok) passed++; else failures.push({ id: c.id, label: c.label, got: { compliant: got.compliant, divergence: got.divergence_flag, break: got.us_dot.rest_break_required }, expected: e });
}
const pct = filtered.length > 0 ? (passed / filtered.length) * 100 : 100;
console.log(`HOS: ${passed}/${filtered.length} = ${pct.toFixed(1)}%`);
if (failures.length > 0) for (const f of failures) console.log(`  x ${f.id} ${f.label}: got ${JSON.stringify(f.got)}; expected ${JSON.stringify(f.expected)}`);
if (pct < 100) { console.error(`FAIL: < 100%`); process.exit(1); }
console.log(`PASS: 100%`);
