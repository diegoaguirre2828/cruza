import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { validateOrigin } = await import('../lib/chassis/customs/origin-validator.ts');

const set = JSON.parse(readFileSync(resolve(__dirname, '../data/customs/origin-test-cases.json'), 'utf-8'));

let passed = 0;
const failures = [];
for (const c of set.cases) {
  const got = validateOrigin(c.input.shipment, c.input.product_hs_chapter);
  const usmcaOk = got.usmca_originating === c.expected.usmca_originating;
  const ligieOk = got.ligie.affected === c.expected.ligie_affected;
  const ok = usmcaOk && ligieOk;
  if (ok) passed++; else failures.push({ id: c.id, label: c.label, got_usmca: got.usmca_originating, got_ligie: got.ligie.affected, expected: c.expected });
}

const pct = (passed / set.cases.length) * 100;
console.log(`Origin validator: ${passed}/${set.cases.length} = ${pct.toFixed(1)}%`);
if (failures.length > 0) for (const f of failures) console.log(`  ✗ ${f.id} ${f.label}\n    got usmca=${f.got_usmca} ligie=${f.got_ligie}; expected usmca=${f.expected.usmca_originating} ligie=${f.expected.ligie_affected}`);
if (pct < 98) { console.error(`FAIL: < 98%`); process.exit(1); }
console.log(`PASS: ≥ 98%`);
