// scripts/verify-isf-10-2.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { composeIsf10_2 } = await import('../lib/chassis/regulatory/isf-10-2.ts');
const set = JSON.parse(readFileSync(resolve(__dirname, '../data/regulatory/test-shipments.json'), 'utf-8'));

let passed = 0;
const failures = [];
for (const c of set.cases) {
  const got = composeIsf10_2(c.input);
  const isOcean = c.input.mode_of_transport === 'ocean';
  const expReq = c.expected.isf_required;
  let ok = got.required === expReq;
  if (isOcean && expReq) {
    const expectedDeadline = new Date(new Date(c.input.vessel_load_iso).getTime() - 24 * 3600 * 1000).toISOString();
    ok = ok && got.loading_deadline_iso === expectedDeadline
      && got.elements_complete.importer_count === 10
      && got.elements_complete.carrier_count === 2
      && typeof got.elements.country_of_origin === 'string' && got.elements.country_of_origin.length > 0
      && typeof got.elements.hts_6 === 'string' && got.elements.hts_6.length === 6;
  } else {
    ok = ok && got.loading_deadline_iso === null
      && got.elements_complete.importer_count === 0
      && got.elements_complete.carrier_count === 0;
  }
  if (ok) passed++; else failures.push({ id: c.id, label: c.label, isOcean, expReq, got });
}
const pct = (passed / set.cases.length) * 100;
console.log(`ISF 10+2: ${passed}/${set.cases.length} = ${pct.toFixed(1)}%`);
if (failures.length > 0) for (const f of failures) console.log(`  x ${f.id} ocean=${f.isOcean} expReq=${f.expReq} got=${JSON.stringify({required: f.got.required, deadline: f.got.loading_deadline_iso, hts6: f.got.elements.hts_6, count: f.got.elements_complete})}`);
if (pct < 100) { console.error('FAIL: < 100%'); process.exit(1); }
console.log('PASS: 100%');
