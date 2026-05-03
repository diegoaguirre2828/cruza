// scripts/verify-fda-prior-notice.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { composeFdaPriorNotice } = await import('../lib/chassis/regulatory/fda-prior-notice.ts');
const set = JSON.parse(readFileSync(resolve(__dirname, '../data/regulatory/test-shipments.json'), 'utf-8'));

let passed = 0;
const failures = [];
for (const c of set.cases) {
  const got = composeFdaPriorNotice(c.input);
  const expReq = c.expected.fda_required;
  let ok = got.required === expReq;
  if (expReq) {
    const expectedDeadline = new Date(new Date(c.input.arrival_eta_iso).getTime() - 2 * 3600 * 1000).toISOString();
    ok = ok && got.arrival_deadline_iso === expectedDeadline && got.product_code !== null && got.manifest_notes.length > 0;
  } else {
    ok = ok && got.product_code === null && got.arrival_deadline_iso === null;
  }
  if (ok) passed++; else failures.push({ id: c.id, label: c.label, expReq, got });
}
const pct = (passed / set.cases.length) * 100;
console.log(`FDA Prior Notice: ${passed}/${set.cases.length} = ${pct.toFixed(1)}%`);
if (failures.length > 0) for (const f of failures) console.log(`  x ${f.id} expected fda_required=${f.expReq}, got required=${f.got.required} code=${f.got.product_code}`);
if (pct < 100) { console.error('FAIL: < 100%'); process.exit(1); }
console.log('PASS: 100%');
