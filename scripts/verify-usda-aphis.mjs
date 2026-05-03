// scripts/verify-usda-aphis.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { composeUsdaAphis } = await import('../lib/chassis/regulatory/usda-aphis.ts');
const set = JSON.parse(readFileSync(resolve(__dirname, '../data/regulatory/test-shipments.json'), 'utf-8'));

let passed = 0;
const failures = [];
for (const c of set.cases) {
  const got = composeUsdaAphis(c.input);
  const expReq = c.expected.usda_required;
  let ok = got.required === expReq;
  if (expReq) {
    const ch = c.input.hs.hts_10.slice(0, 2);
    ok = ok && got.forms_applicable.length >= 1 && got.forms_applicable.includes('PPQ_587');
    if (ch === '44') ok = ok && got.fields.treatment_required === 'heat';
    if (['06','07','08','12','14'].includes(ch)) ok = ok && got.forms_applicable.includes('PPQ_925');
    if (['09','10','44'].includes(ch)) ok = ok && !got.forms_applicable.includes('PPQ_925');
  } else {
    ok = ok && got.forms_applicable.length === 0;
  }
  if (ok) passed++; else failures.push({ id: c.id, label: c.label, expReq, got });
}
const pct = (passed / set.cases.length) * 100;
console.log(`USDA APHIS: ${passed}/${set.cases.length} = ${pct.toFixed(1)}%`);
if (failures.length > 0) for (const f of failures) console.log(`  x ${f.id} expReq=${f.expReq}, got req=${f.got.required} forms=${JSON.stringify(f.got.forms_applicable)} treatment=${f.got.fields.treatment_required}`);
if (pct < 100) { console.error('FAIL: < 100%'); process.exit(1); }
console.log('PASS: 100%');
